"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export interface AnimatedBanModeCardProps {
  teamName: string;
  mode: {
    mode: string;
    translatedMode: string;
  };
  gameName: string;
  cardColors: {
    text: string[];
    bg: string[];
  };
  highlightElement?: string;
}

export default function AnimatedBanModeCard({
  teamName,
  mode,
  gameName,
  cardColors,
  highlightElement,
}: AnimatedBanModeCardProps) {
  const [isVisible] = useState(true);

  const teamTextSize =
    teamName.length > 9
      ? teamName.length > 15
        ? "text-xl"
        : "text-2xl"
      : "text-3xl";
  const modeTextSize =
    mode.translatedMode.length > 12
      ? mode.translatedMode.length > 18
        ? "text-xl"
        : "text-2xl"
      : "text-3xl";

  const getHighlightClass = (element: string) => {
    return highlightElement === element ? "animate-pulse" : "";
  };

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
              className={`absolute top-0 left-0 right-0 p-3 overflow-hidden ${getHighlightClass("top")}`}
            >
              <div className="flex items-center justify-center h-full">
                <span
                  style={{ color: cardColors.text[0] }}
                  className={`${teamTextSize} font-bold ${getHighlightClass("team")}`}
                >
                  {teamName}
                </span>
              </div>
            </motion.div>

            {/* Image Section */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ backgroundColor: cardColors.bg[1], originY: 1 }}
              className={`absolute top-[60px] bottom-[120px] left-0 right-0 overflow-hidden ${getHighlightClass("base")}`}
            >
              <div className="w-full h-full flex items-center justify-center">
                <Image
                  src={`/${gameName}/modes/${mode.mode.toLowerCase()}.png`}
                  alt={mode.translatedMode}
                  draggable={false}
                  width={220}
                  height={220}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{
                    objectFit: "cover",
                  }}
                  unoptimized
                />
              </div>
            </motion.div>

            {/* Bottom Info Section */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              style={{
                backgroundColor: cardColors.bg[2],
                width: "320px",
                height: "110px",
              }}
              className={`absolute bottom-0 left-0 right-0 pt-3 pb-4 pl-4 pr-4 rounded-bl-lg rounded-br-lg ${getHighlightClass("bottom")}`}
            >
              <motion.div
                className="flex flex-col items-center gap-1"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.2, delayChildren: 0.3 },
                  },
                }}
                style={{
                  width: "288px",
                  height: "86px",
                }}
              >
                <motion.div
                  variants={{
                    hidden: { y: -20, opacity: 0 },
                    visible: { y: 0, opacity: 1 },
                  }}
                  style={{ color: cardColors.text[1] }}
                  className={`text-4xl font-bold ${getHighlightClass("action")}`}
                >
                  BAN MODE
                </motion.div>
                <div
                  style={{ backgroundColor: cardColors.bg[3] }}
                  className={`w-48 h-0.5 ${getHighlightClass("stripe")}`}
                />
                <motion.div
                  variants={{
                    hidden: { y: 20, opacity: 0 },
                    visible: { y: 0, opacity: 1 },
                  }}
                  style={{ color: cardColors.text[2], height: "40px" }}
                  className={`${modeTextSize} font-bold flex items-center ${getHighlightClass("mode")}`}
                >
                  {mode.translatedMode}
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
