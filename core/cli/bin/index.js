#! /usr/bin/env node

const importLocal = require('import-local')

if (importLocal(__dirname)) {

} else {
    require('../lib')(process.argv.slice(2))
}