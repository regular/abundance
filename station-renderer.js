const computed = require('mutant/computed')
const watch = require('mutant/watch')
const Value = require('mutant/value')
const WatchMerged = require('tre-prototypes')
const WatchHeads = require('tre-watch-heads')
const h = require('mutant/html-element')

module.exports = function(ssb, opts) {
  opts = opts || {}
  const watchHeads = WatchHeads(ssb)
  const watchMerged = WatchMerged(ssb)
  const {renderEntry} = opts

  return function renderStation(kv, ctx) {
    ctx = ctx || {}
    const content = kv && kv.value.content
    if (!content) return
    if (content.type !== 'station') return
    const previewObs = ctx.previewObs || Value(kv)

    const contentObs = computed(previewObs, kv => {
      return kv && kv.value && kv.value.content || {}
    })

    const stageObs = computed(contentObs, c => c && c.stage)
    const entryKeyObs = computed(contentObs, c => c && c.entry)
    const timeoutObs = computed(contentObs, c => c && c.idle && c.idle.timeout || computed.NO_CHANGE)
    const {languagesObs, currentLanguageObs, idleTimer} = ctx

    const abort = watch(timeoutObs, seconds => {
      if (seconds && idleTimer) {
        console.warn('Setting idle timeout to', seconds)
        idleTimer.setSeconds(seconds)
      }
    })

    const entryObs = computed(entryKeyObs, k => {
      if (!k) return computed.NO_CHANGE
      return watchHeads(k, {allowAllAuthors: true})
    })

    return h('.tre-station-container', {
      hooks: [el => abort],
      classList: computed(contentObs, c => c.classes || []),
    }, [
      h('.tre-station', {
        classList: computed(contentObs, c => c.classes || []),
        style: {
          width: computed(stageObs, stage => `${stage && stage.width || 1920}px`),
          height: computed(stageObs, stage => `${stage && stage.height || 1080}px`),
          trnsform: computed(stageObs, stage => stage && stage.transform)
        }
      }, [
        computed(watchMerged(entryObs, {allowAllAuthors: true}), kvm => {
          if (!kvm) return []
          console.warn('renderEntry', kvm.key, kvm.value.content.name)
          return renderEntry(kvm, {
            where: ctx.where,
            languagesObs,
            currentLanguageObs,
            idleTimer
          }) || []
        })
      ])
    ])
  }
}
