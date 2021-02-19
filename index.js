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

class PlayerStatus { }
PlayerStatus.prototype.BETTING = "betting";
PlayerStatus.prototype.WAITING = "waiting";
PlayerStatus.prototype.LOST = "lost";
PlayerStatus.prototype.WON = "won";
PlayerStatus.prototype.WON_BET = "won_bet";
PlayerStatus.prototype.CONNECTING = "connecting";
PlayerStatus.prototype.DISCONNECTED = "disconnected";

class Player {
	constructor(socket, room) {
		this.socket = socket;
		this.room = room;
		this.id = room.players.length-1;
		this.name = "Player";
		this.status = PlayerStatus.CONNECTING;
		this.money = 10000;
		this.bet = 0;
		this.hasBet = false;
		
		this.timeout = 0;

		socket.send("connected");

		socket.on('message', this.handleClientMessage);
		socket.on('close', this.room.players.splice(this.id, 1));

	}

	handleClientMessage(message) {
		console.log('received: %s', message); //temporary
	}

	setStatus(status) {
		this.status = status;
	}

	Update() {
		socket.send(
			JSON.stringify({
				type: "player_update",
				player: {
					room: this.room,
					id: this.id,
					name: this.name,
					status: this.status,
					money: this.money
				},
				players: this.room.players
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

		this.roll = 0;

		setInterval(this.gameLoop, 1000);

	}

	gameLoop() {

		if (this.players >= minPlayers && this.players <= maxPlayers) {

			//wait for all players to bet
			while (!haveAllPlayersBet()) {
				this.players.forEach(player => {
					if (player.hasBet) player.setStatus(PlayerStatus.WAITING);
					else player.setStatus(PlayerStatus.BETTING);
					player.Update();
				});
			}

			//roll the dice
			let dice = ~~(Math.random() * 6) + 1;

			this.Update();

			//determine outcome for each player
			let losses = 0;
			let winners = [];
			this.players.forEach((player, index) => {

			if (player.bet != dice) {
				setPlayerStatus(player, PlayerStatus.LOST);
				player.money -= player.bet;
				losses += player.bet;
				player.Update();
			}

			if (player.bet == dice) {
				setPlayerStatus(player, PlayerStatus.WON);
				winners.push(player);
			}
			});

			winners.forEach(player => {
				player.money += ~~(losses / winners.length)
				player.Update();
			});

		}

		function haveAllPlayersBet() {
			return this.players.filter(player => {return !player.hasBet}).length == 0
		}

	}

	addPlayer(socket) {
		let player = new Player(socket);
		this.players.push(player);
	}

	Update() {
		socket.send(
			JSON.stringify({
				roll: this.roll;
			})
		);
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