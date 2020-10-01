const io = require('../socket.js').getio()
const _ = require('lodash')
const words = require('../assets/words.js')
const LOG = true

const defaultGameState = {
  event: 'pre_round',
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
  room.gameState.turnUser = getUserAtIndex(room.gameState.turnIndex, room)

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

    room.gameState.event = 'pre_round'

    // update room
    broadcastGameState()

    // wait 3 seconds before starting next round
    startTimer(3, startRound)
  }

  // actions
  function startRound() {
    room.gameState.event = 'round_start'
    broadcastGameState()

    // start round timer
    startTimer(room.gameState.roundTimer, endRound)
  }
  function endRound() {
    room.gameState.event = 'round_end'
    
    // move round count down, next user turn
    room.gameState.round++

    // update turn
    incrementTurnIndex()

    // update game
    broadcastGameState()

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
  function endGame() {
    log('end')
    clearTimer()
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
      broadcastGameState()
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
  function broadcastGameState() {
    for (const client of room.sockets) {
      client.emit('update_game_state', room.gameState)
    }
  }

  // start game
  loop()

  // expose functions
  return {
    guess,
    endGame,
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
function getUserAtIndex(index, room) {
  let userid = Object.keys(room.users)[index - 1]
  return room.users[userid]
}
