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

type PickedMap = { map: string; teamName: string; side: string };
type BannedMap = { map: string; teamName: string };

type Lobby = {
  lobbyId: string;
  members: string[];
  teamNames: [string, string][];
  observers: string[];
  picked: PickedMap[];
  banned: BannedMap[];
  gameName: number;
  gameType: number;
  mapNames: string[];
  gameStateList: string[];
  coinFlip: boolean;
  admin: boolean;
  gameStep: number; // Added current game step
  knifeDecider: number; // New flag indicating knife decider mode
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
  const [localKnifeDecider, setLocalKnifeDecider] = useState<number>(0);
  const [gameType, setGameType] = useState("BO1");
  const [gameName, setGame] = useState("CS2");
  const [allMapsList, setAllMapsList] = useState<string[][]>([]);
  const [sourceMapPool, setSourceMapPool] = useState<string[][]>([]);
  const [mapPool, setMapPool] = useState<string[][]>([]);
  const [adminOverlay, setAdminOverlay] = useState(false);
  const [editMapPool, setEditMapPool] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  const [cardColors, setCardColors] = useState<CardColors>(initialCardColors);
  const [editCardColorsModal, setEditCardColorsModal] = useState(false);
  const [editingCardColors, setEditingCardColors] = useState<CardColors | null>(
    null,
  );

  const backendUrl =
    process.env.NODE_ENV === "development"
      ? process.env.BACKEND_URL + "/" || "http://localhost:4000/"
      : "/";

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
        const data: { mapPool: string[][]; mapNamesLists: string[][] } =
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
        const data: { mapPool: string[][]; mapNamesLists: string[][] } =
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
    }

    return () => {
      clearInterval(interval);
      clearInterval(interval2);
      socketRef.current?.disconnect();
    };
  }, [backendUrl]);

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
      let gameNum = 0;
      if (gameName === "CS2") gameNum = 0;
      if (gameName === "Valorant") gameNum = 1;
      let gameTypeNum = 0;
      if (gameType === "BO3") gameTypeNum = 1;
      if (gameType === "BO5") gameTypeNum = 2;
      const lobbyId = `${Math.floor(1000 + Math.random() * 9000).toString()}`;
      socketRef.current.emit("createObsLobby", {
        lobbyId,
        gameNum,
        gameTypeNum,
        coinFlip: localCoinFlip.current,
        knifeDecider: localKnifeDecider,
      });
      setAdminOverlay(false);
    }
  };

  const handleMapPoolButton = () => {
    setMapPool(sourceMapPool);
    setEditMapPool(true);
  };
  const handleSelectChange = (
    index: number,
    value: string,
    gameNum: number,
  ) => {
    const newMapPool = [...mapPool[gameNum]];
    newMapPool[index] = value;

    if (gameNum == 0) {
      setMapPool([newMapPool, mapPool[1]]);
    } else {
      setMapPool([mapPool[0], newMapPool]);
    }
  };

  const handleEditMapPool = () => {
    const uniqueValuesZero = new Set(mapPool[0]);
    const uniqueValuesOne = new Set(mapPool[1]);
    if (
      uniqueValuesZero.size !== mapPool[0].length ||
      uniqueValuesOne.size !== mapPool[1].length
    ) {
      toast({ description: "Карты не должны повторяться!" });
    } else {
      if (socketRef.current) {
        socketRef.current.emit("editMapPool", mapPool);
        toast({ description: "Маппул сохранен" });
      }
    }
    setEditMapPool(false);
  };

  const handleResetMapPool = () => {
    if (socketRef.current) {
      socketRef.current.emit("resetMapPool");
      toast({ description: "Маппул сброшен" });
    }
    setEditMapPool(false);
  };

  const handleOpenEditModal = () => {
    // Create a copy so that editing does not update cardColors immediately.
    setEditingCardColors({ ...cardColors });
    setEditCardColorsModal(true);
  };

  const handleSaveCardColors = () => {
    if (socketRef.current && editingCardColors) {
      socketRef.current.emit("editCardColors", editingCardColors);
      toast({ description: "Цвета карточек сохранены" });
    }
    setEditCardColorsModal(false);
    setEditingCardColors(null);
  };

  const handleResetCardColors = () => {
    if (socketRef.current) {
      socketRef.current.emit("resetCardColors");
      toast({ description: "Цвета карточек сброшены" });
    }
    setEditCardColorsModal(false);
    setEditingCardColors(null);
  };

  const checkboxVariants = {
    checked: { scale: 1.1 },
    unchecked: { scale: 1 },
  };

  // New handler for knife decider choices.
  const handleKnifeDecider = (lobbyId: string, side: "blue" | "red") => {
    if (socketRef.current) {
      socketRef.current.emit("knifeDeciderChoice", { lobbyId, side });
    }
  };

  if (!cardColors) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="relative max-w-7xl mx-auto mb-8">
          <h1 className="text-4xl font-bold text-center text-gray-800">
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
          <Card className="w-full max-w-md mx-auto bg-white shadow-lg mb-8">
            <CardContent className="p-6 text-center text-gray-600 space-x-4 flex flex-wrap items-center gap-4">
              <AnimatedCheckbox
                id="coinFlip"
                checked={globalCoinFlip}
                onCheckedChange={(checked) => {
                  handleCoinFlip(checked as boolean);
                }}
                className="ml-8"
                variants={checkboxVariants}
                animate={globalCoinFlip ? "checked" : "unchecked"}
                transition={{ type: "spring", stiffness: 300, damping: 10 }}
              />
              <Label htmlFor="coinFlip">Подбросить монетку в начале игры</Label>
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
            </CardContent>
          </Card>
        </div>
        {lobbies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {lobbies.map((lobby) => (
              <Card
                key={lobby.lobbyId}
                className="w-full bg-white shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="text-xl text-gray-700 flex items-center justify-between">
                    <span className="truncate">Lobby: {lobby.lobbyId}</span>
                    <Badge
                      variant="secondary"
                      className="ml-2 flex items-center"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      {lobby.members.length}
                    </Badge>
                    {lobby.admin && (
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
                      {lobby.knifeDecider === 1 && lobby.gameStep === 6 && (
                        <div className="flex justify-around p-2 bg-gray-100">
                          <Button
                            variant="outline"
                            className="bg-blue-500 text-white"
                            onClick={() =>
                              handleKnifeDecider(lobby.lobbyId, "blue")
                            }
                          >
                            {lobby.teamNames[0][1] || "blue"}
                          </Button>
                          <Button
                            variant="outline"
                            className="bg-red-500 text-white"
                            onClick={() =>
                              handleKnifeDecider(lobby.lobbyId, "red")
                            }
                          >
                            {lobby.teamNames[1][1] || "red"}
                          </Button>
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-600 mb-2">
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
                              <span className="text-gray-500 truncate">
                                {socketId}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-sm text-gray-700">
                          Game Type:{" "}
                          {lobby.gameType === 0
                            ? "BO1"
                            : lobby.gameType === 1
                              ? "BO3"
                              : "BO5"}
                        </div>
                        <div className="text-sm text-gray-700">
                          Coin Flip: {lobby.coinFlip ? "Yes" : "No"}
                        </div>
                        <div className="text-sm text-gray-700">
                          Current Game Step: {lobby.gameStep}/7
                        </div>
                        <div className="text-sm text-gray-700">
                          Knife Decider:{" "}
                          {lobby.knifeDecider === 2
                            ? "Skip"
                            : lobby.knifeDecider === 1
                              ? "Manual"
                              : "No"}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-gray-600 mb-2">
                          Picked:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {lobby.picked.map((item, index) => (
                            <Badge key={index} variant="secondary">
                              {item.map} ({item.teamName}, Side:{" "}
                              {item.side.toUpperCase()})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-gray-600 mb-2">
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
                <CardFooter className="bg-gray-50 border-t p-4 flex flex-wrap gap-2">
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
                    className="flex-1 bg-blue-500 hover:bg-blue-700 text-[#dfdfdf] hover:text-white"
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
          <Card className="w-full max-w-md mx-auto bg-white shadow-lg">
            <CardContent className="p-6 text-center text-gray-600">
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
              className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
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
                          setLocalKnifeDecider(0);
                        }
                      }}
                      className="w-20"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-center">
                  Десайдер
                </h3>
                <div className="flex justify-center space-x-4">
                  {[
                    { label: "Рандом", value: 0 },
                    { label: "Авто (пропуск)", value: 2 },
                    { label: "Ножи вручную", value: 1 },
                  ].map((option) => (
                    <Button
                      key={option.label}
                      variant={
                        (["BO1", "BO2"].includes(gameType) &&
                          option.value === 0) ||
                        localKnifeDecider === option.value
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        if (!["BO3", "BO5"].includes(gameType)) {
                          toast({
                            title: "Ошибка",
                            description: `Десайдер не доступен в ${gameType}`,
                            variant: "destructive",
                          });
                          return;
                        }
                        setLocalKnifeDecider(option.value);
                      }}
                      className={`w-30 ${!["BO3", "BO5"].includes(gameType) ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="pt-6 ml-10 text-center text-gray-600 space-x-4 flex flex-wrap items-center gap-4">
                  <AnimatedCheckbox
                    id="coinFlip"
                    checked={localCoinFlip.current}
                    onCheckedChange={(checked) => {
                      localCoinFlip.current = checked as boolean;
                    }}
                    variants={checkboxVariants}
                    animate={localCoinFlip.current ? "checked" : "unchecked"}
                    transition={{ type: "spring", stiffness: 300, damping: 10 }}
                  />
                  <Label htmlFor="coinFlip">
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
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4 text-center">CS2</h2>
                {mapPool[0].map((value, index) => (
                  <select
                    key={index}
                    value={value}
                    onChange={(e) =>
                      handleSelectChange(index, e.target.value, 0)
                    }
                    className="border border-gray-300 rounded p-2"
                  >
                    <option value="" disabled>
                      Select a value
                    </option>
                    {allMapsList[0].map((refValue, refIndex) => (
                      <option key={refIndex} value={refValue}>
                        {refValue}
                      </option>
                    ))}
                  </select>
                ))}
                <h2 className="text-2xl font-bold mb-4 mt-4 text-center">
                  VALORANT
                </h2>
                {mapPool[1].map((value, index) => (
                  <select
                    key={index}
                    value={value}
                    onChange={(e) =>
                      handleSelectChange(index, e.target.value, 1)
                    }
                    className="border border-gray-300 rounded p-2"
                  >
                    <option value="" disabled>
                      Select a value
                    </option>
                    {allMapsList[1].map((refValue, refIndex) => (
                      <option key={refIndex} value={refValue}>
                        {refValue}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              <div className="flex justify-between mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditMapPool(false)}
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleResetMapPool}
                >
                  Сбросить
                </Button>
                <Button type="button" onClick={handleEditMapPool}>
                  Сохранить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {editCardColorsModal && editingCardColors && (
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
      </AnimatePresence>

      {editCardColorsModal && editingCardColors && (
        <>
          <motion.div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
            <div className="scale-75">
              <AnimatedBanCard
                teamName="BAN Team"
                mapName="Dust 2"
                gameName="0"
                cardColors={editingCardColors.ban}
              />
            </div>
          </motion.div>
          <motion.div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
            <div className="scale-75">
              <AnimatedPickCard
                teamName="PICK Team"
                mapName="Mirage"
                gameName="0"
                side="t"
                cardColors={editingCardColors.pick}
              />
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
