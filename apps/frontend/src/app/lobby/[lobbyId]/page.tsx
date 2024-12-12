'use client';

import React, {useEffect, useState} from 'react';
import {useRouter, useParams} from 'next/navigation';
import {io, Socket} from 'socket.io-client';
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {useToast} from "@/hooks/use-toast";
import {ArrowLeft, Copy} from 'lucide-react';
import {motion, AnimatePresence} from 'framer-motion';
import Image from 'next/image';

export default function LobbyPage() {
    // Core variables and states
    const {lobbyId} = useParams();
    const {toast} = useToast();
    const [socket, setSocket] = useState<Socket | null>(null);
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

    // Overlay states
    const [showTeamNameOverlay, setShowTeamNameOverlay] = useState(true);
    const [showPrompts, setShowPrompts] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const [isAnimated, setIsAnimated] = useState(false);

    // Lobby data
    const [teamName, setTeamName] = useState('');
    const [teamNames, setTeamNames] = useState<[string, string][]>([]);
    const [gameState, setGameState] = useState<string>('Игра начинается...');
    const [pickColor, setPickColor] = useState('');
    const [canPick, setCanPick] = useState(false);
    const [canBan, setCanBan] = useState(false);
    const [canWork, setCanWork] = useState(false);
    const [coinResult, setCoinResult] = useState<number>(0);
    const [isCoin, setIsCoin] = useState(false);

    // Map data
    const [bannedMaps, setBannedMaps] = useState<Array<{ map: string; teamName: string }>>([]);
    const [pickedMaps, setPickedMaps] = useState<Array<{ map: string; teamName: string; side: string }>>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
    const [selectedMapIndex, setSelectedMapIndex] = useState<number | null>(null);

    // Socket Calls Handling
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
            if (teamNamesArray.length === 2 && isCoin) {
                setShowTeamNameOverlay(false);
            }
        });

        // Handle 'pickedUpdated' event
        newSocket.on('pickedUpdated', (picked: Array<{ map: string; teamName: string; side: string }>) => {
            console.log('RECEIVE PICKED UPDATED');
                setPickedMaps(picked);
                setSelectedPrompt(picked[0].side);
                setSelectedMapIndex(null);
                setPickColor(picked[0].teamName);
            }
        );

        // Handle 'bannedUpdated' event
        newSocket.on('bannedUpdated', (banned: Array<{ map: string; teamName: string }>) => {
            setBannedMaps(banned);
            setSelectedMapIndex(null);
        });

        // Handle 'lobbyDeleted' event
        newSocket.on('lobbyDeleted', () => {
            console.log('lobbyDeleted');
            router.push('/');
        });

        // Handle 'lobbyUndefined'
        newSocket.on('lobbyUndefined', () => {
            console.log('lobbyUndefined');
            router.push('/');
        });

        // Handle 'canWorkUpdated' event
        newSocket.on('canWorkUpdated', (canWorkVar: boolean) => {
            setCanWork(canWorkVar);
            setSelectedMapIndex(null);
        });

        // Handle 'gameStateUpdated' event
        newSocket.on('gameStateUpdated', (gameStateVar: string) => {
            setGameState(gameStateVar);
        });

        newSocket.on('canBan', () => {
            setCanBan(!canBan);
        })

        newSocket.on('canPick', () => {
            setCanPick(!canBan);
        })

        newSocket.on('coinFlip', (result: number) => {
            setCoinResult(result);
            setIsWaiting(false);
            setIsAnimated(true);
        })

        newSocket.on('isCoin', (isCoin: boolean) => {
            setIsCoin(isCoin);
        })

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [lobbyId]);


    // Buttons handling
    const handleCardClick = (index: number) => {
        const mapName = mapNames[index];

        // Check if the map is already picked or banned
        if (
            pickedMaps.some((pick) => pick.map === mapName) ||
            bannedMaps.some((ban) => ban.map === mapName)
        ) {
            return;
        }

        setSelectedMapIndex(index);
    };

    const handleSubmit = () => {
        if (selectedMapIndex === null || !socket || !lobbyId) return;
        const mapName = mapNames[selectedMapIndex];
        const team = teamNames.find(([socketId]) => socketId === socket.id);
        const teamName = team ? team[1] : 'Spectator';

        if (canBan) {
            // Ban the map
            socket.emit('ban', {lobbyId, map: mapName, teamName});
        } else if (canPick) {
            setShowPrompts(true);
            return;
        }

        // Reset selected map
        setSelectedMapIndex(null);
    };

    const handlePromptClick = (side: string) => {
        // TODO: Make selected prompts in a Set<MapName, Side>
        setSelectedPrompt(side);
        setShowPrompts(false);

        if (socket && lobbyId && selectedMapIndex !== null) {
            const mapName = mapNames[selectedMapIndex];
            const team = teamNames.find(([socketId]) => socketId === socket.id);
            const teamName = team ? team[1] : 'Spectator';

            socket.emit('pick', {lobbyId, map: mapName, teamName, side});

            // Reset selected map
            setSelectedMapIndex(null);
        }
    };

    const handleTeamNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (socket && lobbyId && teamName) {
            socket.emit('teamName', {lobbyId, teamName});
        }

        setIsWaiting(true);
    };

    const handleSkipTeamName = () => {
        setIsWaiting(true);
    };

    const handleBackClick = () => {
        router.push('/');
    };

    const handleCopyCodeClick = () => {
        navigator.clipboard.writeText(`${lobbyId}`)
            .then(() => toast({description: "Код скопирован в буфер обмена"}))
            .catch(() => toast({description: "Не получилось :("}));
    };

    // Get the team names from the teamNames state
    const blueTeamEntry = teamNames[0];
    const redTeamEntry = teamNames[1];
    const blueTeamName = blueTeamEntry ? blueTeamEntry[1] : 'Team Blue';
    const redTeamName = redTeamEntry ? redTeamEntry[1] : 'Team Red';

    return (
        <div className="min-h-screen bg-gray-100 p-8 relative">
            <div className="max-w-6xl mx-auto">
                {/* Header Buttons */}
                <div className="flex justify-between items-center mb-6">
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleBackClick}>
                        <ArrowLeft className="w-4 h-4 mr-2"/>
                        Главная
                    </Button>
                    <div className="mx-2"></div>
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleCopyCodeClick}>
                        <Copy className="w-4 h-4 mr-2"/>
                        {lobbyId}
                    </Button>
                </div>

                {/* Team Names */}
                <div className="flex justify-between items-center mb-6">
                    <div className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-2xl">
                        {blueTeamName}
                    </div>
                    <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-2xl">
                        {redTeamName}
                    </div>
                </div>


                <div className="flex justify-center items-center mb-6">
                    <Card className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xl">
                        {gameState}
                    </Card>
                </div>

                {/* Map Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-center">
                    {mapNames.map((mapName, index) => {
                        const isPicked = pickedMaps.some((pick) => pick.map === mapName);
                        const isBanned = bannedMaps.some((ban) => ban.map === mapName);
                        const isDisabled = isPicked || isBanned;
                        const isSelected = selectedMapIndex === index;

                        const banEntry = bannedMaps.find((ban) => ban.map === mapName);
                        const banTeamColor =
                            banEntry && banEntry.teamName === blueTeamName
                                ? 'blue'
                                : banEntry && banEntry.teamName === redTeamName
                                    ? 'red'
                                    : null;

                        // const pickEntry = pickedMaps.find((pick) => pick.map === mapName);
                        // const pickSide = pickEntry ? pickEntry.side : null;

                        return (
                            <motion.div
                                key={index}
                                layout
                                transition={{
                                    layout: {duration: 0.3},
                                    opacity: {duration: 0.2}
                                }}
                            >
                                <Card
                                    className={`
                    w-full sm:w-64 p-6 flex flex-col items-center justify-between cursor-pointer transition-all duration-300 relative
                    overflow-hidden ${
                                        isDisabled && !isPicked
                                            ? 'bg-gray-200'
                                            : isSelected
                                                ? 'bg-gray-800'
                                                : 'bg-white hover:shadow-2xl'
                                    }
                    h-64 
                  `}
                                    onClick={() => !isDisabled && handleCardClick(index)}
                                >
                                    <Image
                                        src={`/maps/de_${mapName.toLowerCase().replace(" ", "")}.png`}
                                        alt={mapName}
                                        draggable={false}
                                        fill
                                        priority={true}
                                        objectFit="cover"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className={`absolute inset-0 z-0 border-4 rounded-xl ${
                                            isDisabled && !isPicked ? 'grayscale blur-sm' : ''
                                        } transition-all duration-300 
                                        ${isSelected && !isPicked ? 'border-gray-500' : 'border-gray-300'}
                                        ${isPicked ? 'border-green-400' : ''}`}
                                    />
                                    <div className={`relative z-10 bg-black bg-opacity-50 px-2 py-1 rounded-md`}>
                    <span
                        className={`text-xl font-bold ${
                            isDisabled && !isPicked ? 'text-gray-400' : 'text-white'
                        }`}
                    >
                      {mapName}
                    </span>
                                    </div>
                                    <AnimatePresence>
                                        {isPicked && (
                                            <motion.div
                                                className="flex flex-row justify-between overflow-hidden space-x-6"
                                                initial="hidden"
                                                animate="visible"
                                                variants={{
                                                    hidden: {opacity: 0},
                                                    visible: {
                                                        opacity: 1,
                                                        transition: {staggerChildren: 0.2, delayChildren: 0.3},
                                                    },
                                                }}
                                            >
                                                {/* Left Image */}
                                                <motion.div
                                                    initial={{y: 100, opacity: 0}}
                                                    animate={{y: 0, opacity: 1}}
                                                    exit={{opacity: 0}}
                                                    transition={{duration: 0.3}}
                                                    className="relative flex items-center justify-center"
                                                >
                                                    <Image
                                                        src={`/${selectedPrompt || 'ct'}.png`}
                                                        alt={`${selectedPrompt || 'ct'}`}
                                                        draggable={false}
                                                        width={80}
                                                        height={80}
                                                        priority={true}
                                                        className={`rounded-full border-4 ${
                                                            pickColor === redTeamName ? 'border-red-500' : 'border-blue-500'
                                                        }`}
                                                    />
                                                </motion.div>

                                                {/* Right Image */}
                                                <motion.div
                                                    initial={{y: 100, opacity: 0}}
                                                    animate={{y: 0, opacity: 1}}
                                                    exit={{opacity: 0}}
                                                    transition={{duration: 0.3}}
                                                    className="relative flex items-center justify-center"
                                                >
                                                    <Image
                                                        src={`/${selectedPrompt === 'ct' ? 't' : 'ct'}.png`}
                                                        alt={`${selectedPrompt === 'ct' ? 't' : 'ct'}`}
                                                        draggable={false}
                                                        width={80}
                                                        height={80}
                                                        priority={true}
                                                        className={`rounded-full border-4 ${
                                                            pickColor === redTeamName ? 'border-blue-500' : 'border-red-500'
                                                        }`}
                                                    />
                                                </motion.div>
                                            </motion.div>

                                        )
                                        }
                                        {
                                            isBanned && (
                                                <motion.div
                                                    className="flex flex-row justify-between overflow-hidden"
                                                    initial="hidden"
                                                    animate="visible"
                                                    variants={{
                                                        hidden: {opacity: 0},
                                                        visible: {
                                                            opacity: 1,
                                                            transition: {staggerChildren: 0.2, delayChildren: 0.3}
                                                        }
                                                    }}
                                                >
                                                    <motion.div
                                                        initial={{y: 100, opacity: 0}}
                                                        animate={{y: 0, opacity: 1}}
                                                        exit={{opacity: 0}}
                                                        transition={{duration: 0.3}}
                                                        className="absolute inset-0 flex items-center justify-center"
                                                    >

                                                        <div
                                                            className={`transform text-white
                                            px-4 py-1 font-bold text-xl`}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '80%',
                                                                width: '150%',
                                                                height: '150%',
                                                                textAlign: 'center',
                                                                opacity: 0.8,
                                                                backgroundColor: '#000000',
                                                            }}
                                                        >
                                                            BANNED
                                                        </div>
                                                    </motion.div>
                                                    {/* Animated outline */}
                                                    <motion.div
                                                        initial={{opacity: 0}}
                                                        animate={{opacity: 1}}
                                                        exit={{opacity: 0}}
                                                        transition={{duration: 0.3}}
                                                        className={`absolute inset-0 border-4 rounded-lg animate-pulse ${
                                                            banTeamColor === 'blue' ? 'border-blue-500' : 'border-red-500'
                                                        }`}
                                                    ></motion.div>
                                                </motion.div>
                                            )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Submit Button */}
                <div className="flex justify-center mt-4">
                    <Button onClick={handleSubmit} disabled={selectedMapIndex === null || !canWork}>
                        Подтвердить
                    </Button>
                </div>
            </div>

            {/* Prompts Modal */}
            <AnimatePresence>
                {showPrompts && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.3}}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                        onClick={() => setShowPrompts(false)}
                    >
                        <motion.div
                            initial={{scale: 0.9, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            exit={{scale: 0.9, opacity: 0}}
                            transition={{duration: 0.3}}
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-4 text-center">Выберите сторону</h2>
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
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.3}}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{scale: 0.9, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            exit={{scale: 0.9, opacity: 0}}
                            transition={{duration: 0.3}}
                            style={{width:'600px', height: '180px'}}
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                        >
                            {!isWaiting && !isAnimated && (
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-center">Введите имя команды</h2>
                                    <form onSubmit={handleTeamNameSubmit} className="space-y-4">
                                        <Input
                                            type="text"
                                            placeholder="Имя команды..."
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between">
                                            <Button type="submit"
                                                    disabled={
                                                        !teamName.trim() ||
                                                        teamNames.length === 2}>
                                                Подтвердить
                                            </Button>
                                            <Button type="button" variant="outline" onClick={handleSkipTeamName}>
                                                Я зритель
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {isWaiting && (
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-center">Ждём готовность команд...</h2>
                                    <video
                                        src={"/coinIdle.mp4"}
                                        preload={"auto"}
                                        autoPlay
                                        loop
                                        muted
                                        className={"mx-auto w-full max-w-md"}
                                    />
                                </div>
                            )}

                            {isAnimated && (
                                <div>
                                    <h2 className="text-2xl font-bold mb-4 text-center">{`${teamNames[coinResult]} начинают первыми`}</h2>
                                    <video
                                        src={`coin_${coinResult}.mp4`}
                                        preload={"auto"}
                                        autoPlay
                                        loop
                                        muted
                                        className={"mx-auto w-full max-w-md"}
                                    />
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
