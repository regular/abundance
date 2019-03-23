const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const when = require('mutant/when')
const watch = require('mutant/watch')
const IdleTimeout = require('./idle-timeout')
const Spinner = require('./spinner')

module.exports = function(opts) {
  opts = opts || {}
  opts.seconds = opts.seconds || 10

  return function() {
    const idleTimer = IdleTimeout(opts)
    const pausedObs = Value(!!opts.paused)
    if (pausedObs()) idleTimer.pause()

    const spinner = Spinner({
      color: 'yellow',
      strokeWidth: 5,
      radius: 8
    })

    const abort = watch(idleTimer.secondsLeftObs, s => {
      const progress = s / opts.seconds
      spinner.setProgress(progress)
    })
    
    return h('.abundance-idle-control', {
      hooks: [el => el => {
        idleTimer.abort()
        abort()
      }]
    }, [
      spinner,
      h('input', {
        type: 'checkbox',
        checked: pausedObs,
        'ev-change': e => {
          setTimeout(()=>{
            pausedObs.set(e.target.checked)
            if (pausedObs()) {
              idleTimer.pause()
            } else {
              idleTimer.resume()
            }
          },0)
        }
      }),
      when(idleTimer.isIdleObs,
        h('.idle', 'idle'),
        h('.msg', [
          when(pausedObs,
            h('span', '(paused)'),
            [
              h('span', {
                classList: computed(idleTimer.secondsLeftObs, s => {
                  return s < 3 ? ['warn'] : []
                })
              }, computed(idleTimer.secondsLeftObs, s => {
                return `${Math.floor(s)}s`
              })),
              h('span', ' left until idle')
            ]
          )
        ])
      )
    ])
  }
}
