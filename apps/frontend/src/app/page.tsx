// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { fetchMapPool } from "@/lib/utils";

// Анимационные варианты
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
};

export default function HomePage() {
  const [lobbyId, setLobbyId] = useState("");
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [showMapPoolOverlay, setShowMapPoolOverlay] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Things for sending lobby settings to server
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameType, setGameType] = useState("BO1");
  const [gameName, setGame] = useState("CS2");
  const [localKnifeDecider, setLocalKnifeDecider] = useState(false);
  const [mapPoolSize, setMapPoolSize] = useState<number>(7);

  // Map pool related states
  const [activeTab, setActiveTab] = useState(0);
  const [allMapsList, setAllMapsList] = useState<Record<string, string[]>>({});
  const [mapPool, setMapPool] = useState<Record<string, string[]>>({});
  const [defaultMapPool, setDefaultMapPool] = useState<
    Record<string, string[]>
  >({});
  const [useCustomMapPool, setUseCustomMapPool] = useState(false);

  const backendUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/";

  // Fetch map pool data
  const fetchMapPoolData = async () => {
    try {
      const result = await fetchMapPool(backendUrl);

      if (result.success) {
        setMapPool(result.mapPool);
        setDefaultMapPool(result.mapPool);
        setAllMapsList(result.mapNamesLists);
      } else if (Object.keys(defaultMapPool).length > 0) {
        // В случае ошибки используем последний известный дефолтный маппул
        setMapPool({ ...defaultMapPool });
      }
    } catch (error) {
      console.error("Error in fetchMapPoolData:", error);
      if (Object.keys(defaultMapPool).length > 0) {
        setMapPool({ ...defaultMapPool });
      }
    }
  };

  useEffect(() => {
    const newSocket = io(backendUrl);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
    });

    newSocket.on("lobbyCreationError", (errorMessage: string) => {
      toast({
        title: "Ошибка создания лобби",
        description: errorMessage,
        variant: "destructive",
      });
      // Возвращаемся на главную страницу
      router.push("/");
    });

    setSocket(newSocket);

    // Fetch map pool data on initial load
    fetchMapPoolData();

    return () => {
      newSocket.disconnect();
    };
  }, [backendUrl, router, toast]);

  // Update game type when game changes
  useEffect(() => {
    if (gameName === "Splatoon") {
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

      if (gameName === "Splatoon") {
        // Create Splatoon lobby
        socket.emit("createSplatoonLobby", {
          lobbyId,
          gameType: gameType.toLowerCase(),
          admin: false,
        });

        // Wait for lobby creation confirmation before redirecting
        socket.once("lobbyCreated", () => {
          setShowSettingsOverlay(false);
          router.push(`/lobby/${lobbyId}`);
        });
      } else {
        // Create FPS lobby (CS2 or Valorant)
        socket.emit("createFPSLobby", {
          lobbyId,
          gameName: gameName.toLowerCase(),
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
    // Если маппул не был изменен пользователем, обновляем его с сервера
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <Card className="w-full max-w-md bg-background shadow-lg">
        <CardContent className="p-6">
          <div className="mb-6 text-center">
            <Image
              src="/CSM White.svg"
              alt="CSM"
              width={150}
              height={40}
              className="mx-auto"
            />
            <p className="text-muted-foreground mt-2">
              Присоединитесь к существующему лобби или создайте новое
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col space-y-3 mt-[-20px]">
              <div className="flex justify-center mb-4">
                <InputOTP
                  maxLength={4}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={lobbyId}
                  onChange={(value) => setLobbyId(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
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
                className={`w-full ${lobbyId.length !== 4 ? "opacity-50" : ""}`}
              >
                Присоединиться к лобби
              </Button>
            </div>

            <div className="relative">
              <Separator className="my-4" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-background px-2 text-muted-foreground">
                  или
                </span>
              </div>
            </div>

            <Button
              onClick={() => setShowSettingsOverlay(true)}
              variant="outline"
              className="w-full"
            >
              Создать своё лобби
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Overlay */}
      <AnimatePresence>
        {showSettingsOverlay && (
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
              className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full text-foreground"
            >
              <h2 className="text-2xl font-bold mb-4 text-center">
                Настройки лобби
              </h2>
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-2 text-center">Игра</h3>
                <div className="flex justify-center space-x-4">
                  {["CS2", "Valorant", "Splatoon"].map((game) => (
                    <Button
                      key={game}
                      variant={gameName === game ? "default" : "outline"}
                      onClick={() => setGame(game)}
                      className={game === "Splatoon" ? "w-24" : "w-20"}
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
                            } else if (["BO3", "BO5"].includes(type)) {
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

                {/* Кнопка редактирования маппула - только для FPS */}
                {gameName !== "Splatoon" && (
                  <div className="flex justify-center mt-4">
                    <Button
                      onClick={handleOpenMapPoolEditor}
                      variant={useCustomMapPool ? "default" : "outline"}
                      className="w-full"
                    >
                      {useCustomMapPool
                        ? "Маппул изменен ✓"
                        : "Редактировать маппул"}
                    </Button>
                  </div>
                )}

                <div className="flex justify-between mt-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSettingsOverlay(false)}
                    className="px-6"
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateLobby}
                    className="px-6"
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
              className="bg-background p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto text-foreground"
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

              {/* Вкладки */}
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
              {activeTab === 0 && mapPool["cs2"] && (
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

              <div className="flex justify-between mt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowMapPoolOverlay(false);
                    setActiveTab(0); // Сбрасываем вкладку на CS2
                    setTimeout(() => {
                      setShowSettingsOverlay(true);
                    }, 300);
                  }}
                  className="px-6"
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
                  onClick={handleSaveMapPool}
                  className="px-6"
                >
                  Сохранить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
