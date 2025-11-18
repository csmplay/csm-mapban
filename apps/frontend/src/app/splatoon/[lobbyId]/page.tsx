// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter, useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ActionLog } from "@/components/ui/ActionLog";
import { ArrowLeft, Copy, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

type GameMode = "clam" | "rainmaker" | "tower" | "zones";

const modeTranslations: Record<GameMode, string> = {
  tower: "Бой за башню",
  zones: "Бой за зоны",
  clam: "Устробол",
  rainmaker: "Мегакарп",
};

// Mode images by name
const getModeImagePath = (modeName: string): string => {
  const filename = modeName.toLowerCase();
  return `https://cdn.csmpro.ru/mapban/splatoon/modes/${filename}.png`;
};

// Map images by name
const getMapImagePath = (mapName: string): string => {
  const filename = mapName
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/["«»]/g, "");
  return `https://cdn.csmpro.ru/mapban/splatoon/maps/${filename}.jpg`;
};

export default function SplatoonLobbyPage() {
  // Core variables and states
  const { lobbyId } = useParams();
  const { toast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();

  // Maps and modes lists
  const [mapNames, setMapNames] = useState<string[]>([]);
  const [modesSize, setModesSize] = useState<number>(4);
  const [availableModes, setAvailableModes] = useState<GameMode[]>([
    "clam",
    "rainmaker",
    "tower",
    "zones",
  ]);

  useEffect(() => {
    if (modesSize === 2) {
      setAvailableModes(["tower", "zones"]);
    } else {
      setAvailableModes(["clam", "rainmaker", "tower", "zones"]);
    }
  }, [modesSize]);

  // Overlay states
  const [showTeamNameOverlay, setShowTeamNameOverlay] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isUndefined, setIsUndefined] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [showWinnerReportOverlay, setShowWinnerReportOverlay] = useState(false);
  const [showWinnerConfirmOverlay, setShowWinnerConfirmOverlay] =
    useState(false);
  const [pendingWinner, setPendingWinner] = useState<string | null>(null);
  const [reportingTeam, setReportingTeam] = useState<string | null>(null);
  const [winnerConfirmed, setWinnerConfirmed] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  const [coinResult, setCoinResult] = useState<number>(0);
  const isCoin = useRef(true);

  // Lobby data
  const [teamName, setTeamName] = useState<string>("");
  const [teamNames, setTeamNames] = useState<[string, string][]>([]);
  const [gameState, setGameState] = useState<string>("Игра начинается...");
  const [gameStateHistory, setGameStateHistory] = useState<string[]>([]);
  const [canWork, setCanWork] = useState<boolean>(false);

  // Function to filter game state history to only include ban/pick related messages
  const filteredGameStateHistory = useMemo(() => {
    return gameStateHistory
      .filter(
        (entry) =>
          entry.includes("забанили") ||
          entry.includes("выбрали") ||
          entry.includes("выбрали режим") ||
          entry.includes("забанили режим"),
      )
      .reverse(); // Reverse the order so newest entries appear at the top
  }, [gameStateHistory]);

  // Splatoon-specific states
  const [canModeBan, setCanModeBan] = useState<boolean>(false);
  const [canModePick, setCanModePick] = useState<boolean>(false);
  const [canMapBan, setCanMapBan] = useState<boolean>(false);
  const [canMapPick, setCanMapPick] = useState<boolean>(false);
  const [canReportWinner, setCanReportWinner] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [hasPriority, setHasPriority] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<GameMode | null>(null);

  // Map and mode data
  const [bannedModes, setBannedModes] = useState<
    Array<{ mode: GameMode; teamName: string }>
  >([]);
  const [bannedMaps, setBannedMaps] = useState<
    Array<{ map: string; teamName: string; roundNumber?: number }>
  >([]);
  const [pickedMaps, setPickedMaps] = useState<
    Array<{ map: string; teamName: string; roundNumber?: number }>
  >([]);
  const [selectedMapIndex, setSelectedMapIndex] = useState<number | null>(null);

  // Get the team names from the teamNames state
  const blueTeamEntry = teamNames[0];
  const redTeamEntry = teamNames[1];
  const blueTeamName = blueTeamEntry ? blueTeamEntry[1] : "Team Blue";
  const redTeamName = redTeamEntry ? redTeamEntry[1] : "Team Red";

  const backendUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/";

  const canMapBanRef = useRef(canMapBan);
  const canMapPickRef = useRef(canMapPick);
  const canModeBanRef = useRef(canModeBan);
  const canModePickRef = useRef(canModePick);
  const canReportWinnerRef = useRef(canReportWinner);
  const canWorkRef = useRef(canWork);
  const hasPriorityRef = useRef(hasPriority);
  const isWaitingRef = useRef(isWaiting);
  const teamNameRef = useRef(teamName);

  useEffect(() => {
    canMapBanRef.current = canMapBan;
  }, [canMapBan]);
  useEffect(() => {
    canMapPickRef.current = canMapPick;
  }, [canMapPick]);
  useEffect(() => {
    canModeBanRef.current = canModeBan;
  }, [canModeBan]);
  useEffect(() => {
    canModePickRef.current = canModePick;
  }, [canModePick]);
  useEffect(() => {
    canReportWinnerRef.current = canReportWinner;
  }, [canReportWinner]);
  useEffect(() => {
    canWorkRef.current = canWork;
  }, [canWork]);
  useEffect(() => {
    hasPriorityRef.current = hasPriority;
  }, [hasPriority]);
  useEffect(() => {
    isWaitingRef.current = isWaiting;
  }, [isWaiting]);
  useEffect(() => {
    teamNameRef.current = teamName;
  }, [teamName]);

  // Socket Calls Handling
  useEffect(() => {
    const newSocket = io(backendUrl);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      if (lobbyId) {
        newSocket.emit("getLobbyGameCategory", lobbyId);
        console.log(`Requested game category for lobby ${lobbyId}`);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });

    newSocket.on("lobbyGameCategory", (gameCategory: string) => {
      if (gameCategory !== "splatoon") {
        console.log("Detected non-Splatoon lobby, redirecting...");
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

    newSocket.on("availableMaps", (mapNamesArray: string[]) => {
      setMapNames(mapNamesArray);
    });

    // Handle 'teamNamesUpdated' event
    newSocket.on("teamNamesUpdated", (teamNamesArray: [string, string][]) => {
      setTeamNames(teamNamesArray);
    });

    // Handle 'startWithoutCoin' event
    newSocket.on("startWithoutCoin", () => {
      if (!isCoin.current) {
        setShowTeamNameOverlay(false);
        setIsWaiting(false);
      }
    });

    newSocket.on("endPick", () => {
      setShowTeamNameOverlay(false);
      setIsWaiting(false);
    });

    // Handle 'coinFlip' event
    newSocket.on("coinFlip", (result: number) => {
      console.log("Coin flip result:", result);
      setCoinResult(result);
      setIsWaiting(false);
      setIsAnimated(true);
      setShowTeamNameOverlay(true);
      setGameState("Подбрасываем монетку...");
      setTimeout(() => {
        setIsAnimated(false);
        setShowTeamNameOverlay(false);
      }, 5000);
    });

    // Handle 'isCoin' event
    newSocket.on("isCoin", (isCoinVar: boolean) => {
      console.log("Is coin flip enabled:", isCoinVar);
      isCoin.current = isCoinVar;
    });

    // Handle 'bannedUpdated' event for maps
    newSocket.on(
      "bannedUpdated",
      (
        banned: Array<{ map: string; teamName: string; roundNumber?: number }>,
      ) => {
        setBannedMaps(banned);
      },
    );

    // Handle 'pickedUpdated' event for maps
    newSocket.on(
      "pickedUpdated",
      (
        picked: Array<{ map: string; teamName: string; roundNumber?: number }>,
      ) => {
        setPickedMaps(picked);
        setSelectedMapIndex(null);
        setWinnerConfirmed(true);
        if (picked.length > 0) {
          setShowWinnerReportOverlay(true);
        }
      },
    );

    newSocket.on("modesSizeUpdated", (modesSize: number) => {
      setModesSize(modesSize);
    });

    // Handle 'modesUpdated' event
    newSocket.on(
      "modesUpdated",
      (data: {
        banned: Array<{ mode: GameMode; teamName: string }>;
        active: GameMode[];
        modesSize: number;
      }) => {
        setBannedModes(data.banned);
        setAvailableModes(data.active);
        setActiveMode(null);
        if (data.modesSize === 2) {
          setModesSize(2);
        } else if (data.modesSize === 4) {
          setModesSize(4);
        }
        setBannedMaps([]);
        setPickedMaps([]);
        if (data.active.length === 4 && data.banned.length > 0) {
          setHasPriority(data.banned[0].teamName === teamNameRef.current);
        }
      },
    );

    newSocket.on(
      "modePicked",
      (data: { mode: GameMode; teamName: string; translatedMode: string }) => {
        setActiveMode(data.mode);
        setWinnerConfirmed(false);
      },
    );

    // Handle UI state updates
    newSocket.on("canWorkUpdated", (canWorkState: boolean) => {
      console.log(`canWorkUpdated: ${canWorkState}`);
      setCanWork(canWorkState);
      if (!canWorkState) {
        setCanModeBan(false);
        setCanModePick(false);
        setCanMapBan(false);
        setCanMapPick(false);
      }
    });

    newSocket.on("canModeBan", (canModeBanState: boolean) => {
      console.log(`canModeBan: ${canModeBanState}`);
      setCanModeBan(canModeBanState);
      if (canModeBanState) {
        setCanModePick(false);
        setCanMapBan(false);
        setCanMapPick(false);
        console.log("Mode ban enabled, other options disabled");
      }
    });

    newSocket.on("canModePick", (canModePickState: boolean) => {
      console.log(`canModePick: ${canModePickState}`);
      setCanModePick(canModePickState);
      if (canModePickState) {
        setCanModeBan(false);
        setCanMapBan(false);
        setCanMapPick(false);
        console.log("Mode pick enabled, other options disabled");
      }
    });

    newSocket.on("canBan", (canBan: boolean) => {
      console.log(`[canBan] Received canBan event: ${canBan}`);
      console.log(`[canBan] Current state:`, {
        canWork: canWorkRef.current,
        canModeBan: canModeBanRef.current,
        canModePick: canModePickRef.current,
        canMapBan: canBan,
        canMapPick: canMapPickRef.current,
        canReportWinner: canReportWinnerRef.current,
        hasPriority: hasPriorityRef.current,
      });
      setCanMapBan(canBan);
    });

    newSocket.on("canPick", (canPick: boolean) => {
      console.log(`[canPick] Received canPick event: ${canPick}`);
      console.log(`[canPick] Current state:`, {
        canWork: canWorkRef.current,
        canModeBan: canModeBanRef.current,
        canModePick: canModePickRef.current,
        canMapBan: canMapBanRef.current,
        canMapPick: canPick,
        canReportWinner: canReportWinnerRef.current,
        hasPriority: hasPriorityRef.current,
      });
      setCanMapPick(canPick);
    });

    newSocket.on("canReportWinner", (canReportWinnerState: boolean) => {
      setCanReportWinner(canReportWinnerState);
    });

    // Game state updates
    newSocket.on("gameStateUpdated", (state: string) => {
      console.log(`[gameStateUpdated] Received game state update: ${state}`);
      console.log(`[gameStateUpdated] Current state:`, {
        canWork: canWorkRef.current,
        canModeBan: canModeBanRef.current,
        canModePick: canModePickRef.current,
        canMapBan: canMapBanRef.current,
        canMapPick: canMapPickRef.current,
        canReportWinner: canReportWinnerRef.current,
        hasPriority: hasPriorityRef.current,
      });
      setGameState(state);
      setGameStateHistory((prev) => [...prev, state]);
    });

    newSocket.on("lobbyUndefined", () => {
      setIsUndefined(true);
      setIsWaiting(false);
    });

    newSocket.on("lobbyDeleted", () => {
      setIsDeleted(true);
      setIsWaiting(false);
    });

    // Handle winner proposal
    newSocket.on(
      "winnerProposed",
      (data: { winnerTeam: string; reportingTeam: string }) => {
        if (data.reportingTeam !== teamNameRef.current) {
          setPendingWinner(data.winnerTeam);
          setReportingTeam(data.reportingTeam);
          setShowWinnerConfirmOverlay(true);
          setShowWinnerReportOverlay(false);
        } else {
          setShowWinnerReportOverlay(false);
        }
      },
    );

    // Handle winner rejection
    newSocket.on("winnerRejected", (data: { rejectingTeam: string }) => {
      if (data.rejectingTeam === teamNameRef.current) {
        setShowWinnerReportOverlay(true);
      }
    });

    // Handle winner confirmation
    newSocket.on("winnerConfirmed", () => {
      setWinnerConfirmed(true);
      setShowWinnerConfirmOverlay(false);
      setShowWinnerReportOverlay(false);
      setPendingWinner(null);
      setReportingTeam(null);
      setGameStateHistory([]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [lobbyId, router, backendUrl]);

  // Handle mode ban selection
  const handleModeBanClick = useCallback(
    (mode: GameMode) => {
      if (canModeBan) {
        setSelectedMode(mode);
      }
    },
    [canModeBan],
  );

  // Handle mode pick selection
  const handleModePickClick = useCallback(
    (mode: GameMode) => {
      if (canModePick) {
        setSelectedMode(mode);
      }
    },
    [canModePick],
  );

  // Handle map ban selection
  const handleMapBanClick = useCallback(
    (index: number) => {
      if (canMapBan) {
        setSelectedMapIndex(index);
      }
    },
    [canMapBan],
  );

  // Handle map pick selection
  const handleMapPickClick = useCallback(
    (index: number) => {
      if (canMapPick) {
        setSelectedMapIndex(index);
      }
    },
    [canMapPick],
  );

  // Handle submit button click
  const handleSubmit = useCallback(() => {
    if (socket) {
      if (canModeBan && selectedMode && modesSize === 4) {
        // Mode banning is only available for 4 modes
        socket.emit("lobby.modeBan", {
          lobbyId,
          mode: selectedMode,
          teamName,
        });
        setSelectedMode(null);
      } else if (canModePick && selectedMode) {
        socket.emit("lobby.modePick", {
          lobbyId,
          mode: selectedMode,
          teamName,
        });
        setSelectedMode(null);
      } else if (canMapBan && selectedMapIndex !== null) {
        socket.emit("lobby.ban", {
          lobbyId,
          map: mapNames[selectedMapIndex],
          teamName,
        });
        setSelectedMapIndex(null);
      } else if (canMapPick && selectedMapIndex !== null) {
        socket.emit("lobby.pick", {
          lobbyId,
          map: mapNames[selectedMapIndex],
          teamName,
        });
        setSelectedMapIndex(null);
      }
    }
  }, [
    socket,
    canModeBan,
    canModePick,
    canMapBan,
    canMapPick,
    selectedMode,
    selectedMapIndex,
    lobbyId,
    teamName,
    mapNames,
    modesSize,
  ]);

  // Handle winner selection
  const handleReportWinner = useCallback(
    (winnerTeam: string) => {
      if (socket) {
        socket.emit("lobby.proposeWinner", {
          lobbyId,
          winnerTeam,
          reportingTeam: teamName,
        });
        setShowWinnerReportOverlay(false);
      }
    },
    [socket, lobbyId, teamName],
  );

  // Handle winner confirmation
  const handleConfirmWinner = useCallback(
    (confirmed: boolean) => {
      if (socket && pendingWinner) {
        socket.emit("lobby.confirmWinner", {
          lobbyId,
          winnerTeam: pendingWinner,
          confirmed,
          confirmingTeam: teamName,
        });
        setShowWinnerConfirmOverlay(false);
        setPendingWinner(null);
        setReportingTeam(null);

        // If not confirmed, show the winner selection overlay for this team
        if (!confirmed) {
          setShowWinnerReportOverlay(true);
        }
      }
    },
    [socket, pendingWinner, lobbyId, teamName],
  );

  const handleTeamNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim() && socket) {
      console.log(`Submitting team name: ${teamName}`);
      setIsWaiting(true);
      socket.emit("lobby.teamName", { lobbyId, teamName: teamName.trim() });
    }
  };

  // Handle team name input changes
  const handleTeamNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTeamName(e.target.value);
    },
    [],
  ); // No dependencies needed

  const handleSkipTeamName = useCallback(() => {
    if (pickedMaps.length !== 0 || bannedMaps.length !== 0) {
      setShowTeamNameOverlay(false);
    }
    setIsWaiting(true);
  }, [pickedMaps.length, bannedMaps.length]);

  const handleBackClick = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleCopyCodeClick = useCallback(() => {
    navigator.clipboard.writeText(lobbyId as string);
    toast({
      title: "Код скопирован",
      description: "Код лобби скопирован в буфер обмена",
    });
  }, [lobbyId, toast]);

  if (isUndefined) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white">
        <Card className="w-full max-w-md rounded-md border border-orange-500 bg-zinc-900 p-6 text-white shadow-lg shadow-orange-500/20">
          <h1 className="mb-4 text-2xl font-bold">Лобби не найдено</h1>
          <p className="mb-6">
            Лобби с ID {lobbyId} не существует или было удалено.
          </p>
          <Button
            onClick={handleBackClick}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Вернуться
          </Button>
        </Card>
      </main>
    );
  }

  if (isDeleted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white">
        <Card className="w-full max-w-md rounded-md border border-orange-500 bg-zinc-900 p-6 text-white shadow-lg shadow-orange-500/20">
          <h1 className="mb-4 text-2xl font-bold">Лобби удалено</h1>
          <p className="mb-6">Лобби с ID {lobbyId} было удалено.</p>
          <Button
            onClick={handleBackClick}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Вернуться
          </Button>
        </Card>
      </main>
    );
  }

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

        {/* Game Modes */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Режимы {modesSize === 2 ? "(2 режима)" : "(4 режима)"}
          </h2>
          <div
            className={`grid gap-4 ${modesSize === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}
          >
            {(() => {
              const filteredModes = Object.entries(modeTranslations).filter(
                ([mode]) => {
                  if (modesSize === 2) {
                    return mode === "tower" || mode === "zones";
                  }
                  return true;
                },
              );

              return filteredModes.map(([mode, name]) => {
                const modeKey = mode as GameMode;
                const isBanned = bannedModes.some(
                  (banned) => banned.mode === modeKey,
                );
                const isActive = activeMode === modeKey;
                const isAvailable =
                  (canModePick && availableModes.includes(modeKey)) ||
                  (canModeBan &&
                    modesSize === 4 &&
                    availableModes.includes(modeKey));

                return (
                  <motion.div
                    key={mode}
                    layout
                    transition={{
                      layout: { duration: 0.3 },
                      opacity: { duration: 0.2 },
                    }}
                    whileHover={isAvailable ? { scale: 1.05 } : undefined}
                    whileTap={isAvailable ? { scale: 0.95 } : undefined}
                    className={`relative overflow-hidden rounded-md ${isBanned ? "opacity-50" : ""}`}
                  >
                    <Card
                      className={`relative flex flex-col items-center justify-center border-2 
                        ${isBanned ? "border-red-500" : isActive ? "border-green-500" : selectedMode === modeKey ? "border-gray-800" : "border-gray-300"}
                        bg-white p-3 transition-all 
                        ${isAvailable ? "cursor-pointer hover:shadow-xl" : "cursor-default"}
                      `}
                      onClick={() =>
                        canModeBan && modesSize === 4 && !isBanned
                          ? handleModeBanClick(modeKey)
                          : canModePick && !isBanned
                            ? handleModePickClick(modeKey)
                            : undefined
                      }
                    >
                      <div className="relative mb-2 h-12 w-12">
                        {isBanned && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="absolute h-0.5 w-full rotate-45 transform bg-red-500"></div>
                            <div className="absolute h-0.5 w-full -rotate-45 transform bg-red-500"></div>
                          </div>
                        )}
                        <Image
                          src={getModeImagePath(modeKey)}
                          alt={name}
                          width={48}
                          height={48}
                          className="rounded-md"
                          priority={true}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">{name}</span>
                      {isBanned && (
                        <span className="mt-1 text-xs text-red-500">
                          Забанено:{" "}
                          {
                            bannedModes.find(
                              (banned) => banned.mode === modeKey,
                            )?.teamName
                          }
                        </span>
                      )}
                      {isActive && (
                        <span className="mt-1 text-xs text-green-500">
                          Выбрано для игры
                        </span>
                      )}
                    </Card>
                  </motion.div>
                );
              });
            })()}
          </div>
        </div>

        {/* Map Cards */}
        {!winnerConfirmed && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {activeMode ? `Карты (${modeTranslations[activeMode]})` : "Карты"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center">
              {mapNames.map((mapName, index) => {
                const isPicked = pickedMaps.some(
                  (pick) => pick.map === mapName,
                );
                const isBanned = bannedMaps.some((ban) => ban.map === mapName);
                const isDisabled = isPicked || isBanned;
                const isSelected = selectedMapIndex === index;

                const banEntry = bannedMaps.find((ban) => ban.map === mapName);
                const banTeamColor =
                  banEntry && banEntry.teamName === blueTeamName
                    ? "blue"
                    : banEntry && banEntry.teamName === redTeamName
                      ? "red"
                      : null;

                const pickEntry = pickedMaps.find(
                  (pick) => pick.map === mapName,
                );

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
                      onClick={() =>
                        canMapBan && !isDisabled
                          ? handleMapBanClick(index)
                          : canMapPick && !isDisabled
                            ? handleMapPickClick(index)
                            : undefined
                      }
                    >
                      <Image
                        src={getMapImagePath(mapName)}
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
                      <div className="relative z-10 bg-black/50 px-2 py-1 rounded-md">
                        <span
                          className={`text-xl font-bold ${
                            isDisabled && !isPicked
                              ? "text-gray-400"
                              : "text-white"
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
                            <motion.div
                              initial={{ y: 100, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="absolute inset-0 flex items-center justify-center"
                            >
                              <div
                                className="transform text-white px-4 py-1 font-bold text-xl"
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
                                PICKED
                              </div>
                            </motion.div>
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
                                className="transform text-white px-4 py-1 font-bold text-xl"
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
          </div>
        )}

        {/* Submit Button */}
        <div className="justify-center flex my-10">
          {canWork && (
            <>
              <Button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl"
                onClick={handleSubmit}
                disabled={
                  (canModeBan && modesSize === 4 && !selectedMode) ||
                  (canModePick && !selectedMode) ||
                  (canMapBan && selectedMapIndex === null) ||
                  (canMapPick && selectedMapIndex === null)
                }
              >
                {canModeBan && modesSize === 4
                  ? "Забанить режим"
                  : canModePick
                    ? "Выбрать режим"
                    : canMapBan
                      ? "Забанить карту"
                      : canMapPick
                        ? "Выбрать карту"
                        : "Подтвердить"}
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center justify-center p-4">
          <ActionLog
            entries={filteredGameStateHistory}
            blueTeamName={blueTeamName}
            redTeamName={redTeamName}
          />
        </div>
      </div>

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
              {!isWaiting && !isUndefined && !isDeleted && !isAnimated && (
                <div>
                  {/* Lobby Info */}
                  <div className="mb-4 text-center">
                    <div className="text-lg font-semibold text-white">
                      Игра:{" "}
                      <span className="font-bold text-white">Splatoon</span>
                    </div>
                    <div className="text-md text-gray-200">
                      Количество режимов:{" "}
                      <span className="font-bold text-white">{modesSize}</span>
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
                      onChange={handleTeamNameChange}
                      maxLength={20}
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

              {isAnimated && (
                <div className="-mb-28">
                  <h2 className="text-2xl font-bold mb-4 text-center">
                    Подбрасываем монетку...
                  </h2>
                  <video
                    src={`https://cdn.csmpro.ru/mapban/coin_${coinResult}.webm`}
                    preload="high"
                    autoPlay
                    muted
                    className="mx-auto w-full max-w-md -mt-32"
                    onEnded={() => {
                      setIsAnimated(false);
                      setShowTeamNameOverlay(false);
                    }}
                  />
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Report Overlay */}
      <AnimatePresence>
        {showWinnerReportOverlay && (
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
              <h2 className="text-2xl font-bold mb-4 text-center">
                Выбранная карта и режим
              </h2>

              {/* Display active mode and picked map */}
              <div className="mb-6 p-3 bg-gray-100 rounded-lg flex justify-between items-center">
                {activeMode && (
                  <div className="flex items-center">
                    <span className="font-semibold mr-1">Режим:</span>
                    <span>{modeTranslations[activeMode]}</span>
                  </div>
                )}
                {pickedMaps.length > 0 && (
                  <div className="flex items-center">
                    <span className="font-semibold mr-1">Карта:</span>
                    <span>{pickedMaps[pickedMaps.length - 1].map}</span>
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold mb-4 text-center">
                Выберите победителя раунда
              </h2>

              <div className="space-y-3">
                {teamNames.map(([socketId, name]) => (
                  <Button
                    key={socketId}
                    onClick={() => handleReportWinner(name)}
                    className="w-full"
                  >
                    <Trophy className="mr-2 h-4 w-4" />
                    {name}
                  </Button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Confirmation Overlay */}
      <AnimatePresence>
        {showWinnerConfirmOverlay &&
          pendingWinner &&
          reportingTeam &&
          reportingTeam !== teamName && (
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
                <h2 className="text-2xl font-bold mb-4 text-center">
                  Подтверждение победителя
                </h2>

                <p className="text-center mb-6">
                  {reportingTeam} сообщает, что {pendingWinner} победили в этом
                  раунде. Это верно?
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => handleConfirmWinner(true)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Подтвердить
                  </Button>
                  <Button
                    onClick={() => handleConfirmWinner(false)}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    Отклонить
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
