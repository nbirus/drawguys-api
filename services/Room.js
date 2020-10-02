const io = require('../socket.js').getio()
const _ = require('lodash')
const getColor = require('../assets/colors')
const game = require('./Game')
const Countdown = require('../countdown.js')
const LOG = true

let rooms = {}
let defaultRoom = {
  game: game,
  roomid: '',
  roomname: '',
  sockets: [],
  timer: 3,
  timerActive: false,
  roomTimer: null,
  messages: [],
  gameState: {
    active: false,
    event: 'pre_round',
    timer: 0,
    turnIndex: 1,
    turnUser: {},
    round: 1,
    roundWord: '',
    numberOfRounds: 5,
    numberOfTurns: 4,
    roundTimer: 10,
  },
  usersState: {},
}
let defaultRoomUser = {
  guesses: [],
  ready: false,
  match: false,
  typing: false,
  drawing: false,
  color: '',
  score: 0,
  lastTurnScore: 0,
}

// socket events
io.on('connection', (socket) => {
  socket.on('get_rooms', () => socket.emit('update_rooms', formatRooms(rooms)))
  socket.on('create_room', (room) => createRoom(room, socket))
  socket.on('join_room', (roomid) => joinRoom(roomid, socket))
  socket.on('leave_room', () => leaveRoom(socket))
  socket.on('toggle_ready', () => toggleReady(socket))
  socket.on('message', (message) => roomMessage(message, socket))
  socket.on('color', (color) => setColor(color, socket))
  socket.on('typing', (typing) => setTyping(typing, socket))
  socket.on('disconnecting', () => leaveRoom(socket.roomid, socket))
})

// events
function createRoom(room, socket) {
  log('create-room')

  // if room exists, error out
  if (!socket || roomExists(room.roomid)) {
    log('create-room:error');
    return
  }

  // create room
  rooms[room.roomid] = getDefaultRoom(room)

  // join room after it's created
  joinRoom(room.roomid, socket)
}
function removeRoom(roomid) {
  log('remove-room')

  // validation
  if (!socket || !roomExists(roomid)) {
    log('remove-room:error');
    return
  }

  // remove room from rooms object
  delete rooms[roomid]

  // update ui
  updateRooms()
}
function joinRoom(roomid, socket) {
  log('join-room')

  // if room doesn't exists don't join
  if (!socket || !roomExists(roomid)) {
    onSocketError(socket, 'join-room')
    return
  }
  // if room exists and user is already in the game, do nothing
  if (roomExists(roomid, socket.userid)) {
    log('join-room:already-in-room');
    updateRoomState()
    return
  }

  // join room
  socket.join(roomid, () => {
    let room = rooms[roomid]

    // set socket roomid
    socket.roomid = roomid
    socket.color = getColor(room.usersState)

    // add socket to room
    room.sockets.push(socket)

    // add user to room
    room.usersState[socket.userid] = getDefaultUser(socket)

    // add event to message
    roomMessage('', socket, 'join-room')

    // update state
    updateRoomState(room, true)
  })
}
function leaveRoom(socket) {
  log('leave-room')

  // if room or user doesn't exists don't join
  if (!socket || !roomExists(socket.roomid, socket.userid)) {
    onSocketError(socket, 'leave-room')
    return
  }

  // add event to message
  roomMessage('', socket, 'leave-room')

  // leave room
  socket.leave(socket.roomid, () => {
    let tempRoomid = socket.roomid
    let room = rooms[socket.roomid]

    // remove user object from room
    delete room.usersState[socket.userid]

    // reset socket
    socket.roomid = ''
    socket.color = ''

    // remove socket
    const index = room.sockets.findIndex((s) => s.userid === socket.userid)
    if (index > -1) {
      room.sockets.splice(index, 1)
    }



    // if the room is empty, remove the room
    if (room.sockets.length === 0) {
      removeRoom(tempRoomid)
    } else {
      updateRoomState(room, true)
    }
  })
}
function toggleReady(socket) {
  log('toggle-ready')

  if (!socket || !roomExists(socket.roomid, socket.userid)) {
    onSocketError(socket, 'toggle-ready')
    return
  }

  // toggle ready
  setRoomUserState(socket, 'ready', !getRoomUserState(socket, 'ready'), true)

  // if all users are ready start or stop the room timer
  if (allUsersReady(socket)) {
    startRoomTimer(socket)
  }
  else {
    stopRoomTimer(socket)
  }
}
function setTyping(typing, socket) {
  log('set-typing')

  if (!socket || !roomExists(socket.roomid, socket.userid)) {
    onSocketError(socket, 'set-typing')
    return
  }

  // toggle ready
  setRoomUserState(socket, 'typing', typing, true)
}
function setColor(color, socket) {
  log('set-color')

  if (!socket || !roomExists(socket.roomid, socket.userid)) {
    onSocketError(socket, 'set-color')
    return
  }

  // toggle ready
  setRoomUserState(socket, 'color', color, true)
}

// messages
function roomMessage(message, socket, event) {
    log('message');

  if (!socket || !roomExists(socket.roomid, socket.userid)) {
    log('message:error');
    onError(socket)
    return
  }

  let room = rooms[socket.roomid]
  room.messages.push({
    username: socket.username,
    userid: socket.userid,
    message,
    event,
  })

  updateRoomState(room)
}

// room timer
function startRoomTimer(socket) {
  setRoomState(socket.roomid, 'timer', 3)
  setRoomState(socket.roomid, 'timerActive', true, true)
  rooms[socket.roomid].roomTimer = new Countdown({ 
    seconds: 3,
    onUpdateStatus: function(interval) {
      roomMessage(interval, socket, 'countdown')
      setRoomState(socket.roomid, 'timer', interval, true)
    },
    onCounterEnd: function() {
      setRoomState(socket.roomid, 'gameState.active', true, true)
    }
  });
  rooms[socket.roomid].roomTimer.start();
}
function stopRoomTimer(socket) {
  let roundTimer = rooms[socket.roomid].roomTimer
  setRoomState(socket.roomid, 'timerActive', false, true)
  if (roundTimer) {
    roundTimer.stop()
  }
}

// brodcast
function updateRoomState(room, updateAllRooms = false) {
  if (!room) {
    return
  }
  for (const client of room.sockets) {
    client.emit('update_room', formatRoom(room))
  }
  if (updateAllRooms) {
    updateRooms()
  }
}
function updateRooms() {
  io.emit('update_rooms', formatRooms(rooms))
}
function onError(socket, message) {
  log(`${message}:error`)
  if (socket && socket.emit) {
    socket.emit('join_room_error')
    if (socket.roomid) {
      removeRoom(socket.roomid)
    }
  }
}
function onSocketError(socket) {
  if (socket) {
    socket.emit('join_room_error')
  }
}

// setters
function setRoomState(roomid, path, value, shouldUpdate = false) {
  _.set(rooms, `${roomid}.${path}`, value)
  if (shouldUpdate) {
    updateRoomState(rooms[roomid])
  }
}
function setRoomUserState(socket, path, value, shouldUpdate = false) {
  _.set(rooms, `${socket.roomid}.usersState.${socket.userid}.${path}`, value)
  if (shouldUpdate) {
    updateRoomState(rooms[socket.roomid])
  }
}

// getters
function getRoomUserState(socket, path) {
  return _.get(rooms, `${socket.roomid}.usersState.${socket.userid}.${path}`)
}

// helpers
function allUsersReady(socket) {
  let userArray = Object.values(_.get(rooms, `${socket.roomid}.usersState`))
  return userArray.length > 1 && userArray.every((user) => user.ready)
}
function roomExists(roomid, userid) {
  // if the room isn't defined
  if (rooms[roomid] === undefined) {
    log('room-not-found');
    return false
  }
  // if the user isn't defined
  else if (userid !== undefined && _.get(rooms, `${roomid}.usersState.${userid}`) === undefined) {
    log('user-not-found');
    return false
  }
  else return true
}
function getDefaultRoom(room) {
  return {
    ..._.cloneDeep(defaultRoom),
    ...room,
  }
}
function getDefaultUser(socket) {
  return {
    ..._.cloneDeep(defaultRoomUser),
    username: socket.username,
    userid: socket.userid,
    color: socket.color,
  }
}
function log(message) {
  if (LOG) {
    console.log(`room:${message}`)
  }
}
function formatRooms() {
  let returnRooms = {}
  let roomids = Object.keys(_.cloneDeep(rooms))
  roomids.forEach((roomid) => {
    returnRooms[roomid] = formatRoom(_.cloneDeep(rooms[roomid]))
  })
  return returnRooms
}
function formatRoom(room) {
  return _.cloneDeep({
    ...room,
    game: null,
    sockets: [],
  })
}
