// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { fetchMapPool } from "@/lib/utils";
import { GitMerge, FileCheck } from "lucide-react";

const availableGames = [
  {
    id: "cs2",
    prettyName: "Counter-Strike 2",
    type: "fps",
    developer: "Valve",
  },
  {
    id: "valorant",
    prettyName: "Valorant",
    type: "fps",
    developer: "Riot Games",
  },
  {
    id: "splatoon",
    prettyName: "Splatoon 3",
    type: "splatoon",
    developer: "Nintendo",
  },
  {
    id: "ssbu",
    prettyName: "SSBU (скоро)",
    type: "other",
    developer: "Nintendo",
    disabled: true,
  },
];
const availableFormats = [
  { id: "BO1", name: "BO1" },
  { id: "BO2", name: "BO2" },
  { id: "BO3", name: "BO3" },
  { id: "BO5", name: "BO5" },
];

export default function HomePage() {
  const [lobbyId, setLobbyId] = useState("");
  const [showGameSelectionOverlay, setShowGameSelectionOverlay] =
    useState(false);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [showMapPoolOverlay, setShowMapPoolOverlay] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Things for sending lobby settings to server
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameType, setGameType] = useState("BO1");
  const [gameName, setGame] = useState("CS2");
  const [localKnifeDecider, setLocalKnifeDecider] = useState(false);
  const [localModesSize, setLocalModesSize] = useState(2);
  const [mapPoolSize, setMapPoolSize] = useState<number>(7);

  // Map pool related states
  const [activeTab, setActiveTab] = useState(0);
  const [allMapsList, setAllMapsList] = useState<Record<string, string[]>>({});
  const [mapPool, setMapPool] = useState<Record<string, string[]>>({});
  const [defaultMapPool, setDefaultMapPool] = useState<
    Record<string, string[]>
  >({});
  const [useCustomMapPool, setUseCustomMapPool] = useState(false);

  // Add missing states for overlays and loading
  const [connectionError, setConnectionError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [buildVersion, setBuildVersion] = useState<string>("");

  const backendUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/";

  const defaultMapPoolRef = useRef(defaultMapPool);
  useEffect(() => {
    defaultMapPoolRef.current = defaultMapPool;
  }, [defaultMapPool]);

  // Fetch map pool data
  const fetchMapPoolData = useCallback(async () => {
    try {
      const result = await fetchMapPool(backendUrl);

      if (result.success) {
        setMapPool(result.mapPool);
        setDefaultMapPool(result.mapPool);
        setAllMapsList(result.mapNamesLists);
      } else if (Object.keys(defaultMapPoolRef.current).length > 0) {
        // В случае ошибки используем последний известный дефолтный маппул
        setMapPool({ ...defaultMapPoolRef.current });
      }
    } catch (error) {
      console.error("Error in fetchMapPoolData:", error);
      if (Object.keys(defaultMapPoolRef.current).length > 0) {
        setMapPool({ ...defaultMapPoolRef.current });
      }
    }
  }, [backendUrl]);

  useEffect(() => {
    const newSocket = io(backendUrl, {
      reconnectionAttempts: 3,
      timeout: 3000,
    });

    setIsConnecting(true);
    setShowContent(false);
    setConnectionError(false);

    // Минимальное время загрузки
    const minLoadingMs = 500;
    const loadingStart = Date.now();

    function finishLoading() {
      const elapsed = Date.now() - loadingStart;
      if (elapsed < minLoadingMs) {
        setTimeout(() => {
          setIsConnecting(false);
          setShowContent(true);
          setConnectionError(false);
        }, minLoadingMs - elapsed);
      } else {
        setIsConnecting(false);
        setShowContent(true);
        setConnectionError(false);
      }
    }

    newSocket.on("connect", finishLoading);

    newSocket.on("connect_error", () => {
      setIsConnecting(false);
      setShowContent(false);
      setConnectionError(true);
    });

    newSocket.on("lobbyCreationError", (errorMessage: string) => {
      toast({
        title: "Ошибка создания лобби",
        description: errorMessage,
        variant: "destructive",
      });
      router.push("/");
    });

    setSocket(newSocket);

    // Fetch map pool data on initial load
    fetchMapPoolData();

    return () => {
      newSocket.disconnect();
    };
  }, [backendUrl, router, toast, fetchMapPoolData]);

  // Update game type when game changes
  useEffect(() => {
    if (gameName === "Splatoon 3") {
      setGameType("BO3");
    }
  }, [gameName]);

  const handleJoinLobby = async () => {
    if (lobbyId && lobbyId.length === 4) {
      try {
        // First check if socket is connected
        if (!socket?.connected) {
          toast({
            description: "Ошибка подключения к серверу",
            variant: "destructive",
          });
          return;
        }

        // Create a Promise to wait for the server response
        const checkLobbyExists = new Promise((resolve, reject) => {
          socket.emit("getLobbyGameCategory", lobbyId);

          const timeoutId = setTimeout(() => {
            reject(new Error("Timeout waiting for server response"));
          }, 5000); // 5 second timeout

          const handleLobbyNotFound = () => {
            clearTimeout(timeoutId);
            reject(new Error("Lobby does not exist"));
          };

          const handleSuccess = () => {
            clearTimeout(timeoutId);
            resolve(true);
          };

          socket.once("lobbyNotFound", handleLobbyNotFound);
          socket.once("lobbyGameCategory", handleSuccess);

          // Cleanup listeners
          setTimeout(() => {
            socket.off("lobbyNotFound", handleLobbyNotFound);
            socket.off("lobbyGameCategory", handleSuccess);
          }, 5000);
        });

        await checkLobbyExists;
        router.push(`/lobby/${lobbyId}`);
      } catch {
        toast({
          description: "Лобби не существует",
          variant: "destructive",
        });
      }
    } else {
      toast({
        description: "Введите корректный код лобби",
        variant: "destructive",
      });
    }
  };

  const handleCreateLobby = () => {
    if (socket) {
      const lobbyId = Math.floor(1000 + Math.random() * 9000).toString();

      if (gameName === "Splatoon 3") {
        // Create Splatoon lobby
        socket.emit("createSplatoonLobby", {
          lobbyId,
          gameType: gameType.toLowerCase(),
          modesSize: localModesSize,
          admin: false,
        });

        // Wait for lobby creation confirmation before redirecting
        socket.once("lobbyCreated", () => {
          setShowSettingsOverlay(false);
          router.push(`/splatoon/${lobbyId}`);
        });
      } else {
        // Create FPS lobby (CS2 or Valorant)
        let realGameName;
        if (gameName === "Counter-Strike 2") realGameName = "cs2";
        if (gameName === "Valorant") realGameName = "valorant";
        socket.emit("createFPSLobby", {
          lobbyId,
          gameName: realGameName,
          gameType: gameType.toLowerCase(),
          knifeDecider: localKnifeDecider,
          mapPoolSize,
          customMapPool: useCustomMapPool ? mapPool : null,
        });

        // Wait for lobby creation confirmation before redirecting
        socket.once("lobbyCreated", () => {
          setShowSettingsOverlay(false);
          router.push(`/fps/${lobbyId}`);
        });
      }
    }
  };

  // Функция для открытия оверлея редактирования маппула
  const handleOpenMapPoolEditor = async () => {
    if (!useCustomMapPool) {
      await fetchMapPoolData();
    }
    setShowSettingsOverlay(false);
    setTimeout(() => {
      setShowMapPoolOverlay(true);
    }, 300);
  };

  // Функция для выбора карты из выпадающего списка
  const handleSelectChange = (
    index: number,
    value: string,
    gameName: string,
  ) => {
    const newMapPool = [...mapPool[gameName]];
    newMapPool[index] = value;

    if (gameName === "cs2") {
      setMapPool({ cs2: newMapPool, valorant: mapPool["valorant"] });
    } else {
      setMapPool({ cs2: mapPool["cs2"], valorant: newMapPool });
    }

    // Установка флага использования пользовательского маппула
    setUseCustomMapPool(true);
  };

  // Сброс маппула к первоначальному состоянию
  const handleResetMapPool = () => {
    setMapPool({ ...defaultMapPool });
    setUseCustomMapPool(false);
    setShowMapPoolOverlay(false);
    setActiveTab(0); // Сбрасываем вкладку на CS2

    setTimeout(() => {
      setShowSettingsOverlay(true);
    }, 300);

    toast({
      description: "Маппул сброшен к значению по умолчанию",
    });
  };

  // Сохранение изменений маппула
  const handleSaveMapPool = () => {
    // Проверка на дубликаты в маппуле
    const uniqueValuesZero = new Set(mapPool["cs2"]);
    const uniqueValuesOne = new Set(mapPool["valorant"]);

    if (
      uniqueValuesZero.size !== mapPool["cs2"].length ||
      uniqueValuesOne.size !== mapPool["valorant"].length
    ) {
      toast({
        description: "Карты не должны повторяться!",
        variant: "destructive",
      });
      return;
    }

    setShowMapPoolOverlay(false);
    setActiveTab(0); // Сбрасываем вкладку на CS2

    setTimeout(() => {
      setShowSettingsOverlay(true);
    }, 300);

    toast({
      description: useCustomMapPool
        ? "Изменения маппула сохранены"
        : "Используется стандартный маппул",
    });
  };

  // Helper to get selected game info
  const selectedGameInfo = availableGames.find(
    (g) => g.prettyName === gameName,
  );

  useEffect(() => {
    fetch("/version")
      .then((res) => {
        if ([200, 301, 302].includes(res.status)) {
          return res.text();
        }
        throw new Error("Unexpected response status");
      })
      .then((ver) => {
        if (/^\d+\.\d+\.\d+$/.test(ver.trim())) {
          setBuildVersion(
            process.env.NODE_ENV === "development"
              ? `${ver.trim()}-dev`
              : ver.trim(),
          );
        } else {
          throw new Error("Invalid version format");
        }
      })
      .catch(() =>
        setBuildVersion(process.env.NODE_ENV === "development" ? "0-dev" : "0"),
      );
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {" "}
        {/* Loading State */}
        {(connectionError || !showContent || isConnecting) && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center space-y-6"
          >
            {/* Logo with pulsing animation */}
            <motion.div
              animate={
                !connectionError
                  ? {
                      scale: [1, 1.1, 1],
                      opacity: [0.6, 0.9, 0.6],
                    }
                  : {}
              }
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="https://cdn.csmpro.ru/CSM_white.svg"
                alt="CSM"
                width={80}
                height={21}
                className="opacity-60"
                priority={true}
              />
            </motion.div>

            {/* Loading status or error */}
            <div className="flex flex-col items-center space-y-4">
              {connectionError ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <span className="text-red-600 dark:text-red-400 text-xl">
                      ⚠
                    </span>
                  </div>
                  <div className="text-center space-y-3">
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Ошибка подключения к серверу CSM
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                        Пожалуйста, попробуйте позже
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        // Сброс состояний и попытка переподключения
                        setConnectionError(false);
                        setIsConnecting(true);
                        setShowContent(false);
                        window.location.reload();
                      }}
                      className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                    >
                      Попробовать снова
                    </Button>
                  </div>
                </div>
              ) : null}

              {!connectionError && (
                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {isConnecting
                      ? "Подключение к серверу..."
                      : "Загрузка данных..."}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                    {isConnecting
                      ? "Установка соединения"
                      : "Пожалуйста, подождите"}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {/* Main Content */}
        {showContent && !isConnecting && !connectionError && (
          <motion.div
            key="main-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            {/* Logo and Title */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-center mb-12"
            >
              <Image
                src="https://cdn.csmpro.ru/CSM_white.svg"
                alt="CSM"
                width={120}
                height={32}
                priority={true}
                className="mx-auto mb-6 opacity-90 cursor-pointer hover:opacity-100 transition-opacity duration-200"
                onClick={() => {
                  toast({
                    title: "Разрабочики",
                    description: "Сервис разработали GooseMooz и ch4og из CSM",
                    duration: 4000,
                  });
                }}
              />
              <h1 className="text-3xl font-light text-neutral-900 dark:text-neutral-100 mb-3 tracking-tight">
                Map Ban
              </h1>
              <p className="text-neutral-500 dark:text-neutral-500 text-sm font-normal">
                Присоединитесь к лобби или создайте новое
              </p>
            </motion.div>

            {/* Main Card */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm"
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Код лобби
                  </label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={4}
                      pattern={REGEXP_ONLY_DIGITS}
                      value={lobbyId}
                      onChange={(value) => setLobbyId(value)}
                    >
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="w-12 h-12 text-lg font-medium border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-xl focus:border-neutral-900 dark:focus:border-neutral-100 transition-colors duration-200"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    onClick={() => {
                      if (lobbyId.length !== 4) {
                        toast({
                          description: "Введите код лобби",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleJoinLobby();
                    }}
                    className={`w-full h-11 rounded-2xl font-medium transition-all duration-200 ${
                      lobbyId.length === 4
                        ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200"
                        : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                    }`}
                    disabled={lobbyId.length !== 4}
                  >
                    Присоединиться к лобби
                  </Button>
                </div>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-px bg-neutral-200 dark:bg-neutral-800"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white dark:bg-neutral-900 px-3 py-1 text-xs text-neutral-500 dark:text-neutral-500 font-medium uppercase tracking-wider">
                      или
                    </span>
                  </div>
                </div>

                {/* Create Lobby Button */}
                <Button
                  onClick={() => setShowGameSelectionOverlay(true)}
                  className="w-full h-11 rounded-2xl font-medium bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all duration-200"
                >
                  Создать своё лобби
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer with GitHub and License buttons */}
      {showContent && !isConnecting && !connectionError && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col sm:flex-row gap-4 items-center justify-center"
        >
          <Button
            variant="outline"
            className="flex items-center gap-2 text-sm"
            onClick={() =>
              window.open("https://git.csmpro.ru/csmpro/csm-mapban", "_blank")
            }
          >
            <GitMerge className="w-4 h-4" />
            Git
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2 text-sm"
            onClick={() =>
              window.open(
                "https://git.in.csmpro.ru/csmpro/csm-mapban#license-and-trademark-notice",
                "_blank",
              )
            }
          >
            <FileCheck className="w-4 h-4" />
            Licences
          </Button>
        </motion.div>
      )}

      {/* Settings Overlay */}
      <AnimatePresence>
        {/* Game Selection Overlay */}
        {showGameSelectionOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xl max-w-md w-full"
            >
              <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
                Выберите игру
              </h2>

              <div className="space-y-4">
                {/* Expanded Game Selection */}
                <div className="grid grid-cols-2 gap-3">
                  {availableGames.map((game) => (
                    <Button
                      key={game.id}
                      onClick={() => {
                        setGame(game.prettyName);
                        setShowGameSelectionOverlay(false);
                        setTimeout(() => {
                          setShowSettingsOverlay(true);
                        }, 200);
                      }}
                      // for disabled games we need to disable the button
                      disabled={game.disabled}
                      className="h-20 rounded-2xl font-medium transition-all duration-200 flex flex-col items-center justify-center gap-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                    >
                      <Image
                        src={`https://cdn.csmpro.ru/mapban/${game.id}/logo.png`}
                        alt={game.prettyName}
                        width={28}
                        height={28}
                        className="opacity-90"
                        priority={true}
                      />
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {game.prettyName}
                        </div>
                        <div className="text-xs opacity-60">
                          {game.developer}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>

                {/* Action button */}
                <div className="flex pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <Button
                    type="button"
                    onClick={() => setShowGameSelectionOverlay(false)}
                    className="w-full h-10 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Settings Overlay */}
        {showSettingsOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xl max-w-md w-full"
            >
              <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
                Настройки для {gameName}
              </h2>

              <div className="space-y-4">
                {/* Game Format for non-Splatoon games */}
                {selectedGameInfo?.type !== "splatoon" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
                      Формат игры
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {availableFormats.map((format) => (
                        <Button
                          key={format.id}
                          onClick={() => {
                            setGameType(format.id);
                            if (
                              ["bo1", "bo2"].includes(format.id.toLowerCase())
                            ) {
                              setLocalKnifeDecider(false);
                            } else if (
                              ["bo3", "bo5"].includes(format.id.toLowerCase())
                            ) {
                              setMapPoolSize(7);
                            }
                          }}
                          className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                            gameType === format.id
                              ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                          }`}
                        >
                          {format.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modes count for Splatoon */}
                {selectedGameInfo?.type === "splatoon" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
                      Количество режимов
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[2, 4].map((size) => (
                        <Button
                          key={size}
                          onClick={() => setLocalModesSize(size)}
                          className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                            localModesSize === size
                              ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                          }`}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Map pool size for BO1 and BO2 */}
                {["BO1", "BO2"].includes(gameType) &&
                  selectedGameInfo?.type !== "splatoon" && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
                        Размер маппула
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[4, 7].map((size) => (
                          <Button
                            key={size}
                            onClick={() => setMapPoolSize(size)}
                            className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                              mapPoolSize === size
                                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                            }`}
                          >
                            {size} карт
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Decider for BO1, BO3 and BO5 */}
                {["BO1", "BO3", "BO5"].includes(gameType) &&
                  selectedGameInfo?.type !== "splatoon" && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
                        Десайдер
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Выкл", value: false },
                          { label: "Вкл", value: true },
                        ].map((option) => (
                          <Button
                            key={option.label}
                            onClick={() => setLocalKnifeDecider(option.value)}
                            className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                              localKnifeDecider === option.value
                                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                            }`}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Map pool editor for FPS games */}
                {selectedGameInfo?.type === "fps" && (
                  <Button
                    onClick={handleOpenMapPoolEditor}
                    className={`w-full h-10 rounded-2xl font-medium transition-all duration-200 ${
                      useCustomMapPool
                        ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                    }`}
                  >
                    {useCustomMapPool
                      ? "Маппул изменен ✓"
                      : "Редактировать маппул"}
                  </Button>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowSettingsOverlay(false);
                      setTimeout(() => {
                        setShowGameSelectionOverlay(true);
                      }, 200);
                    }}
                    className="h-10 px-6 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
                  >
                    Назад
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateLobby}
                    className="flex-1 h-10 rounded-2xl font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all duration-200"
                  >
                    Создать
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Map Pool Editor Overlay */}
        {showMapPoolOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xl w-full max-w-5xl max-h-[85vh] overflow-y-auto"
            >
              <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-4">
                Редактирование маппула
              </h2>

              {/* Info banner */}
              <div className="mb-4 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
                  При выборе пула из 4 карт используются только первые 4 карты в
                  списке
                </p>
              </div>

              {/* Tabs */}
              <div className="flex mb-4 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl max-w-xs mx-auto">
                <button
                  onClick={() => setActiveTab(0)}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-xl transition-all duration-200 ${
                    activeTab === 0
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                  }`}
                >
                  CS2
                </button>
                <button
                  onClick={() => setActiveTab(1)}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-xl transition-all duration-200 ${
                    activeTab === 1
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                  }`}
                >
                  VALORANT
                </button>
              </div>

              {/* CS2 Maps Tab */}
              {activeTab === 0 && mapPool["cs2"] && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
                  {mapPool["cs2"].map((value, index) => (
                    <div
                      key={index}
                      className="group bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200"
                    >
                      <div className="relative w-full pt-[70%] overflow-hidden">
                        <Image
                          src={`https://cdn.csmpro.ru/mapban/cs2/maps/${value.toLowerCase().replace(/ /g, "")}.jpg`}
                          alt={value}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover"
                          priority={true}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="p-2">
                        <select
                          value={value}
                          onChange={(e) =>
                            handleSelectChange(index, e.target.value, "cs2")
                          }
                          className="w-full bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100 transition-colors duration-200"
                        >
                          <option value="" disabled>
                            Выберите карту
                          </option>
                          {allMapsList["cs2"]?.map((mapName, mapIndex) => (
                            <option key={mapIndex} value={mapName}>
                              {mapName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VALORANT Maps Tab */}
              {activeTab === 1 && mapPool["valorant"] && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
                  {mapPool["valorant"].map((value, index) => (
                    <div
                      key={index}
                      className="group bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200"
                    >
                      <div className="relative w-full pt-[70%] overflow-hidden">
                        <Image
                          src={`https://cdn.csmpro.ru/mapban/valorant/maps/${value.toLowerCase().replace(/ /g, "")}.jpg`}
                          alt={value}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover"
                          priority={true}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="p-2">
                        <select
                          value={value}
                          onChange={(e) =>
                            handleSelectChange(
                              index,
                              e.target.value,
                              "valorant",
                            )
                          }
                          className="w-full bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100 transition-colors duration-200"
                        >
                          <option value="" disabled>
                            Выберите карту
                          </option>
                          {allMapsList["valorant"]?.map((mapName, mapIndex) => (
                            <option key={mapIndex} value={mapName}>
                              {mapName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  onClick={() => {
                    setShowMapPoolOverlay(false);
                    setActiveTab(0);
                    setTimeout(() => {
                      setShowSettingsOverlay(true);
                    }, 300);
                  }}
                  className="flex-1 h-9 rounded-xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  onClick={handleResetMapPool}
                  className="flex-1 h-9 rounded-xl font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 border-0 transition-all duration-200"
                >
                  Сбросить
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveMapPool}
                  className="flex-1 h-9 rounded-xl font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all duration-200"
                >
                  Сохранить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build version in bottom right corner */}
      <a
        href={`https://git.in.csmpro.ru/csmpro/csm-mapban/releases/tag/v${buildVersion.replace(/-dev$/, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-2 right-2 z-50 text-xs text-neutral-400 dark:text-neutral-500 bg-white/80 dark:bg-neutral-900/80 px-2 py-1 rounded shadow cursor-pointer"
        style={{ pointerEvents: "auto" }}
      >
        {buildVersion ? `v${buildVersion}` : ""}
      </a>
    </div>
  );
}
