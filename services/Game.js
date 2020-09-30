const io = require('../socket.js').getio()
const _ = require('lodash')
const words = require('../assets/words.js')
const LOG = true

const defaultGameState = {
  timer: 0,
  turnIndex: 1,
  turnUser: {},
  round: 1,
  roundWord: '',
  numberOfRounds: 5,
  numberOfTurns: 4,
  roundTimer: 10,
}

const game = function (room, endGame) {
  // init game state
  room.gameState = _.cloneDeep(defaultGameState)
  room.gameState.numberOfTurns = Object.keys(room.users).length

  // brodcast start
  broadcastGameState()

  let timerInterval = null

  function loop() {
    log('loop', `${room.gameState.round}/${room.gameState.round}`)

    // create new word
    room.gameState.roundWord = getRandomWord()

    // reset user info
    Object.keys(room.users).forEach((userid) => {
      room.users[userid].match = false
      room.users[userid].guesses = []
    })

    // update room
    broadcastRoomUpdate(room)

    // broadcast loop start
    broadcastEvent({
      event: 'pre_round',
      ...room.gameState,
    })

    // wait 3 seconds before starting next round
    startTimer(3, startRound)
  }

  // actions
  function startRound() {
    broadcastEvent({
      event: 'round_start',
    })

    // start round timer
    startTimer(room.gameState.roundTimer, endRound)
  }
  function endRound() {
    broadcastEvent({
      event: 'round_end',
    })

    // move round count down, next user turn
    room.gameState.round++

    // update turn
    incrementTurnIndex()

    // check to see if game is over
    if (room.gameState.round > room.gameState.numberOfRounds) {
      endGame()
    } else {
      // allow 3 seconds of endtime
      startTimer(3, loop)
    }
  }
  function guess(data, cb) {
    let roundWordMatch =
      data.guess &&
      data.guess.toUpperCase() === room.gameState.roundWord.toUpperCase()
    cb(roundWordMatch)
  }

  // helpers
  function startTimer(timerLength, cb) {
    // set timer length
    room.gameState.timer = timerLength

    // set timer interval
    timerInterval = setInterval(() => {
      updateTimer(cb)
    }, 1000)
  }
  function updateTimer(cb) {
    if (room.gameState.timer === -1) {
      clearTimer()
      cb()
    } else {
      broadcastTimer()
      room.gameState.timer--
    }
  }
  function clearTimer() {
    clearInterval(timerInterval)
    timerInterval = null
    timerCallback = null
  }
  function incrementTurnIndex() {
    if (room.gameState.turnIndex === room.gameState.numberOfTurns) {
      room.gameState.turnIndex = 1
    } else {
      room.gameState.turnIndex++
    }

    room.gameState.turnUser = getUserAtIndex(room.gameState.turnIndex, room)
  }
  function getRandomWord() {
    return words[Math.floor(Math.random() * words.length)]
  }

  // broadcasts
  function broadcastTimer() {
    for (const client of room.sockets) {
      client.emit('update_game_timer', room.gameState.timer)
    }
  }
  function broadcastGameState() {
    log('broadcast-game-state')
    for (const client of room.sockets) {
      console.log(room.gameState)

      client.emit('update_game_state', room.gameState)
    }
  }
  function broadcastEvent(event) {
    log('broadcast-event', event.event)
    for (const client of room.sockets) {
      client.emit('update_game_event', event)
    }
  }
  function broadcastRoomUpdate(room) {
    log('broadcast-room-update', room.roomid)
    for (const client of room.sockets) {
      client.emit('update_room', formatRoom(room))
    }
  }

  // start game
  loop()

  // expose functions
  return {
    guess,
  }
}

module.exports = game

// helpers
function log(message, roomid, userid) {
  if (LOG) {
    if (userid) {
      console.log(`game:${message}`, roomid, userid)
    } else {
      console.log(`game:${message}`, roomid)
    }
  }
}
function formatRoom(room) {
  return _.cloneDeep({
    ...room,
    game: null,
    sockets: [],
  })
}
function getUserAtIndex(index, room) {
  let userid = Object.keys(room.users)[index - 1]
  return room.users[userid]
}
