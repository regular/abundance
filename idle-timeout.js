const Value = require('mutant/value')
const computed = require('mutant/computed')

module.exports = function(opts) {
  opts = opts || {}
  let seconds
  let timerId, intervalId, started
  const paused = Value(0)
  const secondsLeftObs = Value()
  const progressObs = Value()
  const isIdleObs = Value(false)
  const updateInterval = opts.updateInterval || 250

  setSeconds(opts.seconds || 10)

  function setSeconds(s) {
    seconds = s
    started = Date.now()
    secondsLeftObs.set(s)
    progressObs.set(0)
    isIdleObs.set(false)
    abort()
    timerId = setTimeout(onTimeout, seconds * 1000)
    intervalId = setInterval(update, updateInterval)
  }

  function onTimeout() {
    if (paused()) return
    isIdleObs.set(true)
  }
  function reset() {
    if (paused()) return
    console.log('reset')
    setSeconds(seconds)
  }
  function pause() {
    console.log('pause')
    paused.set(paused() + 1)
    abort()
  }
  function resume() {
    let i = paused() - 1
    paused.set(i)
    if (i == 0) reset()
  }
  function update() {
    if (paused()) return
    const ms_passed = Date.now() - started
    secondsLeftObs.set(seconds - ms_passed / 1000.0)
    progressObs.set(ms_passed / seconds / 1000.0)
  }

  function abort() {
    if (timerId) clearTimeout(timerId)
    if (intervalId) clearInterval(intervalId)
    timerId = null
    intervalId = null
  }

  return {
    setSeconds, // set idle timeout duration
    reset,      // call when user interaction occurs
    pause,      // call when start to play media (no interaction expected for a while)
    resume,     // call after playback ends
    secondsLeftObs, // number of seconds remaining
    progressObs, // 0 ... 1, 1 == idle
    isIdleObs,   // true if timeout occured (use reset() to restart)
    pausedObs: computed(paused, p => p !==0),
    abort     // call to shut down
  }
}
