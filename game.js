const io = require('./socket.js').getio()
const Countdown = require('./countdown.js')
const LOG = true
const _ = require('lodash')
const Room = require('./services/Room')

// timers
const startRoundWaitTime = 3
const endRoundWaitTime = 3
const preTurnWaitTime = 10
const endTurnWaitTime = 3
const turnWaitTime = 25

function Game(_room, updateRooms) {
  let room = _room
  let turnIndex = 0

  this.start = function () {
    log('start')

    // reset flags
    Object.values(room.usersState).forEach(resetUser)

    // start round
    roundStart()
  }
  this.stop = function () {
    log('stop')
    if (room.gameState.gameTimer) {
      room.gameState.gameTimer.stop()
    }
  }
  this.setWord = function (word) {
    setGameState('word', word, true)
    cancelTimer()
    turnStart()
  }
  this.guess = function (guess = '', userid) {
    let guessed = guess.toLowerCase() === room.gameState.word.toLowerCase()

    setUsersState(userid, 'guess', guess)
    setUsersState(userid, 'match', guessed, true)

    if (guessed) {
      incUserScore(userid)
      incDrawScore()
    }

    if (Object.values(room.usersState).every(user => user.match || user.drawing)) {
      cancelTimer()
      turnEnd()
    }
  }

  // round
  function roundStart() {
    // stop game if at limit
    if (getGameState('round') >= getGameState('numberOfRounds')) {
      setGameState('event', 'game_end', true)
      setGameState('round', 0, true)
      return
    }

    // increment round count
    // setGameState('event', 'round_start')
    setGameState('round', getGameState('round') + 1, true)


    // start pre turn
    preTurnStart()

    // start timer, on complete start pre turn
    // startTimer({
    //   seconds: startRoundWaitTime,
    //   end: preTurnStart,
    // })
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
    // reset users before timer start
    Object.values(room.usersState).forEach(resetUser)

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
    setUserDrawing()
    setGameState('event', 'turn_start', true)

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
  function setUserDrawing() {
    let user = room.gameState.turnUser
    user.selecting = false
    user.drawing = true
    room.usersState[user.userid] = user
    updateRoomState()
  }
  function setTurnUser() {
    let users = Object.values(room.usersState)
    if (turnIndex === users.length) {
      turnIndex = 0
      return false
    }

    // get user
    let turnUser = users[turnIndex]
    if (turnUser) {
      // set selecting
      users.forEach((user) => {
        setUsersState(user.userid, 'selecting', turnUser.userid === user.userid)
      })
      // set turn user
      setGameState('turnUser', users[turnIndex], true)
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
  function cancelTimer() {
    room.gameState.gameTimer.stop()
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
  function incUserScore(userid) {
    let score = _.get(room, `usersState.${userid}.score`)
    score += 100
    _.set(room, `usersState.${userid}.score`, score)
    updateRooms()
  }
  function incDrawScore() {
    let userid = room.gameState.turnUser.userid
    let score = _.get(room, `usersState.${userid}.score`)
    score += 50
    _.set(room, `usersState.${userid}.score`, score)
    updateRooms()
  }
  function updateRoomState() {
    if (room.sockets) {
      for (const client of room.sockets) {
        client.emit('update_room', formatRoom(room))
      }
    }
  }
  function resetUser(user) {
    _.set(room, `usersState.${user.userid}`, {
      ...user,
      guesses: [],
      ready: false,
      match: false,
      drawing: false,
      selecting: false,
    })
    updateRooms()
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
