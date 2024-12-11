'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGEXP_ONLY_DIGITS } from "input-otp"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const AnimatedCheckbox = motion(Checkbox);

export default function HomePage() {
    const [lobbyId, setLobbyId] = useState('');
    const [showJoinLobbyOverlay, setShowJoinLobbyOverlay] = useState(false);
    const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
    const router = useRouter();

    // Things for sending lobby settings to server
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameType, setGameType] = useState("BO1");
    const [coinFlip, setCoinFlip] = useState(false);

    useEffect(() => {
        const newSocket = io('http://localhost:4000');

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server');
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const handleJoinLobby = () => {
        if (lobbyId && socket) {
            socket.emit('joinLobby', lobbyId);
            router.push(`/lobby/${lobbyId}`);
        }
    };

    const handleChooseRules = () => {
        setLobbyId(`${Math.floor(1000 + Math.random() * 9000).toString()}`);
        setShowSettingsOverlay(true);
    }

    const handleCreateLobby = () => {
        if (socket) {
            let gameTypeNum = 0;
            if (gameType === "BO3") gameTypeNum = 1;
            if (gameType === "BO5") gameTypeNum = 2;
            socket.emit('createLobby', { lobbyId, gameTypeNum, coinFlip });
            router.push(`/lobby/${lobbyId}`);
        }
    };

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    const contentVariants = {
        hidden: { scale: 0.9, opacity: 0 },
        visible: { scale: 1, opacity: 1 },
    };

    const checkboxVariants = {
        checked: { scale: 1.1 },
        unchecked: { scale: 1 },
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-white shadow-md">
                <div className="text-center py-3">
                    <Image
                        src="/CSM Original.svg"
                        alt="Map Image"
                        priority={true}
                        draggable={false}
                        width={100}
                        height={100}
                        className="mx-auto"
                    />
                </div>
                <CardContent className="space-y-6">
                    <Button
                        className="w-full bg-gray-800 text-white hover:bg-gray-700"
                        onClick={handleChooseRules}
                    >
                        Создать лобби
                    </Button>
                    <Separator className="my-4"/>
                    <Button
                        className="w-full bg-zinc-800 text-white hover:bg-zinc-700"
                        onClick={() => setShowJoinLobbyOverlay(true)}
                    >
                        Зайти в лобби
                    </Button>
                </CardContent>
            </Card>
            <AnimatePresence>
                {showJoinLobbyOverlay && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={overlayVariants}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            variants={contentVariants}
                            transition={{ duration: 0.3 }}
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full justify-center"
                        >
                            <h2 className="text-2xl font-bold mb-4">Введите код лобби</h2>
                            <div className="space-y-4">
                                <div className="flex justify-center space-x-2">
                                    <InputOTP
                                        maxLength={4}
                                        pattern={REGEXP_ONLY_DIGITS}
                                        value={lobbyId}
                                        onChange={(value) => setLobbyId(value)}
                                    >
                                        <InputOTPGroup>
                                            <InputOTPSlot index={0}/>
                                            <InputOTPSlot index={1}/>
                                            <InputOTPSlot index={2}/>
                                            <InputOTPSlot index={3}/>
                                        </InputOTPGroup>
                                    </InputOTP>
                                </div>
                                <div className="flex justify-between">
                                    <Button type="button" disabled={lobbyId.length !== 4}
                                            onClick={handleJoinLobby}>
                                        Подтвердить
                                    </Button>
                                    <Button type="button" variant="outline"
                                            onClick={() => setShowJoinLobbyOverlay(false)}>
                                        Назад
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSettingsOverlay && (
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
                                </div>
                                <div className="flex items-center justify-center space-x-2">
                                    <AnimatedCheckbox
                                        id="coinFlip"
                                        checked={coinFlip}
                                        onCheckedChange={(checked) => setCoinFlip(checked as boolean)}
                                        variants={checkboxVariants}
                                        animate={coinFlip ? "checked" : "unchecked"}
                                        transition={{ type: "spring", stiffness: 300, damping: 10 }}
                                    />
                                    <Label htmlFor="coinFlip">Подбросить монетку в начале игры</Label>
                                </div>
                                <div className="flex justify-between">
                                    <Button type="button" onClick={handleCreateLobby}>
                                        Создать лобби
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => setShowSettingsOverlay(false)}>
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

