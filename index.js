const app = require('express')()
const cors = require('cors')

app.use(cors())
app.options('*', cors())

const http = require('http').Server(app)
const PORT = process.env.PORT || 3000
const io = require('./socket.js').init(http)

require('./services/User.js')
require('./services/Room.js')
// require('./services/Game.js')

// start server
http.listen(PORT, function () {
  console.log(`listening on *:${PORT}`)
})
