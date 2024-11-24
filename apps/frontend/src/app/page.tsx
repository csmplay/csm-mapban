'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';

export default function HomePage() {
  useEffect(() => {
    const socket = io('http://localhost:4000');

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');

      const lobbyId = 'my-lobby';
      socket.emit('joinLobby', lobbyId);

      socket.emit('message', { lobbyId, message: 'Hello Lobby!' });
    });

    socket.on('message', (message) => {
      console.log('Received message:', message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
      <div>
        <h1>Socket.IO with Next.js</h1>
      </div>
  );
}
