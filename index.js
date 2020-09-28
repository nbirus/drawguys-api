const app = require('express')()
const http = require('http').Server(app)
const cors = require('cors')
const PORT = process.env.PORT || 3000
const io = require('./socket.js').init(http)

// cors
app.use(cors())

require('./services/User.js')
require('./services/Room.js')
// require('./services/global.js')
// const game = require('./services/game.js')

// start server
http.listen(PORT, function () {
  console.log(`listening on *:${PORT}`)
})
