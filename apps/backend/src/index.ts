import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import cors from 'cors';

const app = express();

const port = 4000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// Use cors middleware
app.use(
    cors({
        origin: frontendUrl
    })
);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: frontendUrl, 
        methods: ['GET', 'POST'],
    },
});

// Lobby interface
interface Lobby {
    lobbyId: string;
    members: Set<string>;
    teamNames: Map<string, string>;
    observers: Set<string>;
    picked: Array<{ map: string; teamName: string; side: string }>;
    banned: Array<{ map: string; teamName: string }>;
    gameName: number;
    gameType: number;
    mapNames: Array<string>;
    gameStateList: string[];
    coinFlip: boolean;
    gameStep: number;
    admin: boolean;
}

// Data structure to store lobbies and their members
const lobbies = new Map<string, Lobby>();
let globalCoinFlip = true;
const gameTypeLists = [
    ['ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'pick'], // 0 Element - BO1
    ['ban', 'ban', 'pick', 'pick', 'ban', 'ban', 'pick'], // 1 Element - BO3
    ['ban', 'ban', 'pick', 'pick', 'pick', 'pick', 'pick'], // 2 Element - BO5
]
const mapNamesLists = [
    [ "Ancient", "Anubis", "Dust 2", "Inferno", "Mirage", "Nuke", "Overpass", "Train", "Vertigo"], // 0 Element - CS2
    [ "Abyss", "Ascent", "Bind", "Breeze", "District", "Drift", "Fracture", "Glitch", "Haven", "Icebox", "Kasbah", "Lotus", "Pearl", "Piazza", "Split", "Sunset"] // 1 Element - VALORANT  
];
const startMapPool = [
    [ "Nuke", "Dust 2", "Ancient", "Inferno", "Anubis", "Train", "Mirage"], // 0 Element - CS2
    [ "Ascent", "Bind", "Pearl", "Haven", "Abyss", "Sunset", "Split"] // 1 Element - VALORANT
];
let mapPool = startMapPool;

app.get('/api', (_req, res) => {
    res.send('Express + TypeScript Server');
});

const startGame = (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
        console.log('Game Started in lobby: ' + lobbyId);
        io.to(lobbyId).emit('teamNamesUpdated', Array.from(lobby.teamNames.entries()));
        io.to(lobbyId).emit('isCoin', lobby.coinFlip);

        if (lobby.coinFlip) {
            if (lobby.teamNames.size === 2) {
                const result = Math.floor(Math.random() * 2);
                io.to(lobbyId).emit('coinFlip', result);
                const entry = Array.from(lobby.teamNames.entries())[result];
                io.to(entry[0]).emit('canWorkUpdated', true);
                if (lobby.gameStateList[0] === 'ban') {
                    io.to(entry[0]).emit('canBan', true);
                    setTimeout(() => {
                        io.to(lobbyId).emit('gameStateUpdated', entry[1] + ' выбирают карту для бана');
                    }, 3000);
                } else {
                    io.to(entry[0]).emit('canPick', true);
                    setTimeout(() => {
                        io.to(lobbyId).emit('gameStateUpdated', entry[1] + ' выбирают карту для пика');
                    }, 3000);
                }
            }
        } else {
            for (const [otherSocketIdKey] of lobby.teamNames.entries()) {
                io.to(otherSocketIdKey).emit('canWorkUpdated', true);
                io.to(lobbyId).emit('startWithoutCoin');
                if (lobby.gameStateList[0] === 'ban') {
                    io.to(otherSocketIdKey).emit('canBan', true);
                    io.to(lobbyId).emit('gameStateUpdated', 'Выберите карту для бана');
                } else {
                    io.to(otherSocketIdKey).emit('canPick', true);
                    io.to(lobbyId).emit('gameStateUpdated', 'Выберите карту для пика');
                }
            }
        }
    }
}

// Admin endpoint to get the list of lobbies and their members
app.get('/api/lobbies', (_req, res) => {
    const lobbyList = Array.from(lobbies.values()).map((lobby) => ({
        lobbyId: lobby.lobbyId,
        members: Array.from(lobby.members),
        teamNames: Array.from(lobby.teamNames.entries()),
        observers: Array.from(lobby.observers),
        picked: lobby.picked,
        banned: lobby.banned,
        gameName: lobby.gameName,
        gameType: lobby.gameType,
        mapNames: lobby.mapNames,
        gameStateList: Array.from(lobby.gameStateList),
        coinFlip: lobby.coinFlip,
        admin: lobby.admin,
    }));
    res.json(lobbyList);
});

app.get('/api/mapPool', (req, res) => {
    res.json({ mapPool, mapNamesLists });
});

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    // Initialize the set of lobbies the socket is in
    socket.data.lobbies = new Set<string>();

    socket.on('joinLobby', (lobbyId: string) => {
        socket.join(lobbyId);
        console.log(`User ${socket.id} joined lobby ${lobbyId}`);

        // Check if the lobby exists
        const lobby = lobbies.get(lobbyId);
        if (!lobby) {
            io.to(socket.id).emit('lobbyUndefined', lobbyId);
            return;
        }
        
        io.to(lobbyId).emit('mapNames', lobby.mapNames);
        io.to(lobbyId).emit('gameName', lobby.gameName);

        // Add the socket ID to the lobby's member list
        lobby.members.add(socket.id);

        // Add the lobbyId to the socket's list of lobbies
        socket.data.lobbies.add(lobbyId);
        io.to(socket.id).emit('teamNamesUpdated', Array.from(lobby.teamNames.entries()));
        if (lobby.picked.length > 0) {
            io.to(socket.id).emit('pickedUpdated', lobby.picked);
        }
        if (lobby.banned.length > 0) {
            io.to(socket.id).emit('bannedUpdated', lobby.banned);
        }
    });

    socket.on('joinLobbyObs', (lobbyId: string) => {
        socket.join(lobbyId);
        console.log(`User ${socket.id} observing lobby ${lobbyId}`);

        // Check if the lobby exists
        const lobby = lobbies.get(lobbyId);
        if (!lobby) {
            io.to(socket.id).emit('lobbyUndefined', lobbyId);
            return;
        }

        io.to(lobbyId).emit('mapNames', lobby.mapNames);
        io.to(lobbyId).emit('gameName', lobby.gameName);

        // Add the socket ID to the lobby's member list
        lobby.observers.add(socket.id);

        // Add the lobbyId to the socket's list of lobbies
        socket.data.lobbies.add(lobbyId);
        io.to(socket.id).emit('pickedUpdated', lobby.picked);
        io.to(socket.id).emit('bannedUpdated', lobby.banned);
    })

    socket.on('createLobby', (data: {lobbyId: string; gameNum: number; gameTypeNum: number}) => {
        const {lobbyId, gameNum, gameTypeNum} = data;
        console.log('Lobby created with id ' + lobbyId);

        // Create a new lobby
        let lobby = lobbies.get(lobbyId);
        if (!lobby) {
            // Create a new lobby
            lobby = {
                lobbyId: lobbyId,
                members: new Set<string>(),
                teamNames: new Map<string, string>(),
                observers: new Set<string>(),
                picked: [],
                banned: [],
                gameName: gameNum,
                gameType: gameTypeNum,
                mapNames: mapPool[gameNum],
                gameStateList: gameTypeLists[gameTypeNum],
                coinFlip: globalCoinFlip,
                gameStep: 0,
                admin: false
            };

            lobbies.set(lobbyId, lobby);
        }
    });

    socket.on('createObsLobby', (data: {lobbyId: string; gameNum: number; gameTypeNum: number; coinFlip: boolean}) => {
        const {lobbyId, gameNum, gameTypeNum, coinFlip} = data;
        console.log('Admin Lobby created with id ' + lobbyId);

        let lobby = lobbies.get(lobbyId);
        if (!lobby) {
            // Create a new ADMIN lobby
            lobby = {
                lobbyId: lobbyId,
                members: new Set<string>(),
                teamNames: new Map<string, string>(),
                observers: new Set<string>(),
                picked: [],
                banned: [],
                gameName: gameNum,
                gameType: gameTypeNum,
                mapNames: mapPool[gameNum],
                gameStateList: gameTypeLists[gameTypeNum],
                coinFlip: coinFlip,
                gameStep: 0,
                admin: true
            };

            lobbies.set(lobbyId, lobby);
        }
    });

    socket.on('editMapPool', (newMapPool: string[][]) => {
        mapPool = newMapPool;
    });

    socket.on('resetMapPool' , () => {
        mapPool = startMapPool;
    });

    socket.on('coinFlipUpdate', (coinFlip: boolean) => {
        globalCoinFlip = coinFlip;
        console.log('Coin Flip globally updated to ' + coinFlip);
    });

    socket.on('getPatternList', (lobbyId: string) => {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            io.to(socket.id).emit('patternList', lobby.gameStateList);
        }
    });

    socket.on('teamName', (data: { lobbyId: string; teamName: string }) => {
        const {lobbyId, teamName} = data;
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            // Update the teamNames Map
            lobby.teamNames.set(socket.id, teamName);

            // Broadcast the updated team names to all lobby members
            io.to(lobbyId).emit('teamNamesUpdated', Array.from(lobby.teamNames.entries()));
            if (!lobby.admin) {
                startGame(lobbyId);
            }
        }
    });

    socket.on('start', (lobbyId: string) => {
        startGame(lobbyId);
    });

    socket.on('startPick', (data: { lobbyId: string; teamName: string; selectedMapIndex: number }) => {
        const { lobbyId, teamName, selectedMapIndex } = data;
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            let otherSocketId = "";
            for (const [otherSocketIdKey, otherNames] of lobby.teamNames.entries()) {
                if (otherNames !== teamName) {
                    otherSocketId = otherSocketIdKey;
                    break;
                }
            }
            const targetSocket = lobby.gameType === 0 ? socket.id : otherSocketId;
            const otherSocket = lobby.gameType === 0 ? otherSocketId : socket.id;

            io.to(targetSocket).emit('startPick', selectedMapIndex);
            io.to(otherSocket).emit('canWorkUpdated', false);
            io.to(otherSocket).emit('canPick', false);
        }
    });

    socket.on('pick', (data: { lobbyId: string; map: string; teamName: string; side: string }) => {
        console.log(data);
        const { lobbyId, map, teamName, side } = data;
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            lobby.picked.push({ map, teamName, side });
            lobby.gameStep++;

            // Send updated canWork to another team socket
            let otherSocketId = "";
            for (const [otherSocketIdKey, otherNames] of lobby.teamNames.entries()) {
                if (otherNames !== teamName) {
                    otherSocketId = otherSocketIdKey;
                    break;
                }
            }

            io.to(lobbyId).emit('gameStateUpdated',
                teamName + ' выбрали ' + (side === 't' ? 'атакующих' : side === 'ct' ? 'обороняющих' : side.toUpperCase())
                + ' на карте ' + map);
            io.to(otherSocketId).emit('endPick');

            if (lobby.gameStep < 7) {
                io.to(socket.id).emit('canWorkUpdated', true);
                if (lobby.gameStateList[lobby.gameStep] === 'pick') {
                    io.to(socket.id).emit('canPick', true);
                    setTimeout(() => {
                        io.to(lobbyId).emit('gameStateUpdated', teamName + ' выбирают карту для пика');
                    }, 3000);
                } else {
                    io.to(socket.id).emit('canBan', true);
                    setTimeout(() => {
                        io.to(lobbyId).emit('gameStateUpdated', teamName + ' выбирают карту для бана');
                    }, 3000);
                }
            } else {
                io.to(lobbyId).emit('canWorkUpdated', false);
            }

            // Broadcast the updated picks to all lobby members
            io.to(lobbyId).emit('pickedUpdated', lobby.picked);
        }
    });

    socket.on('ban', (data: { lobbyId: string; map: string; teamName: string }) => {
        const { lobbyId, map, teamName } = data;
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            lobby.banned.push({ map, teamName });
            lobby.gameStep++;

            // Send updated canWork to sending socket and turn off canBan
            io.to(socket.id).emit('canWorkUpdated', false);
            io.to(socket.id).emit('canBan', false);

            // Send updated canWork to another team socket
            let otherSocketId = "";
            let otherName = "";
            for (const [otherSocketIdKey, otherNames] of lobby.teamNames.entries()) {
                if (otherNames !== teamName) {
                    otherName = otherNames;
                    otherSocketId = otherSocketIdKey;
                    break;
                }
            }
            if (lobby.gameStep < 7) {
                io.to(otherSocketId).emit('canWorkUpdated', true);
                if (lobby.gameStateList[lobby.gameStep] === 'pick') {
                    io.to(otherSocketId).emit('canPick', true);
                    io.to(lobbyId).emit('gameStateUpdated', otherName + ' выбирают карту для пика');
                } else {
                    io.to(otherSocketId).emit('canBan', true);
                    io.to(lobbyId).emit('gameStateUpdated', otherName + ' выбирают карту для бана');
                }
            } else {
                io.to(lobbyId).emit('canWorkUpdated', false);
            }

            // Broadcast the updated bans to all lobby members
            io.to(lobbyId).emit('bannedUpdated', lobby.banned);
        }
    });

    socket.on('delete', (lobbyId: string) => {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            // Notify all members that the lobby is being deleted
            io.to(lobbyId).emit('lobbyDeleted', lobbyId);

            // Remove all members from the lobby
            lobby.members.forEach((memberId) => {
                const memberSocket = io.sockets.sockets.get(memberId);
                if (memberSocket) {
                    memberSocket.leave(lobbyId);
                    memberSocket.data.lobbies.delete(lobbyId);
                }
            });

            // Delete the lobby from the lobbies Map
            lobbies.delete(lobbyId);

            console.log(`Lobby ${lobbyId} has been deleted`);
        }
    });

    socket.on('replay', (lobbyId: string) => {
        const lobby = lobbies.get(lobbyId);
        if (!lobby) return;

        let bannedIndex = 0;
        let pickedIndex = 0;
        const delayBetweenSteps = 5000; // e.g. 5 seconds delay
        let accumulatedDelay = 0;

        lobby.gameStateList.forEach((step) => {
            accumulatedDelay += delayBetweenSteps;
            if (step === 'ban') {
                const banEntry = lobby.banned[bannedIndex++];
                if (banEntry) {
                    setTimeout(() => {
                        // Emit this banned map to all members
                        io.to(lobbyId).emit('bannedReplay', banEntry);
                    }, accumulatedDelay);
                }
            } else if (step === 'pick') {
                const pickEntry = lobby.picked[pickedIndex++];
                if (pickEntry) {
                    setTimeout(() => {
                        // Emit this picked map to all members
                        io.to(lobbyId).emit('pickedReplay', pickEntry);
                    }, accumulatedDelay);
                }
            }
        });
    });

    // Socket calls for clearing and restarting animation for the observer (streamer)
    // Clear all action lists
    socket.on('clear', (lobbyId: string) => {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            lobby.observers.forEach((observer) => {
                io.to(observer).emit('clear');
            })
        }
    })

    // Refill action lists again
    socket.on('play', (lobbyId: string) => {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            lobby.observers.forEach((observer) => {
                io.to(observer).emit('bannedUpdated', lobby.banned);
                io.to(observer).emit('pickedUpdated', lobby.picked);
            })
        }
    })

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);

        // Remove the socket ID from all lobbies it was in
        for (const lobbyId of socket.data.lobbies) {
            const lobby = lobbies.get(lobbyId);
            if (lobby !== undefined) {
                lobby.members.delete(socket.id);
                lobby.teamNames.delete(socket.id);
                console.log(`User ${socket.id} left lobby ${lobbyId}`);

                // Broadcast the updated team names to all lobby members
                io.to(lobbyId).emit('teamNamesUpdated', Array.from(lobby.teamNames.entries()));

                // Code for deleting the lobby after 5 minutes of inactivity
                // if (lobby.teamNames.size === 0) {
                //     // Set the timer for 5 minutes to delete the lobby
                //     setTimeout(() => {
                //         lobbies.delete(lobbyId);
                //         console.log(`Lobby ${lobbyId} deleted as it has no more members`);
                //     }, 300000);
                // }

                // If the lobby is empty, delete it
                if (lobby.members.size === 0) {
                    lobbies.delete(lobbyId);
                    console.log(`Lobby ${lobbyId} deleted as it has no more members`);
                } else {
                    // Broadcast the updated team names to all lobby members
                    io.to(lobbyId).emit('teamNamesUpdated', Array.from(lobby.teamNames.entries()));
                }
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server is running at localhost:${port}`);
});
