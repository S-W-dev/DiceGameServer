const app = require('express')();
const http = require('http').createServer(app);
const WebSocket = require('ws');

const ws = new WebSocket.Server({ port: 667 });

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

app.post('/webhook', (req, res) => {
	console.log("received webhook. Restarting now.")
	process.exit();
});

var rooms = [];

class PlayerStatus { 
	constructor() {}
}
PlayerStatus.prototype.BETTING = "betting";
PlayerStatus.prototype.WAITING = "waiting";
PlayerStatus.prototype.LOST = "lost";
PlayerStatus.prototype.WON = "won";
PlayerStatus.prototype.CONNECTING = "connecting";
PlayerStatus.prototype.DISCONNECTED = "disconnected";

class Player {
	constructor(socket, room) {
		this.socket = socket;
		this.room = room;
		this.id = room.players.length;
		this.name = "Player";
		this.status = PlayerStatus.CONNECTING;
		this.money = 10000;
		
		this.timeout = 0;

		socket.send("connected");

		socket.on('message', this.handleClientMessage);
	}

	handleClientMessage(message) {
		console.log('received: %s', message); //temporary
	}

	Update() {
		socket.send(
			JSON.stringify({
				type: "update",
				content: {
					room: this.room,
					id: this.id,
					name: this.name,
					status: this.status,
					money: this.money
				}
			})
		);
	}

}

class Room {
	constructor(roomCode) {
		this.roomCode = roomCode;

		this.maxPlayers = 2;
		this.minPlayers = 2;

		this.players = [];

		setInterval(this.gameLoop, 1000);

	}

	gameLoop() {

		if (this.players >= minPlayers && this.players <= maxPlayers) {

			//player logic
			this.players.forEach((player, index) => {
				player.socket.on('close', () => {
					player.status = PlayerStatus.DISCONNECTED;
					if (player.timeout >= 30 && player.status == PlayerStatus.DISCONNECTED) return players.splice(index, 1);
					player.timeout++;
				})
			});

		}

		function setPlayerStatus(player, status) {
			player.status = status;
		}

	}

	addPlayer(socket) {
		let player = new Player(socket);
		this.players.push(player);
	}

}

ws.on('connection', (socket) => {
	console.log('a user connected');
	var room;
	if (rooms.length == 0 || rooms[rooms.length - 1].players.length >= rooms[rooms.length - 1].maxPlayers) {
		room = new Room(makeid(5))
		rooms.push(room);
	}
	else room = rooms.filter(room => { return room.players.length < room.maxPlayers })[0];


	room.addPlayer(socket);

	console.table(rooms);

});

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