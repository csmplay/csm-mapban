'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function HomePage() {
  const [socket, setSocket] = useState<any>(null);
  const [lobbyId, setLobbyId] = useState('');
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    const newSocket = io('http://localhost:4000');

    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      setConnected(true);
    });

    newSocket.on('message', (message) => {
      console.log('Received message:', message);
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoinLobby = () => {
    if (socket && lobbyId) {
      socket.emit('joinLobby', lobbyId);
      console.log(`Joined lobby ${lobbyId}`);
    }
  };

  const handleSendMessage = () => {
    if (socket && lobbyId && inputMessage) {
      socket.emit('message', { lobbyId, message: inputMessage });
      setInputMessage('');
    }
  };

  return (
      <div>
        <h1>Socket.IO with Next.js</h1>
        {connected ? (
            <div>
              <input
                  type="text"
                  value={lobbyId}
                  onChange={(e) => setLobbyId(e.target.value)}
                  placeholder="Enter Lobby ID"
              />
              <button onClick={handleJoinLobby}>Join Lobby</button>

              {lobbyId && (
                  <div>
                    <h2>Lobby: {lobbyId}</h2>
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Enter your message"
                    />
                    <button onClick={handleSendMessage}>Send Message</button>
                    <ul>
                      {messages.map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                      ))}
                    </ul>
                  </div>
              )}
            </div>
        ) : (
            <p>Connecting to server...</p>
        )}
      </div>
  );
}
