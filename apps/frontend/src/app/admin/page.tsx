// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  LogIn,
  Users,
  Eye,
  Plus,
  PenBox,
  Droplet,
  Copy,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AnimatePresence, motion } from "framer-motion";
import AnimatedBanCard from "@/components/ui/ban";
import AnimatedPickCard from "@/components/ui/pick";
import AnimatedPickModeCard from "@/components/ui/pick_mode";
import AnimatedDeciderCard from "@/components/ui/decider";
import Image from "next/image";
import { fetchMapPool } from "@/lib/utils";
import AnimatedBanModeCard from "@/components/ui/ban_mode";

// Define the CardColors interface for both ban and pick cards.
interface CardColors {
  ban: {
    text: string[];
    bg: string[];
  };
  pick: {
    text: string[];
    bg: string[];
  };
  pick_mode: {
    text: string[];
    bg: string[];
  };
  ban_mode: {
    text: string[];
    bg: string[];
  };
  decider: {
    text: string[];
    bg: string[];
  };
}

type PickedMap = {
  map: string;
  teamName: string;
  side?: string;
  sideTeamName?: string;
};
type BannedMap = { map: string; teamName: string };

type RoundHistory = {
  roundNumber: number;
  pickedMaps: PickedMap[];
  pickedMode?: { mode: string; teamName: string; translatedMode: string };
};

type Lobby = {
  lobbyId: string;
  members: string[];
  teamNames: [string, string][];
  observers: string[];
  pickedMaps: PickedMap[];
  bannedMaps: BannedMap[];
  deciderMap?: { map: string; side: string };
  rules: {
    gameName: string;
    gameType: string;
    mapNames: string[];
    mapRulesList: string[];
    coinFlip: boolean;
    admin: boolean;
    knifeDecider: boolean;
    mapPoolSize: number;
    roundNumber?: number;
  };
  gameStep: number;
  pickedMode?: { mode: string; teamName: string; translatedMode: string };
  roundHistory?: RoundHistory[];
};

const AnimatedCheckbox = motion.create(Checkbox);

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
};

// Initialize with an empty (but typed) object—colors will be fetched from the backend.
const initialCardColors: CardColors = {
  ban: { text: [], bg: [] },
  pick: { text: [], bg: [] },
  pick_mode: { text: [], bg: [] },
  ban_mode: { text: [], bg: [] },
  decider: { text: [], bg: [] },
};

export default function AdminPage() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [globalCoinFlip, setGlobalCoinFlip] = useState(true);
  const localCoinFlip = useRef(true);
  const [localKnifeDecider, setLocalKnifeDecider] = useState(false);
  const [gameType, setGameType] = useState("BO1");
  const [gameName, setGame] = useState("CS2");
  const [allMapsList, setAllMapsList] = useState<Record<string, string[]>>({});
  const [mapPool, setMapPool] = useState<Record<string, string[]>>({});
  const [sourceMapPool, setSourceMapPool] = useState<Record<string, string[]>>(
    {},
  );
  const [adminOverlay, setAdminOverlay] = useState(false);
  const [editMapPool, setEditMapPool] = useState(false);
  const [mapPoolSize, setMapPoolSize] = useState<number>(7);
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();
  const [lobbyToDelete, setLobbyToDelete] = useState<string | null>(null);

  const [cardColors, setCardColors] = useState<CardColors>(initialCardColors);
  const [editCardColorsModal, setEditCardColorsModal] = useState(false);
  const [editingCardColors, setEditingCardColors] = useState<CardColors | null>(
    null,
  );
  const [hoveredElement, setHoveredElement] = useState<{
    type: "ban" | "pick" | "pick_mode" | "decider" | "ban_mode";
    element: string;
  } | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const backendUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/";

  const [activeTab, setActiveTab] = useState(0);

  // Update game type when game changes
  useEffect(() => {
    if (gameName === "Splatoon") {
      setGameType("BO3");
    }
  }, [gameName]);

  // Define fetchMapPoolData using useCallback to avoid recreating it on every render
  const fetchMapPoolData = useCallback(async () => {
    try {
      const result = await fetchMapPool(backendUrl);
      if (result.success) {
        setMapPool(result.mapPool);
        setAllMapsList(result.mapNamesLists);
      }
    } catch (error) {
      console.error("Error in fetchMapPoolData:", error);
    }
  }, [backendUrl]);

  const fetchSourceMapPoolData = useCallback(async () => {
    try {
      const result = await fetchMapPool(backendUrl);
      if (result.success) {
        setSourceMapPool(result.mapPool);
        setAllMapsList(result.mapNamesLists);
      }
    } catch (error) {
      console.error("Error in fetchSourceMapPoolData:", error);
    }
  }, [backendUrl]);

  useEffect(() => {
    socketRef.current = io(backendUrl);

    const fetchLobbies = async () => {
      try {
        const response = await fetch(`${backendUrl}api/lobbies`);
        const data = await response.json();
        setLobbies(data);
      } catch (error) {
        console.error("Error fetching lobbies:", error);
      }
    };

    // Fetch initial card colors from backend with a typed response.
    fetch(`${backendUrl}api/cardColors`)
      .then((res) => res.json())
      .then((data: CardColors) => setCardColors(data))
      .catch((err) => console.error("Error fetching card colors:", err));

    (async () => {
      await fetchLobbies();
      await fetchSourceMapPoolData();
      await fetchMapPoolData();
    })();

    // Polling every 5 seconds to update the lobby list
    const interval = setInterval(fetchLobbies, 500);
    const interval2 = setInterval(fetchSourceMapPoolData, 500);

    if (socketRef.current) {
      // Define the event handlers to be able to remove them later
      const handleLobbyDeleted = (deletedLobbyId: string) => {
        setLobbies((prevLobbies) =>
          prevLobbies.filter((lobby) => lobby.lobbyId !== deletedLobbyId),
        );
      };

      const handleCardColorsUpdated = (newCardColors: CardColors) => {
        setCardColors(newCardColors);
      };

      const handleCoinFlipUpdated = (newCoinFlip: boolean) => {
        setGlobalCoinFlip(newCoinFlip);
      };

      const handleLobbyCreationError = (errorMessage: string) => {
        toast({
          title: "Ошибка создания лобби",
          description: errorMessage,
          variant: "destructive",
        });
      };

      // Add the event listeners
      socketRef.current.on("lobbyDeleted", handleLobbyDeleted);
      socketRef.current.on("cardColorsUpdated", handleCardColorsUpdated);
      socketRef.current.on("coinFlipUpdated", handleCoinFlipUpdated);
      socketRef.current.on("lobbyCreationError", handleLobbyCreationError);

      // Clean up function to remove event listeners
      return () => {
        clearInterval(interval);
        clearInterval(interval2);
        if (socketRef.current) {
          socketRef.current.off("lobbyDeleted", handleLobbyDeleted);
          socketRef.current.off("cardColorsUpdated", handleCardColorsUpdated);
          socketRef.current.off("coinFlipUpdated", handleCoinFlipUpdated);
          socketRef.current.off("lobbyCreationError", handleLobbyCreationError);
          socketRef.current.disconnect();
        }
      };
    }

    return () => {
      clearInterval(interval);
      clearInterval(interval2);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [backendUrl, toast, fetchMapPoolData, fetchSourceMapPoolData]);

  const handleDeleteLobby = (lobbyId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      setLobbies((prevLobbies) =>
        prevLobbies.filter((lobby) => lobby.lobbyId !== lobbyId),
      );
      socketRef.current.emit("admin.delete", lobbyId);
      setLobbyToDelete(null);
    }
  };

  const handleCopyLink = () => {
    const obsUrl = `${window.origin}/obs`;
    navigator.clipboard.writeText(obsUrl).then(
      () => {
        toast({
          description: "Ссылка для OBS скопирована в буфер обмена",
        });
      },
      () => {
        toast({
          description: "Не получилось :(",
        });
      },
    );
  };

  const handleConnectToLobby = (lobbyId: string) => {
    window.open(`/lobby/${lobbyId}`, "_blank");
  };

  const handleClear = (lobbyId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("admin.clear_obs", lobbyId);
    }
  };

  const handleCoinFlip = (coinFlip: boolean) => {
    if (socketRef.current && socketRef.current.connected) {
      setGlobalCoinFlip(coinFlip);
      socketRef.current.emit("admin.coinFlipUpdate", coinFlip);
    }
  };

  const handleStartGame = (lobbyId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("admin.start", lobbyId);
    }
  };

  const handleAdminLobby = () => {
    if (socketRef.current && socketRef.current.connected) {
      const lobbyId = `${Math.floor(1000 + Math.random() * 9000).toString()}`;

      if (gameName === "Splatoon") {
        // Create Splatoon lobby
        socketRef.current.emit("createSplatoonLobby", {
          lobbyId,
          gameType: "bo3", // Default game type for Splatoon
          coinFlip: localCoinFlip.current,
          admin: true,
        });
      } else {
        // Create FPS lobby (CS2 or Valorant)
        socketRef.current.emit("createFPSLobby", {
          lobbyId,
          gameName: gameName.toLowerCase(),
          gameType: gameType.toLowerCase(),
          coinFlip: localCoinFlip.current,
          knifeDecider: localKnifeDecider,
          mapPoolSize,
          admin: true,
        });
      }
      setAdminOverlay(false);
    }
  };

  const handleMapPoolButton = () => {
    setShowSettingsModal(false);

    setTimeout(() => {
      setMapPool(sourceMapPool);
      setEditMapPool(true);
    }, 300);
  };
  const handleSelectChange = (
    index: number,
    value: string,
    gameName: string,
  ) => {
    const newMapPool = [...mapPool[gameName]];
    newMapPool[index] = value;

    if (gameName == "cs2") {
      setMapPool({ cs2: newMapPool, valorant: mapPool["valorant"] });
    } else {
      setMapPool({ cs2: mapPool["cs2"], valorant: newMapPool });
    }
  };

  const handleEditMapPool = () => {
    const uniqueValuesZero = new Set(mapPool["cs2"]);
    const uniqueValuesOne = new Set(mapPool["valorant"]);
    if (
      uniqueValuesZero.size !== mapPool["cs2"].length ||
      uniqueValuesOne.size !== mapPool["valorant"].length
    ) {
      toast({ description: "Карты не должны повторяться!" });
    } else {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("admin.editFPSMapPool", mapPool);
        toast({ description: "Маппул сохранен" });
      }
    }
    setEditMapPool(false);
    setActiveTab(0);

    setTimeout(() => {
      setShowSettingsModal(true);
    }, 300);
  };

  const handleResetMapPool = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("admin.editFPSMapPool");
      toast({ description: "Маппул сброшен" });
    }
    setEditMapPool(false);
    setActiveTab(0);

    setTimeout(() => {
      setShowSettingsModal(true);
    }, 300);
  };

  const handleOpenEditModal = () => {
    setShowSettingsModal(false);

    setTimeout(() => {
      // Create a copy so that editing does not update cardColors immediately.
      setEditingCardColors({ ...cardColors });
      setEditCardColorsModal(true);
    }, 300);
  };

  const handleSaveCardColors = () => {
    if (socketRef.current && socketRef.current.connected && editingCardColors) {
      socketRef.current.emit("admin.editCardColors", editingCardColors);
      toast({ description: "Цвета карточек сохранены" });
    }
    setEditCardColorsModal(false);
    setEditingCardColors(null);

    setTimeout(() => {
      setShowSettingsModal(true);
    }, 300);
  };

  const handleResetCardColors = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("admin.editCardColors");
      toast({ description: "Цвета карточек сброшены" });
    }
    setEditCardColorsModal(false);
    setEditingCardColors(null);

    setTimeout(() => {
      setShowSettingsModal(true);
    }, 300);
  };

  const handleSetObsLobby = (lobbyId: string) => {
    console.log("Attempting to set OBS lobby:", lobbyId);
    if (socketRef.current && socketRef.current.connected) {
      console.log("Socket is connected, emitting setObsLobby event");
      socketRef.current.emit("admin.setObsLobby", lobbyId);
      toast({
        title: "OBS View Updated",
        description: "This lobby is now being displayed in the OBS view",
      });
    } else {
      console.error("Socket is not connected!");
      toast({
        title: "Error",
        description: "Could not update OBS view - socket not connected",
        variant: "destructive",
      });
    }
  };

  const handleCreatePreviewLobby = () => {
    if (socketRef.current && socketRef.current.connected) {
      const lobbyId = "preview";

      // Create a Splatoon lobby for proper mode handling
      socketRef.current.emit("createSplatoonLobby", {
        lobbyId,
        gameType: "preview",
        coinFlip: false,
        admin: true,
      });

      // Add fake data to show all card types
      setTimeout(() => {
        if (socketRef.current) {
          // Set team names
          socketRef.current.emit("lobby.teamName", {
            lobbyId,
            teamName: "Team A",
          });
          socketRef.current.emit("lobby.teamName", {
            lobbyId,
            teamName: "Team B",
          });

          // Add a mode ban
          socketRef.current.emit("lobby.modeBan", {
            lobbyId,
            mode: "clam",
            translatedMode: "Устробол",
            teamName: "Маленькие слееры",
          });

          // Add a mode pick
          socketRef.current.emit("lobby.modePick", {
            lobbyId,
            mode: "zones",
            translatedMode: "Бой за зоны",
            teamName: "Красный бархат",
          });

          // Add a ban
          socketRef.current.emit("lobby.ban", {
            lobbyId,
            map: 'Аэропорт "Пенково"',
            teamName: "Inkblots",
          });

          // Add a pick
          socketRef.current.emit("lobby.pick", {
            lobbyId,
            map: "Тухловодск",
            teamName: "Spilled Tea",
            side: "t",
            sideTeamName: "Spilled Tea",
          });

          // Add a decider
          setTimeout(() => {
            socketRef.current?.emit("lobby.pick", {
              lobbyId,
              map: 'Велозал "9-й вал"',
              teamName: "",
              side: "DECIDER",
              sideTeamName: "",
            });
          }, 3000);

          // Set this lobby as the OBS view
          socketRef.current.emit("admin.setObsLobby", lobbyId);
        }
      }, 1000);
    }
    setShowSettingsModal(false);
  };

  const checkboxVariants = {
    checked: { scale: 1.1 },
    unchecked: { scale: 1 },
  };

  if (!cardColors) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="relative max-w-7xl mx-auto mb-8">
          <Button
            onClick={() => handleCopyLink()}
            variant="outline"
            className="absolute top-0 left-0"
          >
            <Copy className="w-4 h-4 mr-2" />
            Копировать OBS ссылку
          </Button>
          <h1 className="text-4xl font-bold text-center text-foreground flex items-center justify-center gap-4">
            <Image
              src="https://cdn.csmpro.ru/CSM_white.svg"
              alt="CSM"
              width={90}
              height={20}
              priority={true}
            />
            mapban admin
          </h1>
          <Button
            onClick={() => setAdminOverlay(true)}
            variant="outline"
            className="absolute top-0 right-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать OBS лобби
          </Button>
        </div>
        <div className="flex justify-center items-center mb-6">
          <Button
            onClick={() => setShowSettingsModal(true)}
            variant="outline"
            className="w-full max-w-md mx-auto bg-card shadow-lg mb-8 py-6"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-settings mr-2"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Настройки игры
          </Button>
        </div>
        {lobbies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {lobbies.map((lobby) => (
              <Card
                key={lobby.lobbyId}
                className="w-full bg-card shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <CardHeader className="bg-card border-b">
                  <CardTitle className="text-xl text-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="truncate">Лобби: {lobby.lobbyId}</span>
                      <Badge variant="outline" className="ml-2">
                        {lobby.rules.gameName.toUpperCase()}
                      </Badge>
                    </div>
                    <Badge
                      variant="secondary"
                      className="ml-2 flex items-center"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      {lobby.members.length}
                    </Badge>
                    {lobby.rules.admin && (
                      <Button
                        onClick={() => handleStartGame(lobby.lobbyId)}
                        variant="outline"
                        className="flex-1"
                        disabled={lobby.teamNames.length !== 2}
                      >
                        Старт
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ScrollArea className="h-90 pr-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">
                          Команды:
                        </h3>
                        <div className="space-y-1">
                          <div className="flex items-center justify-start gap-4">
                            {lobby.teamNames.map(
                              ([socketId, teamName], index) => (
                                <div
                                  key={socketId}
                                  className="flex items-center"
                                >
                                  <Badge
                                    variant="outline"
                                    className={`text-base font-bold ${index === 0 ? "bg-blue-500" : index === 1 ? "bg-red-500" : ""}`}
                                  >
                                    {teamName}
                                  </Badge>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <details className="cursor-pointer">
                          <summary className="font-semibold text-foreground mb-2">
                            Данные о лобби
                          </summary>
                          <div className="text-sm text-foreground">
                            Game Type:{" "}
                            {lobby.rules.gameType === "BO1"
                              ? "BO1"
                              : lobby.rules.gameType === "BO3"
                                ? "BO3"
                                : "BO5"}
                          </div>
                          <div className="text-sm text-foreground">
                            Coin Flip: {lobby.rules.coinFlip ? "Yes" : "No"}
                          </div>
                          <div className="text-sm text-foreground">
                            Current Game Step:{" "}
                            {lobby.rules.mapPoolSize == 4
                              ? lobby.gameStep - 3
                              : lobby.gameStep}
                            /{lobby.rules.mapPoolSize}
                          </div>
                          <div className="text-sm text-foreground">
                            {lobby.rules.gameName.toLowerCase() ===
                            "splatoon" ? (
                              <>Round Number: {lobby.rules.roundNumber || 0}</>
                            ) : (
                              <>
                                Knife Decider:{" "}
                                {lobby.rules.knifeDecider ? "Skip" : "No"}
                              </>
                            )}
                          </div>
                        </details>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">
                          Пики:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {lobby.rules.gameName.toLowerCase() === "splatoon" &&
                          lobby.roundHistory ? (
                            <>
                              {lobby.roundHistory.map(
                                (round: RoundHistory, roundIndex: number) => (
                                  <div key={roundIndex} className="w-full">
                                    <div className="text-sm font-medium text-muted-foreground mb-1">
                                      Раунд {round.roundNumber}
                                      {round.pickedMode &&
                                        ` - ${round.pickedMode.translatedMode.toUpperCase()}`}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {round.pickedMaps.map(
                                        (item: PickedMap, index: number) => (
                                          <Badge
                                            key={index}
                                            variant="secondary"
                                            className={
                                              item.teamName === "DECIDER"
                                                ? "bg-[#0A1A2F] hover:bg-[#0F2A4F]"
                                                : ""
                                            }
                                          >
                                            {item.map} ({item.teamName})
                                          </Badge>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                ),
                              )}
                            </>
                          ) : (
                            <>
                              {lobby.pickedMaps.map((item, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className={
                                    item.teamName === "DECIDER"
                                      ? "bg-[#0A1A2F] hover:bg-[#0F2A4F]"
                                      : ""
                                  }
                                >
                                  {item?.side === "DECIDER"
                                    ? `${item.map} (DECIDER)`
                                    : lobby.rules.gameName.toLowerCase() ===
                                        "splatoon"
                                      ? `${item.map.toUpperCase()} ${lobby.pickedMode?.translatedMode.toUpperCase() || ""} (${item.teamName})`
                                      : `${item.map} (${item.teamName}), ${item.sideTeamName} - ${item.side?.toUpperCase()}`}
                                </Badge>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">
                          Баны:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {lobby.bannedMaps.map((item, index) => (
                            <Badge key={index} variant="destructive">
                              {item.map} ({item.teamName})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
                <CardFooter className="bg-card border-t p-4 flex flex-wrap gap-2">
                  <div className="flex justify-center w-full">
                    <Button
                      onClick={() => handleSetObsLobby(lobby.lobbyId)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Показать OBS
                    </Button>
                    <Button
                      onClick={() => handleClear(lobby.lobbyId)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Droplet className="w-4 h-4 mr-2" />
                      Очистить OBS
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleConnectToLobby(lobby.lobbyId)}
                    variant="outline"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Подключиться
                  </Button>
                  <Button
                    onClick={() => setLobbyToDelete(lobby.lobbyId)}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить лобби
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="w-full max-w-md mx-auto bg-card">
            <CardContent className="p-6 text-center text-foreground">
              <p className="text-xl">Ничего нет...</p>
            </CardContent>
          </Card>
        )}
      </div>
      <AnimatePresence>
        {adminOverlay && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              variants={contentVariants}
              transition={{ duration: 0.3 }}
              className="bg-card p-6 rounded-lg shadow-xl max-w-md w-full text-card-foreground"
            >
              <h2 className="text-2xl font-bold mb-4 text-center">
                Выберите правила игры
              </h2>
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-2 text-center">Игра</h3>
                <div className="flex justify-center space-x-4">
                  {["CS2", "Valorant", "Splatoon"].map((game) => (
                    <Button
                      key={game}
                      variant={gameName === game ? "default" : "outline"}
                      onClick={() => setGame(game)}
                      className="w-20"
                    >
                      {game}
                    </Button>
                  ))}
                </div>

                {gameName !== "Splatoon" && (
                  <>
                    <h3 className="text-lg font-semibold mb-2 text-center">
                      Формат игры
                    </h3>
                    <div className="flex justify-center space-x-4">
                      {["BO1", "BO2", "BO3", "BO5"].map((type) => (
                        <Button
                          key={type}
                          variant={gameType === type ? "default" : "outline"}
                          onClick={() => {
                            setGameType(type);
                            if (["BO1", "BO2"].includes(type)) {
                              setLocalKnifeDecider(false);
                            } else {
                              setMapPoolSize(7);
                            }
                          }}
                          className="w-20"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </>
                )}

                {/* Отображаем размер маппула только для BO1 и BO2 */}
                {["BO1", "BO2"].includes(gameType) &&
                  gameName !== "Splatoon" && (
                    <>
                      <h3 className="text-lg font-semibold mb-2 text-center">
                        Размер маппула
                      </h3>
                      <div className="flex justify-center space-x-4">
                        {[4, 7].map((size) => (
                          <Button
                            key={size}
                            variant={
                              mapPoolSize === size ? "default" : "outline"
                            }
                            onClick={() => setMapPoolSize(size)}
                            className="w-20"
                          >
                            {size} карт
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                {/* Отображаем десайдер только для BO3 и BO5 */}
                {["BO3", "BO5"].includes(gameType) &&
                  gameName !== "Splatoon" && (
                    <>
                      <h3 className="text-lg font-semibold mb-2 text-center">
                        Десайдер
                      </h3>
                      <div className="flex justify-center space-x-4">
                        {[
                          { label: "Рандом", value: false },
                          { label: "Авто (пропуск)", value: true },
                        ].map((option) => (
                          <Button
                            key={option.label}
                            variant={
                              localKnifeDecider === option.value
                                ? "default"
                                : "outline"
                            }
                            onClick={() => setLocalKnifeDecider(option.value)}
                            className="w-30"
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                <div className="pt-6 ml-10 text-center text-foreground space-x-4 flex flex-wrap items-center gap-4">
                  <AnimatedCheckbox
                    id="localCoinFlip"
                    checked={localCoinFlip.current}
                    onCheckedChange={(checked) => {
                      localCoinFlip.current = checked as boolean;
                    }}
                    variants={checkboxVariants}
                    animate={localCoinFlip.current ? "checked" : "unchecked"}
                    transition={{ type: "spring", stiffness: 300, damping: 10 }}
                  />
                  <Label htmlFor="localCoinFlip">
                    Подбросить монетку в начале игры
                  </Label>
                </div>
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdminOverlay(false)}
                  >
                    Назад
                  </Button>
                  <Button type="button" onClick={handleAdminLobby}>
                    Создать лобби
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {editMapPool && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              variants={contentVariants}
              transition={{ duration: 0.3 }}
              className="bg-card p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto text-card-foreground"
            >
              <h2 className="text-3xl font-bold mb-6 text-center">
                Редактирование маппула
              </h2>

              {/* Информация о маппуле */}
              {
                <div className="mb-4 p-3 bg-muted rounded-md text-center">
                  <p className="text-sm text-muted-foreground">
                    Внимание! При выборе пула из 4 карт используются только
                    первые 4 карты в списке.
                  </p>
                </div>
              }

              {/* Tabs */}
              <div className="flex border-b mb-6">
                <button
                  onClick={() => setActiveTab(0)}
                  className={`px-4 py-2 text-lg font-medium ${
                    activeTab === 0
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground transition-colors"
                  }`}
                >
                  CS2
                </button>
                <button
                  onClick={() => setActiveTab(1)}
                  className={`px-4 py-2 text-lg font-medium ${
                    activeTab === 1
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground transition-colors"
                  }`}
                >
                  VALORANT
                </button>
              </div>

              {/* CS2 Maps Tab */}
              {activeTab === 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mapPool["cs2"].map((value, index) => (
                    <div
                      key={index}
                      className="bg-muted rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                    >
                      <div className="relative w-full pt-[75%]">
                        <Image
                          src={`https://cdn.csmpro.ru/mapban/cs2/maps/${value.toLowerCase().replace(/ /g, "")}.jpg`}
                          alt={value}
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
                          priority={true}
                          className="object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="p-3">
                        <select
                          value={value}
                          onChange={(e) =>
                            handleSelectChange(index, e.target.value, "cs2")
                          }
                          className="w-full bg-background border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="" disabled>
                            Выберите карту
                          </option>
                          {allMapsList["cs2"].map((refValue, refIndex) => (
                            <option key={refIndex} value={refValue}>
                              {refValue}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VALORANT Maps Tab */}
              {activeTab === 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mapPool["valorant"].map((value, index) => (
                    <div
                      key={index}
                      className="bg-muted rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                    >
                      <div className="relative w-full pt-[75%]">
                        <Image
                          src={`https://cdn.csmpro.ru/mapban/valorant/maps/${value.toLowerCase().replace(/ /g, "")}.jpg`}
                          alt={value}
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
                          className="object-cover"
                          priority={true}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="p-3">
                        <select
                          value={value}
                          onChange={(e) =>
                            handleSelectChange(
                              index,
                              e.target.value,
                              "valorant",
                            )
                          }
                          className="w-full bg-background border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="" disabled>
                            Выберите карту
                          </option>
                          {allMapsList["valorant"].map((refValue, refIndex) => (
                            <option key={refIndex} value={refValue}>
                              {refValue}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between mt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditMapPool(false);
                    setActiveTab(0);

                    setTimeout(() => {
                      setShowSettingsModal(true);
                    }, 300);
                  }}
                  className="px-6 border-white text-white hover:bg-white/10"
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleResetMapPool}
                  className="px-6"
                >
                  Сбросить
                </Button>
                <Button
                  type="button"
                  onClick={handleEditMapPool}
                  className="px-6"
                >
                  Сохранить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {editCardColorsModal && editingCardColors && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              variants={contentVariants}
              transition={{ duration: 0.3 }}
              className="bg-card p-6 rounded-lg shadow-xl max-w-5xl w-full overflow-y-auto text-card-foreground"
            >
              <h2 className="text-2xl font-bold mb-4 text-center">
                Редактировать цвета карточек
              </h2>

              {/* Tabs */}
              <div className="flex border-b mb-6">
                <button
                  onClick={() => setActiveTab(0)}
                  className={`px-4 py-2 text-lg font-medium ${
                    activeTab === 0
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground transition-colors"
                  }`}
                >
                  Карты
                </button>
                <button
                  onClick={() => setActiveTab(1)}
                  className={`px-4 py-2 text-lg font-medium ${
                    activeTab === 1
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground transition-colors"
                  }`}
                >
                  Десайдер
                </button>
                <button
                  onClick={() => setActiveTab(2)}
                  className={`px-4 py-2 text-lg font-medium ${
                    activeTab === 2
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground transition-colors"
                  }`}
                >
                  Режимы
                </button>
              </div>

              {/* Maps Tab (BAN & PICK) */}
              {activeTab === 0 && (
                <div className="grid grid-cols-2 gap-8">
                  {/* BAN Colors Section */}
                  <div className="bg-card/50 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">
                      BAN
                    </h2>

                    {/* BAN Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Текст
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-3 gap-6">
                          {editingCardColors.ban?.text?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "ban",
                                      element:
                                        index === 0
                                          ? "team"
                                          : index === 1
                                            ? "action"
                                            : "map",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newText = [
                                      ...editingCardColors.ban.text,
                                    ];
                                    newText[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      ban: {
                                        ...editingCardColors.ban,
                                        text: newText,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Команда"
                                    : index === 1
                                      ? "Действие"
                                      : index === 2
                                        ? "Карта"
                                        : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BAN Background Colors */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Фон
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                          {editingCardColors.ban?.bg?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "ban",
                                      element:
                                        index === 0
                                          ? "top"
                                          : index === 1
                                            ? "base"
                                            : index === 2
                                              ? "bottom"
                                              : "stripe",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newBg = [...editingCardColors.ban.bg];
                                    newBg[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      ban: {
                                        ...editingCardColors.ban,
                                        bg: newBg,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Верх"
                                    : index === 1
                                      ? "Подложка"
                                      : index === 2
                                        ? "Низ"
                                        : index === 3
                                          ? "Полоска"
                                          : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PICK Colors Section */}
                  <div className="bg-card/50 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">
                      PICK
                    </h2>

                    {/* PICK Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Текст
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-3 gap-6">
                          {editingCardColors.pick?.text?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "pick",
                                      element:
                                        index === 0
                                          ? "team"
                                          : index === 1
                                            ? "action"
                                            : "map",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newText = [
                                      ...editingCardColors.pick.text,
                                    ];
                                    newText[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      pick: {
                                        ...editingCardColors.pick,
                                        text: newText,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Команда"
                                    : index === 1
                                      ? "Действие"
                                      : index === 2
                                        ? "Карта"
                                        : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PICK Background Colors */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Фон
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                          {editingCardColors.pick?.bg?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "pick",
                                      element:
                                        index === 0
                                          ? "top"
                                          : index === 1
                                            ? "base"
                                            : index === 2
                                              ? "bottom"
                                              : "stripe",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newBg = [
                                      ...editingCardColors.pick.bg,
                                    ];
                                    newBg[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      pick: {
                                        ...editingCardColors.pick,
                                        bg: newBg,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Верх"
                                    : index === 1
                                      ? "Подложка"
                                      : index === 2
                                        ? "Низ"
                                        : index === 3
                                          ? "Полоска"
                                          : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Decider Tab */}
              {activeTab === 1 && (
                <div className="grid grid-cols-1 gap-8">
                  <div className="bg-card/50 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">
                      DECIDER
                    </h2>

                    {/* DECIDER Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Текст
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-3 gap-6">
                          {editingCardColors.decider?.text?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "decider",
                                      element:
                                        index === 0
                                          ? "team"
                                          : index === 1
                                            ? "action"
                                            : "map",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newText = [
                                      ...editingCardColors.decider.text,
                                    ];
                                    newText[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      decider: {
                                        ...editingCardColors.decider,
                                        text: newText,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Команда"
                                    : index === 1
                                      ? "Действие"
                                      : index === 2
                                        ? "Карта"
                                        : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    {/* DECIDER Background Colors */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Фон
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                          {editingCardColors.decider?.bg?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "decider",
                                      element:
                                        index === 0
                                          ? "top"
                                          : index === 1
                                            ? "base"
                                            : index === 2
                                              ? "bottom"
                                              : "stripe",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newBg = [
                                      ...editingCardColors.decider.bg,
                                    ];
                                    newBg[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      decider: {
                                        ...editingCardColors.decider,
                                        bg: newBg,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Верх"
                                    : index === 1
                                      ? "Подложка"
                                      : index === 2
                                        ? "Низ"
                                        : index === 3
                                          ? "Полоска"
                                          : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modes Tab */}
              {activeTab === 2 && (
                <div className="grid grid-cols-2 gap-8">
                  {/* MODE BAN Colors Section */}
                  <div className="bg-card/50 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">
                      MODE BAN
                    </h2>

                    {/* MODE BAN Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Текст
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-3 gap-6">
                          {editingCardColors.ban_mode?.text?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "ban_mode",
                                      element:
                                        index === 0
                                          ? "team"
                                          : index === 1
                                            ? "action"
                                            : "mode",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newText = [
                                      ...editingCardColors.ban_mode.text,
                                    ];
                                    newText[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      ban_mode: {
                                        ...editingCardColors.ban_mode,
                                        text: newText,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Команда"
                                    : index === 1
                                      ? "Действие"
                                      : index === 2
                                        ? "Режим"
                                        : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    {/* MODE BAN Background Colors */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Фон
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                          {editingCardColors.ban_mode?.bg?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "ban_mode",
                                      element:
                                        index === 0
                                          ? "top"
                                          : index === 1
                                            ? "base"
                                            : index === 2
                                              ? "bottom"
                                              : "stripe",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newBg = [
                                      ...editingCardColors.ban_mode.bg,
                                    ];
                                    newBg[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      ban_mode: {
                                        ...editingCardColors.ban_mode,
                                        bg: newBg,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Верх"
                                    : index === 1
                                      ? "Подложка"
                                      : index === 2
                                        ? "Низ"
                                        : index === 3
                                          ? "Полоска"
                                          : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MODE PICK Colors Section */}
                  <div className="bg-card/50 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">
                      MODE PICK
                    </h2>

                    {/* MODE PICK Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Текст
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-3 gap-6">
                          {editingCardColors.pick_mode?.text?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "pick_mode",
                                      element:
                                        index === 0
                                          ? "team"
                                          : index === 1
                                            ? "action"
                                            : "mode",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newText = [
                                      ...editingCardColors.pick_mode.text,
                                    ];
                                    newText[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      pick_mode: {
                                        ...editingCardColors.pick_mode,
                                        text: newText,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Команда"
                                    : index === 1
                                      ? "Действие"
                                      : index === 2
                                        ? "Режим"
                                        : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    {/* MODE PICK Background Colors */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        Фон
                      </h3>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                          {editingCardColors.pick_mode?.bg?.map(
                            (color: string, index: number) => (
                              <div
                                key={index}
                                className="flex flex-col items-center space-y-2"
                              >
                                <input
                                  type="color"
                                  value={color}
                                  onMouseEnter={() =>
                                    setHoveredElement({
                                      type: "pick_mode",
                                      element:
                                        index === 0
                                          ? "top"
                                          : index === 1
                                            ? "base"
                                            : index === 2
                                              ? "bottom"
                                              : "stripe",
                                    })
                                  }
                                  onMouseLeave={() => setHoveredElement(null)}
                                  onChange={(e) => {
                                    const newBg = [
                                      ...editingCardColors.pick_mode.bg,
                                    ];
                                    newBg[index] = e.target.value;
                                    setEditingCardColors({
                                      ...editingCardColors,
                                      pick_mode: {
                                        ...editingCardColors.pick_mode,
                                        bg: newBg,
                                      },
                                    });
                                  }}
                                  className="w-16 h-16 rounded cursor-pointer"
                                />
                                <span className="text-sm text-center font-medium">
                                  {index === 0
                                    ? "Верх"
                                    : index === 1
                                      ? "Подложка"
                                      : index === 2
                                        ? "Низ"
                                        : index === 3
                                          ? "Полоска"
                                          : ""}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditCardColorsModal(false);
                    setEditingCardColors(null);

                    setTimeout(() => {
                      setShowSettingsModal(true);
                    }, 300);
                  }}
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleResetCardColors}
                >
                  Сбросить
                </Button>
                <Button type="button" onClick={handleSaveCardColors}>
                  Сохранить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showSettingsModal && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              variants={contentVariants}
              transition={{ duration: 0.3 }}
              className="bg-card p-6 rounded-lg shadow-xl max-w-md w-full text-card-foreground"
            >
              <h2 className="text-2xl font-bold mb-4 text-center">
                Настройки игры
              </h2>
              <div className="space-y-6">
                <div className="flex items-center gap-4 justify-center p-4 bg-muted rounded-lg">
                  <AnimatedCheckbox
                    id="coinFlip"
                    checked={globalCoinFlip}
                    onCheckedChange={(checked) => {
                      handleCoinFlip(checked as boolean);
                    }}
                    variants={checkboxVariants}
                    animate={globalCoinFlip ? "checked" : "unchecked"}
                    transition={{ type: "spring", stiffness: 300, damping: 10 }}
                  />
                  <Label htmlFor="coinFlip" className="text-foreground">
                    Подбросить монетку в начале игры
                  </Label>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Button
                    onClick={handleMapPoolButton}
                    variant="outline"
                    className="w-full"
                  >
                    <PenBox className="w-4 h-4 mr-2" />
                    Редактировать маппул
                  </Button>

                  <Button
                    onClick={handleOpenEditModal}
                    variant="outline"
                    className="w-full"
                  >
                    <PenBox className="w-4 h-4 mr-2" />
                    Редактировать цвета карточек
                  </Button>

                  <Button
                    onClick={handleCreatePreviewLobby}
                    variant="outline"
                    className="w-full"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Отобразить все карточки в OBS
                  </Button>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={() => setShowSettingsModal(false)}
                    variant="outline"
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {lobbyToDelete && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              variants={contentVariants}
              transition={{ duration: 0.3 }}
              className="bg-card p-6 rounded-lg shadow-xl max-w-md w-full text-card-foreground"
            >
              <h2 className="text-2xl font-bold mb-4 text-center">
                Удалить лобби
              </h2>
              <p className="text-center mb-6">
                Вы уверены, что хотите удалить это лобби? Это действие нельзя
                отменить.
              </p>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLobbyToDelete(null)}
                >
                  Отменить
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteLobby(lobbyToDelete)}
                >
                  Удалить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {editCardColorsModal && editingCardColors && (
        <>
          <motion.div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
            <div className="scale-75 bg-[#00FF00]">
              {activeTab === 0 && (
                <AnimatedBanCard
                  teamName="Spilled Tea"
                  mapName='Велозал "9-й вал"'
                  gameName="splatoon"
                  cardColors={editingCardColors.ban}
                  highlightElement={
                    hoveredElement?.type === "ban"
                      ? hoveredElement.element
                      : undefined
                  }
                />
              )}
              {activeTab === 1 && (
                <AnimatedDeciderCard
                  mapName="Mirage"
                  gameName="cs2"
                  cardColors={editingCardColors.decider}
                  highlightElement={
                    hoveredElement?.type === "decider"
                      ? hoveredElement.element
                      : undefined
                  }
                />
              )}
              {activeTab === 2 && (
                <AnimatedBanModeCard
                  teamName="Spilled Tea"
                  mode={{ mode: "clam", translatedMode: "Устробол" }}
                  gameName="splatoon"
                  cardColors={editingCardColors.ban_mode}
                  highlightElement={
                    hoveredElement?.type === "ban_mode"
                      ? hoveredElement.element
                      : undefined
                  }
                />
              )}
            </div>
          </motion.div>
          <motion.div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
            <div className="scale-75 bg-[#00FF00]">
              {activeTab === 0 && (
                <AnimatedPickCard
                  teamName="Костромаэнерго"
                  sideTeamName="Костромаэнерго"
                  mapName="Mirage"
                  side="t"
                  gameName="cs2"
                  cardColors={editingCardColors.pick}
                  highlightElement={
                    hoveredElement?.type === "pick"
                      ? hoveredElement.element
                      : undefined
                  }
                />
              )}
              {activeTab === 1 && (
                <AnimatedDeciderCard
                  mapName="Mirage"
                  gameName="cs2"
                  cardColors={editingCardColors.decider}
                  highlightElement={
                    hoveredElement?.type === "decider"
                      ? hoveredElement.element
                      : undefined
                  }
                />
              )}
              {activeTab === 2 && (
                <AnimatedPickModeCard
                  teamName="Костромаэнерго"
                  sideTeamName="Костромаэнерго"
                  mode={{ mode: "tower", translatedMode: "Бой за башню" }}
                  gameName="splatoon"
                  cardColors={editingCardColors.pick_mode}
                  highlightElement={
                    hoveredElement?.type === "pick_mode"
                      ? hoveredElement.element
                      : undefined
                  }
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
