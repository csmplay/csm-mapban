'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import AnimatedBanCard from '@/components/ui/ban';
import AnimatedPickCard from '@/components/ui/pick';


interface BanAction {
    type: 'ban';
    teamName: string;
    mapName: string;
    timestamp: number;
}

interface PickAction {
    type: 'pick';
    teamName: string;
    mapName: string;
    side: string;
    timestamp: number;
}

type Action = BanAction | PickAction;

const LobbyObsPage = () => {
    const { lobbyId } = useParams();
    const [_, setSocket] = useState<Socket | null>(null);
    const [actions, setActions] = useState<Action[]>([]);

    const port = 4000;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:' + port;


    useEffect(() => {
        const newSocket = io(backendUrl);

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server');
            if (lobbyId) {
                newSocket.emit('joinLobby', lobbyId);
                console.log(`Joined lobby ${lobbyId}`);
            }
        });

        // Handle 'pickedUpdated' event
        newSocket.on(
            'pickedUpdated',
            (picked: Array<{ map: string; teamName: string; side: string; timestamp: number }>) => {
                updateActions(picked, 'pick');
            }
        );

        // Handle 'bannedUpdated' event
        newSocket.on(
            'bannedUpdated',
            (banned: Array<{ map: string; teamName: string; timestamp: number }>) => {
                updateActions(banned, 'ban');
            }
        );

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [lobbyId]);

    const updateActions = (
        newEntries: Array<any>,
        type: 'pick' | 'ban'
    ) => {
        setActions((prevActions) => {
            // Remove previous entries of the same type
            const existingEntries = prevActions.filter((action) => action.type !== type);
            const formattedNewEntries = newEntries.map((entry) => {
                if (type === 'ban') {
                    return {
                        type: 'ban',
                        teamName: entry.teamName,
                        mapName: entry.map,
                        timestamp: entry.timestamp,
                    } as BanAction;
                } else {
                    return {
                        type: 'pick',
                        teamName: entry.teamName,
                        mapName: entry.map,
                        side: entry.side,
                        timestamp: entry.timestamp,
                    } as PickAction;
                }
            });

            // Combine and sort by timestamp
            const combinedActions = [...existingEntries, ...formattedNewEntries];
            combinedActions.sort((a, b) => a.timestamp - b.timestamp);

            return combinedActions;
        });
    };

    return (
        <div className="bg-transparent p-8 justify-start">
            <div className="flex space-x-4 py-16">
                {actions.map((action, index) => {
                    if (action.type === 'ban') {
                        return (
                            <AnimatedBanCard
                                key={index}
                                teamName={action.teamName}
                                mapName={action.mapName}
                            />
                        );
                    } else if (action.type === 'pick') {
                        return (
                            <AnimatedPickCard
                                key={index}
                                teamName={action.teamName}
                                mapName={action.mapName}
                                side={action.side}
                            />
                        );
                    } else {
                        return null;
                    }
                })}
            </div>
        </div>
    );
};

export default LobbyObsPage;
