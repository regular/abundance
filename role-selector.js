const pull = require('pull-stream')
const MutantMap = require('mutant/map')
const MutantArray = require('mutant/array')
const collectMutations = require('collect-mutations')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const watch = require('mutant/watch')
const ResolvePrototypes = require('tre-prototypes')
const h = require('mutant/html-element')
const deepEqual = require('deep-equal')

module.exports = function(ssb, onStationChange) {
  const feedId = Value()
  const resolvePrototypes = ResolvePrototypes(ssb)
  ssb.whoami((err, feed)=>{
    if (err) return console.error(err.message)
    feedId.set(feed.id)
  })

  const stations = trackStations()
  const currentRole = trackCurrentRole()
  const currentStation = trackCurrentStation(currentRole)

  const abort = currentStation(kv => {
    console.log('station changed', kv)
    onStationChange(kv)
  })

  return function renderSelector() {
    return h('select.tre-roles', {
      /*
      hooks: [el => el => {
        stations.abort()
        currentRole.abort()
        abort()
      }],
      */
      'ev-change': e => {
        const kv = currentRole()
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
      const selected = computed([revRoot, currentRole], (r,c) => {
        return c && c.value.content.station == r
      })
      return h('option', {
        value: revRoot,
        selected
      }, name)
    }))
  }

  function trackStations() {
    const stations = MutantArray()
    const o = {sync: true, live: true}
    const drain = collectMutations(stations, o)
    pull(
      ssb.revisions.messagesByType('station', o),
      pull.through( kv=>{
        console.warn('TYPE STATION', kv)
      }),
      drain
    )
    const resolved = MutantMap(stations, resolvePrototypes, {comparer: deepEqual})
    const withNone = computed(resolved, arr => {
      return [Value({key: '', value: {content: {name: 'None'}}})].concat(arr)
    })
    withNone.abort = drain.abort
    return withNone
  } 

  function trackCurrentRole() {
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
      const sorted = aboutUs.sort((a,b) => b.value.timestamp - a.value.timestamp)
      return sorted[0]
    })
    current.abort = drain.abort
    return current
  } 

  function trackCurrentStation(currentRole) {
    const currentStation = computed(currentRole, kv =>{
      if (!kv) return null
      const station = kv && kv.value.content.station
      if (!station) {
        console.warn('Role does not specify a station', kv)
        return null
      }
      return resolvePrototypes(station, {allowAllAuthors: true})
    }, {
      //comparer: (a,b) => (a && a.key) == (b && b.key)
      comparer: (a,b) => {
        return a == b
      }
    })
    return currentStation
  }

}
