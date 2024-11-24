import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

const port = process.env.PORT || 4000;

app.get('/', (_req, res) => {
    res.send('Express + TypeScript Server');
});

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('joinLobby', (lobbyId) => {
        socket.join(lobbyId);
        console.log(`User ${socket.id} joined lobby ${lobbyId}`);
    });

    socket.on('message', (data) => {
        io.to(data.lobbyId).emit('message', data.message);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
    });
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
