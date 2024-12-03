'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Copy, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export default function LobbyPage() {
    const { lobbyId } = useParams();
    const { toast } = useToast();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [teamNames, setTeamNames] = useState<[string, string][]>([]); // [socketId, teamName]
    const [pickedMaps, setPickedMaps] = useState<string[]>([]);
    const [bannedMaps, setBannedMaps] = useState<string[]>([]);
    const [showTeamNameOverlay, setShowTeamNameOverlay] = useState(true);
    const [teamName, setTeamName] = useState('');
    const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
    const [showPrompts, setShowPrompts] = useState(false);
    const [lastUnmutedCardIndex, setLastUnmutedCardIndex] = useState<number | null>(null);
    const router = useRouter();
    const mapNames = [
        "Nuke",
        "Dust 2",
        "Ancient",
        "Inferno",
        "Anubis",
        "Vertigo",
        "Mirage"
    ];

    useEffect(() => {
        const newSocket = io('http://localhost:4000');

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server');
            if (lobbyId) {
                newSocket.emit('joinLobby', lobbyId);
                console.log(`Joined lobby ${lobbyId}`);
            }
        });

        // Handle 'teamNamesUpdated' event
        newSocket.on('teamNamesUpdated', (teamNamesArray: [string, string][]) => {
            setTeamNames(teamNamesArray);
        });

        // Handle 'pickedUpdated' event
        newSocket.on('pickedUpdated', (picked: string[]) => {
            setPickedMaps(picked);
        });

        // Handle 'bannedUpdated' event
        newSocket.on('bannedUpdated', (banned: string[]) => {
            setBannedMaps(banned);
        });

        // Handle 'lobbyDeleted' event
        newSocket.on('lobbyDeleted', () => {
            console.log('Lobby deleted');
            router.push('/');
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [lobbyId]);

    const handleCardClick = (index: number) => {
        const mapName = mapNames[index];

        // Check if the map is already picked or banned
        if (pickedMaps.includes(mapName) || bannedMaps.includes(mapName)) {
            return; // Do nothing if the map is already picked or banned
        }

        const remainingMaps = mapNames.filter(
            (map) => !pickedMaps.includes(map) && !bannedMaps.includes(map)
        );

        if (remainingMaps.length === 1) {
            setLastUnmutedCardIndex(index);
            setShowPrompts(true);
        } else {
            // Ban the map
            if (socket && lobbyId) {
                socket.emit('banned', { lobbyId, item: mapName });
            }
        }
    };

    const handlePromptClick = (prompt: string) => {
        setSelectedPrompt(prompt);
        setShowPrompts(false);

        // Emit the 'pick' event with the selected map and prompt
        if (socket && lobbyId && lastUnmutedCardIndex !== null) {
            const mapName = mapNames[lastUnmutedCardIndex];
            socket.emit('pick', { lobbyId, item: mapName });
            // Optionally, emit the side selected
            // socket.emit('sideSelected', { lobbyId, mapName, side: prompt });
        }
    };

    const handleTeamNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (socket && lobbyId && teamName) {
            socket.emit('teamName', { lobbyId, teamName });
        }
        setShowTeamNameOverlay(false);
    };

    const handleSkipTeamName = () => {
        setShowTeamNameOverlay(false);
    };

    const handleBackClick = () => {
        router.push('/');
    };

    const handleCopyObsClick = () => {
        const sampleText = `http://localhost:3000/lobby/${lobbyId}/obs`;
        navigator.clipboard.writeText(sampleText)
            .then(() => toast({ description: "Ссылка для OBS скопирована в буфер обмена" }))
            .catch(() => toast({ description: "Не получилось :(" }));
    };

    const handleCopyCodeClick = () => {
        navigator.clipboard.writeText(`${lobbyId}`)
            .then(() => toast({ description: "Код скопирован в буфер обмена" }))
            .catch(() => toast({ description: "Не получилось :(" }));
    };

    // Get the team names from the teamNames state
    const blueTeamName = teamNames.length > 0 ? teamNames[0][1] : 'Team Blue';
    const redTeamName = teamNames.length > 1 ? teamNames[1][1] : 'Team Red';

    return (
        <div className="min-h-screen bg-gray-100 p-8 relative">
            <div className="max-w-6xl mx-auto">
                {/* Header Buttons */}
                <div className="flex justify-between items-center mb-6">
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleBackClick}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Главная
                    </Button>
                    <div className="mx-2"></div>
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleCopyCodeClick}>
                        <Copy className="w-4 h-4 mr-2" />
                        {lobbyId}
                    </Button>
                    <div className="mx-2"></div>
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleCopyObsClick}>
                        <Eye className="w-4 h-4" />
                    </Button>
                </div>

                {/* Team Names */}
                <div className="flex justify-between items-center mb-6">
                    <div className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold">
                        {blueTeamName}
                    </div>
                    <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold">
                        {redTeamName}
                    </div>
                </div>

                {/* Map Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center content-center">
                    {mapNames.map((mapName, index) => {
                        const isPicked = pickedMaps.includes(mapName);
                        const isBanned = bannedMaps.includes(mapName);
                        const isDisabled = isPicked || isBanned;

                        return (
                            <motion.div
                                key={index}
                                layout
                                transition={{
                                    layout: { duration: 0.3 },
                                    opacity: { duration: 0.2 }
                                }}
                            >
                                <Card
                                    className={`
                    w-full sm:w-64 p-6 flex flex-col items-center justify-between cursor-pointer transition-all duration-300 relative
                    overflow-hidden ${isDisabled ? 'bg-gray-200' : 'bg-white hover:shadow-md'}
                    h-64 
                  `}
                                    onClick={() => !isDisabled && handleCardClick(index)}
                                >
                                    <Image
                                        src={`/maps/de_${mapName.toLowerCase().replace(" ", "")}.png`}
                                        alt={mapName}
                                        draggable={false}
                                        fill
                                        object-fit="cover"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className={`absolute inset-0 z-0 blur-sm ${isDisabled ? 'grayscale' : ''} transition-all duration-300`}
                                    />
                                    <div className="relative z-10 bg-black bg-opacity-50 px-2 py-1 rounded-md">
                    <span className={`text-xl font-bold ${isDisabled ? 'text-gray-400' : 'text-white'}`}>
                      {mapName}
                    </span>
                                    </div>
                                    <AnimatePresence>
                                        {isPicked && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 20 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex items-center justify-center relative z-20 mt-4"
                                            >
                                                <Image
                                                    src={`/${selectedPrompt || 'ct'}.png`} // Default to 'ct' if no prompt selected
                                                    alt={selectedPrompt || 'ct'}
                                                    draggable={false}
                                                    width={80}
                                                    height={80}
                                                    priority={true}
                                                    className="rounded-full"
                                                />
                                            </motion.div>
                                        )}
                                        {isBanned && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 20 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex items-center justify-center relative z-20 mt-4"
                                            >
                                                <X className="w-8 h-8 text-blue-500" strokeWidth={3} stroke="black" fill="blue" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Prompts Modal */}
            <AnimatePresence>
                {showPrompts && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                        onClick={() => setShowPrompts(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-4">Выберите сторону</h2>
                            <div className="flex justify-center space-x-4">
                                <Image
                                    src="/ct.png"
                                    alt="CT Icon"
                                    width={100}
                                    height={100}
                                    className="cursor-pointer hover:opacity-80 transition-opacity rounded-full"
                                    onClick={() => handlePromptClick('ct')}
                                />
                                <Image
                                    src="/t.png"
                                    alt="T Icon"
                                    width={100}
                                    height={100}
                                    className="cursor-pointer hover:opacity-80 transition-opacity rounded-full"
                                    onClick={() => handlePromptClick('t')}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Team Name Overlay */}
            <AnimatePresence>
                {showTeamNameOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                        >
                            <h2 className="text-2xl font-bold mb-4">Введите имя команды</h2>
                            <form onSubmit={handleTeamNameSubmit} className="space-y-4">
                                <Input
                                    type="text"
                                    placeholder="Имя команды..."
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="w-full"
                                />
                                <div className="flex justify-between">
                                    <Button type="submit" disabled={!teamName.trim()}>
                                        Подтвердить
                                    </Button>
                                    <Button type="button" variant="outline" onClick={handleSkipTeamName}>
                                        Я зритель
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
