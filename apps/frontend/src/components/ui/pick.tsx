'use client'

import React, {useState} from 'react'
import {motion, AnimatePresence} from 'framer-motion'
import {Button} from '@/components/ui/button'
import Image from "next/image";

interface AnimatedPickCardProps {
    teamName: string;
    mapName: string;
    side: string;
}

export default function AnimatedPickCard({teamName, mapName, side}: AnimatedPickCardProps) {
    const [isVisible, setIsVisible] = useState(true)

    const replay = () => {
        setIsVisible(false)
        setTimeout(() => setIsVisible(true), 10)
    }

    const teamTextSize = teamName.length > 9 ? 'text-2xl' : 'text-3xl';

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
                            className="absolute top-0 left-0 right-0 bg-[#26262a] px-3 overflow-hidden"
                            style={{
                                clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                                height: '60px'
                            }}
                        >
                            <motion.div
                                className="flex flex-row justify-between overflow-hidden"
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: {opacity: 0},
                                    visible: {opacity: 1, transition: {staggerChildren: 0.2, delayChildren: 1}}
                                }}
                            >
                                <motion.div
                                    variants={{
                                        hidden: {x: -20, opacity: 0},
                                        visible: {x: 0, opacity: 1}
                                    }}
                                    className={`${teamTextSize} font-bold text-[#8ce1ff] block text-center pt-3`}
                                >
                                    {teamName}
                                </motion.div>
                                <motion.div
                                    variants={{
                                        hidden: {x: 20, opacity: 0},
                                        visible: {x: 0, opacity: 1}
                                    }}
                                    className="pr-6"
                                >
                                    <Image
                                        src={`/${side}_white.png`}
                                        alt={side}
                                        draggable={false}
                                        width={40}
                                        height={40}
                                        priority={true}
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className="pt-2.5"
                                    />
                                </motion.div>
                            </motion.div>
                        </motion.div>

                        {/* Image Section */}
                        <motion.div
                            initial={{y: 100, opacity: 0}}
                            animate={{y: 0, opacity: 1}}
                            transition={{delay: 0.5}}
                            style={{originY: 1}}
                            className="absolute top-[60px] bottom-[120px] left-0 right-0 bg-[#26262a] overflow-hidden"
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
                            className="absolute bottom-0 left-0 right-0 bg-[#8ce1ff] p-4 rounded-bl-lg rounded-br-lg"
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
                                    className="text-4xl font-bold text-black"
                                >
                                    PICK
                                </motion.div>
                                <div className="w-48 h-0.5 bg-gray-600"/>
                                <motion.div
                                    variants={{
                                        hidden: {y: 20, opacity: 0},
                                        visible: {y: 0, opacity: 1}
                                    }}
                                    className="text-3xl font-bold text-black pt-1"
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

