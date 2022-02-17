'use strict';

const axios = require('axios')
const urlJoin = require('url-join')
const semver = require('semver')

function getNpmInfo(npmName, registry) {
    if (!npmName) {
        return null
    }
    const registryUrl = registry || getDefaultRegistry()
    const npmInfoUrl  = urlJoin(registryUrl, npmName)
    return axios.get(npmInfoUrl).then(res => {
        if (res.status === 200) {
            return res.data
        }
        return null
    }).catch(e => {
        return Promise.reject(e)
    })

}

function getDefaultRegistry(isOriginal = false) {
    return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobao.org'
}

async function getNpmVersion(npmName, registry) {
    const data = await getNpmInfo(npmName, registry)
    if (data) {
        return Object.keys(data.versions)
    } else {
        return []
    }
}
function getSemverVersions(baseVersion, versions) {
    return versions
        .filter(version => semver.satisfies(version, `^${baseVersion}`))
        .sort((a, b) => (semver.gt(b, a) ? 1 : -1))
}

async function getNpmSemverVersions(baseVersion, npmName, registry) {
    const versions = await getNpmVersion(npmName, registry)
    const newVersions = getSemverVersions(baseVersion, versions)
    if (newVersions && newVersions.length > 0) {
        return newVersions[0]
    }
}
async function getNpmLatestVersion(npmName, registry) {
    let versions = await getNpmVersion(npmName, registry)
    if (versions) {
        return versions.sort((a, b) => (semver.gt(b, a) ? 1 : -1))[0]
    }
    return null
}
module.exports = {
    getNpmInfo,
    getNpmVersion,
    getNpmSemverVersions,
    getDefaultRegistry,
    getNpmLatestVersion
};