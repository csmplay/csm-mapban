"use client";

import React, { useEffect, useState, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import AnimatedBanCard from "@/components/ui/ban";
import AnimatedPickCard from "@/components/ui/pick";

interface BanAction {
  type: "ban";
  teamName: string;
  mapName: string;
}

interface PickAction {
  type: "pick";
  teamName: string;
  mapName: string;
  side: string;
  sideTeamName: string;
  decider?: boolean;
  isMode?: boolean;
  mode?: {
    mode: string;
    translatedMode: string;
  }
}

type Action = BanAction | PickAction;

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

const ObsPage = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedLobbyId, setSelectedLobbyId] = useState<string | null>(null);

  const [pickedEntries, setPickedEntries] = useState<
    {
      map: string;
      teamName: string;
      side: string;
      sideTeamName: string;
      decider?: boolean;
    }[]
  >([]);
  const [bannedEntries, setBannedEntries] = useState<
    { map: string; teamName: string }[]
  >([]);
  const [pattern, setPattern] = useState<string[]>([]);
  const [pickedMode, setPickedMode] = useState<{ mode: string; teamName: string; translatedMode: string } | null>(null);
  const [visibleActionsCount, setVisibleActionsCount] = useState(0);
  const [gameName, setGameName] = useState<string>("0");
  const [cardColors, setCardColors] = useState<CardColors>({
    ban: { text: [], bg: [] },
    pick: { text: [], bg: [] },
  });

  const backendUrl =
    process.env.NODE_ENV === "development"
      ? process.env.BACKEND_URL + "/" || "http://localhost:4000/"
      : "/";

  useEffect(() => {
    // Fetch initial card colors from backend
    fetch(`${backendUrl}api/cardColors`)
      .then((res) => res.json())
      .then((data: CardColors) => setCardColors(data))
      .catch((err) => console.error("Error fetching card colors:", err));
  }, [backendUrl]);

  useEffect(() => {
    console.log("Initializing socket connection...");
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      console.log("Joining as observer");
      newSocket.emit("joinObsView");
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });

    newSocket.on("error", (error: Error) => {
      console.error("Socket error:", error);
    });

    newSocket.on("cardColorsUpdated", (newCardColors: CardColors) => {
      console.log("Card colors updated:", newCardColors);
      setCardColors(newCardColors);
    });

    // Listen for admin selecting a lobby to display
    newSocket.on("admin.setObsLobby", (lobbyId: string) => {
      console.log("Received admin.setObsLobby event with lobby:", lobbyId);
      setSelectedLobbyId(lobbyId);
      
      // Clear current state
      setPickedEntries([]);
      setBannedEntries([]);
      setVisibleActionsCount(0);
      setPickedMode(null);
      setPattern([]); // Clear pattern before joining new lobby
      
      // Join the new lobby and get pattern list
      if (lobbyId) {
        console.log("Joining lobby as observer:", lobbyId);
        newSocket.emit("joinLobby", lobbyId, "observer");
        console.log("Requesting pattern list for lobby:", lobbyId);
        newSocket.emit("obs.getPatternList", lobbyId);
      }
    });

    newSocket.on("gameName", (gameNameVar: string) => {
      console.log("Game name received:", gameNameVar);
      setGameName(gameNameVar);
    });

    newSocket.on(
      "pickedUpdated",
      (
        picked: Array<{
          map: string;
          teamName: string;
          side: string;
          sideTeamName: string;
          decider?: boolean;
        }>,
      ) => {
        console.log("Picked entries updated:", picked);
        setPickedEntries(picked);
      },
    );

    newSocket.on(
      "bannedUpdated",
      (banned: Array<{ map: string; teamName: string }>) => {
        console.log("Banned entries updated:", banned);
        setBannedEntries(banned);
      },
    );

    newSocket.on("patternList", (pattern: string[]) => {
      console.log("Pattern list received:", pattern);
      setPattern(pattern);
    });

    newSocket.on("modePicked", (data: { mode: string; teamName: string; translatedMode: string }) => {
      console.log("Mode picked:", data);
      setPickedMode(data);
      // Reset the OBS view when a mode is picked
      setPickedEntries([]);
      setBannedEntries([]);
      setVisibleActionsCount(0);
    });

    // Handle 'clear' event from the server
    newSocket.on("backend.clear_obs", () => {
      console.log("Clearing OBS state");
      setPickedEntries([]);
      setBannedEntries([]);
      setVisibleActionsCount(0);
      setPickedMode(null);
    });

    return () => {
      console.log("Cleaning up socket connection...");
      newSocket.disconnect();
    };
  }, [backendUrl]);

  // Construct the final actions array based on the pattern and the data we have
  const actions: Action[] = useMemo(() => {
    console.log("Computing actions with:", {
      pattern,
      bannedEntries,
      pickedEntries,
      pickedMode
    });

    if (pattern.length === 0) {
      console.log("No pattern available, returning empty actions");
      return [];
    }

    const bannedCopy = [...bannedEntries];
    const pickedCopy = [...pickedEntries];
    const finalActions: Action[] = [];

    // Add mode pick first if it exists
    if (pickedMode) {
      finalActions.push({
        type: "pick",
        teamName: pickedMode.teamName,
        mapName: pickedMode.translatedMode,
        side: "mode",
        sideTeamName: pickedMode.teamName,
        isMode: true,
        mode: {
          mode: pickedMode.mode,
          translatedMode: pickedMode.translatedMode
        },
      });
    }

    // Process each step in the pattern exactly as defined
    pattern.forEach((step) => {
      if (step === "ban") {  // Only handle regular bans, ignore mode_ban
        const banEntry = bannedCopy.shift();
        if (banEntry) {
          finalActions.push({
            type: "ban",
            teamName: banEntry.teamName,
            mapName: banEntry.map,
          });
        }
      } else if (step === "pick" || step === "decider") {  // Only handle regular picks and deciders
        const pickEntry = pickedCopy.shift();
        if (pickEntry) {
          finalActions.push({
            type: "pick",
            teamName: pickEntry.teamName,
            mapName: pickEntry.map,
            side: pickEntry.side || "mode",
            sideTeamName: pickEntry.sideTeamName || pickEntry.teamName,
            decider: step === "decider",
          });
        }
      }
    });

    console.log("Final actions computed:", finalActions);
    return finalActions;
  }, [bannedEntries, pickedEntries, pattern, pickedMode]);

  // Reveal actions one by one with a 3-second delay
  useEffect(() => {
    console.log("Actions visibility effect:", {
      actionsLength: actions.length,
      visibleActionsCount
    });

    // If the new actions array is shorter than what we have revealed, it's a reset scenario
    if (actions.length < visibleActionsCount) {
      console.log("Resetting visible actions count");
      setVisibleActionsCount(0);
    } else if (actions.length > visibleActionsCount) {
      // There are new actions to reveal
      let currentIndex = visibleActionsCount;
      const intervalId = setInterval(() => {
        currentIndex += 1;
        setVisibleActionsCount(currentIndex);
        if (currentIndex >= actions.length) {
          clearInterval(intervalId);
        }
      }, 3000);

      return () => clearInterval(intervalId);
    }
  }, [actions, visibleActionsCount]);

  useEffect(() => {
    document.body.classList.add("obs-page");
    return () => document.body.classList.remove("obs-page");
  }, []);

  return (
    <div className="bg-transparent p-8 justify-start">
      <div className="flex space-x-4 py-16">
        {actions.slice(0, visibleActionsCount).map((action, index) => {
          if (action.type === "ban") {
            return (
              <AnimatedBanCard
                key={index}
                teamName={action.teamName}
                mapName={action.mapName}
                gameName={gameName}
                cardColors={cardColors.ban}
              />
            );
          } else if (action.type === "pick") {
            return (
              <AnimatedPickCard
                key={index}
                teamName={action.teamName}
                mapName={action.mapName}
                gameName={gameName}
                side={action.side}
                cardColors={cardColors.pick}
                decider={action.decider}
                isMode={action.isMode}
                mode={action.mode}
              />
            );
          } else {
            return null;
          }
        })}
      </div>
    </div>
  );
};

export default ObsPage; 