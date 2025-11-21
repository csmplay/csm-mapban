// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { GameSelectionOverlay } from "@/components/overlays/GameSelectionOverlay";
import { SettingsOverlay } from "@/components/overlays/SettingsOverlay";
import { MapPoolEditorOverlay } from "@/components/overlays/MapPoolEditorOverlay";
import { FooterBar } from "@/components/ui/footer-bar";
import { OverlayShell } from "@/components/ui/overlay-shell";
import { MapTile } from "@/components/ui/map-tile";

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

// Initialize with an empty (but typed) object—colors will be fetched from the backend.
const initialCardColors: CardColors = {
  ban: { text: [], bg: [] },
  pick: { text: [], bg: [] },
  pick_mode: { text: [], bg: [] },
  ban_mode: { text: [], bg: [] },
  decider: { text: [], bg: [] },
};

export default function AdminPage() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [globalCoinFlip, setGlobalCoinFlip] = useState(true);
  const localCoinFlip = useRef(true);
  const [localCoinFlipState, setLocalCoinFlipState] = useState<boolean>(true);
  const [localKnifeDecider, setLocalKnifeDecider] = useState(false);
  const [gameType, setGameType] = useState("BO1");
  const [gameName, setGame] = useState("CS2");
  const [allMapsList, setAllMapsList] = useState<Record<string, string[]>>({});
  const [mapPool, setMapPool] = useState<Record<string, string[]>>({});
  const [sourceMapPool, setSourceMapPool] = useState<Record<string, string[]>>(
    {},
  );
  // Modern overlay flow states
  type Overlay = "none" | "game" | "settings" | "mapPool";
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [selectedGameId, setSelectedGameId] = useState<string>("cs2");
  const [creatingLobby, setCreatingLobby] = useState(false);
  const [localModesSizeAdmin, setLocalModesSizeAdmin] = useState(2);
  const [overlayGlobal, setOverlayGlobal] = useState<"none" | "mapPool">(
    "none",
  );
  const [globalMapPoolGameId, setGlobalMapPoolGameId] = useState<
    "cs2" | "valorant"
  >("cs2");
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
  const [socketConnected, setSocketConnected] = useState(false);
  const [buildVersion, setBuildVersion] = useState<string>("");

  const backendUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/";

  const [activeTab, setActiveTab] = useState(0);

  // Update game type when game changes - Splatoon only supports BO3
  useEffect(() => {
    if (gameName === "Splatoon") {
      // Intentionally setting state in effect to enforce BO3 for Splatoon
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGameType("BO3");
    }
  }, [gameName]);

  // Define fetchMapPoolData using useCallback to avoid recreating it on every render
  // Single fetch for map pool that sets both source and editable states
  const fetchSourceMapPoolData = useCallback(async () => {
    try {
      const result = await fetchMapPool(backendUrl);
      if (result.success) {
        setSourceMapPool(result.mapPool);
        setMapPool(result.mapPool); // keep editable pool in sync initially
        setAllMapsList(result.mapNamesLists);
      }
    } catch (error) {
      console.error("Error in fetchSourceMapPoolData:", error);
    }
  }, [backendUrl]);

  // Fetch version for footer display (same logic as index page)
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
        setBuildVersion(
          process.env.NODE_ENV === "development" ? "0-dev" : "0",
        ),
      );
  }, []);

  useEffect(() => {
    socketRef.current = io(backendUrl);
    const s = socketRef.current;

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onConnectError = () => setSocketConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);

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

    fetch(`${backendUrl}api/coinFlip`)
      .then((res) => res.json())
      .then((data: { coinFlip: boolean }) => setGlobalCoinFlip(data.coinFlip))
      .catch((err) => console.error("Error fetching coin flip:", err));

    (async () => {
      await fetchLobbies();
      await fetchSourceMapPoolData();
    })();

  const interval = setInterval(fetchLobbies, 5000);

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
          title: "lobby creation error",
          description: errorMessage,
          variant: "destructive",
        });
      };

      // Add the event listeners
      socketRef.current.on("lobbyDeleted", handleLobbyDeleted);
      socketRef.current.on("cardColorsUpdated", handleCardColorsUpdated);
      socketRef.current.on("coinFlipUpdated", handleCoinFlipUpdated);
      socketRef.current.on("lobbyCreationError", handleLobbyCreationError);
      socketRef.current.on("lobbyCreated", () => {
        fetchLobbies();
      });
      socketRef.current.on("lobbiesUpdated", () => {
        fetchLobbies();
      });

      // Clean up function to remove event listeners
      return () => {
  clearInterval(interval);
        if (socketRef.current) {
          socketRef.current.off("lobbyDeleted", handleLobbyDeleted);
          socketRef.current.off("cardColorsUpdated", handleCardColorsUpdated);
          socketRef.current.off("coinFlipUpdated", handleCoinFlipUpdated);
          socketRef.current.off("lobbyCreationError", handleLobbyCreationError);
          socketRef.current.off("lobbyCreated");
          socketRef.current.off("lobbiesUpdated");
          socketRef.current.off("connect", onConnect);
          socketRef.current.off("disconnect", onDisconnect);
          socketRef.current.off("connect_error", onConnectError);
          socketRef.current.disconnect();
        }
      };
    }

    return () => {
  clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.off("lobbyCreated");
        socketRef.current.off("lobbiesUpdated");
        socketRef.current.off("connect", onConnect);
        socketRef.current.off("disconnect", onDisconnect);
        socketRef.current.off("connect_error", onConnectError);
        socketRef.current.disconnect();
      }
    };
  }, [backendUrl, toast, fetchSourceMapPoolData]);

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
          description: "obs url copied to clipboard",
        });
      },
      () => {
        toast({
          description: "failed to copy url",
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
    const s = socketRef.current;
    if (!s || !s.connected) return;
    const lobbyId = `${Math.floor(1000 + Math.random() * 9000).toString()}`;

    if (selectedGameId === "splatoon") {
      s.emit("createSplatoonLobby", {
        lobbyId,
        gameType: "bo3",
        admin: true,
        coinFlip: localCoinFlipState,
        modesSize: localModesSizeAdmin,
      });
      s.once("lobbyCreated", () => {
        setCreatingLobby(false);
        setOverlay("none");
        // Admin opens OBS/management, we don't navigate
      });
    } else {
      const effectivePoolSize = ["BO3", "BO5"].includes(gameType) ? 7 : mapPoolSize;
      s.emit("createFPSLobby", {
        lobbyId,
        gameName: selectedGameId,
        gameType: gameType.toLowerCase(),
        knifeDecider: localKnifeDecider,
        mapPoolSize: effectivePoolSize,
        admin: true,
        coinFlip: localCoinFlipState,
        customMapPool: null,
      });
      s.once("lobbyCreated", () => {
        setCreatingLobby(false);
        setOverlay("none");
      });
    }
  };

  const handleMapPoolButton = () => {
    setShowSettingsModal(false);
    setMapPool(sourceMapPool);
    setOverlayGlobal("mapPool");
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
      toast({ description: "maps must be unique" });
    } else {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("admin.editFPSMapPool", mapPool);
        toast({ description: "mappool saved" });
      }
    }
    setOverlayGlobal("none");
    setShowSettingsModal(true);
  };

  const handleResetMapPool = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("admin.editFPSMapPool");
      toast({ description: "mappool reset" });
    }
    setOverlayGlobal("none");
    setShowSettingsModal(true);
  };

  // Overlay-specific map pool actions (do not touch legacy modals)
  const handleResetMapPoolOverlay = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("admin.editFPSMapPool");
      toast({ description: "mappool reset" });
      // refresh map pool from server
      fetchSourceMapPoolData();
    }
    setOverlay("settings");
  };

  const handleSaveMapPoolOverlay = () => {
    const uniqueValuesZero = new Set(mapPool["cs2"] || []);
    const uniqueValuesOne = new Set(mapPool["valorant"] || []);
    if (
      uniqueValuesZero.size !== (mapPool["cs2"] || []).length ||
      uniqueValuesOne.size !== (mapPool["valorant"] || []).length
    ) {
      toast({ description: "maps must be unique", variant: "destructive" });
      return;
    }
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("admin.editFPSMapPool", mapPool);
      toast({ description: "mappool saved" });
    }
    setOverlay("settings");
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
      toast({ description: "card colors saved" });
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
      toast({ description: "card colors reset" });
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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <Image
            src="https://cdn.csmpro.ru/CSM_white.svg"
            alt="CSM"
            width={120}
            height={32}
            priority={true}
            className="mx-auto mb-6 opacity-90 cursor-pointer hover:opacity-100 transition-opacity duration-200"
            onClick={() => {
              router.push("/");
            }}
          />
          <h1 className="text-1xl md:text-2xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-neutral-900 to-neutral-600 dark:from-neutral-50 dark:to-neutral-400 -mb-7 -mt-5">
            map ban admin
          </h1>
        </div>

        {/* Action bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-10">
          <Button
            onClick={() => setOverlay("game")}
            className="w-full h-11 rounded-2xl font-medium bg-neutral-900 dark:bg-green-300 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-green-200 transition-all duration-200"
            disabled={!socketConnected}
          >
            <Plus className="w-4 h-4 mr-2" />
            new obs lobby
          </Button>
          <Button
            onClick={() => setShowSettingsModal(true)}
            className="w-full h-11 rounded-2xl font-medium bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/70 transition-all duration-200"
          >
            settings
          </Button>
          <Button
            onClick={() => handleCopyLink()}
            className="w-full h-11 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
          >
            <Copy className="w-4 h-4 mr-2" />
            copy obs url
          </Button>
        </div>
        {lobbies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {lobbies.map((lobby) => (
              <Card
                key={lobby.lobbyId}
                className="w-full bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800/60 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:shadow-xl transition-shadow duration-300"
              >
                <CardHeader className="border-b border-neutral-200/60 dark:border-neutral-800/60 rounded-t-3xl">
                  <CardTitle className="text-lg md:text-xl text-neutral-800 dark:text-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{lobby.lobbyId}</span>
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
                        className="w-20 rounded-2xl font-medium bg-neutral-900 dark:bg-green-300 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-green-200"
                        disabled={lobby.teamNames.length !== 2}
                      >
                        start
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ScrollArea className="h-90 pr-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                          teams:
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
                            Lobby Rules
                          </summary>
                            <pre className="whitespace-pre-wrap break-words">
                              {JSON.stringify(lobby.rules, null, 2)}
                            </pre>
                        </details>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                          picks:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {lobby.rules.gameName.toLowerCase() === "splatoon" &&
                          lobby.roundHistory ? (
                            <>
                              {lobby.roundHistory.map(
                                (round: RoundHistory, roundIndex: number) => (
                                  <div key={roundIndex} className="w-full">
                                    <div className="text-sm font-medium text-muted-foreground mb-1">
                                      round {round.roundNumber}
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
                        <h3 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                          bans:
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
                <CardFooter className="border-t border-neutral-200/60 dark:border-neutral-800/60 p-4 flex flex-wrap gap-2 rounded-b-3xl">
                  <div className="flex justify-center w-full">
                    <Button
                      onClick={() => handleSetObsLobby(lobby.lobbyId)}
                      className="flex-1 h-9 rounded-2xl font-medium bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/70 transition-all duration-200"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      show in obs
                    </Button>
                    <Button
                      onClick={() => handleClear(lobby.lobbyId)}
                      className="flex-1 h-9 rounded-2xl font-medium bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/70 transition-all duration-200"
                    >
                      <Droplet className="w-4 h-4 mr-2" />
                      clear obs
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleConnectToLobby(lobby.lobbyId)}
                    className="flex-1 h-9 rounded-2xl font-medium bg-neutral-900 dark:bg-green-300 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-green-200 transition-all duration-200"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    join
                  </Button>
                  <Button
                    onClick={() => setLobbyToDelete(lobby.lobbyId)}
                    className="flex-1 h-9 rounded-2xl font-medium bg-red-600 dark:bg-red-400 text-white dark:text-neutral-900 hover:bg-red-700 dark:hover:bg-red-300 transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    delete
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="w-full max-w-md mx-auto bg-card">
            <CardContent className="p-6 text-center text-foreground">
              <p className="text-xl">nothing here...</p>
            </CardContent>
          </Card>
        )}
      </div>
  <AnimatePresence>
        {overlay === "game" && (
          <GameSelectionOverlay
            games={[
              { id: "cs2", prettyName: "Counter-Strike 2", type: "fps", developer: "Valve" },
              { id: "valorant", prettyName: "Valorant", type: "fps", developer: "Riot Games" },
              { id: "splatoon", prettyName: "Splatoon 3", type: "splatoon", developer: "Nintendo" },
            ]}
            onSelect={(id) => {
              setSelectedGameId(id);
              setGame(id === "splatoon" ? "Splatoon" : id === "valorant" ? "Valorant" : "CS2");
              setOverlay("settings");
            }}
            onCancel={() => setOverlay("none")}
          />
        )}
        {overlay === "settings" && (
          <SettingsOverlay
            gamePrettyName={gameName}
            gameType={gameType}
            setGameType={setGameType}
            localModesSize={localModesSizeAdmin}
            setLocalModesSize={setLocalModesSizeAdmin}
            localKnifeDecider={localKnifeDecider}
            setLocalKnifeDecider={setLocalKnifeDecider}
            mapPoolSize={mapPoolSize}
            setMapPoolSize={setMapPoolSize}
            type={selectedGameId === "splatoon" ? "splatoon" : "fps"}
            onBack={() => setOverlay("game")}
            onOpenMapPool={() => setOverlay("mapPool")}
            onCreate={() => {
              if (creatingLobby) return;
              setCreatingLobby(true);
              handleAdminLobby();
            }}
            creating={creatingLobby}
            disabled={!socketConnected}
            mapPoolChanged={false}
            showCoinFlip
            coinFlip={localCoinFlipState}
            setCoinFlip={(v) => {
              localCoinFlip.current = v;
              setLocalCoinFlipState(v);
            }}
          />
        )}
        {overlay === "mapPool" && (
          <MapPoolEditorOverlay
            gameId={selectedGameId === "valorant" ? "valorant" : "cs2"}
            gamePrettyName={gameName}
            mapPool={mapPool}
            allMapsList={allMapsList}
            onChange={handleSelectChange}
            onBack={() => setOverlay("settings")}
            onReset={handleResetMapPoolOverlay}
            onSave={handleSaveMapPoolOverlay}
          />
        )}
        {overlayGlobal === "mapPool" && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <OverlayShell motionKey="global-map-pool" size="md">
              <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
                global fps map pool editor
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {(
                    [
                      { id: "cs2", name: "Counter-Strike 2" },
                      { id: "valorant", name: "Valorant" },
                    ] as const
                  ).map((g) => (
                    <Button
                      key={g.id}
                      onClick={() => setGlobalMapPoolGameId(g.id)}
                      className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                        globalMapPoolGameId === g.id
                          ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                      }`}
                    >
                      {g.name}
                    </Button>
                  ))}
                </div>

                <div className="mb-2 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
                    in 4 maps mode only the first 4 maps are used
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(mapPool[globalMapPoolGameId] || []).map((value, index) => (
                    <MapTile
                      key={`${globalMapPoolGameId}-${index}`}
                      gameId={globalMapPoolGameId}
                      value={value}
                      index={index}
                      allMaps={allMapsList[globalMapPoolGameId] || []}
                      onChange={(i, v) =>
                        handleSelectChange(i, v, globalMapPoolGameId)
                      }
                    />
                  ))}
                </div>

                <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <Button
                    type="button"
                    onClick={() => setOverlayGlobal("none")}
                    className="h-10 px-6 rounded-2xl font-medium bg-neutral-100 dark:bg-red-400 text-neutral-600 dark:text-neutral-900 hover:bg-red-200 dark:hover:bg-red-300 border-0 transition-all duration-200"
                  >
                    back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleResetMapPool}
                    className="h-10 px-6 rounded-2xl font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 border-0 transition-all duration-200"
                  >
                    reset
                  </Button>
                  <Button
                    type="button"
                    onClick={handleEditMapPool}
                    className="flex-1 h-10 rounded-2xl font-medium bg-neutral-900 dark:bg-green-300 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-green-200 transition-all duration-200"
                  >
                    save
                  </Button>
                </div>
              </div>
            </OverlayShell>
          </motion.div>
        )}
        {editCardColorsModal && editingCardColors && (
          <OverlayShell motionKey="edit-card-colors" size="xl">
            <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
              card colors editor
            </h2>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { id: 0, label: "maps" },
                { id: 1, label: "decider" },
                { id: 2, label: "modes" },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                  }`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Maps Tab (BAN & PICK) */}
              {activeTab === 0 && (
                <div className="grid grid-cols-2 gap-8">
                  {/* BAN Colors Section */}
                  <div className="bg-card/50 p-6 rounded-lg">
                    <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">
                      ban
                    </h2>

                    {/* BAN Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        text
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
                                    ? "team"
                                    : index === 1
                                      ? "action"
                                      : index === 2
                                        ? "map"
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
                        bg
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
                                    ? "top"
                                    : index === 1
                                      ? "base"
                                      : index === 2
                                        ? "bottom"
                                        : index === 3
                                          ? "stripe"
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
                        text
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
                                    ? "team"
                                    : index === 1
                                      ? "action"
                                      : index === 2
                                        ? "map"
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
                        bg
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
                                    ? "top"
                                    : index === 1
                                      ? "base"
                                      : index === 2
                                        ? "bottom"
                                        : index === 3
                                          ? "stripe"
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
                      decider
                    </h2>

                    {/* DECIDER Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        text
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
                                    ? "team"
                                    : index === 1
                                      ? "action"
                                      : index === 2
                                        ? "map"
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
                        bg
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
                                    ? "top"
                                    : index === 1
                                      ? "base"
                                      : index === 2
                                        ? "bottom"
                                        : index === 3
                                          ? "stripe"
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
                      mode ban
                    </h2>

                    {/* MODE BAN Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        text
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
                                    ? "team"
                                    : index === 1
                                      ? "action"
                                      : index === 2
                                        ? "mode"
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
                        bg
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
                                    ? "top"
                                    : index === 1
                                      ? "base"
                                      : index === 2
                                        ? "bottom"
                                        : index === 3
                                          ? "stripe"
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
                      mode pick
                    </h2>

                    {/* MODE PICK Text Colors */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold mb-4 text-center">
                        text
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
                                    ? "team"
                                    : index === 1
                                      ? "action"
                                      : index === 2
                                        ? "mode"
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
                        bg
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
                                    ? "top"
                                    : index === 1
                                      ? "base"
                                      : index === 2
                                        ? "bottom"
                                        : index === 3
                                          ? "stripe"
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

            <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                type="button"
                onClick={() => {
                  setEditCardColorsModal(false);
                  setEditingCardColors(null);

                  setTimeout(() => {
                    setShowSettingsModal(true);
                  }, 300);
                }}
                className="h-10 px-6 rounded-2xl font-medium bg-neutral-100 dark:bg-red-400 text-neutral-600 dark:text-neutral-900 hover:bg-red-200 dark:hover:bg-red-300 border-0 transition-all duration-200"
              >
                back
              </Button>
              <Button
                type="button"
                onClick={handleResetCardColors}
                className="h-10 px-6 rounded-2xl font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 border-0 transition-all duration-200"
              >
                reset
              </Button>
              <Button
                type="button"
                onClick={handleSaveCardColors}
                className="flex-1 h-10 rounded-2xl font-medium bg-neutral-900 dark:bg-green-300 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-green-200 transition-all duration-200"
              >
                save
              </Button>
            </div>
          </OverlayShell>
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
            <OverlayShell motionKey="admin-settings" size="md">
              <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
                admin settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
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
                  <Label htmlFor="coinFlip" className="text-neutral-700 dark:text-neutral-300">
                    global coin flip selector
                  </Label>
                </div>

                <Button
                  onClick={handleMapPoolButton}
                  className="w-full h-10 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                >
                  <PenBox className="w-4 h-4 mr-2" />
                  edit global map pool
                </Button>

                <Button
                  onClick={handleOpenEditModal}
                  className="w-full h-10 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                >
                  <PenBox className="w-4 h-4 mr-2" />
                  edit card colors
                </Button>

                <Button
                  onClick={handleCreatePreviewLobby}
                  className="w-full h-10 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  preview all cards in obs
                </Button>

                <div className="flex pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <Button
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full h-10 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
                  >
                    close
                  </Button>
                </div>
              </div>
            </OverlayShell>
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
            <OverlayShell motionKey="confirm-delete" size="md">
              <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
                delete lobby {lobbyToDelete}?
              </h2>
              <p className="text-center text-neutral-600 dark:text-neutral-400 mb-5">
                this action cannot be undone
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setLobbyToDelete(null)}
                  className="h-10 px-6 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
                >
                  cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => handleDeleteLobby(lobbyToDelete)}
                  className="flex-1 h-10 rounded-2xl font-medium bg-red-600 dark:bg-red-400 text-white dark:text-neutral-900 hover:bg-red-700 dark:hover:bg-red-300 transition-all duration-200"
                >
                  delete
                </Button>
              </div>
            </OverlayShell>
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
      <FooterBar
        repoUrl="https://git.csmpro.ru/csmpro/mapban"
        licenseUrl="https://git.csmpro.ru/csmpro/mapban#license-and-trademark-notice"
        version={buildVersion}
      />
    </div>
  );
}
