'use strict';

const cp = require('child_process')
const Package = require('@hhs-cli-dev/package')
const log = require('@hhs-cli-dev/log')
const { exec: spawn } = require('@hhs-cli-dev/utils')
const path = require("path");

const SETTINGS = {
    init: '@hhs-cli/init'
}
const CACHE_DIR = 'dependencies'

async function exec() {
    let pkg
    let storeDir = ''
    let targetPath = process.env.CLI_TARGET_PATH
    const homePath = process.env.CLI_HOME_PATH
    log.verbose('targetPath:', targetPath)
    log.verbose('homePath:', homePath)

    const cmdObj = arguments[arguments.length - 1]
    const cmdName = cmdObj.name()
    const packageName = SETTINGS[cmdName]
    const packageVersion = 'latest'

    if (!targetPath) {
        // 生成缓存目录
        targetPath = path.resolve(homePath, CACHE_DIR)
        storeDir = path.resolve(targetPath, 'node_modules')
        log.verbose(targetPath)
        log.verbose(storeDir)

        pkg = new Package({
            targetPath,
            packageName,
            packageVersion,
            storeDir
        })
        if (await pkg.exists()) {
            await pkg.update()
        } else {
           await pkg.install()
        }
    } else {
        pkg = new Package({
            targetPath,
            packageName,
            packageVersion,
        })
    }
    const rootFile = pkg.getRootFilePath()
    if (rootFile) {
        try {
            const args = Array.from(arguments)
            const o = Object.create(null)
            const cmd = args[args.length - 1]

            Object.keys(cmd).forEach(key => {
                if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
                    o[key] = cmd[key]
                }
            })

            args[args.length - 1] = o
            const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`
            const child = spawn('node', ['-e', code], {
                cwd: process.cwd(),
                stdio: 'inherit'
            })
            child.on('error', e => {
                log.error(e.message)
                process.exit(1)
            })
            child.on('exit', e => {
                log.verbose('命令执行成功' + e)
                process.exit(e)
            })
        } catch (e) {
            log.error(e.message)
        }
    }

}

module.exports = exec;
