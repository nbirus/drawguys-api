const io = require('../socket.js').getio()
const _ = require('lodash')
const LOG = false

// socket events
io.on('connection', (socket) => {
  socket.on('set_user', (user) => setUser(user, socket))
})

// actions
function setUser(user, socket) {
  log('set-user', user.userid)
  socket.userid = user.userid
  socket.username = user.username
}

// helpers
function log(message, userid) {
  if (LOG) {
    console.log(`user:${message}`, userid)
  }
}
