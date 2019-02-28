const computed = require('mutant/computed')
const WatchMerged = require('tre-prototypes')
const h = require('mutant/html-element')

module.exports = function(ssb, opts) {
  opts = opts || {}
  const watchMerged = WatchMerged(ssb)
  const {renderEntry} = opts

  return function renderStation(kv, ctx) {
    ctx = ctx || {}
    const content = kv && kv.value.content
    if (!content) return
    if (content.type !== 'station') return
    const {stage, entry} = content
    if (!stage || !entry) return

    return h('.tre-station-container', {
      classList: content.classes || [],
    }, [
      h('.tre-station', {
        classList: content.classes || [],
        style: {
          width: `${stage.width}px`,
          height: `${stage.height}px`,
          transform: content.stage.transform
        }
      }, [
        computed(watchMerged(entry, {allowAllAuthors: true}), kvm => {
          if (!kvm) return []
          console.warn('renderEntry', kvm)
          return renderEntry(kvm, {where: ctx.where}) || []
        })
      ])
    ])
  }
}
