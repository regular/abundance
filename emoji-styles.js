const pull = require('pull-stream')
const MutantMap = require('mutant/map')
const MutantArray = require('mutant/array')
const collectMutations = require('collect-mutations')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const ResolvePrototypes = require('tre-prototypes')
const h = require('mutant/html-element')

module.exports = function(ssb, config) {
  const resolvePrototypes = ResolvePrototypes(ssb)
  const blobPrefix = Value()
  ssb.ws.getAddress((err, address) => {
    if (err) return console.error(err)
    address = address.replace(/^ws:\/\//, 'http://').replace(/~.*$/, '/blobs/get/')
    blobPrefix.set(address)
  })
  const icons = MutantArray()
  const o = {sync: true, live: true}
  const drain = collectMutations(icons, o)
  console.warn('EMOJI', config.tre.branches)
  pull(
    ssb.revisions.messagesByBranch(config.tre.branches.emoji, o),
    drain
  )
  const abort = drain.abort
  const resolved = MutantMap(icons, resolvePrototypes, {comparer})

  return function() {
    return h('style', {
      id: 'emoji-styles',
      hooks: [el=>abort]
    }, computed([resolved, blobPrefix], (kvs, blobPrefix) =>{
      return kvs.map(kv => {
        const name = kv.value.content.name
        const blob = kv.value.content.blob
        return `.emoji.emoji-${name} {
          background-image: url("${blobPrefix}${encodeURIComponent(blob)}");
        }`
      }).join('\n')    
    }))
  }
}

function comparer(a, b) {
  // NOTE: a and b might be observables 
  /*
  It might be beneficial to overall perofrmance to make a slightly deeper comparison of
  - keys
  - meta (wihtout prototype-chain)
  - keys of prototype chain

  It's not enough to just compare akey to b.key because changes in
  prototypes would slip through.
  */
  return a === b
}

