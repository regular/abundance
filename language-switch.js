const Value = require('mutant/value')
const computed = require('mutant/computed')
const MutantProxy = require('mutant/proxy')
const WatchMerged = require('tre-prototypes')
const h = require('mutant/html-element')
const debug = require('debug')('abundance:language-switch')

module.exports = function(ssb, config, commonContext) {
  const language = Value()
  const watchMerged = WatchMerged(ssb)

  const configObs = trackConfig(config)
  const languagesObs = computed(configObs, c => {
    return c && c.tre && c.tre.languages || []
  })
  const currentObs = Value()

  commonContext.languagesObs = languagesObs
  commonContext.currentLanguageObs = computed([languagesObs, currentObs], (langs, c) =>{
    return (c && langs.includes(c)) ? c : langs[0] || computed.NO_CHANGE
  })
  commonContext.currentLanguageObs.set = function(x) {
    currentObs.set(x)
  }

  return function renderSelector() {
    const selectEl = computed(languagesObs, langs => {
      return h('select', {
        'ev-change': e => {
          debug('switched to: %s', e.target.value)
          currentObs.set(e.target.value)
        }
      }, langs.map(l => {
        const selected = computed(currentObs, c => {
          return c == l
        })
        return h('option', {
          value: l,
          selected
        }, l)
      }))
    })

    const iconEl = computed(currentObs, l => {
      return h(`span.emoji.emoji-${l}`)
    })

    return h('.tre-language-switch', [
      selectEl,
      iconEl
    ])
  }

  function trackConfig(config) {
    const c = MutantProxy(Value(config))
    const bootKey = config.bootMsgRevision
    if (bootKey) {
      ssb.get(bootKey, (err, value) => {
        if (err) return console.error(err.message)
        const revRoot = value.content.revisionRoot || bootKey
        const bootKvObs = watchMerged(revRoot, {allowAllAuthors: false})
        const configObs = computed(bootKvObs, kv => {
          debug('boot msg changed to %O', kv)
          return kv && kv.value.content.config || computed.NO_CHANGE
        })
        debug('Tracking config of %s', revRoot)
        c.set(configObs)
      })
    }
    return c
  }

}

