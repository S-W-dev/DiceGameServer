const app = require('express')();
const http = require('http').createServer(app);
const WebSocket = require('ws');

const ws = new WebSocket.Server({ port: 667 });

app.get('/', (req, res) => {
res.send(`${rooms.length} rooms active. ${

	()=>{
		var i = 0;
		rooms.forEach(({players}) => {
		players.forEach(player => {
			i++;
		})
	})
	return i;
	}
	
} players active.`)
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
		this.choice = 0;
		this.hasBet = false;

		socket.send("connected");

		console.log("New player is " + this.status);

		socket.on('message', (data) => this.handleClientMessage(data));
		socket.on('close', () => this.leaveGame());

	}

	leaveGame() {
		console.log("player leaving game");
		try { rooms[this.room].players.splice(this.id, 1); } catch (x) { }
		try { if (rooms[this.room].players.length <= 0) rooms.splice(rooms.indexOf(rooms[this.room]), 1); } catch (x) { }
	}

	handleClientMessage(message) {
		if (message == "connected") this.setStatus(PlayerStatus.WAITING);
		else {
			try {
				message = JSON.parse(message);
				if (message.type == "bet") {
					if (message.bet <= this.money && message.bet >= 100 && message.choice <= 6 && message.choice >= 1) {
						this.bet = message.bet;
						this.choice = message.choice;
						this.hasBet = true;
					} //we need to send an error message here
				}
				//  else if (message.type == "set") {
				// 	Object.keys(({type, ...message})=>{return message}).forEach({key} => {
				// 		if (this.hasOwnProperty(key)) this[key] = message["set"][key]
				// 	});
				// }
			} catch (x) {
				console.log('received: %s', message);
			}
		}
	}

	setStatus(status) {
		if (this.status != PlayerStatus.LOST) this.status = status;
		console.log(this.status);
	}

	resetPlayer() {
		this.money = 10000;
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

		setInterval((THIS = this) => { if (THIS.hasPlayerJoined) THIS.gameLoop() }, 1000);

	}

	gameLoop() {

		//console.log(this);

		if (this.players >= this.minPlayers && this.players <= maxPlayers && this.running) {

			if (this.players.filter(player => { return player.status != PlayerStatus.LOST }).length <= 1) running = false;

			//wait for all players to bet
			while (!haveAllPlayersBet()) {
				this.players.forEach(player => {
					if (player.hasBet) player.setStatus(PlayerStatus.WAITING);
					else player.setStatus(PlayerStatus.BETTING);
				});
			}

			//roll the dice
			let dice = ~~(Math.random() * 6) + 1;

			this.Update();

			//determine outcome for each player
			let losses = 0;
			let winners = [];
			this.players.filter(player => { return player.status != PlayerStatus.LOST }).forEach((player, index) => {

				if (player.choice != dice) {
					setPlayerStatus(player, PlayerStatus.LOST_BET);
					player.money -= player.bet;
					losses += player.bet;
					if (player.money <= 0) setPlayerStatus(PlayerStatus.LOST);
				}

				if (player.choice == dice) {
					setPlayerStatus(player, PlayerStatus.WON_BET);
					winners.push(player);
				}

			});

			winners.forEach(player => {
				player.money += ~~(losses / winners.length)
			});

			// this.players.forEach(player => {

			// });

		} else if (this.running == false) {

			this.players.forEach(player => {
				if (player.status == PlayerStatus.LOST) player.resetPlayer();
			});

			running = true;

		} //else 

		this.Update();

		function haveAllPlayersBet() {
			return this.players.filter(player => { return !player.hasBet }).length == 0
		}

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
		// this.players.reduce((previous, current) => {
		// 	return previous.push(({socket,...rest} = current)=>{return rest}), previous;
		// }, []);forEach((player, index) => {
		// 	this.players[index].socket.send(
		// 		JSON.stringify({
		// 			player: player,
		// 			roll: this.roll,
		// 			players: players
		// 		})
		// 	);
		// });
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

// setInterval(() => {
// 	console.table(rooms);
// }, 100);

http.listen(666, () => {
	console.log('listening on *:666');
});

function makeid(length) {
	var result = '';
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}