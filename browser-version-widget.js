const h = require('mutant/html-element')
const UAParser = require('ua-parser-js')
const browserVersion = UAParser().browser

module.exports = function() {
  return function renderBrowserVersion() {
    return h('.browser-version', [
      h('span.name', browserVersion.name),
      h('span.version', browserVersion.version)
    ])
  }
}

