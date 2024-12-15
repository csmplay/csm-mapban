'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import AnimatedBanCard from '@/components/ui/ban';
import AnimatedPickCard from '@/components/ui/pick';

interface BanAction {
    type: 'ban';
    teamName: string;
    mapName: string;
}

interface PickAction {
    type: 'pick';
    teamName: string;
    mapName: string;
    side: string;
}

type Action = BanAction | PickAction;

const LobbyObsPage = () => {
    const { lobbyId } = useParams();
    const [, setSocket] = useState<Socket | null>(null);

    const [pickedEntries, setPickedEntries] = useState<
        { map: string; teamName: string; side: string }[]
    >([]);
    const [bannedEntries, setBannedEntries] = useState<
        { map: string; teamName: string }[]
    >([]);
    const [pattern, setPattern] = useState<string[]>([]);

    // Keep track of how many actions have been revealed so far
    const [visibleActionsCount, setVisibleActionsCount] = useState(0);

    const port = 4000;
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;

    // Fetch pattern (Game Rules) from the lobby data
    // useEffect(() => {
    //     if (!lobbyId) return;
    //     const fetchPattern = async () => {
    //         try {
    //             const res = await fetch(`${backendUrl}/admin/lobbies`);
    //             const data = await res.json();
    //             // Find the lobby with the matching lobbyId
    //             const currentLobby = data.find((l: any) => l.lobbyId === lobbyId);
    //             if (currentLobby && currentLobby.gameStateList) {
    //                 setPattern(currentLobby.gameStateList);
    //             }
    //         } catch (error) {
    //             console.error('Error fetching pattern:', error);
    //         }
    //     };
    //     (async () => {
    //         await fetchPattern();
    //     })();
    // }, [lobbyId, backendUrl]);

    useEffect(() => {
        const newSocket = io(backendUrl);

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server');
            if (lobbyId) {
                newSocket.emit('getPatternList', lobbyId);
                newSocket.emit('joinLobby', lobbyId);
                console.log(`Joined lobby ${lobbyId}`);
            }
        });

        newSocket.on('pickedUpdated', (picked: Array<{ map: string; teamName: string; side: string }>) => {
            setPickedEntries(picked);
        });

        newSocket.on('bannedUpdated', (banned: Array<{ map: string; teamName: string }>) => {
            setBannedEntries(banned);
        });

        newSocket.on('patternList', (pattern: string[]) => {
            setPattern(pattern);
        });

        // Handle 'clear' event from the server
        // Clear all entries to wait for new pickedUpdated/bannedUpdated
        newSocket.on('clear', () => {
            setPickedEntries([]);
            setBannedEntries([]);
            setVisibleActionsCount(0);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [lobbyId, backendUrl]);

    // Construct the final actions array based on the pattern and the data we have
    const actions: Action[] = useMemo(() => {
        if (pattern.length === 0) return [];

        const bannedCopy = [...bannedEntries];
        const pickedCopy = [...pickedEntries];

        const finalActions: Action[] = [];

        // Follow the pattern to interleave bans and picks in correct order
        pattern.forEach((step) => {
            if (step === 'ban') {
                const banEntry = bannedCopy.shift();
                if (banEntry) {
                    finalActions.push({
                        type: 'ban',
                        teamName: banEntry.teamName,
                        mapName: banEntry.map,
                    });
                }
            } else if (step === 'pick') {
                const pickEntry = pickedCopy.shift();
                if (pickEntry) {
                    finalActions.push({
                        type: 'pick',
                        teamName: pickEntry.teamName,
                        mapName: pickEntry.map,
                        side: pickEntry.side,
                    });
                }
            }
        });

        return finalActions;
    }, [bannedEntries, pickedEntries, pattern]);

    // Reveal actions one by one with a 3-second delay without resetting everything on new updates
    useEffect(() => {
        // If the new actions array is shorter than what we have revealed, it's a reset scenario
        if (actions.length < visibleActionsCount) {
            // Reset and show from scratch
            setVisibleActionsCount(0);
        } else if (actions.length > visibleActionsCount) {
            // There are new actions to reveal
            let currentIndex = visibleActionsCount;
            const intervalId = setInterval(() => {
                currentIndex += 1;
                setVisibleActionsCount(currentIndex);
                if (currentIndex >= actions.length) {
                    clearInterval(intervalId);
                }
            }, 3000);

            return () => clearInterval(intervalId);
        }
        // If actions.length == visibleActionsCount, do nothing (no changes needed)
    }, [actions, visibleActionsCount]);

    return (
        <div className="bg-transparent p-8 justify-start">
            <div className="flex space-x-4 py-16">
                {actions.slice(0, visibleActionsCount).map((action, index) => {
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
