import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();

// Use cors middleware
app.use(cors({
    origin: 'http://localhost:3000', // Allow requests from your frontend
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000', // Allow requests from your frontend
        methods: ['GET', 'POST'],
    },
});

const port = process.env.PORT || 4000;

// Data structure to store lobbies and their members
const lobbies = new Map<string, Set<string>>();

app.get('/', (_req, res) => {
    res.send('Express + TypeScript Server');
});

// Admin endpoint to get the list of lobbies and their members
app.get('/admin/lobbies', (_req, res) => {
    const lobbyList = Array.from(lobbies.entries()).map(([lobbyId, members]) => ({
        lobbyId,
        members: Array.from(members),
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

        // Add the socket ID to the lobby's member list
        if (!lobbies.has(lobbyId)) {
            lobbies.set(lobbyId, new Set<string>());
        }
        lobbies.get(lobbyId)?.add(socket.id);

        // Add the lobbyId to the socket's list of lobbies
        socket.data.lobbies.add(lobbyId);
    });

    socket.on('message', (data) => {
        io.to(data.lobbyId).emit('message', data.message);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);

        // Remove the socket ID from all lobbies it was in
        for (const lobbyId of socket.data.lobbies) {
            lobbies.get(lobbyId)?.delete(socket.id);
            console.log(`User ${socket.id} left lobby ${lobbyId}`);

            // If the lobby is empty, delete it
            if (lobbies.get(lobbyId)?.size === 0) {
                lobbies.delete(lobbyId);
                console.log(`Lobby ${lobbyId} deleted as it has no more members`);
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
