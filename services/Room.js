const io = require('../socket.js').getio()
const _ = require('lodash')
const LOG = true

let rooms = {}
let defaultRoom = {
  roomname: '',
  roomid: '',
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
  socket.on('create_room', (room) => createRoom(room, socket))
  socket.on('join_room', (roomid) => joinRoom(roomid, socket))
  socket.on('leave_room', (roomid) => leaveRoom(roomid, socket))

  socket.on('disconnecting', () => {
    if (socket.roomid) {
      leaveRoom(socket.roomid, socket)
    }
  })

  // init rooms
  setTimeout(() => brodcastRooms, 50)
})

// actions
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
  if (!socket || !room) {
    log('join-room:error', socket.userid)
    socket.emit('join_room_error')
    return
  }

  // join room
  socket.join(roomid, () => {
    // set socket roomid
    socket.roomid = roomid

    // add socket to room
    room.sockets.push(socket)

    // add user to room
    room.users[socket.userid] = {
      ..._.cloneDeep(defaultRoomUser),
      username: socket.username,
      userid: socket.userid,
      color: 'blue', // TODO
    }

    brodcastRooms()
    brodcastRoom(room)
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
      brodcastRoom(room)
    }
  })
}

// broadcasts
function brodcastRooms() {
  // log('broadcast-rooms')
  io.emit('update_rooms', formatRooms(rooms))
}
function brodcastRoom(room) {
  // log('broadcast-room-update', room.roomid)
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
