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
PlayerStatus.BETTING = "betting";
PlayerStatus.WAITING = "waiting";
PlayerStatus.LOST = "lost";
PlayerStatus.WON = "won";
PlayerStatus.WON_BET = "won_bet";
PlayerStatus.CONNECTING = "connecting";
PlayerStatus.DISCONNECTED = "disconnected";

class Player {
	constructor(socket, room) {
		this.socket = socket;
		this.room = room;
		this.id = rooms[this.room].players.length || 0;
		this.name = "Player";
		this.status = PlayerStatus.CONNECTING;
		this.money = 10000;
		this.bet = 0;
		this.hasBet = false;
		
		socket.send("connected");

		console.log("New player is " + this.status);

		socket.on('message', (data)=>this.handleClientMessage(data));
		socket.on('close', ()=>this.leaveGame());

	}

	leaveGame() {
		//console.log(this.room);
		rooms[this.room].players.splice(this.id, 1);
		//console.table(rooms);
	}

	handleClientMessage(message) {
		console.log('received: %s', message); //temporary
		if (message == "connected") {
			this.setStatus(PlayerStatus.WAITING);
		}
	}

	setStatus(status) {
		if (this.status != PlayerStatus.LOST) this.status = status;
		console.log(this.status);
	}

	resetPlayer() {
		this.money = 10000;
		this.bet = 0;
		this.hasBet = false;
	}

	Update() {
		socket.send(
			JSON.stringify({
				type: "player_update",
				player: {
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

		this.roll = 0;

		this.running = true;

		setInterval((THIS=this) => {THIS.gameLoop()}, 1000);

	}

	gameLoop() {

		//console.log(this);

		if (this.players >= this.minPlayers && this.players <= maxPlayers && this.running) {

			if (this.players.filter(player => {return player.status != PlayerStatus.LOST}).length <= 1) running = false;

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
			this.players.filter(player => {return player.status != PlayerStatus.LOST}).forEach((player, index) => {

			if (player.bet != dice) {
				setPlayerStatus(player, PlayerStatus.LOST_BET);
				player.money -= player.bet;
				losses += player.bet;
				if (player.money <= 0) setPlayerStatus(PlayerStatus.LOST);
				player.Update();
			}

			if (player.bet == dice) {
				setPlayerStatus(player, PlayerStatus.WON_BET);
				winners.push(player);
			}

			});

			winners.forEach(player => {
				player.money += ~~(losses / winners.length)
				player.Update();
			});

		}

		this.Update();

		function haveAllPlayersBet() {
			return this.players.filter(player => {return !player.hasBet}).length == 0
		}

	}

	addPlayer(socket, roomIndex) {
		let player = new Player(socket, roomIndex);
		this.players.push(player);
	}

	Update() {
		let players = [];
		this.players.forEach(({socket, ...rest} = player) => {
			players.push(rest);
		});
		this.players.forEach(({socket , ...rest} = player) => {
			socket.send(
			JSON.stringify({
				player: rest,
				roll: this.roll,
				players: players
			})
		);
		})
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

	room.addPlayer(socket, rooms.indexOf(room));

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