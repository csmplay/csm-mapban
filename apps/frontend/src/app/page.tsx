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
import { FooterBar } from "@/components/ui/footer-bar";
import { GameSelectionOverlay } from "@/components/overlays/GameSelectionOverlay";
import { SettingsOverlay } from "@/components/overlays/SettingsOverlay";
import { MapPoolEditorOverlay } from "@/components/overlays/MapPoolEditorOverlay";

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

export default function HomePage() {
  const [lobbyId, setLobbyId] = useState("");
  const otpWrapperRef = useRef<HTMLDivElement | null>(null);
  type Overlay = "none" | "game" | "settings" | "mapPool";
  const [overlay, setOverlay] = useState<Overlay>("none");
  const router = useRouter();
  const { toast } = useToast();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameType, setGameType] = useState("BO1");
  const [selectedGameId, setSelectedGameId] = useState<string>("cs2");
  const [localKnifeDecider, setLocalKnifeDecider] = useState(true);
  const [localModesSize, setLocalModesSize] = useState(2);
  const [mapPoolSize, setMapPoolSize] = useState<number>(7);
  const [creatingLobby, setCreatingLobby] = useState(false);

  // removed activeTab since map pool editor now only shows selected game's maps
  const [allMapsList, setAllMapsList] = useState<Record<string, string[]>>({});
  const [mapPool, setMapPool] = useState<Record<string, string[]>>({});
  const [mapPoolDraft, setMapPoolDraft] = useState<Record<string, string[]>>(
    {},
  );
  const [defaultMapPool, setDefaultMapPool] = useState<
    Record<string, string[]>
  >({});
  const [useCustomMapPool, setUseCustomMapPool] = useState(false);

  const [connectionError, setConnectionError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [buildVersion, setBuildVersion] = useState<string>("");

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.BACKEND_URL as string | undefined) ||
    (process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/");

  const fetchMapPoolData = useCallback(async () => {
    try {
      const result = await fetchMapPool(backendUrl);

      if (result.success) {
        setMapPool(result.mapPool);
        setDefaultMapPool(result.mapPool);
        setAllMapsList(result.mapNamesLists);
      } else {
        console.warn("Failed to fetch map pool, keeping previous values");
      }
    } catch (error) {
      console.error("Error in fetchMapPoolData:", error);
    }
  }, [backendUrl]);

  useEffect(() => {
    const newSocket = io(backendUrl, {
      reconnectionAttempts: 3,
      timeout: 3000,
    });

    setIsConnecting(true);
    setConnectionError(false);

    newSocket.on("connect", () => {
      setIsConnecting(false);
      setConnectionError(false);
    });

    newSocket.on("connect_error", () => {
      setIsConnecting(false);
      setConnectionError(true);
    });

    newSocket.on("lobbyCreationError", (errorMessage: string) => {
      setCreatingLobby(false);
      toast({
        title: "Ошибка создания лобби",
        description: errorMessage,
        variant: "destructive",
      });
      router.push("/");
    });

    setSocket(newSocket);

    fetchMapPoolData();

    return () => {
      newSocket.disconnect();
    };
  }, [backendUrl, router, toast, fetchMapPoolData]);

  const handleJoinLobby = async () => {
    if (lobbyId && lobbyId.length === 4) {
      try {
        if (!socket?.connected) {
          toast({
            description: "Ошибка подключения к серверу",
            variant: "destructive",
          });
          return;
        }

        const checkLobbyExists = new Promise((resolve, reject) => {
          const s = socket as Socket;
          s.emit("getLobbyGameCategory", lobbyId);

          const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error("Timeout waiting for server response"));
          }, 5000);

          const handleLobbyNotFound = () => {
            clearTimeout(timeoutId);
            cleanup();
            reject(new Error("Lobby does not exist"));
          };

          const handleSuccess = (payload?: unknown) => {
            clearTimeout(timeoutId);
            cleanup();
            resolve(payload);
          };

          function cleanup() {
            s.off("lobbyNotFound", handleLobbyNotFound);
            s.off("lobbyGameCategory", handleSuccess);
          }

          s.once("lobbyNotFound", handleLobbyNotFound);
          s.once("lobbyGameCategory", handleSuccess);
        });

        const category = await checkLobbyExists;
        // Determine route based on payload
        let routeBase = "/lobby";
        const lower =
          typeof category === "string" ? category.toLowerCase() : "fps";
        if (lower === "fps") routeBase = "/fps";
        if (lower === "splatoon") routeBase = "/splatoon";
        router.push(`${routeBase}/${lobbyId}`);
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
      if (creatingLobby) return;
      setCreatingLobby(true);
      const lobbyId = Math.floor(1000 + Math.random() * 9000).toString();

      if (selectedGameId === "splatoon") {
        socket.emit("createSplatoonLobby", {
          lobbyId,
          gameType: "bo3",
          modesSize: localModesSize,
          admin: false,
        });

        socket.once("lobbyCreated", () => {
          setCreatingLobby(false);
          setOverlay("none");
          router.push(`/splatoon/${lobbyId}`);
        });
      } else {
        const effectivePoolSize = ["BO3", "BO5"].includes(gameType)
          ? 7
          : mapPoolSize;
        socket.emit("createFPSLobby", {
          lobbyId,
          gameName: selectedGameId,
          gameType: gameType.toLowerCase(),
          knifeDecider: localKnifeDecider,
          mapPoolSize: effectivePoolSize,
          customMapPool: useCustomMapPool ? mapPool : null,
        });

        socket.once("lobbyCreated", () => {
          setCreatingLobby(false);
          setOverlay("none");
          router.push(`/fps/${lobbyId}`);
        });
      }
    }
  };

  const handleOpenMapPoolEditor = async () => {
    if (!useCustomMapPool) {
      await fetchMapPoolData();
    }
    setMapPoolDraft({
      ...mapPool,
      cs2: [...(mapPool.cs2 || [])],
      valorant: [...(mapPool.valorant || [])],
    });
    setOverlay("mapPool");
  };

  const handleSelectChange = (
    index: number,
    value: string,
    gameName: string,
  ) => {
    const source = mapPoolDraft[gameName] || [];
    const newPoolForGame = [...source];
    newPoolForGame[index] = value;
    if (gameName === "cs2") {
      setMapPoolDraft({
        cs2: newPoolForGame,
        valorant: mapPoolDraft["valorant"] || [],
      });
    } else {
      setMapPoolDraft({
        cs2: mapPoolDraft["cs2"] || [],
        valorant: newPoolForGame,
      });
    }
  };

  const handleResetMapPool = () => {
    const next = {
      cs2: [...(defaultMapPool.cs2 || [])],
      valorant: [...(defaultMapPool.valorant || [])],
    } as Record<string, string[]>;

    setMapPool(next);
    setMapPoolDraft(next);
    setUseCustomMapPool(false);
    setOverlay("settings");

    toast({
      description: "Маппул сброшен к значению по умолчанию",
    });
  };

  const handleSaveMapPool = () => {
    if (
      !Array.isArray(mapPoolDraft["cs2"]) ||
      !Array.isArray(mapPoolDraft["valorant"])
    ) {
      toast({ description: "Маппул не загружен", variant: "destructive" });
      return;
    }
    const uniqueValuesZero = new Set(mapPoolDraft["cs2"]);
    const uniqueValuesOne = new Set(mapPoolDraft["valorant"]);

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

    setMapPool({
      cs2: [...(mapPoolDraft.cs2 || [])],
      valorant: [...(mapPoolDraft.valorant || [])],
    });

    const differs = (a: string[] = [], b: string[] = []) =>
      a.length !== b.length || a.some((v, i) => v !== b[i]);
    const changed =
      differs(mapPoolDraft.cs2, defaultMapPool.cs2) ||
      differs(mapPoolDraft.valorant, defaultMapPool.valorant);
    setUseCustomMapPool(changed);

    setOverlay("settings");

    toast({
      description: changed
        ? "Изменения маппула сохранены"
        : "Используется стандартный маппул",
    });
  };

  const selectedGameInfo = availableGames.find((g) => g.id === selectedGameId);

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

  useEffect(() => {
    if (!isConnecting && !connectionError) {
      const id = setTimeout(() => {
        const el = otpWrapperRef.current?.querySelector(
          'input, [contenteditable="true"]',
        ) as HTMLInputElement | null;
        el?.focus();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [isConnecting, connectionError]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {(connectionError || isConnecting) && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center space-y-6"
          >
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
                        setConnectionError(false);
                        setIsConnecting(true);
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
        {!isConnecting && !connectionError && (
          <motion.div
            key="main-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-center mb-10"
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
                    title: "CSM Map Ban",
                    description: `Версия v${buildVersion}`,
                  });
                }}
              />
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-neutral-900 to-neutral-600 dark:from-neutral-50 dark:to-neutral-400 mb-5 -mt-3">
                Map Ban
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm md:text-base font-normal max-w-md mx-auto -mb-3">
                Присоединяйтесь к лобби по коду или создайте своё
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="backdrop-blur-sm bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800/60 rounded-3xl p-6 md:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Код лобби
                  </label>
                  <div className="flex justify-center" ref={otpWrapperRef}>
                    <InputOTP
                      maxLength={4}
                      pattern={REGEXP_ONLY_DIGITS}
                      value={lobbyId}
                      onChange={(value) => setLobbyId(value)}
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter" && lobbyId.length === 4) {
                          handleJoinLobby();
                        }
                      }}
                    >
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="w-12 h-12 md:w-14 md:h-14 text-xl font-semibold border border-neutral-300/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/70 rounded-2xl focus:border-transparent ring-1 ring-transparent focus:ring-neutral-900/30 dark:focus:ring-neutral-100/30 transition-colors duration-200"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {lobbyId.length === 4 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center">
                      Нажмите Enter, чтобы присоединиться
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center">
                      Введите 4-значный код
                    </p>
                  )}

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
                        ? "bg-gradient-to-b from-neutral-900 to-neutral-800 dark:from-neutral-100 dark:to-neutral-200 text-white dark:text-neutral-900 shadow-sm hover:opacity-95"
                        : "bg-neutral-200/80 dark:bg-neutral-800/70 text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                    }`}
                    disabled={lobbyId.length !== 4}
                  >
                    Присоединиться к лобби
                  </Button>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-px bg-neutral-200/70 dark:bg-neutral-800/70"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-3 py-1 text-[11px] text-neutral-500 dark:text-neutral-500 font-medium uppercase tracking-wider rounded-md border border-neutral-200/60 dark:border-neutral-800/60">
                      или
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => setOverlay("game")}
                  className="w-full h-11 rounded-2xl font-medium bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/70 transition-all duration-200"
                  disabled={!socket?.connected}
                >
                  Создать своё лобби
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isConnecting && !connectionError && (
        <FooterBar
          repoUrl="https://git.in.csmpro.ru/csmpro/csm-mapban"
          licenseUrl="https://git.in.csmpro.ru/csmpro/csm-mapban#license-and-trademark-notice"
          version={buildVersion}
        />
      )}

      <AnimatePresence mode="wait">
        {overlay === "game" && (
          <GameSelectionOverlay
            games={availableGames}
            onSelect={(id) => {
              setSelectedGameId(id);
              setOverlay("settings");
            }}
            onCancel={() => setOverlay("none")}
          />
        )}
        {overlay === "settings" && (
          <SettingsOverlay
            gamePrettyName={selectedGameInfo?.prettyName}
            gameType={gameType}
            setGameType={setGameType}
            localModesSize={localModesSize}
            setLocalModesSize={setLocalModesSize}
            localKnifeDecider={localKnifeDecider}
            setLocalKnifeDecider={setLocalKnifeDecider}
            mapPoolSize={mapPoolSize}
            setMapPoolSize={setMapPoolSize}
            type={selectedGameInfo?.type}
            onBack={() => setOverlay("game")}
            onOpenMapPool={handleOpenMapPoolEditor}
            onCreate={handleCreateLobby}
            creating={creatingLobby}
            disabled={!socket?.connected}
            mapPoolChanged={useCustomMapPool}
          />
        )}
        {overlay === "mapPool" && (
          <MapPoolEditorOverlay
            gameId={selectedGameId === "valorant" ? "valorant" : "cs2"}
            gamePrettyName={selectedGameInfo?.prettyName}
            mapPool={mapPoolDraft}
            allMapsList={allMapsList}
            onChange={handleSelectChange}
            onBack={() => setOverlay("settings")}
            onReset={handleResetMapPool}
            onSave={handleSaveMapPool}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
