'use client';

import React, {useEffect, useState} from 'react';
import {useRouter, useParams} from 'next/navigation';
import {io, Socket} from 'socket.io-client';
import {Button} from "@/components/ui/button"
import {Card} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {useToast} from "@/hooks/use-toast"
import {ArrowLeft, Eye, Lock, Hand, Copy} from 'lucide-react'
import {motion, AnimatePresence} from 'framer-motion'
import Image from 'next/image'

export default function LobbyPage() {
    const {lobbyId} = useParams();
    const {toast} = useToast();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [mutedCards, setMutedCards] = useState<boolean[]>(Array(7).fill(false))
    const [lastUnmutedCard, setLastUnmutedCard] = useState<number | null>(null)
    const [showPrompts, setShowPrompts] = useState(false)
    const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null)
    const [showTeamNameOverlay, setShowTeamNameOverlay] = useState(true)
    const [teamName, setTeamName] = useState('')
    const router = useRouter();
    const mapNames = [
        "Nuke",
        "Dust 2",
        "Ancient",
        "Inferno",
        "Anubis",
        "Vertigo",
        "Mirage"
    ]

    useEffect(() => {
        // Establish a new Socket.IO connection
        const newSocket = io('http://localhost:4000');

        newSocket.on('connect', () => {
            console.log('Connected to Socket.IO server');

            // Join the lobby
            if (lobbyId) {
                newSocket.emit('joinLobby', lobbyId);
                console.log(`Joined lobby ${lobbyId}`);
            }
        });

        setSocket(newSocket);

        const unmutedCount = mutedCards.filter(muted => !muted).length
        if (unmutedCount === 1) {
            setLastUnmutedCard(mutedCards.findIndex(muted => !muted))
            setShowPrompts(true)
        } else {
            setLastUnmutedCard(null)
            setShowPrompts(false)
        }

        return () => {
            newSocket.disconnect();
        };
    }, [lobbyId, mutedCards]);

    const handleCardClick = (index: number) => {
        if (lastUnmutedCard === index) {
            setSelectedPrompt(null)
            setShowPrompts(true);
            return;
        }

        const newMutedCards = [...mutedCards]
        newMutedCards[index] = !newMutedCards[index]
        setMutedCards(newMutedCards)
    }

    const handleBackClick = () => {
        router.push(`/`);
    }

    const handleCopyObsClick = () => {
        const sampleText = "https://localhost:3000/lobby/" + `${lobbyId}` + "/obs";
        navigator.clipboard.writeText(sampleText)
            .then(() => toast({
                description: "Код для OBS скопирован в буфер обмена",
            }))
            .catch(() => toast({
                description: "Не получилось :(",
            }))
    }

    const handleCopyCodeClick = () => {
        const sampleText = `${lobbyId}`;
        navigator.clipboard.writeText(sampleText)
            .then(() => toast({
                description: "Код скопирован в буфер обмена",
            }))
            .catch(() => toast({
                description: "Не получилось :(",
            }))
    }

    const handlePromptClick = (prompt: string) => {
        console.log('Selected prompt:', prompt)
        setSelectedPrompt(prompt)
        setShowPrompts(false)
    }

    const handleTeamNameSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        console.log('Team name submitted:', teamName)
        if (socket && lobbyId && teamName) {
            socket.emit('teamName', {lobbyId, teamName});
        }
        setShowTeamNameOverlay(false)
    }

    const handleSkipTeamName = () => {
        setShowTeamNameOverlay(false)
    }

    const handleSendMessage = () => {
        if (socket && lobbyId && inputMessage) {
            socket.emit('message', {lobbyId, message: inputMessage});
            setInputMessage('');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8 relative">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleBackClick}>
                        <ArrowLeft className="w-4 h-4 mr-2"/>
                        Главная
                    </Button>
                    <div className="mx-2"></div>
                    {/* Spacer */}
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleCopyCodeClick}>
                        <Copy className="w-4 h-4 mr-2"/>
                        {lobbyId}
                    </Button>
                    <div className="mx-2"></div>
                    {/* Spacer */}
                    <Button className="flex-1 max-w-xs" variant="outline" onClick={handleCopyObsClick}>
                        <Eye className="w-4 h-4"/>
                    </Button>
                </div>
                <div className="space-y-4">
                    {mutedCards.map((muted, index) => (
                        <Card
                            key={index}
                            className={`
        p-6 flex items-center justify-between cursor-pointer transition-all duration-300 relative
        overflow-hidden ${muted ? 'bg-gray-200' : 'bg-white hover:shadow-md'}
        ${lastUnmutedCard === index ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
    `}
                            onClick={() => handleCardClick(index)}
                        >
                            {/* Background Image */}
                            <Image
                                src={`/maps/de_${mapNames[index].toLowerCase().replace(" ", "")}.png`}
                                alt={mapNames[index]}
                                layout="fill" // Fills the card completely
                                objectFit="cover" // Ensures the image doesn't distort
                                className="absolute inset-0 z-0 opacity-30 blur-sm"
                            />
                            {/* Card Content */}
                            <span
                                className={`relative z-10 text-xl font-bold ${muted ? 'text-gray-400 blur-sm' : 'text-gray-700'}`}>
                                {mapNames[index]}
                            </span>
                            <AnimatePresence>
                                {(muted || (lastUnmutedCard === index && selectedPrompt)) && (
                                    <motion.div
                                        initial={{opacity: 0, x: 20}}
                                        animate={{opacity: 1, x: 0}}
                                        exit={{opacity: 0, x: 20}}
                                        transition={{duration: 0.3}}
                                        className="flex items-center relative z-10"
                                    >
                                        {muted ? (
                                            <>
                                                <Lock className="w-6 h-6 text-gray-500 mr-2"/>
                                                <Hand className="w-6 h-6 text-gray-500"/>
                                            </>
                                        ) : selectedPrompt ? (
                                            <Image
                                                src={`/${selectedPrompt}.png`}
                                                alt={selectedPrompt}
                                                width={60}
                                                height={60}
                                                className="rounded-full"
                                            />
                                        ) : null}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Card>
                    ))}
                </div>
            </div>
            <AnimatePresence>
                {showPrompts && (
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.3}}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
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
            <AnimatePresence>
                {showTeamNameOverlay && (
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
                            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                        >
                            <h2 className="text-2xl font-bold mb-4">Введите имя команды</h2>
                            <form onSubmit={handleTeamNameSubmit} className="space-y-4">
                                <Input
                                    type="text"
                                    placeholder="Team Name"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="w-full"
                                />
                                <div className="flex justify-between">
                                    <Button type="submit" disabled={!teamName.trim()}>
                                        Подтвердить
                                    </Button>
                                    <Button type="button" variant="outline" onClick={handleSkipTeamName}>
                                        Зритель
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
