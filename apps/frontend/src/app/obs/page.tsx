"use client";

import React, { useEffect, useState, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import AnimatedBanCard from "@/components/ui/ban";
import AnimatedPickCard from "@/components/ui/pick";
import AnimatedBanModeCard from "@/components/ui/ban_mode";
import AnimatedPickModeCard from "@/components/ui/pick_mode";
import AnimatedDeciderCard from "@/components/ui/decider";

interface BanAction {
  type: "ban";
  teamName: string;
  mapName: string;
}

interface BanModeAction {
  type: "ban_mode";
  teamName: string;
  mode: {
    mode: string;
    translatedMode: string;
  };
}

interface PickAction {
  type: "pick";
  teamName: string;
  mapName: string;
  side: string;
  sideTeamName: string;
}

interface PickModeAction {
  type: "pick_mode";
  teamName: string;
  sideTeamName: string;
  mode: {
    mode: string;
    translatedMode: string;
  };
}

interface DeciderAction {
  type: "decider";
  mapName: string;
}

type Action = BanAction | BanModeAction | PickAction | PickModeAction | DeciderAction;

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

const ObsPage = () => {
  const [, setSocket] = useState<Socket | null>(null);
  const [, setSelectedLobbyId] = useState<string | null>(null);

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
  const [bannedModeEntries, setBannedModeEntries] = useState<
    Array<{ mode: string; teamName: string; translatedMode?: string }>
  >([]);
  const [pattern, setPattern] = useState<string[]>([]);
  const defaultPickedMode = {
    mode: "",
    teamName: "",
    translatedMode: "",
  };
  const [pickedMode, setPickedMode] = useState<{ mode: string; teamName: string; translatedMode: string }>(defaultPickedMode);
  const [deciderEntries, setDeciderEntries] = useState("");
  const [visibleActionsCount, setVisibleActionsCount] = useState(0);
  const [gameName, setGameName] = useState<string>("0");
  const [cardColors, setCardColors] = useState<CardColors>({
    ban: { text: [], bg: [] },
    pick: { text: [], bg: [] },
    pick_mode: { text: [], bg: [] },
    ban_mode: { text: [], bg: [] },
    decider: { text: [], bg: [] },
  });

  const backendUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:4000/" : "/";

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

      // Clear current state
      document.body.style.transition = 'opacity 0.9s'; // Updated to make fade-out 3 times slower
      document.body.style.opacity = '0';
      setTimeout(() => {
        document.body.style.opacity = '1';
        setVisibleActionsCount(0);
        setPickedMode(defaultPickedMode);
        setPickedEntries([]);
        setBannedEntries([]);
        setPattern([]); // Clear pattern before joining new lobby
        if (lobbyId) {
          console.log("Joining lobby as observer:", lobbyId);
          newSocket.emit("joinLobby", lobbyId, "observer");
          console.log("Requesting pattern list for lobby:", lobbyId);
          newSocket.emit("obs.getPatternList", lobbyId);
          // Request current picked mode if it exists
          newSocket.emit("obs.getCurrentPickedMode", lobbyId);
          setSelectedLobbyId(lobbyId);
        }
      }, 900); // Match the updated transition duration

      // Join the new lobby and get pattern list

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

    newSocket.on(
      "modesUpdated",
      (data: { 
        banned: Array<{ mode: string; teamName: string }>; 
        active: string[];
      }) => {
        console.log("Mode bans updated:", data.banned);
        
        // Only reset UI when banned modes array is empty (indicating a new round)
        if (data.banned.length === 0) {
          console.log("New round detected - resetting UI");
          // First fade out the UI
          document.body.style.transition = 'opacity 0.9s';
          document.body.style.opacity = '0';
          
          // Then update state variables AFTER the transition
          setTimeout(() => {
            document.body.style.opacity = '1';
            setVisibleActionsCount(0);
            setBannedModeEntries(data.banned);
            setPickedMode(defaultPickedMode);
            setBannedEntries([]);
            setPickedEntries([]);
          }, 900); // Match the transition duration
        } else {
          // Just update the banned modes without resetting UI
          setBannedModeEntries(data.banned);
        }
      },
    );

    newSocket.on("patternList", (pattern: string[]) => {
      console.log("Pattern list received:", pattern);
      setPattern(pattern);
    });

    newSocket.on(
      "modePicked",
      (data: { mode: string; teamName: string; translatedMode: string }) => {
        console.log("Mode picked event received:", data);
        if (data && data.mode && data.teamName) {
          setPickedMode(data);
        } else {
          console.warn("Received incomplete modePicked data:", data);
        }
      },
    );

    newSocket.on("deciderUpdated", (decider: string) => {
      console.log("Decider updated:", decider);
      setDeciderEntries(decider);
    });

    // Fallback for when modePicked event might be missed
    newSocket.on(
      "currentPickedMode",
      (data: { mode: string; teamName: string; translatedMode: string } | null) => {
        console.log("Current picked mode received:", data);
        if (data && data.mode && data.teamName) {
          setPickedMode(data);
        }
      },
    );

    // Handle 'clear' event from the server
    newSocket.on("backend.clear_obs", () => {
      console.log("Clearing OBS state");
      document.body.style.transition = 'opacity 0.9s'; // Updated to make fade-out 3 times slower
      document.body.style.opacity = '0';
      setTimeout(() => {
        document.body.style.opacity = '1';
        setVisibleActionsCount(0);
        setPattern([]);
        setSelectedLobbyId(null);
        setPickedEntries([]);
        setBannedEntries([]);
        setPickedMode(defaultPickedMode);
      }, 900); // Match the updated transition duration

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
      bannedModeEntries,
      pickedEntries,
      pickedMode,
    });

    if (pattern.length === 0) {
      console.log("No pattern available, returning empty actions");
      return [];
    }

    const bannedCopy = [...bannedEntries];
    const bannedModeCopy = [...bannedModeEntries];
    const pickedModeCopy = pickedMode;
    const pickedCopy = [...pickedEntries];
    const finalActions: Action[] = [];

    // Process each step in the pattern exactly as defined
    pattern.forEach((step) => {
      if (step === "ban") {
        const banEntry = bannedCopy.shift();
        if (banEntry) {
          finalActions.push({
            type: "ban",
            teamName: banEntry.teamName,
            mapName: banEntry.map,
          });
        }
      } else if (step === "mode_ban") {
        const banEntry = bannedModeCopy.shift();
        if (banEntry) {
          finalActions.push({
            type: "ban_mode",
            teamName: banEntry.teamName,
            mode: {
              mode: banEntry.mode,
              translatedMode: banEntry.translatedMode || banEntry.mode,
            },
          });
        }
      } else if (step === "pick") {
        const pickEntry = pickedCopy.shift();
        if (pickEntry) {
          finalActions.push({
            type: "pick",
            teamName: pickEntry.teamName,
            mapName: pickEntry.map,
            side: pickEntry.side || "mode",
            sideTeamName: pickEntry.sideTeamName || pickEntry.teamName,
          });
        }
      } else if (step === "mode_pick" && pickedModeCopy.mode != "") {
        const pickEntry = pickedModeCopy;
        finalActions.push({
          type: "pick_mode",
          teamName: pickEntry.teamName,
          sideTeamName: pickEntry.teamName,
          mode: {
            mode: pickEntry.mode,
            translatedMode: pickEntry.translatedMode,
          },
        });
      } else if (step === "decider") {
        const pickEntry = pickedCopy.shift();
        if (pickEntry) {
          finalActions.push({
            type: "decider",
            mapName: pickEntry.map,
          });
        }
      }
    });

    console.log("Final actions computed:", finalActions);
    return finalActions;
  }, [bannedEntries, bannedModeEntries, pickedEntries, pattern, pickedMode]);

  // Reveal actions one by one with a 3-second delay
  useEffect(() => {
    console.log("Actions visibility effect:", {
      actionsLength: actions.length,
      visibleActionsCount,
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
    if (visibleActionsCount === 0) {
      document.body.style.transition = 'opacity 0.9s'; // Updated to make fade-out 3 times slower
      document.body.style.opacity = '0';
      setTimeout(() => {
        document.body.style.opacity = '1';
        setVisibleActionsCount(0);
      }, 900); // Match the updated transition duration
    }
  }, [visibleActionsCount]);

  useEffect(() => {
    document.body.classList.add("obs-page");
    return () => document.body.classList.remove("obs-page");
  }, []);

  return (
    <div className="bg-transparent p-8 justify-start">
      <div className="flex space-x-4 py-16">
        {actions.slice(0, visibleActionsCount).map((action, index) => {
          // Skip rendering if cardColors is not yet populated
          console.log('Rendering action:', action);
          console.log('Card colors for action type:', cardColors[action.type]);
          if (!cardColors || !cardColors[action.type]) {
            console.log('Skipping render due to missing card colors for type:', action.type);
            return null;
          }

          switch (action.type) {
            case "ban":
              return (
                <AnimatedBanCard
                  key={index}
                  teamName={action.teamName}
                  mapName={action.mapName}
                  gameName={gameName}
                  cardColors={cardColors.ban}
                />
              );
            case "ban_mode":
              return (
                <AnimatedBanModeCard
                  key={index}
                  teamName={action.teamName}
                  mode={action.mode}
                  gameName={gameName}
                  cardColors={cardColors.ban_mode}
                />
              );
            case "pick":
              return (
                <AnimatedPickCard
                  key={index}
                  teamName={action.teamName}
                  sideTeamName={action.sideTeamName}
                  mapName={action.mapName}
                  gameName={gameName}
                  side={action.side}
                  cardColors={cardColors.pick}
                />
              );
            case "pick_mode":
              return (
                <AnimatedPickModeCard
                  key={index}
                  teamName={action.teamName}
                  sideTeamName={action.sideTeamName}
                  mode={action.mode}
                  gameName={gameName}
                  cardColors={cardColors.pick_mode}
                />
              );
            case "decider":
              return (
                <AnimatedDeciderCard
                  key={index}
                  mapName={action.mapName}
                  gameName={gameName}
                  cardColors={cardColors.decider}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};

export default ObsPage;
