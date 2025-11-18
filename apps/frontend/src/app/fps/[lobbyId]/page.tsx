// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ActionLog } from "@/components/ui/ActionLog";
import { ArrowLeft, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function LobbyPage() {
  // Core variables and states
  const { lobbyId } = useParams();
  const { toast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();

  // Maps list
  const [mapNames, setMapNames] = useState<string[]>([]);

  // Game name
  const [gameName, setGameName] = useState<string>("0");

  // Overlay states
  const [showTeamNameOverlay, setShowTeamNameOverlay] = useState(true);
  const [showPrompts, setShowPrompts] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isKnifing, setIsKnifing] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  const [isUndefined, setIsUndefined] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [waitingForSide, setWaitingForSide] = useState(false);
  const iStartedPickRef = useRef(false);

  // Lobby data
  const [teamName, setTeamName] = useState("");
  const [teamNames, setTeamNames] = useState<[string, string][]>([]);
  const [teamColorByName, setTeamColorByName] = useState<Record<string, 'blue' | 'red'>>({});
  const [gameState, setGameState] = useState<string>("Игра начинается...");
  const [gameStateHistory, setGameStateHistory] = useState<string[]>([]);
  const [canPick, setCanPick] = useState(false);
  const [canBan, setCanBan] = useState(false);
  const [canWork, setCanWork] = useState(false);
  const [coinResult, setCoinResult] = useState<number>(0);
  const isCoin = useRef(true);

  const [fpsGameType, setFpsGameType] = useState<string>("");
  const fpsGameTypeRef = useRef<string>("");
  const [fpsMapPoolSize, setFpsMapPoolSize] = useState<number>(0);
  const [fpsKnifeDecider, setFpsKnifeDecider] = useState<boolean>(false);

  // Map data
  const [bannedMaps, setBannedMaps] = useState<
    Array<{ map: string; teamName: string }>
  >([]);
  const [pickedMaps, setPickedMaps] = useState<
    Array<{ map: string; teamName: string; side: string }>
  >([]);
  const [selectedMapIndex, setSelectedMapIndex] = useState<number | null>(null);
  const [pickMapId, setPickMapId] = useState<number>(0);

  const backendUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/";

  // Socket Calls Handling
  useEffect(() => {
    const newSocket = io(backendUrl);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      if (lobbyId) {
        // Request game type for this lobby
        newSocket.emit("getLobbyGameCategory", lobbyId);
        console.log(`Requested game category for lobby ${lobbyId}`);
      }
    });

    newSocket.on("lobbyGameCategory", (gameCategory: string) => {
      if (gameCategory !== "fps") {
        console.log("Detected non-FPS lobby, redirecting...");
        router.push(`/lobby/${lobbyId}`);
      } else {
        newSocket.emit("joinLobby", lobbyId, "member");
        console.log(`Joined lobby ${lobbyId}`);
      }
    });

    newSocket.on("lobbyNotFound", () => {
      console.log("Lobby not found, redirecting to home...");
      router.push("/");
    });

    newSocket.on("mapNames", (mapNamesArray: string[]) => {
      setMapNames(mapNamesArray);
    });

    newSocket.on("gameName", (gameNameVar: string) => {
      setGameName(gameNameVar);
    });

    // Handle 'teamNamesUpdated' event
    newSocket.on("teamNamesUpdated", (teamNamesArray: [string, string][]) => {
      setTeamNames(teamNamesArray);
      setTeamColorByName((prev) => {
        const next = { ...prev };
        teamNamesArray.forEach(([, name], idx) => {
          if (!next[name]) {
            const colorsTaken = new Set(Object.values(next));
            if (colorsTaken.size === 0) {
              next[name] = idx === 0 ? 'blue' : 'red';
            } else if (colorsTaken.size === 1) {
              if (!colorsTaken.has('blue')) next[name] = 'blue';
              else if (!colorsTaken.has('red')) next[name] = 'red';
              else next[name] = idx === 0 ? 'blue' : 'red'; // fallback
            }
          }
        });
        return next;
      });
    });

    newSocket.on("startWithoutCoin", () => {
      setShowTeamNameOverlay(false);
    });

    // Handle 'pickedUpdated' event
    newSocket.on(
      "pickedUpdated",
      (picked: Array<{ map: string; teamName: string; side: string }>) => {
        setPickedMaps(picked);
        setSelectedMapIndex(null);
        setWaitingForSide(false);
        setShowPrompts(false);
        iStartedPickRef.current = false;
      },
    );

    // Handle 'bannedUpdated' event
    newSocket.on(
      "bannedUpdated",
      (banned: Array<{ map: string; teamName: string }>) => {
        setBannedMaps(banned);
        setSelectedMapIndex(null);
      },
    );

    newSocket.on("lobbyDeleted", () => {
      console.log("lobbyDeleted");
      setIsWaiting(false);
      setIsAnimated(false);
      setIsKnifing(false);
      setIsDeleted(true);
    });

    // Handle 'lobbyUndefined'
    newSocket.on("lobbyUndefined", () => {
      console.log("lobbyUndefined");
      setIsWaiting(false);
      setIsAnimated(false);
      setIsKnifing(false);
      setIsUndefined(true);
    });

    // Handle 'canWorkUpdated' event
    newSocket.on("canWorkUpdated", (canWorkVar: boolean) => {
      setCanWork(canWorkVar);
      setSelectedMapIndex(null);
    });

    // Handle 'gameStateUpdated' event
    newSocket.on("gameStateUpdated", (gameStateVar: string) => {
      setGameState(gameStateVar);
      setGameStateHistory((prevHistory) => [gameStateVar, ...prevHistory]);
    });

    // Handle 'canBan' event
    newSocket.on("canBan", (banVar: boolean) => {
      console.log("I can ban now");
      setCanBan(() => banVar);
    });

    // Handle 'canPick' event
    newSocket.on("canPick", (pickVar: boolean) => {
      console.log("I can pick now");
      setCanPick(() => pickVar);
    });

    // Handle 'coinFlip' event
    newSocket.on("coinFlip", (result: number) => {
      setCoinResult(result);
      setIsWaiting(false);
      setIsAnimated(true);
      setTimeout(() => {
        setIsAnimated(false);
        setShowTeamNameOverlay(false);
      }, 5000);
    });

    // Handle 'isCoin' event
    newSocket.on("isCoin", (isCoinVar: boolean) => {
      isCoin.current = isCoinVar;
    });

    newSocket.on("backend.startPick", (index: number) => {
      setPickMapId(index);
      setSelectedMapIndex(index);
      setIsWaiting(false);
      const gt = fpsGameTypeRef.current;
      const pickerChooses = gt === "bo1" || !gt;
      const iStarted = iStartedPickRef.current;
      const shouldShowPrompts = pickerChooses ? iStarted : !iStarted;
      setShowPrompts(shouldShowPrompts);
      setWaitingForSide(!pickerChooses && iStarted);
    });

    newSocket.on("endPick", () => {
      setShowTeamNameOverlay(false);
      setIsWaiting(false);
      setWaitingForSide(false);
      iStartedPickRef.current = false;
    });

    newSocket.on(
      "fpsLobbySettings",
      (settings: {
        gameType: string;
        mapPoolSize: number;
        knifeDecider: boolean;
      }) => {
        setFpsGameType(settings.gameType);
        fpsGameTypeRef.current = settings.gameType;
        setFpsMapPoolSize(settings.mapPoolSize);
        setFpsKnifeDecider(settings.knifeDecider);
      },
    );

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [lobbyId, backendUrl, toast, router]);

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
    const teamName = team ? team[1] : "Spectator";

    if (canBan) {
      socket.emit("lobby.ban", { lobbyId, map: mapName, teamName });
    } else if (canPick) {
      socket.emit("lobby.startPick", { lobbyId, teamName, selectedMapIndex });
      iStartedPickRef.current = true;
      setWaitingForSide(fpsGameTypeRef.current !== "bo1");
      return;
    }

    setSelectedMapIndex(null);
  };

  const handlePromptClick = (side: string) => {
    setShowPrompts(false);

    if (socket && lobbyId && selectedMapIndex !== null) {
      const mapName = mapNames[selectedMapIndex];
      const team = teamNames.find(([socketId]) => socketId === socket.id);
      const teamName = team ? team[1] : "Spectator";

      socket.emit("lobby.pick", { lobbyId, map: mapName, teamName, side });
      // Reset selected map
      setSelectedMapIndex(null);
      setWaitingForSide(false);
    }
  };

  const handleTeamNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && lobbyId && teamName) {
      socket.emit("lobby.teamName", { lobbyId, teamName });
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
    router.push("/");
  };

  const handleCopyCodeClick = () => {
    navigator.clipboard
      .writeText(`${lobbyId}`)
      .then(() => toast({ description: "Код скопирован в буфер обмена" }))
      .catch(() => toast({ description: "Не получилось :(" }));
  };

  // Get the team names from the teamNames state
  const blueTeamEntry = teamNames[0];
  const redTeamEntry = teamNames[1];
  const blueTeamName = blueTeamEntry ? blueTeamEntry[1] : "Team Blue";
  const redTeamName = redTeamEntry ? redTeamEntry[1] : "Team Red";

  const getTeamColor = (name: string | undefined | null) => {
    if (!name) return null;
    return teamColorByName[name] || null;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 relative">
      <div className="max-w-6xl mx-auto">
        {/* Header Buttons */}
        <div className="flex justify-between items-center mb-6">
          <Button
            className="flex-1 max-w-xs"
            variant="outline"
            onClick={handleBackClick}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Главная
          </Button>
          <div className="mx-2"></div>
          <Button
            className="flex-1 max-w-xs"
            variant="outline"
            onClick={handleCopyCodeClick}
          >
            <Copy className="w-4 h-4 mr-2" />
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
        {/* Team Color Info */}
        <div className="flex justify-center items-center mb-4">
          {teamName === blueTeamName && (
            <span className="text-blue-500 text-xl font-semibold">
              Вы - синяя команда
            </span>
          )}
          {teamName === redTeamName && (
            <span className="text-red-500 text-xl font-semibold">
              Вы - красная команда
            </span>
          )}
        </div>

        <div className="flex justify-center items-center mb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={gameState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className={`
                            bg-white text-black px-4 py-2 rounded-lg font-bold text-xl border-2 
                            ${gameState.includes(redTeamName) ? "border-red-500" : "border-blue-500"}
                            `}
              >
                {gameState}
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Map Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center">
          {mapNames.map((mapName, index) => {
            const isPicked = pickedMaps.some((pick) => pick.map === mapName);
            const isBanned = bannedMaps.some((ban) => ban.map === mapName);
            const isDisabled = isPicked || isBanned;
            const isSelected = selectedMapIndex === index;

            const banEntry = bannedMaps.find((ban) => ban.map === mapName);
            const banTeamColor = getTeamColor(banEntry?.teamName);

            const pickEntry = pickedMaps.find((pick) => pick.map === mapName);
            const pickSide = pickEntry ? pickEntry.side : null;
            const pickTeamColor = getTeamColor(pickEntry?.teamName);

            return (
              <motion.div
                key={index}
                layout
                transition={{
                  layout: { duration: 0.3 },
                  opacity: { duration: 0.2 },
                }}
              >
                <Card
                  className={`
                                        w-full sm:w-64 p-6 flex flex-col items-center justify-between cursor-pointer transition-all duration-300 relative
                                        overflow-hidden ${
                                          isDisabled && !isPicked
                                            ? "bg-gray-200"
                                            : isSelected
                                              ? "bg-gray-800"
                                              : "bg-white hover:shadow-2xl"
                                        }
                                        h-64 
                                    `}
                  onClick={() => !isDisabled && handleCardClick(index)}
                >
                  <Image
                    src={`https://cdn.csmpro.ru/mapban/${gameName}/maps/${mapName.toLowerCase().replace(" ", "")}.jpg`}
                    alt={mapName}
                    draggable={false}
                    fill
                    priority={true}
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={`absolute inset-0 z-0 border-4 rounded-xl ${
                      isDisabled && !isPicked ? "grayscale blur-xs" : ""
                    } transition-all duration-300 
                                        ${isSelected && !isPicked ? "border-gray-500" : "border-gray-300"}
                                        ${isPicked ? "border-green-400" : ""}`}
                  />
                  <div
                    className={`relative z-10 bg-black/50 px-2 py-1 rounded-md`}
                  >
                    <span
                      className={`text-xl font-bold ${
                        isDisabled && !isPicked ? "text-gray-400" : "text-white"
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
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: {
                              staggerChildren: 0.2,
                              delayChildren: 0.3,
                            },
                          },
                        }}
                      >
                        {(() => {
                          const pickingColor = pickTeamColor;
                          const opponentColor = pickingColor === 'red'
                            ? 'blue'
                            : pickingColor === 'blue'
                              ? 'red'
                              : null;

                          const sideDeciderColor = fpsGameType === 'bo1' ? pickingColor : opponentColor;
                          const otherIconColor = fpsGameType === 'bo1' ? opponentColor : pickingColor;
                          return (
                            <>
                        {pickEntry.side === "DECIDER" && (
                          <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <div
                              className={`transform text-white
                                                        px-4 py-1 font-bold text-xl`}
                              style={{
                                position: "absolute",
                                top: "80%",
                                width: "150%",
                                height: "150%",
                                textAlign: "center",
                                opacity: 0.8,
                                backgroundColor: "#000000",
                              }}
                            >
                              DECIDER
                            </div>
                          </motion.div>
                        )}
                        {pickEntry.side !== "DECIDER" && (
                          <>
                            {/* Left Image (picked side) */}
                            <motion.div
                              initial={{ y: 100, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="relative flex items-center justify-center"
                            >
                              <Image
                                src={`https://cdn.csmpro.ru/mapban/${gameName}/${pickSide === "ct" ? "ct" : "t"}.jpg`}
                                alt={`${pickSide === "ct" ? "ct" : "t"}`}
                                draggable={false}
                                width={80}
                                height={80}
                                priority={true}
                                className={`rounded-full border-4 ${
                                  sideDeciderColor === 'red'
                                    ? 'border-red-500'
                                    : sideDeciderColor === 'blue'
                                      ? 'border-blue-500'
                                      : 'border-neutral-400'
                                }`}
                              />
                            </motion.div>

                            {/* Right Image (opposite side) */}
                            <motion.div
                              initial={{ y: 100, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="relative flex items-center justify-center"
                            >
                              <Image
                                src={`https://cdn.csmpro.ru/mapban/${gameName}/${pickSide === "ct" ? "t" : "ct"}.jpg`}
                                alt={`${pickSide === "ct" ? "t" : "ct"}`}
                                draggable={false}
                                width={80}
                                height={80}
                                priority={true}
                                className={`rounded-full border-4 ${
                                  otherIconColor === 'red'
                                    ? 'border-red-500'
                                    : otherIconColor === 'blue'
                                      ? 'border-blue-500'
                                      : 'border-neutral-400'
                                }`}
                              />
                            </motion.div>
                          </>
                        )}
                            </>
                          );
                        })()}
                      </motion.div>
                    )}

                    {isBanned && (
                      <motion.div
                        className="flex flex-row justify-between overflow-hidden"
                        initial="hidden"
                        animate="visible"
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: {
                              staggerChildren: 0.2,
                              delayChildren: 0.3,
                            },
                          },
                        }}
                      >
                        <motion.div
                          initial={{ y: 100, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <div
                            className={`transform text-white
                                                        px-4 py-1 font-bold text-xl`}
                            style={{
                              position: "absolute",
                              top: "80%",
                              width: "150%",
                              height: "150%",
                              textAlign: "center",
                              opacity: 0.8,
                              backgroundColor: "#000000",
                            }}
                          >
                            BANNED
                          </div>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className={`absolute inset-0 border-4 rounded-lg animate-pulse ${
                            banTeamColor === "blue"
                              ? "border-blue-500"
                              : "border-red-500"
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
          <Button
            onClick={handleSubmit}
            disabled={selectedMapIndex === null || !canWork}
          >
            Подтвердить
          </Button>
        </div>

        <div className="flex items-center justify-center p-4">
          <ActionLog
            entries={gameStateHistory}
            blueTeamName={blueTeamName}
            redTeamName={redTeamName}
          />
        </div>
      </div>

      {/* Prompts Modal */}
      <AnimatePresence>
        {showPrompts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 text-center">
                Выберите сторону на карте {mapNames[pickMapId]}
              </h2>
              <div className="flex justify-center space-x-4">
                <Image
                  src={`https://cdn.csmpro.ru/mapban/${gameName}/ct.jpg`}
                  alt="CT Icon"
                  priority={true}
                  width={100}
                  height={100}
                  className="cursor-pointer hover:opacity-80 transition-opacity rounded-full"
                  onClick={() => handlePromptClick("ct")}
                />
                <Image
                  src={`https://cdn.csmpro.ru/mapban/${gameName}/t.jpg`}
                  alt="T Icon"
                  width={100}
                  height={100}
                  priority={true}
                  className="cursor-pointer hover:opacity-80 transition-opacity rounded-full"
                  onClick={() => handlePromptClick("t")}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {waitingForSide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
            >
              <h2 className="text-2xl font-bold mb-2 text-center">
                Ожидание выбора стороны соперником
              </h2>
              {typeof pickMapId === "number" && mapNames[pickMapId] && (
                <p className="text-center text-neutral-600 mb-4">
                  Карта: <span className="font-semibold">{mapNames[pickMapId]}</span>
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team Name Overlay */}
      <AnimatePresence>
        {showTeamNameOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ width: "600px" }}
              className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
            >
              {!isWaiting &&
                !isAnimated &&
                !isUndefined &&
                !isDeleted &&
                !isKnifing && (
                  <div>
                    {/* Lobby Info */}
                    <div className="mb-4 ml-5 mr-5">
                      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 py-3">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            Игра
                          </span>
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            { gameName.toUpperCase() }
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            Правила
                          </span>
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {fpsGameType?.toUpperCase()}
                          </span>
                        </div>
                        {(fpsGameType === "bo1" || fpsGameType === "bo2") && (
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                              Размер маппула
                            </span>
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {fpsMapPoolSize}
                            </span>
                          </div>
                        )}
                        {(fpsGameType === "bo1" || fpsGameType === "bo3" || fpsGameType === "bo5") && (
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                              Десайдер
                            </span>
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {fpsKnifeDecider ? "Вкл" : "Выкл"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-center">
                      Введите имя команды
                    </h2>
                    <form onSubmit={handleTeamNameSubmit} className="space-y-4">
                      <Input
                        type="text"
                        placeholder="Имя команды..."
                        value={teamName}
                        maxLength={20}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full"
                      />
                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSkipTeamName}
                        >
                          Я зритель
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCopyCodeClick}
                        >
                          <Copy className="h-4 mr-2" />
                          {lobbyId}
                        </Button>
                        <Button
                          type="submit"
                          disabled={!teamName.trim() || teamNames.length === 2}
                        >
                          Подтвердить
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

              {isWaiting && (
                <div>
                  <h2 className="text-2xl font-bold text-center">
                    Ожидание готовности противника...
                  </h2>
                </div>
              )}
              {isKnifing && (
                <div>
                  <h2 className="text-2xl font-bold text-center">
                    Ожидание результатов ножевого раунда...
                  </h2>
                </div>
              )}
              {isUndefined && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 text-center">
                    Лобби не существует
                  </h2>
                  <div className="flex">
                    <Button
                      className="w-full bg-zinc-800 text-white hover:text-white hover:bg-zinc-700"
                      type="button"
                      variant="outline"
                      onClick={handleBackClick}
                    >
                      Назад
                    </Button>
                  </div>
                </div>
              )}
              {isDeleted && (
                <div>
                  <h2 className="text-2xl font-bold mb-4 text-center">
                    Лобби удалено
                  </h2>
                  <div className="flex">
                    <Button
                      className="w-full bg-zinc-800 text-white hover:text-white hover:bg-zinc-700"
                      type="button"
                      variant="outline"
                      onClick={handleBackClick}
                    >
                      Назад
                    </Button>
                  </div>
                </div>
              )}
              {isAnimated && (
                <div className="-mb-28">
                  <h2 className="text-2xl font-bold mb-4 text-center">
                    Подбрасываем монетку...
                  </h2>
                  <video
                    src={`https://cdn.csmpro.ru/mapban/coin_${coinResult}.webm`}
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
