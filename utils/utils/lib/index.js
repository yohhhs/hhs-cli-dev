'use strict';

const cp = require("child_process");

function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]'
}
function spinnerStart(loadingStr = 'loading..') {
    const Spinner = require('cli-spinner').Spinner
    const spinner = new Spinner(`${loadingStr}%s`)
    spinner.setSpinnerString('|/-\\')
    spinner.start()
    return spinner
}
function exec(command, args, options) {
    const win32 = process.platform === 'win32'
    const cmd = win32 ? 'cmd' : command
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args

    return require('child_process').spawn(cmd, cmdArgs, options || {})
}
function execAsync(command, args, options) {
    return new Promise((resolve, reject) => {
        const p = exec(command, args, options)
        p.on('error', e => reject(e))
        p.on('exit', c => resolve(c))
    })
}
module.exports = {
    isObject,
    spinnerStart,
    exec,
    execAsync
}