'use client';

import { useEffect, useState } from 'react';

type Lobby = {
    lobbyId: string;
    members: string[];
    teams: string[];
};

export default function AdminPage() {
    const [lobbies, setLobbies] = useState<Lobby[]>([]);

    useEffect(() => {
        const fetchLobbies = async () => {
            try {
                const response = await fetch('http://localhost:4000/admin/lobbies');
                const data: Lobby[] = await response.json();
                setLobbies(data);
            } catch (error) {
                console.error('Error fetching lobbies:', error);
            }
        };

        (async () => {
            await fetchLobbies();
        })();

        // Polling every 5 seconds to update the lobby list
        const interval = setInterval(fetchLobbies, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <h1>Admin Page</h1>
            {lobbies.length > 0 ? (
                <ul>
                    {lobbies.map((lobby) => (
                        <li key={lobby.lobbyId}>
                            <strong>Lobby ID:</strong> {lobby.lobbyId}
                            <ul>
                                {lobby.teams.map((memberId) => (
                                    <li key={memberId}>{memberId}</li>
                                ))}
                            </ul>
                            <ul>
                                {lobby.members.map((memberId) => (
                                    <li key={memberId}>{memberId}</li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No lobbies found.</p>
            )}
        </div>
    );
}
