const io = require('./socket.js').getio()
const Countdown = require('./countdown.js')
const LOG = true
const _ = require('lodash')

// timers
const roundWaitTime = 3
const preTurnWaitTime = 15
const turnWaitTime = 15

function Game(_room) {
  let room = _room

  this.start = function () {
    log('start')
    roundStart()
  }
  this.stop = function () {
    log('stop')
    if (room.gameState.gameTimer) {
      room.gameState.gameTimer.stop()
    }
  }

  // round
  function roundStart() {
    setGameState('event', 'round_start', true)

    // start timer, on coplete start pre turn
    startTimer({
      seconds: roundWaitTime,
      end: turnStart,
    })
  }
  function roundEnd() {
    setGameState('event', 'round_end')
  }
  function preTurnStart() {
    setGameState('event', 'pre_turn')

    // user is selecting a word, start turn after
    startTimer({
      seconds: preTurnWaitTime,
      end: turnStart,
    })
  }
  function turnStart() {
    setGameState('event', 'turn_start')

    // start turn
    startTimer({
      seconds: turnWaitTime,
      end: turnEnd,
    })
  }
  function turnEnd() {
    setGameState('event', 'turn_end')
  }

  // helpers
  function startTimer(options) {
    room.gameState.gameTimer = new Countdown({
      ...options,
      update: (timer) => setGameState('timer', timer, true),
    })
    room.gameState.gameTimer.start()
  }
  function setGameState(path, value, shouldUpdate = false) {
    log('set', path, value)
    _.set(room, `gameState.${path}`, value)
    if (shouldUpdate) {
      updateRoomState()
    }
  }
  function updateRoomState() {
    for (const client of room.sockets) {
      client.emit('update_room', formatRoom(room))
    }
  }
}

module.exports = Game

// helpers
function log(message) {
  if (LOG) {
    console.log(`game:${message}`)
  }
}

function formatRoom(room) {
  return _.cloneDeep({
    ...room,
    game: null,
    sockets: [],
  })
}
