'use client';

import React, {useEffect, useRef, useState} from 'react';
import {useRouter, useParams} from 'next/navigation';
import {io, Socket} from 'socket.io-client';
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {useToast} from "@/hooks/use-toast";
import {ActionLog} from "@/components/ui/ActionLog";
import {ArrowLeft, Copy} from 'lucide-react';
import {motion, AnimatePresence} from 'framer-motion';
import Image from 'next/image';

export default function LobbyPage() {
    // Core variables and states
    const {lobbyId} = useParams();
    const {toast} = useToast();
    const [socket, setSocket] = useState<Socket | null>(null);
    const router = useRouter();

    // Maps list
    const [mapNames, setMapNames] = useState<string[]>([]);

    // Game name
    const [gameName, setGameName] = useState<string>('0');

    // Overlay states
    const [showTeamNameOverlay, setShowTeamNameOverlay] = useState(true);
    const [showPrompts, setShowPrompts] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const [isAnimated, setIsAnimated] = useState(false);

    // Lobby data
    const [teamName, setTeamName] = useState('');
    const [teamNames, setTeamNames] = useState<[string, string][]>([]);
    const [gameState, setGameState] = useState<string>('Игра начинается...');
    const [gameStateHistory, setGameStateHistory] = useState<string[]>([]);
    const [canPick, setCanPick] = useState(false);
    const [canBan, setCanBan] = useState(false);
    const [canWork, setCanWork] = useState(false);
    const [coinResult, setCoinResult] = useState<number>(0);
    const isCoin = useRef(true);

    // Map data
    const [bannedMaps, setBannedMaps] = useState<Array<{ map: string; teamName: string }>>([]);
    const [pickedMaps, setPickedMaps] = useState<Array<{ map: string; teamName: string; side: string }>>([]);
    const [selectedMapIndex, setSelectedMapIndex] = useState<number | null>(null);
    const [pickMapId, setPickMapId] = useState<number>(0);

    const port = 4000;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:' + port;

    // Socket Calls Handling
    useEffect(() => {
        const newSocket = io(backendUrl);

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server');
            if (lobbyId) {
                newSocket.emit('joinLobby', lobbyId);
                console.log(`Joined lobby ${lobbyId}`);
            }
        });

        newSocket.on('mapNames', (mapNamesArray: string[]) => {
            setMapNames(mapNamesArray);
        });
        newSocket.on('gameName', (gameNameVar: string) => {
            setGameName(gameNameVar);
        });
        // Handle 'teamNamesUpdated' event
        newSocket.on('teamNamesUpdated', (teamNamesArray: [string, string][]) => {
            setTeamNames(teamNamesArray);
        });

        newSocket.on('startWithoutCoin', () => {
            setShowTeamNameOverlay(false);
        })

        // Handle 'pickedUpdated' event
        newSocket.on('pickedUpdated', (picked: Array<{ map: string; teamName: string; side: string }>) => {
            setPickedMaps(picked);
            setSelectedMapIndex(null);
        });

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
            setGameStateHistory(prevHistory => [gameStateVar, ...prevHistory]);
        });

        // Handle 'canBan' event
        newSocket.on('canBan', (banVar: boolean) => {
            console.log('I can ban now');
            setCanBan(() => banVar);
        });

        // Handle 'canPick' event
        newSocket.on('canPick', (pickVar: boolean) => {
            console.log('I can pick now');
            setCanPick(() => pickVar);
        });

        // Handle 'coinFlip' event
        newSocket.on('coinFlip', (result: number) => {
            setCoinResult(result);
            setIsWaiting(false);
            setIsAnimated(true);
            setTimeout(() => {
                setIsAnimated(false);
                setShowTeamNameOverlay(false);
            }, 5000);
        });

        // Handle 'isCoin' event
        newSocket.on('isCoin', (isCoinVar: boolean) => {
            isCoin.current = isCoinVar;
        });

        newSocket.on('startPick', (index: number) => {
            setPickMapId(index);
            setSelectedMapIndex(index);
            setIsWaiting(false);
            setShowPrompts(true);
        });

        newSocket.on('endPick', () => {
            setShowTeamNameOverlay(false);
            setIsWaiting(false);
        });

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
            console.log('Banning map');
            socket.emit('ban', {lobbyId, map: mapName, teamName});
        } else if (canPick) {
            console.log('Started picking map');
            socket.emit('startPick', {lobbyId, teamName, selectedMapIndex});
            setIsWaiting(true);
            return;
        }

        setSelectedMapIndex(null);
    };

    const handlePromptClick = (side: string) => {
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
        if (pickedMaps.length !== 0 || bannedMaps.length !== 0) {
            setShowTeamNameOverlay(false);
        }
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
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={gameState}
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            transition={{duration: 0.3}}
                        >
                            <Card className={`
                            bg-white text-black px-4 py-2 rounded-lg font-bold text-xl border-2 
                            ${gameState.includes(redTeamName) ? 'border-red-500' : 'border-blue-500'}
                            `}>
                                {gameState}
                            </Card>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Map Cards */}
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center">
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

                        const pickEntry = pickedMaps.find((pick) => pick.map === mapName);
                        const pickSide = pickEntry ? pickEntry.side : null;
                        const pickTeamColor = pickEntry
                            ? pickEntry.teamName === redTeamName
                                ? 'red'
                                : 'blue'
                            : null;

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
                                        src={`/${gameName}/maps/de_${mapName.toLowerCase().replace(" ", "")}.jpg`}
                                        alt={mapName}
                                        draggable={false}
                                        fill
                                        priority={true}
                                        style={{objectFit:"cover"}}
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
                                        {isPicked && pickEntry && (
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
                                                {/* Left Image (picked side) */}
                                                <motion.div
                                                    initial={{y: 100, opacity: 0}}
                                                    animate={{y: 0, opacity: 1}}
                                                    exit={{opacity: 0}}
                                                    transition={{duration: 0.3}}
                                                    className="relative flex items-center justify-center"
                                                >
                                                    <Image
                                                        src={`/${gameName}/${pickSide === 'ct' ? 'ct' : 't'}.jpg`}
                                                        alt={`${pickSide === 'ct' ? 'ct' : 't'}`}
                                                        draggable={false}
                                                        width={80}
                                                        height={80}
                                                        priority={true}
                                                        className={`rounded-full border-4 ${
                                                            pickTeamColor === 'red' ? 'border-red-500' : 'border-blue-500'
                                                        }`}
                                                    />
                                                </motion.div>

                                                {/* Right Image (opposite side) */}
                                                <motion.div
                                                    initial={{y: 100, opacity: 0}}
                                                    animate={{y: 0, opacity: 1}}
                                                    exit={{opacity: 0}}
                                                    transition={{duration: 0.3}}
                                                    className="relative flex items-center justify-center"
                                                >
                                                    <Image
                                                        src={`/${gameName}/${pickSide === 'ct' ? 't' : 'ct'}.jpg`}
                                                        alt={`${pickSide === 'ct' ? 't' : 'ct'}`}
                                                        draggable={false}
                                                        width={80}
                                                        height={80}
                                                        priority={true}
                                                        className={`rounded-full border-4 ${
                                                            pickTeamColor === 'red' ? 'border-blue-500' : 'border-red-500'
                                                        }`}
                                                    />
                                                </motion.div>
                                            </motion.div>
                                        )}

                                        {isBanned && (
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

                <div className="flex items-center justify-center p-4">
                    <ActionLog entries={gameStateHistory} blueTeamName={blueTeamName} redTeamName={redTeamName}/>
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
                    >
                        <motion.div
                            initial={{scale: 0.9, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            exit={{scale: 0.9, opacity: 0}}
                            transition={{duration: 0.3}}
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-4 text-center">
                                Выберите сторону на карте {mapNames[pickMapId]}
                            </h2>
                            <div className="flex justify-center space-x-4">
                                <Image
                                    src={`/${gameName}/ct.jpg`}
                                    alt="CT Icon"
                                    width={100}
                                    height={100}
                                    className="cursor-pointer hover:opacity-80 transition-opacity rounded-full"
                                    onClick={() => handlePromptClick('ct')}
                                />
                                <Image
                                    src={`/${gameName}/t.jpg`}
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
                            style={{width: '600px'}}
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
                                            <Button type="button" variant="outline" onClick={handleCopyCodeClick}>
                                                <Copy className="h-4 mr-2"/>
                                                {lobbyId}
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
                                    <h2 className="text-2xl font-bold mb-4 text-center">Ждём готовность
                                        противника...</h2>
                                </div>
                            )}
                            {isAnimated && (
                                <div className="-mb-28">
                                    <h2 className="text-2xl font-bold mb-4 text-center">Подбрасываем монетку...</h2>
                                    <video
                                        src={`/coin_${coinResult}.webm`}
                                        preload={"high"}
                                        autoPlay
                                        muted
                                        className={"mx-auto w-full max-w-md -mt-32"}
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

{/* TODO: Try this grid approach }
<div className="grid grid-cols-4 gap-4 justify-items-center">
    {mapNames.slice(0, 4).map((mapName, index) => {
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

        const pickEntry = pickedMaps.find((pick) => pick.map === mapName);
        const pickSide = pickEntry ? pickEntry.side : null;
        const pickTeamColor = pickEntry
            ? pickEntry.teamName === redTeamName
                ? 'red'
                : 'blue'
            : null;

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
                        src={`/${gameName}/maps/de_${mapName.toLowerCase().replace(" ", "")}.jpg`}
                        alt={mapName}
                        draggable={false}
                        fill
                        priority={true}
                        style={{objectFit:"cover"}}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={`
                            absolute inset-0 z-0 border-4 rounded-xl ${
                            isDisabled && !isPicked ? 'grayscale blur-sm' : ''
                        } transition-all duration-300
                            ${isSelected && !isPicked ? 'border-gray-500' : 'border-gray-300'}
                            ${isPicked ? 'border-green-400' : ''}
                        `}
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
                        {isPicked && pickEntry && (
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
                                <motion.div
                                    initial={{y: 100, opacity: 0}}
                                    animate={{y: 0, opacity: 1}}
                                    exit={{opacity: 0}}
                                    transition={{duration: 0.3}}
                                    className="relative flex items-center justify-center"
                                >
                                    <Image
                                        src={`/${gameName}/${pickSide === 'ct' ? 'ct' : 't'}.jpg`}
                                        alt={`${pickSide === 'ct' ? 'ct' : 't'}`}
                                        draggable={false}
                                        width={80}
                                        height={80}
                                        priority={true}
                                        className={`rounded-full border-4 ${
                                            pickTeamColor === 'red' ? 'border-red-500' : 'border-blue-500'
                                        }`}
                                    />
                                </motion.div>
                                <motion.div
                                    initial={{y: 100, opacity: 0}}
                                    animate={{y: 0, opacity: 1}}
                                    exit={{opacity: 0}}
                                    transition={{duration: 0.3}}
                                    className="relative flex items-center justify-center"
                                >
                                    <Image
                                        src={`/${gameName}/${pickSide === 'ct' ? 't' : 'ct'}.jpg`}
                                        alt={`${pickSide === 'ct' ? 't' : 'ct'}`}
                                        draggable={false}
                                        width={80}
                                        height={80}
                                        priority={true}
                                        className={`rounded-full border-4 ${
                                            pickTeamColor === 'red' ? 'border-blue-500' : 'border-red-500'
                                        }`}
                                    />
                                </motion.div>
                            </motion.div>
                        )}

                        {isBanned && (
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
                                        className="transform text-white px-4 py-1 font-bold text-xl"
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

<div className="grid grid-cols-3 gap-4 justify-items-center mt-4">
    {mapNames.slice(4).map((mapName, subIndex) => {
        // Adjust the index to reflect the original array's indexing
        const index = subIndex + 4;
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

        const pickEntry = pickedMaps.find((pick) => pick.map === mapName);
        const pickSide = pickEntry ? pickEntry.side : null;
        const pickTeamColor = pickEntry
            ? pickEntry.teamName === redTeamName
                ? 'red'
                : 'blue'
            : null;

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
                        src={`/${gameName}/maps/de_${mapName.toLowerCase().replace(" ", "")}.jpg`}
                        alt={mapName}
                        draggable={false}
                        fill
                        priority={true}
                        style={{objectFit:"cover"}}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={`
                            absolute inset-0 z-0 border-4 rounded-xl ${
                            isDisabled && !isPicked ? 'grayscale blur-sm' : ''
                        } transition-all duration-300
                            ${isSelected && !isPicked ? 'border-gray-500' : 'border-gray-300'}
                            ${isPicked ? 'border-green-400' : ''}
                        `}
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
                        {isPicked && pickEntry && (
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
                                <motion.div
                                    initial={{y: 100, opacity: 0}}
                                    animate={{y: 0, opacity: 1}}
                                    exit={{opacity: 0}}
                                    transition={{duration: 0.3}}
                                    className="relative flex items-center justify-center"
                                >
                                    <Image
                                        src={`/${gameName}/${pickSide === 'ct' ? 'ct' : 't'}.jpg`}
                                        alt={`${pickSide === 'ct' ? 'ct' : 't'}`}
                                        draggable={false}
                                        width={80}
                                        height={80}
                                        priority={true}
                                        className={`rounded-full border-4 ${
                                            pickTeamColor === 'red' ? 'border-red-500' : 'border-blue-500'
                                        }`}
                                    />
                                </motion.div>
                                <motion.div
                                    initial={{y: 100, opacity: 0}}
                                    animate={{y: 0, opacity: 1}}
                                    exit={{opacity: 0}}
                                    transition={{duration: 0.3}}
                                    className="relative flex items-center justify-center"
                                >
                                    <Image
                                        src={`/${gameName}/${pickSide === 'ct' ? 't' : 'ct'}.jpg`}
                                        alt={`${pickSide === 'ct' ? 't' : 'ct'}`}
                                        draggable={false}
                                        width={80}
                                        height={80}
                                        priority={true}

                                        className={`rounded-full border-4 ${
                                            pickTeamColor === 'red' ? 'border-blue-500' : 'border-red-500'
                                        }`}
                                    />
                                </motion.div>
                            </motion.div>
                        )}

                        {isBanned && (
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
                                        className="transform text-white px-4 py-1 font-bold text-xl"
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
{*/}
