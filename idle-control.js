const h = require('mutant/html-element')
const Value = require('mutant/value')
const IdleTimeout = require('./idle-timeout')

module.exports = function(opts) {
  return function() {
    const idleTimer = IdleTimeout(opts)
    const pausedObs = Value(!!opts.paused)
    if (pausedObs()) idleTimer.pause()

    return h('.abundance-idle-control', {
      hooks: [el => el => {
        idleTimer.abort()
      }]
    }, [
      h('input', {
        type: 'checkbox',
        value: pausedObs,
        'ev-change': e => {
          setTimeout(()=>{
            pausedObs.set(e.target.value)
            if (pausedObs()) {
              idleTimer.pause()
            } else {
              idleTimer.resume()
            }
          },0)
        }
      }),
      h('.msg', [
        h('span', {
          classList: computed(idleTimer.secondsLeftObs, s => {
            return s < 3 ? ['warn'] : []
          })
        }, computed(idleTimer.secondsLeftObs, s => {
          return `${Math.floor(s)}s`
        })),
        h('span', ' left until idle')
      ])
    ])
  }
}
