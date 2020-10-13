const colors = [
  'blue',
  'olive',
  'orange',
  'red',
  'maroon',
  'fuchsia',
  'purple',
]

function getColor(users) {
  let activeIndexes = []
  for (let userid in users) {
    let color = users[userid].color
    let colorIndex = colors.findIndex((c) => c === color)
    if (colorIndex !== -1) {
      activeIndexes.push(colorIndex)
    }
  }
  function generateRandom(min, max) {
    var num = Math.floor(Math.random() * (max - min + 1)) + min
    return activeIndexes.includes(num) ? generateRandom(min, max) : num
  }
  return colors[generateRandom(0, 6)]
}

module.exports = getColor
