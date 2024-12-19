'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {Trash2, LogIn, Users, Eye, Plus} from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox"
import {Label} from "@/components/ui/label";
import {AnimatePresence, motion} from "framer-motion";

type PickedMap = { map: string; teamName: string; side: string };
type BannedMap = { map: string; teamName: string };

type Lobby = {
    lobbyId: string;
    members: string[];
    teamNames: [string, string][]; // [socketId, teamName]
    observers: string[];
    picked: PickedMap[];
    banned: BannedMap[];
    gameType: number;
    gameStateList: string[];
    coinFlip: boolean;
    admin: boolean;
};

const AnimatedCheckbox = motion.create(Checkbox);

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const contentVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: { scale: 1, opacity: 1 },
};

export default function AdminPage() {
    const [lobbies, setLobbies] = useState<Lobby[]>([]);
    const [globalCoinFlip, setGlobalCoinFlip] = useState(true)
    const localCoinFlip = useRef(true);
    const [gameType, setGameType] = useState("BO1");
    const [adminOverlay, setAdminOverlay] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    const port = 4000;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:' + port;

    useEffect(() => {
        socketRef.current = io(backendUrl);

        const fetchLobbies = async () => {
            try {
                const response = await fetch(`${backendUrl}/admin/lobbies`);
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
        const interval = setInterval(fetchLobbies, 500);

        if (socketRef.current) {
            socketRef.current.on('lobbyDeleted', (deletedLobbyId: string) => {
                setLobbies((prevLobbies) =>
                    prevLobbies.filter((lobby) => lobby.lobbyId !== deletedLobbyId)
                );
            });
        }

        return () => {
            clearInterval(interval);
            socketRef.current?.disconnect();
        };
    }, [backendUrl]);

    const handleDeleteLobby = (lobbyId: string) => {
        if (socketRef.current) {
            setLobbies(prevLobbies => prevLobbies.filter(lobby => lobby.lobbyId !== lobbyId));
            socketRef.current.emit('delete', lobbyId);
        }
    };

    const handleCopyLink = (lobbyId: string) => {
        const lobbyUrl = `${frontendUrl}/lobby/${lobbyId}/obs`;
        navigator.clipboard.writeText(lobbyUrl).then(
            () => {
                toast({
                    description: "Ссылка для OBS скопирована в буфер обмена",
                });
            },
            () => {
                toast({
                    description: "Не получилось :(",
                });
            }
        );
    };

    const handleConnectToLobby = (lobbyId: string) => {
        router.push(`/lobby/${lobbyId}`);
    };

    const handleClear = (lobbyId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('clear', lobbyId);
        }
    };

    const handlePlayAnimation = (lobbyId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('play', lobbyId);
        }
    }

    const handleCoinFlip = (coinFlip: boolean) => {
        if (socketRef.current) {
            setGlobalCoinFlip(coinFlip);
            socketRef.current.emit('coinFlipUpdate', coinFlip);
        }
    }

    const handleStartGame = (lobbyId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('start', lobbyId);
        }
    }

    const handleAdminLobby = () => {
        if (socketRef.current) {
            let gameTypeNum = 0;
            if (gameType === "BO3") gameTypeNum = 1;
            if (gameType === "BO5") gameTypeNum = 2;
            const lobbyId = `${Math.floor(1000 + Math.random() * 9000).toString()}`;
            socketRef.current.emit('createObsLobby', {lobbyId, gameTypeNum, coinFlip: localCoinFlip.current});
            setAdminOverlay(false);
        }
    }

    const checkboxVariants = {
        checked: { scale: 1.1 },
        unchecked: { scale: 1 },
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="relative max-w-7xl mx-auto mb-8">
                    <h1 className="text-4xl font-bold text-center text-gray-800">Admin</h1>
                    <Button onClick={() => setAdminOverlay(true)} variant="outline"
                            className="absolute top-0 right-0">
                        <Plus className="w-4 h-4 mr-2"/>
                        Create OBS Lobby
                    </Button>
                </div>
                <div className="flex justify-center items-center mb-6">
                    <Card className="w-full max-w-md mx-auto bg-white shadow-lg mb-8">
                        <CardContent
                            className="p-6 ml-8 text-center text-gray-600 space-x-4 flex flex-wrap items-center gap-4">
                        <AnimatedCheckbox
                                id="coinFlip"
                                checked={globalCoinFlip}
                                onCheckedChange={(checked) => {
                                    handleCoinFlip(checked as boolean);
                                }}
                                variants={checkboxVariants}
                                animate={globalCoinFlip ? "checked" : "unchecked"}
                                transition={{type: "spring", stiffness: 300, damping: 10}}
                            />
                            <Label htmlFor="coinFlip">Подбросить монетку в начале игры</Label>
                        </CardContent>
                    </Card>
                </div>
                {lobbies.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {lobbies.map((lobby) => (
                            <Card key={lobby.lobbyId}
                                  className="w-full bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
                                <CardHeader className="bg-gray-50 border-b">
                                    <CardTitle className="text-xl text-gray-700 flex items-center justify-between">
                                        <span className="truncate">Lobby: {lobby.lobbyId}</span>
                                        <Badge variant="secondary" className="ml-2 flex items-center">
                                            <Users className="w-4 h-4 mr-1"/>
                                            {lobby.members.length}
                                        </Badge>
                                        {lobby.admin && (
                                            <Button onClick={() => handleStartGame(lobby.lobbyId)} variant="outline"
                                                    className="flex-1" disabled={lobby.teamNames.length !== 2}>
                                                Start Game
                                            </Button>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <ScrollArea className="h-64 pr-4">
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="font-semibold text-gray-600 mb-2">Teams:</h3>
                                                <ul className="space-y-1">
                                                    {lobby.teamNames.map(([socketId, teamName]) => (
                                                        <li key={socketId} className="flex items-center text-sm">
                                                            <Badge variant="outline" className="mr-2">{teamName}</Badge>
                                                            <span className="text-gray-500 truncate">{socketId}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <Separator/>
                                            {/* Optional display of new fields */}
                                            <div className="space-y-2">
                                                <div className="text-sm text-gray-700">Game Type: {
                                                    lobby.gameType === 0 ? 'BO1' : lobby.gameType === 1 ? 'BO3' : 'BO5'
                                                }</div>
                                                <div className="text-sm text-gray-700">Coin
                                                    Flip: {lobby.coinFlip ? 'Yes' : 'No'}</div>
                                            </div>
                                            <Separator/>
                                            <div>
                                                <h3 className="font-semibold text-gray-600 mb-2">Picked:</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {lobby.picked.map((item, index) => (
                                                        <Badge key={index} variant="secondary">
                                                            {item.map} ({item.teamName}, Side: {item.side.toUpperCase()})
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <Separator/>
                                            <div>
                                                <h3 className="font-semibold text-gray-600 mb-2">Banned:</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {lobby.banned.map((item, index) => (
                                                        <Badge key={index} variant="destructive">
                                                            {item.map} ({item.teamName})
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                                <CardFooter className="bg-gray-50 border-t p-4 flex flex-wrap gap-2">
                                    <Button onClick={() => handleConnectToLobby(lobby.lobbyId)} variant="outline"
                                            className="flex-1">
                                        <LogIn className="w-4 h-4 mr-2"/>
                                        Connect
                                    </Button>
                                    <Button onClick={() => handleCopyLink(lobby.lobbyId)} variant="outline"
                                            className="flex-1">
                                        <Eye className="w-4 h-4 mr-2"/>
                                        Copy Obs Link
                                    </Button>
                                    <Button onClick={() => handleClear(lobby.lobbyId)} variant="outline"
                                            className="flex-1">
                                        Clear Obs View
                                    </Button>
                                    <Button onClick={() => handlePlayAnimation(lobby.lobbyId)} variant="outline"
                                            className="flex-1">
                                        Play Pick Animation
                                    </Button>
                                    <Button onClick={() => handleDeleteLobby(lobby.lobbyId)} variant="destructive"
                                            className="flex-1">
                                        <Trash2 className="w-4 h-4 mr-2"/>
                                        Delete
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="w-full max-w-md mx-auto bg-white shadow-lg">
                        <CardContent className="p-6 text-center text-gray-600">
                            <p className="text-xl">Nothin' here yet...</p>
                        </CardContent>
                    </Card>
                )}
            </div>
            <AnimatePresence>
                {adminOverlay && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={overlayVariants}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            variants={contentVariants}
                            transition={{ duration: 0.3 }}
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                        >
                            <h2 className="text-2xl font-bold mb-4 text-center">Выберите правила игры</h2>
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2 text-center">Формат игры</h3>
                                    <div className="flex justify-center space-x-4">
                                        {["BO1", "BO3", "BO5"].map((type) => (
                                            <Button
                                                key={type}
                                                variant={gameType === type ? "default" : "outline"}
                                                onClick={() => setGameType(type)}
                                                className="w-20"
                                            >
                                                {type}
                                            </Button>
                                        ))}
                                    </div>
                                    <div className="p-6 ml-10 text-center text-gray-600 space-x-4 flex flex-wrap items-center gap-4">
                                        <AnimatedCheckbox
                                            id="coinFlip"
                                            checked={localCoinFlip.current}
                                            onCheckedChange={(checked) => {
                                                localCoinFlip.current = checked as boolean;
                                            }}
                                            variants={checkboxVariants}
                                            animate={localCoinFlip.current ? "checked" : "unchecked"}
                                            transition={{type: "spring", stiffness: 300, damping: 10}}
                                        />
                                        <Label htmlFor="coinFlip">Подбросить монетку в начале игры</Label>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <Button type="button" onClick={handleAdminLobby}>
                                        Создать лобби
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => setAdminOverlay(false)}>
                                        Назад
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
