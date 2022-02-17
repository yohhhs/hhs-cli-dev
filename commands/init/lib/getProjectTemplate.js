
const request = require('@hhs-cli-dev/request')

module.exports = function () {
    return request({
        url: '/project/template'
    })
}