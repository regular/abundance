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
  const idleTimer = IdleTimeout(opts)
  if (opts.paused) idleTimer.pause()

  return function() {
    const ourPausedObs = Value(!!opts.paused)

    let abort

    const spinner = Spinner({
      color: 'yellow',
      strokeWidth: 5,
      radius: 8
    })

    const el = h('.abundance-idle-control', {
      hooks: [el => { 
        abort = watch(idleTimer.progressObs, progress => {
          spinner.setProgress(progress)
        })

        return el => {
          idleTimer.abort()
          abort()
        }
      }]
    }, [
      computed(idleTimer.pausedObs, paused => paused ? [] : spinner),
      h('input', {
        type: 'checkbox',
        checked: ourPausedObs,
        'ev-change': e => {
          setTimeout(()=>{
            if (e.target.checked) {
              ourPausedObs.set(true)
              idleTimer.pause()
            } else {
              ourPausedObs.set(false)
              idleTimer.resume()
            }
          },0)
        }
      }),
      when(idleTimer.isIdleObs,
        h('.idle', 'idle'),
        h('.msg', [
          when(idleTimer.pausedObs,
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
    el.idleTimer = idleTimer
    el.pausedObs = ourPausedObs
    return el
  }
}
