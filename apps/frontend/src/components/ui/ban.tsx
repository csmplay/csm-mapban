"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export interface AnimatedBanCardProps {
  teamName: string;
  mapName: string;
  gameName: string;
  cardColors: {
    text: string[];
    bg: string[];
  };
}

export default function AnimatedBanCard({
  teamName,
  mapName,
  gameName,
  cardColors,
}: AnimatedBanCardProps) {
  const [isVisible] = useState(true);

  const teamTextSize = teamName.length > 9 ? "text-2xl" : "text-3xl";

  return (
    <div className="bg-transparent flex flex-col items-center justify-end gap-8 p-4">
      <AnimatePresence mode="wait">
        {isVisible && (
          <div className="relative w-80 aspect-3/4 space-y-1">
            {/* Team Name Section */}
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1 }}
              style={{
                backgroundColor: cardColors.bg[0],
                clipPath: "polygon(0 0, 90% 0, 100% 100%, 0 100%)",
                height: "60px",
              }}
              className="absolute top-0 left-0 right-0 p-3 overflow-hidden"
            >
              <span
                style={{ color: cardColors.text[0] }}
                className={`${teamTextSize} font-bold block text-center`}
              >
                {teamName}
              </span>
            </motion.div>

            {/* Image Section */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ backgroundColor: cardColors.bg[1], originY: 1 }}
              className="absolute top-[60px] bottom-[120px] left-0 right-0 overflow-hidden"
            >
              <Image
                src={`/${gameName}/maps/${mapName.toLowerCase().replace(" ", "")}.jpg`}
                alt={mapName}
                draggable={false}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{
                  objectFit: "cover",
                  clipPath:
                    "polygon(0% 50%, 20% 0%, 100% 0%, 100% 50%, 80% 100%, 0% 100%)",
                }}
              />
            </motion.div>

            {/* Bottom Info Section */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              style={{ backgroundColor: cardColors.bg[2] }}
              className="absolute bottom-0 left-0 right-0 p-4 rounded-bl-lg rounded-br-lg"
            >
              <motion.div
                className="flex flex-col items-center"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.2, delayChildren: 0.3 },
                  },
                }}
              >
                <motion.div
                  variants={{
                    hidden: { y: -20, opacity: 0 },
                    visible: { y: 0, opacity: 1 },
                  }}
                  style={{ color: cardColors.text[1] }}
                  className="text-4xl font-bold"
                >
                  BAN
                </motion.div>
                <div
                  style={{ backgroundColor: cardColors.bg[3] }}
                  className="w-48 h-0.5"
                />
                <motion.div
                  variants={{
                    hidden: { y: 20, opacity: 0 },
                    visible: { y: 0, opacity: 1 },
                  }}
                  style={{ color: cardColors.text[2] }}
                  className="text-3xl font-bold pt-1"
                >
                  {mapName}
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
