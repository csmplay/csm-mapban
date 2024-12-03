'use client'

import { useState } from 'react'
import AnimatedBanCard from '@/components/ui/ban'

export default function ObsPage() {
    const [isVisible, setIsVisible] = useState(true)

    const replay = () => {
        setIsVisible(false)
        setTimeout(() => setIsVisible(true), 10)
    }

    return (
        <AnimatedBanCard
            teamName="VIRTUS.PRO"
            action="BAN"
            mapName="NUKE"
        />
    )
}

