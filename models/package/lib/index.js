'use strict';

const fse = require('fs-extra')
const pkgDir = require('pkg-dir').sync
const pathExists = require('path-exists').sync
const path = require('path')
const npmInstall = require('npminstall')

const { isObject } = require('@hhs-cli-dev/utils')
const formatPath = require('@hhs-cli-dev/format-path')
const { getDefaultRegistry, getNpmLatestVersion } = require('@hhs-cli-dev/get-npm-info')

class Package {
    constructor(options) {
        if (!isObject(options)) {
            throw new Error('Package类的options参数必须为对象')
        }
        // package路径
        this.targetPath = options.targetPath
        this.storeDir = options.storeDir
        // package本地存储路径
        // this.storePath = options.storePath
        this.packageName = options.packageName
        this.packageVersion = options.packageVersion

        this.cacheFilePathPrefix = this.packageName.replace('/', '_')
    }

    get cacheFilePath() {
        return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
    }

    getSpecificCacheFilePath(packageVersion) {
        return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
    }

    async prepare() {
        if (this.storeDir && !pathExists(this.storeDir)) {
            fse.mkdirpSync(this.storeDir)
        }
        if (this.packageVersion === 'latest') {
            this.packageVersion = await getNpmLatestVersion(this.packageName)
        }
    }
    // 判断当前package是否存在
    async exists() {
        if (this.storeDir) {
            await this.prepare()
            return pathExists(this.cacheFilePath)
        } else {
            return pathExists(this.targetPath)
        }
    }

    // 安装package
    async install() {
        await this.prepare()
        return npmInstall({
            root: this.targetPath,
            storeDir: this.storeDir,
            registry: getDefaultRegistry(),
            pkgs: [{
                name: this.packageName,
                version: this.packageVersion
            }]
        })
    }
    async update() {
        await this.prepare()
        const latestPackageVersion = await getNpmLatestVersion(this.packageName)
        const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
        if (!pathExists(latestFilePath)) {
            await npmInstall({
                root: this.targetPath,
                storeDir: this.storeDir,
                registry: getDefaultRegistry(),
                pkgs: [{
                    name: this.packageName,
                    version: latestPackageVersion
                }]
            })
            this.packageVersion = latestPackageVersion
        } else {
            this.packageVersion = latestPackageVersion
        }
        // return latestFilePath
    }
    // 获取入口文件路径
    getRootFilePath() {
        function _getRootFile(targetPath) {
            const dir = pkgDir(targetPath)
            if (dir) {
                // /d/learn/hhs-cli-dev/commands/init/lib
                const pkgFile = require(path.resolve(dir, 'package.json'))
                if (pkgFile?.main) {
                    return formatPath(path.resolve(dir, pkgFile.main))
                }
            }
            return null
        }
        if (this.storeDir) {
            return _getRootFile(this.cacheFilePath)
        } else {
            return _getRootFile(this.targetPath)
        }

    }
}

module.exports = Package;