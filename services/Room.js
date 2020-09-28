const io = require('../socket.js').getio()
const _ = require('lodash')
const getColor = require('../assets/colors').default
const LOG = true

let rooms = {
  // test: {
  //   roomid: 'test',
  //   roomname: 'test',
  //   active: false,
  //   users: {
  //     test: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'blue',
  //       score: 0,
  //       username: 'Usernmae',
  //     },
  //     test2: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'maroon',
  //       score: 0,
  //       username: 'Other',
  //     },
  //   },
  //   sockets: [],
  //   messages: [],
  // },
  // test2: {
  //   roomid: 'test',
  //   roomname: 'Room Name',
  //   active: false,
  //   users: {
  //     test: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'orange',
  //       score: 0,
  //       username: 'Test',
  //     },
  //   },
  //   sockets: [],
  //   messages: [],
  // },
  // test3: {
  //   roomid: 'test',
  //   roomname: 'Room Three',
  //   active: false,
  //   users: {
  //     test: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'purple',
  //       score: 0,
  //       username: 'Lorium',
  //     },
  //     test2: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'green',
  //       score: 0,
  //       username: 'Other',
  //     },
  //     test2: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'red',
  //       score: 0,
  //       username: 'Other',
  //     },
  //   },
  //   sockets: [],
  //   messages: [],
  // },
  // test4: {
  //   roomid: 'test',
  //   roomname: 'test',
  //   active: false,
  //   users: {
  //     test: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'blue',
  //       score: 0,
  //       username: 'Usernmae',
  //     },
  //     test2: {
  //       guesses: [],
  //       ready: false,
  //       match: false,
  //       typing: false,
  //       color: 'maroon',
  //       score: 0,
  //       username: 'Other',
  //     },
  //   },
  //   sockets: [],
  //   messages: [],
  // },
}
let defaultRoom = {
  roomid: '',
  roomname: '',
  active: false,
  users: {},
  sockets: [],
  messages: [],
}
let defaultRoomUser = {
  guesses: [],
  ready: false,
  match: false,
  typing: false,
  color: '',
  score: 0,
}

// socket events
io.on('connection', (socket) => {
  socket.on('get_rooms', () => getRooms(socket))
  socket.on('create_room', (room) => createRoom(room, socket))
  socket.on('join_room', (roomid) => joinRoom(roomid, socket))
  socket.on('leave_room', (roomid) => leaveRoom(roomid, socket))
  socket.on('toggle_ready', (userid) => toggleReady(userid, socket))
  socket.on('message', (message) => addMessage(message, socket))
  socket.on('color', (color) => setColor(color, socket))
  socket.on('typing', (typing) => setTyping(typing, socket))
  socket.on('disconnecting', () => {
    if (socket.roomid) {
      leaveRoom(socket.roomid, socket)
    }
  })
})

// actions
function getRooms(socket) {
  socket.emit('update_rooms', formatRooms(rooms))
}
function createRoom(room, socket) {
  log('create-room', room.roomid)

  // validation
  if (!socket || !room.roomid) {
    log('create-room:error', room.roomid)
    return
  }

  // add room to rooms object
  rooms[room.roomid] = {
    ..._.cloneDeep(defaultRoom),
    ...room,
  }

  // join room after it's created
  joinRoom(room.roomid, socket)
}
function removeRoom(roomid) {
  log('remove-room', roomid)

  // validation
  if (!socket || !roomid || !rooms[roomid]) {
    log('remove-room:error', room.roomid)
    return
  }

  // remove room from rooms object
  delete rooms[roomid]

  brodcastRooms()
}
function joinRoom(roomid, socket) {
  log('join-room', roomid)

  let room = rooms[roomid]

  // validation
  if (!socket || !room || Object.keys(room.users).length === 8) {
    log('join-room:error', socket.userid)
    socket.emit('join_room_error')
    return
  }

  // join room
  socket.join(roomid, () => {
    // set socket roomid
    socket.roomid = roomid
    socket.color = getColor(room.users)

    // add socket to room
    room.sockets.push(socket)

    // add user to room
    room.users[socket.userid] = {
      ..._.cloneDeep(defaultRoomUser),
      username: socket.username,
      userid: socket.userid,
      color: socket.color,
    }

    addMessage('', socket, 'join-room')
    brodcastRooms()
    updateRoom(room)
  })
}
function leaveRoom(roomid, socket) {
  log('leave-room', roomid)

  let room = rooms[roomid]

  // validation
  if (!socket || !room || !room.users[socket.userid]) {
    log('leave-room:error', roomid)
    return
  }

  addMessage('', socket, 'leave-room')

  socket.leave(roomid, () => {
    // reset roomid on socket
    socket.roomid = ''

    // remove user object from room
    delete room.users[socket.userid]

    // remove socket
    const index = room.sockets.findIndex((s) => s.userid === socket.userid)
    if (index > -1) {
      room.sockets.splice(index, 1)
    }

    // if the room is empty, remove the room
    if (room.sockets.length === 0) {
      removeRoom(roomid)
    } else {
      brodcastRooms()
      updateRoom(room)
    }
  })
}
function toggleReady(userid, socket) {
  log('toggle-ready', userid)

  let room = rooms[socket.roomid]

  // validation
  if (!socket || !room || !room.users[userid]) {
    log('toggle-ready:error', socket.roomid)
    return
  }

  // toggle ready
  room.users[userid].ready = !room.users[userid].ready

  let userArray = Object.values(room.users)
  if (userArray.length > 1 && userArray.every((user) => user.ready)) {
    startGameCountdown(socket)
  } else {
    stopGameCountdown(socket)
  }

  brodcastRooms()
  updateRoom(room)
}
function addMessage(message, socket, event) {
  log('message', message)

  let room = rooms[socket.roomid]

  // validation
  if (!socket || !room) {
    log('message:error', message)
    return
  }

  // add message
  room.messages.push({
    username: socket.username,
    userid: socket.userid,
    message,
    event,
  })

  // update
  updateRoom(room)
}
function setColor(color, socket) {
  let room = rooms[socket.roomid]
  // validation
  if (!socket || !room || !room.users[socket.userid]) {
    log('set-color:error', socket.userid)
    return
  }

  room.users[socket.userid].color = color

  brodcastRooms()
  updateRoom(room)
}
function setTyping(typing, socket) {
  let room = rooms[socket.roomid]
  // validation
  if (!socket || !room || !room.users[socket.userid]) {
    log('set-typing:error', socket.userid)
    return
  }

  room.users[socket.userid].typing = typing

  updateRoom(room)
}
function startGame(socket) {
  log('start')

  let room = rooms[socket.roomid]

  // validation
  if (!socket || !room || !room.users[userid]) {
    log('start:error', socket.roomid)
    return
  }

  // set game to active
  room.active = true

  updateRoom(room)
  brodcastRooms()
}

let countdownInterval = null
function startGameCountdown(socket) {
  let count = 3
  countdownInterval = setInterval(countDown, 1000)

  function countDown() {
    addMessage(count, socket, 'countdown')
    if (count === 0) {
      clearInterval(countdownInterval)
      countdownInterval = null
      startGame(socket)
    }
    count--
  }
}
function stopGameCountdown(socket) {
  if (countdownInterval) {
    addMessage('', socket, 'countdown-cancel')
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

// broadcasts
function brodcastRooms() {
  io.emit('update_rooms', formatRooms(rooms))
}
function updateRoom(room) {
  for (const client of room.sockets) {
    client.emit('update_room', formatRoom(room))
  }
}

// helpers
function log(message, roomid) {
  if (LOG) {
    console.log(`room:${message}`, roomid)
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
