const io = require('./socket.js').getio()
const Countdown = require('./countdown.js')
const LOG = true
const _ = require('lodash')
const Room = require('./services/Room')

// timers
const startRoundWaitTime = 3
const endRoundWaitTime = 3
const preTurnWaitTime = 3
const endTurnWaitTime = 3
const turnWaitTime = 3

function Game(_room, updateRooms) {
  let room = _room
  let turnIndex = 0

  this.start = function () {
    log('start')
    roundStart()

    // reset ready flag
    Object.values(room.usersState).forEach((user) => {
      setUsersState(user.userid, 'ready', false)
    })
  }
  this.stop = function () {
    log('stop')
    if (room.gameState.gameTimer) {
      room.gameState.gameTimer.stop()
    }
  }

  // round
  function roundStart() {
    // stop game if at limit
    if (getGameState('round') >= getGameState('numberOfRounds')) {
      setGameState('event', 'game_end')
      return
    }

    // increment round count
    setGameState('event', 'round_start')
    setGameState('round', getGameState('round') + 1, true)

    // start timer, on complete start pre turn
    startTimer({
      seconds: startRoundWaitTime,
      end: preTurnStart,
    })
  }
  function roundEnd() {
    Object.values(room.usersState).forEach((user) => {
      setUsersState(user.userid, 'drawing', false)
    })
    setGameState('event', 'round_end')
    startTimer({
      seconds: endRoundWaitTime,
      end: roundStart,
    })
  }
  function preTurnStart() {
    // if every user had taken a turn, end the round
    if (!setTurnUser()) {
      roundEnd()
      return
    }

    setGameState('event', 'pre_turn')

    // user is selecting a word, start turn after
    startTimer({
      seconds: preTurnWaitTime,
      end: turnStart,
    })
  }
  function turnStart() {
    setGameState('event', 'turn_start')

    // user is drawing
    startTimer({
      seconds: turnWaitTime,
      end: turnEnd,
    })
  }
  function turnEnd() {
    setGameState('event', 'turn_end')

    startTimer({
      seconds: endTurnWaitTime,
      end: preTurnStart,
    })
  }

  // helpers
  function setTurnUser() {
    let users = Object.values(room.usersState)
    if (turnIndex === users.length) {
      turnIndex = 0
      return false
    }

    // get user
    let turnUser = users[turnIndex]

    if (turnUser) {
      // set drawing
      users.forEach((user) => {
        setUsersState(user.userid, 'drawing', turnUser.userid === user.userid)
      })

      // set turn user
      setGameState(
        'turnUser',
        _.get(room),
        `usersState.${turnUser.userid}`,
        true
      )
    }

    turnIndex++
    return true
  }
  function startTimer(options) {
    room.gameState.gameTimer = new Countdown({
      ...options,
      update: (timer) => setGameState('timer', timer, true),
    })
    room.gameState.gameTimer.start()
  }
  function setGameState(path, value, shouldUpdate = false) {
    _.set(room, `gameState.${path}`, value)
    if (shouldUpdate) {
      updateRoomState()
    }
  }
  function getGameState(path) {
    return _.get(room, `gameState.${path}`)
  }
  function setUsersState(userid, path, value, shouldUpdate = false) {
    _.set(room, `usersState.${userid}.${path}`, value)
    updateRooms()
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
