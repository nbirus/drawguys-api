const Countdown = require('../countdown.js')
const LOG = true
const _ = require('lodash')

function Game(_room, updateRooms) {
  let room = _room
  let turnIndex = 0

  // timers
  let endRoundWaitTime = 10
  let endGameWaitTime = 1
  let preTurnWaitTime = 7
  let endTurnWaitTime = 5
  let turnWaitTime = 40

  this.start = function () {
    log('start')

    // let UI hide lobby before reset flags
    setTimeout(() => {
      Object.values(room.usersState).forEach(resetUser)
    }, 100)

    // start game after refresh
    setTimeout(() => {
      roundStart()
    }, 200)
    
  }
  this.stop = function () {
    log('stop')
    if (room.gameState.gameTimer) {
      room.gameState.gameTimer.stop()
    }
  }
  this.setWord = function (word) {
    room.gameState.usedWords.push(word)
    setGameState('word', word, true)
    cancelTimer()
    triggerTurnStart()
  }
  this.setWordDefault = function (word) {
    room.gameState.usedWords.push(word)
    setGameState('word', word, true)
  }
  this.guess = function (guess = '', userid) {

    if (!room.gameState.word) {
      return
    }
    
    let guessed = guess.toLowerCase() === room.gameState.word.toLowerCase()

    // set match
    if (guessed) {
      setUsersState(userid, 'match', true)
      setUsersState(userid, 'matchTime', room.gameState.timer, true)
      addGuessScore(userid, getScore())
      addDrawScore(getDrawScore())
    }
    else {
      setUsersState(userid, 'guess', guess, true)
    }

    if (Object.values(room.usersState).every(user => user.match || user.drawing)) {
      cancelTimer()
      turnEnd()
    }

    return guessed

  }

  // round
  function roundStart() {
    // stop game if at limit
    if (getGameState('round') >= getGameState('numberOfRounds')) {
      setGameState('event', 'game_end', true)
      setGameState('active', false, true)
      setGameState('round', 0, true)
      return
    }

    // reset users before timer start
    Object.values(room.usersState).forEach(roundResetUser)

    // increment round count
    setGameState('event', 'round_start')
    setGameState('round', getGameState('round') + 1, true)

    // if bonus round
    if (getGameState('round') === 4) {
      turnWaitTime = 15
    }

    // start pre turn
    setTimeout(() => {
      preTurnStart()
    }, 50);
  }
  function roundEnd() {
    Object.values(room.usersState).forEach((user) => {
      setUsersState(user.userid, 'drawing', false)
    })
    setGameState('event', 'round_end')
    startTimer({
      seconds: room.gameState.round === room.gameState.numberOfRounds ? endGameWaitTime : endRoundWaitTime,
      end: roundStart,
    })
  }
  function preTurnStart() {
    // reset users before timer start
    Object.values(room.usersState).forEach(turnResetUser)

    // if every user had taken a turn, end the round
    if (!setTurnUser()) {
      roundEnd()
      return
    }

    setGameState('word', '')
    setGameState('event', 'pre_turn', true)

    // user is selecting a word, start turn after
    startTimer({
      seconds: preTurnWaitTime,
      end: triggerTurnStart,
    })
  }
  function triggerTurnStart() {
    setGameState('event', 'turn_pre_start', true)
    startTimer({
      seconds: 3,
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

    if (noOneGuessed()) {
      addDrawScore(-200)
    }

    // if user didn't match, remove 50 points
    Object.values(room.usersState).forEach(user => {
      if (!user.match) {
        addGuessScore(user.userid, room.gameState.round > 2 ? -200 : -50)
      }
    })

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
    if (shouldUpdate) {
      updateRoomState()
    }
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
      guess: '',
      ready: false,
      match: false,
      typing: false,
      drawing: false,
      matchTime: 0,
      turnScore: 0,
      scoreChange: 0,
      roundScore: 0,
      score: 0,
    })
    updateRooms()
  }
  function turnResetUser(user) {
    _.set(room, `usersState.${user.userid}`, {
      ...user,
      guess: '',
      ready: false,
      match: false,
      typing: false,
      drawing: false,
      matchTime: 0,
      scoreChange: 0,
      turnScore: 0,
    })
    updateRooms()
  }
  function roundResetUser(user) {
    _.set(room, `usersState.${user.userid}`, {
      ...user,
      guess: '',
      ready: false,
      match: false,
      typing: false,
      drawing: false,
      matchTime: 0,
      scoreChange: 0,
      turnScore: 0,
      roundScore: 0,
    })
    updateRooms()
  }
  function noOneGuessed() {
    return Object.values(room.usersState).every(user => !user.match || user.drawing)
  }

  // scoreing
  function addGuessScore(userid, addScore) {
    let score = _.get(room, `usersState.${userid}.score`)
    let turnScore = _.get(room, `usersState.${userid}.turnScore`)
    let roundScore = _.get(room, `usersState.${userid}.roundScore`)
    let scoreChange = _.get(room, `usersState.${userid}.scoreChange`)

    score += addScore
    turnScore += addScore
    roundScore += addScore
    scoreChange = addScore

    _.set(room, `usersState.${userid}.score`, score)
    _.set(room, `usersState.${userid}.turnScore`, turnScore)
    _.set(room, `usersState.${userid}.roundScore`, roundScore)
    _.set(room, `usersState.${userid}.roundScore`, scoreChange)
    
    updateRooms()
  }
  function addDrawScore(addScore) {
    addGuessScore(_.get(room, 'gameState.turnUser.userid'), addScore)
  }
  function getScore() {
    let time = room.gameState.timer
			if (time >= 30) {
				return 400
			} else if (time >= 20) {
				return 300
			} else if (time >= 10) {
				return 200
			} else if (time >= 5) {
				return 100
			} else if (time > 0) {
				return 50
			} else {
				return 0
			}
  }
  function getDrawScore() {
    let time = room.gameState.timer
    if (time >= 30) {
      return 200
    }
    else if (time >= 10) {
      return 100
    }
    else {
      return 50
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
