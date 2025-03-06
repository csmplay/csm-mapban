"use client";

import React, { useEffect, useState, useRef } from "react";
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
import { Trash2, LogIn, Users, Eye, Plus, PenBox } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AnimatePresence, motion } from "framer-motion";
import AnimatedBanCard from "@/components/ui/ban";
import AnimatedPickCard from "@/components/ui/pick";
import Image from "next/image";

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
}

type PickedMap = {
  map: string;
  teamName: string;
  side: string;
  sideTeamName: string;
};
type BannedMap = { map: string; teamName: string };

type Lobby = {
  lobbyId: string;
  members: string[];
  teamNames: [string, string][];
  observers: string[];
  picked: PickedMap[];
  banned: BannedMap[];
  rules: {
    gameName: string;
    gameType: string;
    mapNames: string[];
    gameStateList: string[];
    coinFlip: boolean;
    admin: boolean;
    knifeDecider: boolean;
    mapPoolSize: number;
  };
  gameStep: number;
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
  const [sourceMapPool, setSourceMapPool] = useState<Record<string, string[]>>({});
  const [adminOverlay, setAdminOverlay] = useState(false);
  const [editMapPool, setEditMapPool] = useState(false);
  const [mapPoolSize, setMapPoolSize] = useState<number>(7);
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  const [cardColors, setCardColors] = useState<CardColors>(initialCardColors);
  const [editCardColorsModal, setEditCardColorsModal] = useState(false);
  const [editingCardColors, setEditingCardColors] = useState<CardColors | null>(
    null,
  );

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const backendUrl =
    process.env.NODE_ENV === "development"
      ? process.env.BACKEND_URL + "/" || "http://localhost:4000/"
      : "/";

  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    socketRef.current = io(backendUrl);

    const fetchLobbies = async () => {
      try {
        const response = await fetch(`${backendUrl}api/lobbies`);
        const data: Lobby[] = await response.json();
        setLobbies(data);
      } catch (error) {
        console.error("Error fetching lobbies:", error);
      }
    };

    const fetchSourceMapPool = async () => {
      try {
        const response = await fetch(`${backendUrl}api/mapPool`);
        const data: { mapPool: Record<string, string[]>; mapNamesLists: Record<string, string[]> } =
          await response.json();
        setSourceMapPool(data.mapPool);
        setAllMapsList(data.mapNamesLists);
      } catch (error) {
        console.error("Error fetching map pool:", error);
      }
    };
    const fetchMapPool = async () => {
      try {
        const response = await fetch(`${backendUrl}api/mapPool`);
        const data: { mapPool: Record<string, string[]>; mapNamesLists: Record<string, string[]> } =
          await response.json();
        setMapPool(data.mapPool);
        setAllMapsList(data.mapNamesLists);
      } catch (error) {
        console.error("Error fetching map pool:", error);
      }
    };

    // Fetch initial card colors from backend with a typed response.
    fetch(`${backendUrl}api/cardColors`)
      .then((res) => res.json())
      .then((data: CardColors) => setCardColors(data))
      .catch((err) => console.error("Error fetching card colors:", err));

    (async () => {
      await fetchLobbies();
      await fetchSourceMapPool();
      await fetchMapPool();
    })();

    // Polling every 5 seconds to update the lobby list
    const interval = setInterval(fetchLobbies, 500);
    const interval2 = setInterval(fetchSourceMapPool, 500);

    if (socketRef.current) {
      socketRef.current.on("lobbyDeleted", (deletedLobbyId: string) => {
        setLobbies((prevLobbies) =>
          prevLobbies.filter((lobby) => lobby.lobbyId !== deletedLobbyId),
        );
      });

      // Listen for card colors updates with proper type.
      socketRef.current.on("cardColorsUpdated", (newCardColors: CardColors) => {
        setCardColors(newCardColors);
      });

      socketRef.current.on("lobbyCreationError", (errorMessage: string) => {
        toast({
          title: "Ошибка создания лобби",
          description: errorMessage,
          variant: "destructive",
        });
      });
    }

    return () => {
      clearInterval(interval);
      clearInterval(interval2);
      socketRef.current?.disconnect();
    };
  }, [backendUrl, toast]);

  const handleDeleteLobby = (lobbyId: string) => {
    if (socketRef.current) {
      setLobbies((prevLobbies) =>
        prevLobbies.filter((lobby) => lobby.lobbyId !== lobbyId),
      );
      socketRef.current.emit("delete", lobbyId);
    }
  };

  const handleCopyLink = (lobbyId: string) => {
    const lobbyUrl = `${window.origin}/lobby/${lobbyId}/obs`;
    navigator.clipboard.writeText(lobbyUrl).then(
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
    if (socketRef.current) {
      socketRef.current.emit("clear", lobbyId);
    }
  };

  const handlePlayAnimation = (lobbyId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("play", lobbyId);
    }
  };

  const handleCoinFlip = (coinFlip: boolean) => {
    if (socketRef.current) {
      setGlobalCoinFlip(coinFlip);
      socketRef.current.emit("coinFlipUpdate", coinFlip);
    }
  };

  const handleStartGame = (lobbyId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("start", lobbyId);
    }
  };

  const handleAdminLobby = () => {
    if (socketRef.current) {
      const lobbyId = `${Math.floor(1000 + Math.random() * 9000).toString()}`;
      socketRef.current.emit("createObsLobby", {
        lobbyId,
        gameName: gameName.toLowerCase(),
        gameType: gameType.toLowerCase(),
        coinFlip: localCoinFlip.current,
        knifeDecider: localKnifeDecider,
        mapPoolSize,
      });
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
      if (socketRef.current) {
        socketRef.current.emit("editMapPool", mapPool);
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
    if (socketRef.current) {
      socketRef.current.emit("resetMapPool");
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
    if (socketRef.current && editingCardColors) {
      socketRef.current.emit("editCardColors", editingCardColors);
      toast({ description: "Цвета карточек сохранены" });
    }
    setEditCardColorsModal(false);
    setEditingCardColors(null);

    setTimeout(() => {
      setShowSettingsModal(true);
    }, 300);
  };

  const handleResetCardColors = () => {
    if (socketRef.current) {
      socketRef.current.emit("resetCardColors");
      toast({ description: "Цвета карточек сброшены" });
    }
    setEditCardColorsModal(false);
    setEditingCardColors(null);

    setTimeout(() => {
      setShowSettingsModal(true);
    }, 300);
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
          <h1 className="text-4xl font-bold text-center text-foreground">
            Admin
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
                    <span className="truncate">Lobby: {lobby.lobbyId}</span>
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
                        Start Game
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ScrollArea className="h-64 pr-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">
                          Teams:
                        </h3>
                        <ul className="space-y-1">
                          {lobby.teamNames.map(([socketId, teamName]) => (
                            <li
                              key={socketId}
                              className="flex items-center text-sm"
                            >
                              <Badge variant="outline" className="mr-2">
                                {teamName}
                              </Badge>
                              <span className="text-foreground truncate">
                                {socketId}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Separator />
                      <div className="space-y-2">
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
                          Knife Decider:{" "}
                          {lobby.rules.knifeDecider ? "Skip" : "No"}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">
                          Picked:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {lobby.picked.map((item, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary"
                              className={item.teamName === "DECIDER" ? "bg-[#0A1A2F] hover:bg-[#0F2A4F]" : ""}
                            >
                              {item.side === "DECIDER"
                                ? `${item.map} (DECIDER)`
                                : `${item.map} (${item.teamName}), ${item.sideTeamName} - ${item.side.toUpperCase()}`
                              }
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">
                          Banned:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {lobby.banned.map((item, index) => (
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
                      onClick={() => handleCopyLink(lobby.lobbyId)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Copy OBS Link
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleClear(lobby.lobbyId)}
                    variant="outline"
                    className="flex-1"
                  >
                    Clear overlay
                  </Button>
                  <Button
                    onClick={() => handlePlayAnimation(lobby.lobbyId)}
                    variant="outline"
                    className="flex-1"
                  >
                    Replay animation
                  </Button>
                  <Button
                    onClick={() => handleConnectToLobby(lobby.lobbyId)}
                    variant="outline"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Connect
                  </Button>
                  <Button
                    onClick={() => handleDeleteLobby(lobby.lobbyId)}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete lobby
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
                  {["CS2", "Valorant"].map((game) => (
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
                {/* Отображаем размер маппула только для BO1 и BO2 */}
                {["BO1", "BO2"].includes(gameType) && (
                  <>
                    <h3 className="text-lg font-semibold mb-2 text-center">
                      Размер маппула
                    </h3>
                    <div className="flex justify-center space-x-4">
                      {[4, 7].map((size) => (
                        <Button
                          key={size}
                          variant={mapPoolSize === size ? "default" : "outline"}
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
                {["BO3", "BO5"].includes(gameType) && (
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
                          src={`/cs2/maps/${value.toLowerCase().replace(/ /g, "")}.jpg`}
                          alt={value}
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
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
                          src={`/valorant/maps/${value.toLowerCase().replace(/ /g, "")}.jpg`}
                          alt={value}
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
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
                            handleSelectChange(index, e.target.value, "valorant")
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
              <div className="space-y-6">
                {/* BAN card colors */}
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-center">
                    Цвета текста (BAN)
                  </h3>
                  <div className="flex justify-center space-x-4">
                    {editingCardColors.ban?.text?.map(
                      (color: string, index: number) => (
                        <input
                          key={index}
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newText = [...editingCardColors.ban.text];
                            newText[index] = e.target.value;
                            setEditingCardColors({
                              ...editingCardColors,
                              ban: { ...editingCardColors.ban, text: newText },
                            });
                          }}
                          className="w-12 h-12"
                        />
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-center">
                    Цвета фона (BAN)
                  </h3>
                  <div className="flex justify-center space-x-4">
                    {editingCardColors.ban?.bg?.map(
                      (color: string, index: number) => (
                        <input
                          key={index}
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newBg = [...editingCardColors.ban.bg];
                            newBg[index] = e.target.value;
                            setEditingCardColors({
                              ...editingCardColors,
                              ban: { ...editingCardColors.ban, bg: newBg },
                            });
                          }}
                          className="w-12 h-12"
                        />
                      ),
                    )}
                  </div>
                </div>
                {/* PICK card colors */}
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-center">
                    Цвета текста (PICK)
                  </h3>
                  <div className="flex justify-center space-x-4">
                    {editingCardColors.pick?.text?.map(
                      (color: string, index: number) => (
                        <input
                          key={index}
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newText = [...editingCardColors.pick.text];
                            newText[index] = e.target.value;
                            setEditingCardColors({
                              ...editingCardColors,
                              pick: {
                                ...editingCardColors.pick,
                                text: newText,
                              },
                            });
                          }}
                          className="w-12 h-12"
                        />
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-center">
                    Цвета фона (PICK)
                  </h3>
                  <div className="flex justify-center space-x-4">
                    {editingCardColors.pick?.bg?.map(
                      (color: string, index: number) => (
                        <input
                          key={index}
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newBg = [...editingCardColors.pick.bg];
                            newBg[index] = e.target.value;
                            setEditingCardColors({
                              ...editingCardColors,
                              pick: { ...editingCardColors.pick, bg: newBg },
                            });
                          }}
                          className="w-12 h-12"
                        />
                      ),
                    )}
                  </div>
                </div>
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
      </AnimatePresence>

      {editCardColorsModal && editingCardColors && (
        <>
          <motion.div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
            <div className="scale-75 bg-[#00FF00]">
              <AnimatedBanCard
                teamName="BAN Team"
                mapName="Dust 2"
                gameName="0"
                cardColors={editingCardColors.ban}
              />
            </div>
          </motion.div>
          <motion.div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
            <div className="scale-75 bg-[#00FF00]">
              <AnimatedPickCard
                teamName="PICK Team"
                mapName="Mirage"
                side="t"
                gameName="0"
                cardColors={editingCardColors.pick}
              />
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
