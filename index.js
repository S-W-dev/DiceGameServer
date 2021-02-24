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
PlayerStatus.BETTING = "Betting...";
PlayerStatus.WAITING = "Waiting...";
PlayerStatus.LOST = "Lost Game";
PlayerStatus.LOST_BET = "Lost Bet";
PlayerStatus.WON = "Won Game!";
PlayerStatus.WON_BET = "Won Bet!";
PlayerStatus.CONNECTING = "Connecting...";
PlayerStatus.DISCONNECTED = "Disconnected.";

class Player {
	constructor(socket, room) {
		this.socket = socket;
		this.room = room;
		this.id = rooms[this.room].players.length || 0;
		this.socketId = makeid(20);
		this.room_code = rooms[this.room].roomCode;

		this.name = "Player";
		this.status = PlayerStatus.CONNECTING;
		this.money = 10000;

		this.bet = 0;
		this.choice = 0;
		this.hasBet = false;

		this.timeout = 0;
		this.timeouts = 0;

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
		try {
			rooms[this.room].playerLeavingGame(this.socketId);
		} catch (x) { }
		this.resetPlayer();
	}

	handleClientMessage(message) {
		if (message == "connected") {
			this.setStatus(PlayerStatus.WAITING);
			console.log(message);
		}
		else {
			try {
				message = JSON.parse(message);
				switch (message.type) {
					case "bet":
						if (message.bet <= this.money && message.bet >= 100 && message.choice <= 6 && message.choice >= 1) {
							this.bet = message.bet;
							this.choice = message.choice;
							this.hasBet = true;
							this.timeout = 0;
						}
						break;
					case "name":
						this.name = message.name;
						break;
					case "money":
						this.money = message.money;
						break;
					case "join":
						var matchingRooms = rooms.filter(room => room.roomCode == message.room_code);
						if (matchingRooms.length == 1) {
							this.leaveGame();
							matchingRooms[0].addPlayer(this.socket, rooms.indexOf(matchingRooms[0]));
						}
						break;
				}
			} catch (x) {
				switch (message) {
					case "connected":
						rooms[this.room].playerJoiningGame(this.socketId);
						break;
					default:
						console.log(x);
						console.log('Received: %s', message);
						break;
				}
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
		this.timeout = 0;
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

		setInterval(() => { if (this.hasPlayerJoined) this.gameLoop() }, 1000);
	}

	playerLeavingGame(socketId) {
		this.players.forEach(player => {
			player.socket.send(JSON.stringify({ type: "leave", socketId }));
		})
	}

	playerJoiningGame(socketId) {
		this.players.forEach(player => {
			player.socket.send(JSON.stringify({ type: "join", socketId }));
		})
	}

	gameLoop() {
		if (this.players.length >= this.minPlayers && this.players.length <= this.maxPlayers && this.running) {

			//stop game if everyone has lost
			if (this.players.filter(player => { return player.status != PlayerStatus.LOST }).length <= 1) this.running = false;

			//if players haven't all bet, wait until they have
			if (!(this.players.filter(player => { return !player.hasBet }).length == 0)) {
				this.players.forEach(player => {
					if (player.hasBet) player.setStatus(PlayerStatus.WAITING);
					else {
						if (player.timeout >= 30) {
							if (player.timeouts >= 3) {
								player.leaveGame();
							} else {
								player.bet = 100;
								player.choice = 1;
								player.hasBet = true;
								player.timeout = 0;
								player.timeouts++;
							}
						} else {
							player.setStatus(PlayerStatus.BETTING);
							player.timeout++;
						}
					}
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
	for (var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', i = 0; i < length; i++) result += c.charAt(Math.floor(Math.random() * c.length));
	return result;
}