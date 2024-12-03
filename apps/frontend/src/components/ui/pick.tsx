'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Image from "next/image";

interface AnimatedBanCardProps {
    teamName: string;
    action: string;
    mapName: string;
}

export default function AnimatedPickCard({ teamName, action, mapName }: AnimatedBanCardProps) {
    const [isVisible, setIsVisible] = useState(true)

    const replay = () => {
        setIsVisible(false)
        setTimeout(() => setIsVisible(true), 10)
    }

    return (
        <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-8 p-4">
        <AnimatePresence mode="wait">
            {isVisible && (
                <div className="relative w-80 aspect-[3/4]">
                    {/* Team Name Section */}
                    <motion.div
    initial={{ x: -100, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ delay: 1.2 }}
    className="absolute top-0 left-0 right-0 bg-gray-800 p-4"
    style={{
        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)'
    }}
>
    <span className="text-xl font-bold text-white block text-center">{teamName}</span>
        </motion.div>

    {/* Image Section */}
    <motion.div
        initial={{ scaleY: 0 }}
    animate={{ scaleY: 1 }}
    transition={{ delay: 0.8 }}
    style={{ originY: 1 }}
    className="absolute top-[60px] bottom-[120px] left-0 right-0 bg-gray-800 overflow-hidden"
    >
    <Image
        src={`/maps/de_${mapName.toLowerCase().replace(" ", "")}.png`}
    alt={mapName}
    draggable={false}
    fill
    object-fit="cover"
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        </motion.div>

    {/* Bottom Info Section */}
    <motion.div
        initial={{ y: 100, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="absolute bottom-0 left-0 right-0 bg-gray-800 p-4 rounded-bl-lg rounded-br-lg"
    >
    <motion.div
        className="flex flex-col items-center gap-2"
    initial="hidden"
    animate="visible"
    variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } }
    }}
>
    <motion.div
        variants={{
        hidden: { y: -20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    }}
    className="text-4xl font-bold text-white"
        >
        {action}
        </motion.div>
        <div className="w-16 h-0.5 bg-gray-600" />
    <motion.div
        variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    }}
    className="text-3xl text-gray-300"
        >
        {mapName}
        </motion.div>
        </motion.div>
        </motion.div>
        </div>
)}
    </AnimatePresence>

    <Button
    onClick={replay}
    variant="outline"
    className="bg-gray-800 text-white hover:bg-gray-700"
        >
        Replay Animation
    </Button>
    </div>
)
}

