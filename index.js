const app = require('express')();
const http = require('http').createServer(app);
const WebSocket = require('ws');
const ws = new WebSocket.Server({ port: 667 });
let calcPlayers = () => {
	var i = 0;
	rooms.forEach(({ players }) => {
		players.forEach(player => {
			i++;
		})
	})
	return i;
}
var rooms = [];

app.get('/', (req, res) => {
	res.send(`${rooms.length} room(s) active. ${calcPlayers()} player(s) active.`)
});

app.post('/webhook', (req, res) => {
	console.log("received webhook. Restarting now.")
	process.exit();
});

http.listen(666, () => {
	console.log('listening on *:666');
});

class PlayerStatus { }
PlayerStatus.BETTING = "betting";
PlayerStatus.WAITING = "waiting";
PlayerStatus.LOST = "lost";
PlayerStatus.LOST_BET = "lost";
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
		this.choice = 0;
		this.hasBet = false;

		socket.send("connected");

		socket.on('message', (data) => this.handleClientMessage(data));
		socket.on('close', () => this.leaveGame());
	}

	leaveGame() {
		try {
			rooms[this.room].players.splice(this.id, 1);
		} catch (x) { }
		try {
			if (rooms[this.room].players.length <= 0) rooms.splice(rooms.indexOf(rooms[this.room]), 1);
		} catch (x) { }
	}

	handleClientMessage(message) {
		if (message == "connected") this.setStatus(PlayerStatus.WAITING);
		else {
			try {
				message = JSON.parse(message);
				switch (message.type) {
					case "bet":
						if (message.bet <= this.money && message.bet >= 100 && message.choice <= 6 && message.choice >= 1) {
							this.bet = message.bet;
							this.choice = message.choice;
							this.hasBet = true;
						}
						break;
					case "name":
						this.name = message.name;
						break;
				}
			} catch (x) {
				console.log('received: %s', message);
			}
		}
	}
	setStatus(status) {
		if (this.status != PlayerStatus.LOST) this.status = status;
	}
	resetPlayer() {
		this.money = 10000;
		this.nextRound();
	}
	nextRound() {
		this.bet = 0;
		this.choice = 0;
		this.hasBet = false;
	}
}

class Room {
	constructor(roomCode) {
		this.roomCode = roomCode;

		this.maxPlayers = 8;
		this.minPlayers = 2;

		this.players = [];
		this.roll = 0;
		this.running = true;
		this.hasPlayerJoined = false;

		setInterval(( => { if (this.hasPlayerJoined) this.gameLoop() }, 1000);
	}

	gameLoop() {
		if (this.players.length >= this.minPlayers && this.players.length <= this.maxPlayers && this.running) {

			//stop game if everyone has lost
			if (this.players.filter(player => { return player.status != PlayerStatus.LOST }).length <= 1) this.running = false;

			//if players haven't all bet, wait until they have
			if (!(this.players.filter(player => { return !player.hasBet }).length == 0)) {
				this.players.forEach(player => {
					if (player.hasBet) player.setStatus(PlayerStatus.WAITING);
					else player.setStatus(PlayerStatus.BETTING);
				});
			} else {

				//roll the dice
				let dice = ~~(Math.random() * 6) + 1;

				let losses = 0
				let winners = [];

				this.roll = dice;

				//loop through players that are still in the game
				this.players.filter(player => { return player.status != PlayerStatus.LOST }).forEach((player, index) => {

					//player lost bet
					if (player.choice != dice) {
						player.setStatus(PlayerStatus.LOST_BET);
						player.money -= player.bet;
						losses += player.bet;
						if (player.money <= 0) player.setStatus(PlayerStatus.LOST);
					}

					//player won bet
					if (player.choice == dice) {
						player.setStatus(PlayerStatus.WON_BET);
						winners.push(player);
					}

				});

				//split winnings among winners
				winners.forEach(player => {
					player.money += ~~(losses / winners.length)
				});

				//start next round
				this.players.forEach(player => player.nextRound())
			}
		} else if (this.running == false) {
			//reset players that have lost
			this.players.forEach(player => {
				if (player.status == PlayerStatus.LOST) player.resetPlayer();
			});
			this.running = true;
		}
		//send update to every player
		this.Update();
	}

	addPlayer(socket, roomIndex) {
		let player = new Player(socket, roomIndex);
		this.players.push(player);
		this.hasPlayerJoined = true;
	}

	Update() {
		let players = [];
		this.players.forEach(({ socket, ...rest } = player) => {
			players.push(rest);
		});
		this.players.forEach(({ socket, ...rest } = player) => {
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
});

function makeid(length) {
	var result = '';
	for (var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', i = 0; i < c.length; i++) result += c.charAt(Math.floor(Math.random() * c.length));
	return result;
}