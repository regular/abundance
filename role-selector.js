const pull = require('pull-stream')
const MutantMap = require('mutant/map')
const MutantArray = require('mutant/array')
const collectMutations = require('collect-mutations')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const watch = require('mutant/watch')
const ResolvePrototypes = require('tre-prototypes')
const h = require('mutant/html-element')

module.exports = function(ssb) {
  const feedId = Value()
  const resolvePrototypes = ResolvePrototypes(ssb)
  ssb.whoami((err, feed)=>{
    if (err) return console.error(err.message)
    feedId.set(feed.id)
  })

  function trackStations() {
    const stations = MutantArray()
    const o = {sync: true, live: true}
    const drain = collectMutations(stations, o)
    pull(
      ssb.revisions.messagesByType('station', o),
      drain
    )
    const resolved = MutantMap(stations, resolvePrototypes, {comparer})
    const withNone = computed(resolved, arr => {
      return [Value({key: '', value: {content: {name: 'None'}}})].concat(arr)
    })
    withNone.abort = drain.abort
    return withNone
  } 

  function trackCurrent() {
    const msgs = MutantArray()
    const o = {sync: true, live: true}
    const drain = collectMutations(msgs, o)
    pull(
      ssb.revisions.messagesByType('role', o),
      drain
    )
    const current = computed([feedId, msgs], (id, msgs) => {
      // find messages about us
      const aboutUs = msgs.filter(kv => {
        return kv && kv.value.content.about == id
      })
      // sort by timestamp
      const sorted = aboutUs.sort((a,b) => a.value.timestamp - b.value.timestamp)
      const station = sorted[0] && sorted[0].value.content.station
      console.warn('current station', station)
      return sorted[0]
    })
    current.abort = drain.abort
    return current
  } 

  return function renderSelector(mode, selection) {
    const stations = trackStations()
    const current = trackCurrent()

    const abort = watch(current, kv => {
      const station = kv && kv.value.content.station
      if (station) {
        mode.set(2)
        ssb.revisions.getLatestRevision(station, (err, kv) =>{
          if (err) return console.error(err.message)
          selection.set(kv)
        })
      }
    })

    return h('select.tre-roles', {
      hooks: [el => el => {
        stations.abort()
        current.abort()
        abort()
      }],
      'ev-change': e => {
        const kv = current()
        const revisionRoot = kv && kv.value.content.revisionRoot || kv && kv.key
        const revisionBranch = kv && kv.key
        ssb.publish({
          type: 'role',
          about: feedId(),
          station: e.target.value || undefined,
          revisionRoot,
          revisionBranch
        }, (err, msg) => {
          if (err) return console.error(err.message)
          console.warn('published', msg)
        })
      }
    }, MutantMap(stations, kvm => {
      const name = computed(kvm, kvm =>
        kvm && kvm.value.content.name || 'no name'
      )
      const revRoot = computed(kvm, kvm => 
        kvm && kvm.value.content.revisionRoot || kvm && kvm.key
      )
      const selected = computed([revRoot, current], (r,c) => {
        return c && c.value.content.station == r
      })
      return h('option', {
        value: revRoot,
        selected
      }, name)
    }, {comparer}))
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

