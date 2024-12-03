'use client';

import React, {useState} from 'react';
import {useRouter} from 'next/navigation';
import {REGEXP_ONLY_DIGITS} from "input-otp"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import {Card, CardContent} from "@/components/ui/card";
import {Separator} from "@/components/ui/separator";
import {Button} from "@/components/ui/button";
import Image from "next/image";
import {AnimatePresence, motion} from "framer-motion";

export default function HomePage() {
    const [lobbyId, setLobbyId] = useState('');
    const [showJoinLobbyOverlay, setShowJoinLobbyOverlay] = useState(false);
    const router = useRouter();

    const handleJoinLobby = () => {
        if (lobbyId) {
            router.push(`/lobby/${lobbyId}`);
        }
    };

    const handleCreateLobby = () => {
        let rndmId = Math.floor(1000 + Math.random() * 9000).toString();
        router.push(`/lobby/${rndmId}`);
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
                        onClick={handleCreateLobby}
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
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.3}}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{scale: 0.9, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            exit={{scale: 0.9, opacity: 0}}
                            transition={{duration: 0.3}}
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
        </div>
    );
}
