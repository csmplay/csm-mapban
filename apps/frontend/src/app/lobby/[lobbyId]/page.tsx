'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

export default function LobbyPage() {
    const { lobbyId } = useParams();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [inputMessage, setInputMessage] = useState('');

    useEffect(() => {
        // Establish a new Socket.IO connection
        const newSocket = io('http://localhost:4000');

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server');

            // Join the lobby
            if (lobbyId) {
                newSocket.emit('joinLobby', lobbyId);
                console.log(`Joined lobby ${lobbyId}`);
            }
        });

        newSocket.on('message', (message) => {
            console.log('Received message:', message);
            setMessages((prevMessages) => [...prevMessages, message]);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [lobbyId]);

    const handleSendMessage = () => {
        if (socket && lobbyId && inputMessage) {
            socket.emit('message', { lobbyId, message: inputMessage });
            setInputMessage('');
        }
    };

    return (
        <div>
            <h1>Lobby: {lobbyId}</h1>
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
    );
}
