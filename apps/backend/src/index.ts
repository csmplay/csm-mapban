import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import cors from 'cors';

const app = express();

// Use cors middleware
app.use(
    cors({
        origin: 'http://localhost:3000', // Allow requests from your frontend
    })
);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000', // Allow requests from your frontend
        methods: ['GET', 'POST'],
    },
});

const port = process.env.PORT || 4000;

// Lobby interface
interface Lobby {
    lobbyId: string;
    members: Set<string>;
    teamNames: Map<string, string>;
    picked: Array<{ map: string; teamName: string; side: string }>;
    banned: Array<{ map: string; teamName: string }>;
}

// Data structure to store lobbies and their members
const lobbies = new Map<string, Lobby>();

app.get('/', (_req, res) => {
    res.send('Express + TypeScript Server');
});

// Admin endpoint to get the list of lobbies and their members
app.get('/admin/lobbies', (_req, res) => {
    const lobbyList = Array.from(lobbies.values()).map((lobby) => ({
        lobbyId: lobby.lobbyId,
        members: Array.from(lobby.members),
        teamNames: Array.from(lobby.teamNames.entries()),
        picked: lobby.picked,
        banned: lobby.banned,
    }));
    res.json(lobbyList);
});

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    // Initialize the set of lobbies the socket is in
    socket.data.lobbies = new Set<string>();

    socket.on('joinLobby', (lobbyId: string) => {
        socket.join(lobbyId);
        console.log(`User ${socket.id} joined lobby ${lobbyId}`);

        // Check if the lobby exists
        let lobby = lobbies.get(lobbyId);
        if (!lobby) {
            // Create a new lobby
            lobby = {
                lobbyId,
                members: new Set<string>(),
                teamNames: new Map<string, string>(),
                picked: [],
                banned: [],
            };
            lobbies.set(lobbyId, lobby);
        }

        // Add the socket ID to the lobby's member list
        lobby.members.add(socket.id);

        // Add the lobbyId to the socket's list of lobbies
        socket.data.lobbies.add(lobbyId);
    });

    socket.on('teamName', (data: { lobbyId: string; teamName: string }) => {
        const {lobbyId, teamName} = data;
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            // Update the teamNames Map
            lobby.teamNames.set(socket.id, teamName);
            if (lobby.teamNames.size < 2) {
                io.to(socket.id).emit('canWorkUpdated', true);
            }
            // Broadcast the updated team names to all lobby members
            io.to(lobbyId).emit('teamNamesUpdated', Array.from(lobby.teamNames.entries()));
        }
    });

    socket.on('pick', (data: { lobbyId: string; map: string; teamName: string; side: string }) => {
        console.log(data);
        const { lobbyId, map, teamName, side } = data;
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            lobby.picked.push({ map, teamName, side });
            io.to(lobbyId).emit('canWorkUpdated', false);

            // Broadcast the updated picks to all lobby members
            io.to(lobbyId).emit('pickedUpdated', lobby.picked);
            io.to(lobbyId).emit('gameStateUpdated', teamName + ' выбрали ' + map + ' за сторону ' + side.toUpperCase());
        }
    });

    socket.on('banned', (data: { lobbyId: string; map: string; teamName: string }) => {
        const { lobbyId, map, teamName } = data;
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            lobby.banned.push({ map, teamName });

            // Send updated canWork to sending socket
            io.to(socket.id).emit('canWorkUpdated', false);

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
            io.to(otherSocketId).emit('canWorkUpdated', true);

            // Broadcast the updated bans to all lobby members
            io.to(lobbyId).emit('bannedUpdated', lobby.banned);
            if (lobby.banned.length === 6) {
                io.to(lobbyId).emit('gameStateUpdated', otherName + ' выбирают карту для пика');
            } else {
                io.to(lobbyId).emit('gameStateUpdated', otherName + ' выбирают карту для бана');
            }
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

    socket.on('message', (data) => {
        io.to(data.lobbyId).emit('message', data.message);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);

        // Remove the socket ID from all lobbies it was in
        for (const lobbyId of socket.data.lobbies) {
            const lobby = lobbies.get(lobbyId);
            if (lobby) {
                lobby.members.delete(socket.id);
                lobby.teamNames.delete(socket.id);
                console.log(`User ${socket.id} left lobby ${lobbyId}`);

                // Broadcast the updated team names to all lobby members
                io.to(lobbyId).emit('teamNamesUpdated', Array.from(lobby.teamNames.entries()));
                if (lobby.teamNames.size === 0) {
                    // Set the timer for 5 minutes to delete the lobby
                    setTimeout(() => {
                        lobbies.delete(lobbyId);
                        console.log(`Lobby ${lobbyId} deleted as it has no more members`);
                    }, 300000);
                }

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
    console.log(`Server is running at http://localhost:${port}`);
});
