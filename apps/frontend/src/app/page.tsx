'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [lobbyId, setLobbyId] = useState('');
  const router = useRouter();

  const handleJoinLobby = () => {
    if (lobbyId) {
      router.push(`/lobby/${lobbyId}`);
    }
  };

  return (
      <div>
        <h1>Welcome to the Lobby App</h1>
        <input
            type="text"
            value={lobbyId}
            onChange={(e) => setLobbyId(e.target.value)}
            placeholder="Enter Lobby ID"
        />
        <button onClick={handleJoinLobby}>Join Lobby</button>
      </div>
  );
}
