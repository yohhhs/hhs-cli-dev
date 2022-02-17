'use strict';

const semver = require('semver') // 版本号对比
const colors = require('colors/safe') // 控制台颜色

const log = require('@hhs-cli-dev/log')

const LOWEST_NODE_VERSION = '12.0.0'

class Command {
    constructor(argv) {
        if (!argv || !Array.isArray(argv)) {
            log.error('argv参数不正确')
        }
        this._argv = argv
        let runner = new Promise((resolve, reject) => {
            let chain = Promise.resolve()
            chain = chain.then(() => this.checkNodeVersion())
            chain = chain.then(() => this.initArgs())
            chain = chain.then(() => this.init())
            chain = chain.then(() => this.exec())
            chain.catch(e => {
                log.error(e.message)
            })
        })
    }
    initArgs() {
        this._cmd = this._argv[this._argv.length - 1]
        this._argv = this._argv.slice(0, this._argv.length - 1)
    }
    checkNodeVersion() {
        // 获取当前版本号
        const currentVersion = process.version
        // 获取最低版本号
        const lowestVersion = LOWEST_NODE_VERSION
        if (!semver.gte(currentVersion, lowestVersion)) {
            throw new Error(colors.red(`cli需要安装${lowestVersion}以上版本的node`))
        }
    }
    init() {
        throw new Error('init 必须实现')
    }
    exec() {
        throw new Error('exec 必须实现')
    }
}
module.exports = Command;
