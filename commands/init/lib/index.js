'use strict';

const fs = require('fs')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const semver = require('semver')
const userHome = require('user-home')
const ejs = require('ejs')
const glob = require('glob')
const Command = require('@hhs-cli-dev/command')
const log = require('@hhs-cli-dev/log')
const Package = require('@hhs-cli-dev/package')
const { spinnerStart, execAsync } = require('@hhs-cli-dev/utils')
const getProjectTemplate = require('./getProjectTemplate')
const path = require("path");

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || ''
        this.force = this._argv[1].force
    }
    async exec() {
        // 1.准备阶段
        try {
            const projectInfo = await this.prepare()
            if (projectInfo) {
                this.projectInfo = projectInfo
                log.verbose('projectInfo', projectInfo)
                // 2.下载模板
                await this.downloadTemplate()
                // 安装模板
                await this.installTemplate()
            }
        } catch (e) {
            log.error(e.message)
        }

        // 3.安装模板
    }
    async installTemplate() {
        if (this.templateInfo) {
            if (!this.templateInfo.type) {
                this.templateInfo.type = TEMPLATE_TYPE_NORMAL
            }
            if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
                await this.installNormalTemplate()
            } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
                await this.installCustomTemplate()
            } else {
                throw new Error('无法识别项目模板类型')
            }
        } else {
            throw new Error('项目模板信息不存在')
        }
    }
    async execCommand(command, errMsg) {
        let installRet;
        if (command) {
            const installCmd = command.split(' ')
            const cmd = installCmd[0]
            const args = installCmd.slice(1)
            installRet = await execAsync(cmd, args, {
                stdio: 'inherit',
                cwd: process.cwd()
            })
        }
        if (installRet !== 0) {
            throw new Error(errMsg)
        }
        return installRet
    }
    async ejsRender(ignore) {
        const dir = process.cwd()
        console.log(dir)
        return new Promise((resolve, reject) => {
            glob('**', {
                cwd: dir,
                ignore,
                nodir: true
            }, (err, files) => {
                if (err) {
                    resolve(err)
                }
                Promise.all(files.map(file => {
                    const filePath = path.join(dir, file)
                    return new Promise((resolve1, reject1) => {
                        ejs.renderFile(filePath, this.projectInfo, {}, (err, result) => {
                            if (err) {
                                reject1(err)
                            } else {
                                fs.writeFileSync(filePath, result)
                                resolve1(result)
                            }
                        })
                    })
                })).then(() => {
                    resolve()
                }).catch(e => reject(e))
            })
        })
    }
    async installNormalTemplate() {
        let spinner = spinnerStart('正在安装模板...')
        try {
            const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
            const targetPath = process.cwd()
            fse.ensureDirSync(templatePath)
            fse.ensureDirSync(targetPath)
            fse.copySync(templatePath, targetPath)
        } catch (e) {
            console.log(e)
            throw e
        } finally {
            spinner.stop(true)
        }
        const templateIgnore = this.templateInfo.ignore || []
        const ignore = ['**/node_modules/**', ...templateIgnore]
        await this.ejsRender(ignore)
        const { installCommand, startCommand } = this.templateInfo
        console.log(this.templateInfo)
        await this.execCommand(installCommand, '依赖安装失败')
        await this.execCommand(startCommand, '命令执行失败')
    }
    async installCustomTemplate() {
        if (await this.templateNpm.exists()) {
            const rootFile = this.templateNpm.getRootFilePath()
            console.log(rootFile)
            if (fs.existsSync(rootFile)) {
                const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
                const options = {
                    projectInfo: this.projectInfo,
                    templateInfo: this.templateInfo,
                    sourcePath: templatePath,
                    targetPath: process.cwd()
                }
                const code = `require('${rootFile}')(${JSON.stringify(options)})`
                await execAsync('node', ['-e', code], {
                    cwd: process.cwd(),
                    stdio: 'inherit'
                })
            } else {
                throw new Error('自定义模板入口文件不存在！')
            }
        }
    }
    async downloadTemplate() {
        const { projectTemplate } = this.projectInfo
        const templateInfo = this.template.find(item => item.npmName === projectTemplate)
        const targetPath = path.resolve(userHome, '.hhs-cli-dev', 'template')
        const storeDir = path.resolve(userHome, '.hhs-cli-dev', 'template', 'node_modules')
        const { npmName, version } = templateInfo
        this.templateInfo = templateInfo
        const templateNpm = new Package({
            targetPath,
            storeDir,
            packageName: npmName,
            packageVersion: version
        })
        if (!await templateNpm.exists()) {
            const spinner = spinnerStart()
            try {
                await templateNpm.install()
            } catch (e) {
                throw e
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('下载模板成功')
                    this.templateNpm = templateNpm
                }
            }
        } else {
            const spinner = spinnerStart()
            try {
                await templateNpm.update()
            } catch (e) {
                throw e
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('更新模板成功')
                    this.templateNpm = templateNpm
                }
            }
        }
    }
    async prepare() {
        const template = await getProjectTemplate()
        if (!template || template.length === 0) {
            throw new Error('模板不存在')
        }
        this.template = template
        const localPath = process.cwd()
        let ifContinue = false
        if (!this.isDirEmpty(localPath)) {
            if (!this.force) {
                const re = await inquirer.prompt({
                    type: 'confirm',
                    name: 'ifContinue',
                    default: false,
                    message: '当前文件夹不为空，是否继续创建项目'
                })
                ifContinue = re.ifContinue
                if (!ifContinue) {
                    return
                }
            }

            if (ifContinue || this.force) {
                const { confirmDelete } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmDelete',
                    default: false,
                    message: '是否清空当前文件夹'
                })
                // 清空当前目录
                if (confirmDelete) {
                    fse.emptyDirSync(localPath)
                }
            }
        }
        return this.getProjectInfo()
    }

    async getProjectInfo() {
        function isValidName(v) {
            return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
        }
        let projectInfo = {}
        let isProjectNameValid = false
        if (isValidName(this.projectName)) {
            isProjectNameValid = true
            projectInfo.projectName = this.projectName
        }
        const { type } = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: '请选择创建类型',
            default: TYPE_PROJECT,
            choices: [
                {
                    name: '项目',
                    value: TYPE_PROJECT
                },
                {
                    name: '组件',
                    value: TYPE_COMPONENT
                }
            ]
        })
        const title = type === TYPE_PROJECT ? '项目' : '组件'
        this.template = this.template.filter(template => template.tag.includes(type))
        const projectNamePrompt = {
            type: 'input',
            name: 'projectName',
            message: `请输入${title}名称`,
            default: '',
            validate: function(v) {
                const done = this.async();
                setTimeout(function() {
                    // 1.首字符必须为英文字符
                    // 2.尾字符必须为英文或数字，不能为字符
                    // 3.字符仅允许"-_"
                    if (!isValidName(v)) {
                        done(`请输入合法的${title}名称`);
                        return;
                    }
                    done(null, true);
                }, 0);
            },
            filter: v => {
                return v
            }
        }
        let projectPrompt = []
        if (!isProjectNameValid) {
            projectPrompt.push(projectNamePrompt)
        }
        projectPrompt.push(
            {
                type: 'input',
                name: 'projectVersion',
                message: `请输入${title}版本号`,
                default: '1.0.0',
                validate: function(v) {
                    const done = this.async();
                    setTimeout(function() {
                        if (!(!!semver.valid(v))) {
                            done('请输入合法的版本号');
                            return;
                        }
                        done(null, true);
                    }, 0);
                },
                filter: v => !!semver.valid(v) ? semver.valid(v) : v
            },
            {
                type: 'list',
                name: 'projectTemplate',
                message: `请选择${title}模板`,
                choices: this.createTemplateChoice()
            }
        )
        if (type === TYPE_PROJECT) {
            const project = await inquirer.prompt(projectPrompt)
            projectInfo = {
                ...projectInfo,
                type,
                ...project
            }
        } else if (type === TYPE_COMPONENT) {
            projectPrompt.push({
                type: 'input',
                name: 'componentDescription',
                message: '请输入组件描述',
                default: '',
                validate: function(v) {
                    const done = this.async();
                    setTimeout(function() {
                        if (!v) {
                            done('请输入组件描述');
                            return;
                        }
                        done(null, true);
                    }, 0);
                }
            })
            const component = await inquirer.prompt(projectPrompt)
            projectInfo = {
                ...projectInfo,
                type,
                ...component
            }
        }
        if (projectInfo.projectName) {
            projectInfo.name = projectInfo.projectName
            projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '');
        }
        if (projectInfo.projectVersion) {
            projectInfo.version = projectInfo.projectVersion
        }
        if (projectInfo.componentDescription) {
            projectInfo.description = projectInfo.componentDescription
        }
        return projectInfo
    }
    createTemplateChoice() {
        return this.template.map(item => ({
            value: item.npmName,
            name: item.name
        }))
    }
    isDirEmpty(localPath) {
        let fileList = fs.readdirSync(localPath)
        fileList = fileList.filter(file => (!file.startsWith('.') && !['node_modules'].includes(file)))
        return !fileList || fileList.length === 0
    }
}

function init(argv) {
    return new InitCommand(argv);
}
module.exports = init
module.exports.InitCommand = InitCommand;