const app = require('express')();
const http = require('http').createServer(app);
const WebSocket = require('ws');

const ws = new WebSocket.Server({port: 666});

ws.on('connection', function open() {
  ws.send('something');
	console.log("open")
});

ws.on('message', function incoming(data) {
  console.log(data);
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/webhook', (req, res) => {
	console.log("received webhook. Restarting now.")
process.exit();
});

var rooms = [];

class Room {
	constructor(roomCode) {
		this.roomCode = roomCode;
		
		this.maxRoomLength = 2;
		this.players = [];

	}

	addPlayer(socket) {
		players.push(socket);
		socket.emit("connected");
	}

}

// io.on('connection', (socket) => {
//   console.log('a user connected');
// 	var room;
// 	if (rooms.length == 0 || rooms[rooms.length-1].players.length >= rooms[rooms.length-1].maxRoomLength) room = new Room(makeid(5))

// 	room.addPlayer(socket);

// });

http.listen(666, () => {
  console.log('listening on *:666');
});

function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}