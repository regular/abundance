const Value = require('mutant/value')

module.exports = function(opts) {
  opts = opts || {}
  const updateInterval = opts.updateInterval || 250
  setSeconds(opts.seconds || 10)

  let _seconds
  let timerId, intervalId, started, paused = 0
  const secondsLeftObs = Value()
  const isIdleObs = Value(false)

  function setSeconds(s) {
    _seconds = s
    started = Date.now()
    secondsLeftObs.set(s)
    isIdleObs.set(false)
    abort()
    timerId = setTimeout(onTimeout, _seconds * 1000)
    intervalId = setInterval(update, updateInterval)
  }

  function onTimeout() {
    if (paused) return
    isIdleObs.set(true)
  }
  function reset() {
    setSeconds(_seconds)
  }
  function pause() {
    paused++
    if (intervalId) clearInterval(intervalId)
    intervalId = null
  }
  function resume() {
    if (--paused == 0) reset()
  }
  function update() {
    const ms_passed = Date.now() - started
    secondsLeftObs.set(_seconds - ms_passed / 1000.0)
  }

  function abort() {
    if (timerId) cleatTimeout(timerId)
    if (intervalId) clearInterval(intervalId)
    timerId = null
    intervalId = null
  }

  return {
    setSeconds, // set idle timeout duration
    reset,      // call when user interaction occurs
    pause,      // call when start to play media (no interaction expected for a while)
    resume,     // call after playback ends
    secondsLeftObs, // number of _seconds remaining
    isIdleObs,   // true if timeout occured (use reset() to restart)
    abort     // call to shut down
  }
}
