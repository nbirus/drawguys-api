function Countdown(options) {
  var timer,
    instance = this,
    seconds = options.seconds || 10,
    updateStatus = options.update || function () {},
    counterEnd = options.end || function () {}

  function decrementCounter() {
    updateStatus(seconds)
    if (seconds === 0) {
      counterEnd()
      instance.stop()
    }
    seconds--
  }

  this.start = function () {
    clearInterval(timer)
    timer = 0
    seconds = options.seconds
    decrementCounter()
    timer = setInterval(decrementCounter, 1000)
  }

  this.stop = function () {
    clearInterval(timer)
  }
}

module.exports = Countdown
