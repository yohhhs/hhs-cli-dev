'use strict';

module.exports = core;

// require 默认支撑.js/.json/.node文件
// .js -> 通过module.exports / exports
// .json -> 通过JSON.parse
// 其他文件默认按照.js形势解析
const path = require('path')
const semver = require('semver') // 版本号对比
const colors = require('colors/safe') // 控制台颜色
const userHome = require('user-home') // 获取用户主目录
const pathExists = require('path-exists').sync // 判断目录是否存在
const commander = require('commander')

const log = require('@hhs-cli-dev/log')
const init = require('@hhs-cli-dev/init')
const exec = require('@hhs-cli-dev/exec')

const constant = require('./const')
const pkg = require('../package.json')

const program = new commander.Command(); // 实例化脚手架对象

async function core() {
    try {
        await prepare();
        registerCommand();
        // log.verbose('debug', '--------')
    } catch (e) {
        log.error(e.message)
        if (program.debug) {
            console.log(e);
        }
    }

}

function registerCommand() {
    // option默认值为boolean，需要尖括号或者中括号
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d --debug', '是否开启debug模式', false)
        .option('-tp --targetPath <targetPath>', '是否指定本地调试文件路径', '');

    program
        .command('init [projectName]')
        .option('-f --force', '是否强制初始化项目')
        .action(exec);

    program.on('option:debug', () => {
        const { debug } = program.opts()
        log.level = process.env.LOG_LEVEL = debug ? 'verbose' : 'info'
        log.verbose('debug模式开启')
    })
    program.on('option:targetPath', () => {
        const { targetPath } = program.opts()
        process.env.CLI_TARGET_PATH = targetPath
    })
    program.on('command:*', obj => {
        const availableCommands = program.commands.map(cmd => cmd.name());
        console.log(colors.red(`未知的命令：${obj[0]}`));
        // console.log(availableCommands)
    })

    program.parse(process.argv)
    if (program.args?.length === 0) {
        program.outputHelp()
    }
}

async function prepare() {
    checkPkgVersion();
    // checkNodeVersion();
    checkRoot();
    checkUserHome();
    checkEnv();
    await checkGlobalUpdate();
}

async function checkGlobalUpdate() {
    const currentVersion = pkg.version
    const npmName = pkg.name
    const { getNpmSemverVersions } = require('@hhs-cli-dev/get-npm-info')
    const lastVersion = await getNpmSemverVersions(currentVersion, npmName)
    if (lastVersion && semver.gt(lastVersion, currentVersion)) {
        log.warn(colors.yellow('请更新脚手架'))
    }
}
// 检查环境变量
function checkEnv() {
    const dotenv = require('dotenv')
    const dotenvPath = path.resolve(userHome, '.env')
    if (pathExists(dotenvPath)) {
        dotenv.config({
            path: dotenvPath
        })
    }
    createDefaultConfig()
}
function createDefaultConfig() {
    const cliConfig = {
        home: userHome
    }
    if (process.env.CLI_HOME) {
        cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
    } else {
        cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome
    // return cliConfig
}
/*// 获取args参数开启debug
function checkInputArgs() {
    const minimist = require('minimist')
    args = minimist(process.argv.slice(2))
    checkArgs()
}
function checkArgs() {
    process.env.LOG_LEVEL = args.debug ? 'verbose' : 'info';
    log.level = process.env.LOG_LEVEL
}*/

function checkUserHome() {
    if (!userHome || !pathExists(userHome)) {
        throw new Error('用户主目录不存在')
    }
}
// 检查root权限并降级
function checkRoot() {
    const rootCheck = require('root-check');
    rootCheck()
}
// 检查node版本
function checkNodeVersion() {
    // 获取当前版本号
    const currentVersion = process.version
    // 获取最低版本号
    const lowestVersion = constant.LOWEST_NODE_VERSION
    if (!semver.gte(currentVersion, lowestVersion)) {
        throw new Error(colors.red(`cli需要安装${lowestVersion}以上版本的node`))
    }
}
// 检查当前脚手架版本号
function checkPkgVersion() {
    log.success('cli', pkg.version)
}
