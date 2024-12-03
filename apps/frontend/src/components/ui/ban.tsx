'use client'

import React, {useState} from 'react'
import {motion, AnimatePresence} from 'framer-motion'
import {Button} from '@/components/ui/button'
import Image from "next/image";

interface AnimatedBanCardProps {
    teamName: string;
    mapName: string;
}

export default function AnimatedPickCard({teamName, mapName}: AnimatedBanCardProps) {
    const [isVisible, setIsVisible] = useState(true)

    const replay = () => {
        setIsVisible(false)
        setTimeout(() => setIsVisible(true), 10)
    }

    return (
        <div className="bg-transparent flex flex-col items-center justify-end gap-8 p-4">
            <AnimatePresence mode="wait">
                {isVisible && (
                    <div className="relative w-80 aspect-[3/4] space-y-1">
                        {/* Team Name Section */}
                        <motion.div
                            initial={{x: -100, opacity: 0}}
                            animate={{x: 0, opacity: 1}}
                            transition={{delay: 1}}
                            className="absolute top-0 left-0 right-0 bg-gray-800 p-3 overflow-hidden"
                            style={{
                                clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                                height: '60px'
                            }}
                        >
                            <span className="text-3xl font-bold text-white block text-center">{
                                teamName.length > 10 ? `${teamName.slice(0, 10)}...` : teamName
                            }</span>
                        </motion.div>

                        {/* Image Section */}
                        <motion.div
                            initial={{y: 100, opacity: 0}}
                            animate={{y: 0, opacity: 1}}
                            transition={{delay: 0.5}}
                            style={{originY: 1}}
                            className="absolute top-[60px] bottom-[120px] left-0 right-0 bg-gray-800 overflow-hidden"
                        >
                            <Image
                                src={`/maps/de_${mapName.toLowerCase().replace(" ", "")}.png`}
                                alt={mapName}
                                draggable={false}
                                fill
                                object-fit="cover"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                style={{
                                    clipPath: 'polygon(0% 50%, 20% 0%, 100% 0%, 100% 50%, 80% 100%, 0% 100%)'
                                }}
                            />
                        </motion.div>

                        {/* Bottom Info Section */}
                        <motion.div
                            initial={{y: 100, opacity: 0}}
                            animate={{y: 0, opacity: 1}}
                            className="absolute bottom-0 left-0 right-0 bg-gray-800 p-4 rounded-bl-lg rounded-br-lg"
                        >
                            <motion.div
                                className="flex flex-col items-center"
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: {opacity: 0},
                                    visible: {opacity: 1, transition: {staggerChildren: 0.2, delayChildren: 0.3}}
                                }}
                            >
                                <motion.div
                                    variants={{
                                        hidden: {y: -20, opacity: 0},
                                        visible: {y: 0, opacity: 1}
                                    }}
                                    className="text-4xl font-bold text-white"
                                >
                                    BAN
                                </motion.div>
                                <div className="w-48 h-0.5 bg-white"/>
                                <motion.div
                                    variants={{
                                        hidden: {y: 20, opacity: 0},
                                        visible: {y: 0, opacity: 1}
                                    }}
                                    className="text-3xl font-bold text-white pt-1"
                                >
                                    {mapName}
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

