const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const Webapps = require('tre-webapps')

module.exports = function(ssb, config, canAutoUpdate) {
  const bootMsg = Value()
  const bootRev = config.bootMsgRevision
  console.warn('webapp version:', bootRev)

  const renderWebapp = Webapps(ssb, {
    canAutoUpdate
  })

  if (bootRev) ssb.get(bootRev, (err, value) => {
    if (err) return console.error(err.message)
    bootMsg.set({key: bootRev, value})
  }) 
  
  return function() {
    return computed(bootMsg, kv => {
      if (!bootRev) return h('div.dev', 'dev version')
      if (!kv) return []
      return renderWebapp(kv, {where: 'status'})
    })
  }
}
