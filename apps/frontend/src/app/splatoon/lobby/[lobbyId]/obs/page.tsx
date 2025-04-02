"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
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

// Added a proper type for cardColors based on the structure expected from the backend.
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

const LobbyObsPage = () => {
  const { lobbyId } = useParams();
  const [, setSocket] = useState<Socket | null>(null);

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

  // Keep track of how many actions have been revealed so far
  const [visibleActionsCount, setVisibleActionsCount] = useState(0);

  const [gameName, setGameName] = useState<string>("0");

  // Replace the "any" type with our CardColors type; initialize with empty arrays.
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
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on("cardColorsUpdated", (newCardColors: CardColors) => {
      console.log("Card colors updated:", newCardColors);
      setCardColors(newCardColors);
    });

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      if (lobbyId) {
        newSocket.emit("obs.getPatternList", lobbyId);
        newSocket.emit("joinLobby", lobbyId, "observer");
        console.log(`Joined lobby ${lobbyId}`);
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
    // Clear all entries to wait for new pickedUpdated/bannedUpdated
    newSocket.on("backend.clear_obs", () => {
      console.log("Clearing OBS state");
      setPickedEntries([]);
      setBannedEntries([]);
      setVisibleActionsCount(0);
      setPickedMode(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [lobbyId, backendUrl]);

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

    // First, add all bans in order
    pattern.forEach((step) => {
      if (step === "ban" || step === "mode_ban") {
        const banEntry = bannedCopy.shift();
        if (banEntry) {
          finalActions.push({
            type: "ban",
            teamName: banEntry.teamName,
            mapName: banEntry.map,
          });
        }
      }
    });

    // Then, add all picks in order
    pattern.forEach((step) => {
      if (step === "pick" || step === "mode_pick") {
        const pickEntry = pickedCopy.shift();
        if (pickEntry) {
          finalActions.push({
            type: "pick",
            teamName: pickEntry.teamName || "Unknown Team",
            mapName: pickEntry.map,
            side: pickEntry.side || "mode",
            sideTeamName: pickEntry.sideTeamName || pickEntry.teamName || "Unknown Team",
          });
        }
      } else if (step === "decider") {
        const pickEntry = pickedCopy.shift();
        if (pickEntry) {
          finalActions.push({
            type: "pick",
            teamName: pickEntry.teamName || "Unknown Team",
            mapName: pickEntry.map,
            side: pickEntry.side || "decider",
            sideTeamName: pickEntry.sideTeamName || pickEntry.teamName || "Unknown Team",
            decider: true,
          });
        }
      }
    });

    // Add mode pick at the beginning if it exists
    if (pickedMode) {
      finalActions.unshift({
        type: "pick",
        teamName: pickedMode.teamName || "Unknown Team",
        mapName: pickedMode.translatedMode,
        side: "mode",
        sideTeamName: pickedMode.teamName || "Unknown Team",
        isMode: true,
        mode: pickedMode,
      });
    }

    console.log("Final actions computed:", finalActions);
    return finalActions;
  }, [bannedEntries, pickedEntries, pattern, pickedMode]);

  // Reveal actions one by one with a 3-second delay without resetting everything on new updates
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
    // If actions.length == visibleActionsCount, do nothing (no changes needed)
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

export default LobbyObsPage; 