import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

const port = 4000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

// Referrer check middleware
const checkReferrer = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const referrer = req.get("referer");

  if (
    (!referrer || !referrer.startsWith(frontendUrl)) &&
    process.env.NODE_ENV === "production"
  ) {
    res.status(403).send("Unauthorized request");
    return;
  }

  next();
};

// Apply the referrer check middleware to all API routes
app.use("/api", checkReferrer);

// Use cors middleware
app.use(
  cors({
    origin: frontendUrl,
  }),
);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"],
  },
});

// Lobby interface
interface Lobby {
  lobbyId: string; // Lobby ID
  members: Set<string>; // Set of member IDs
  teamNames: Map<string, string>; // Map of team names
  observers: Set<string>; // Set of observer IDs
  picked: Array<{
    map: string; // Map name
    teamName: string; // Team that picked the map
    side: string; // Side
    sideTeamName: string; // Team that picked the side
  }>;
  banned: Array<{ map: string; teamName: string }>; // Array of banned maps
  rules: {
    gameName: string; // Game name (cs2, valorant)
    gameType: string; // Game type (bo1, bo2, bo3, bo5)
    mapNames: Array<string>; // Array of map names
    gameStateList: string[]; // Array of game states
    coinFlip: boolean; // Coin flip result
    admin: boolean; // Admin status
    knifeDecider: boolean; // Knife decider
    mapPoolSize: number; // Map pool size
  };
  gameStep: number; // Game step
}

// Data structure to store lobbies and their members
const lobbies = new Map<string, Lobby>();
let globalCoinFlip = true;
const gameTypeLists = {
  bo1: ["ban", "ban", "ban", "ban", "ban", "ban", "pick"],
  bo2: ["ban", "ban", "ban", "ban", "ban", "pick", "pick"],
  bo3: ["ban", "ban", "pick", "pick", "ban", "ban", "decider"],
  bo5: ["ban", "ban", "pick", "pick", "pick", "pick", "decider"],
};
const mapNamesLists = {
  cs2: [
    "Ancient",
    "Anubis",
    "Dust 2",
    "Inferno",
    "Mirage",
    "Nuke",
    "Overpass",
    "Train",
    "Vertigo",
  ],
  valorant: [
    "Abyss",
    "Ascent",
    "Bind",
    "Breeze",
    "District",
    "Drift",
    "Fracture",
    "Glitch",
    "Haven",
    "Icebox",
    "Kasbah",
    "Lotus",
    "Pearl",
    "Piazza",
    "Split",
    "Sunset",
  ],
};
const startMapPool = {
  cs2: ["Dust 2", "Mirage", "Inferno", "Nuke", "Ancient", "Anubis", "Train"],
  valorant: ["Ascent", "Bind", "Pearl", "Haven", "Abyss", "Sunset", "Split"],
};
let mapPool = startMapPool;

// Updated default configuration: separate settings for ban and pick cards
const defaultCardColors = {
  ban: {
    text: ["#dfdfdf", "#dfdfdf", "#dfdfdf"],
    bg: ["#282828", "#282828", "#282828", "#dfdfdf"],
  },
  pick: {
    text: ["#dfdfdf", "#dfdfdf", "#dfdfdf"],
    bg: ["#42527e", "#282828", "#42527e", "#dfdfdf"],
  },
};
let cardColors = defaultCardColors;

app.get("/api", (_req, res) => {
  res.send("Express + TypeScript Server");
});

// New endpoint to fetch current card colors
app.get("/api/cardColors", (_req, res) => {
  res.json(cardColors);
});

const startGame = (lobbyId: string) => {
  const lobby = lobbies.get(lobbyId);
  if (lobby) {
    console.log("Game Started in lobby: " + lobbyId);
    io.to(lobbyId).emit(
      "teamNamesUpdated",
      Array.from(lobby.teamNames.entries()),
    );
    io.to(lobbyId).emit("isCoin", lobby.rules.coinFlip);

    if (lobby.rules.coinFlip) {
      if (lobby.teamNames.size === 2) {
        const result = Math.floor(Math.random() * 2);
        io.to(lobbyId).emit("coinFlip", result);
        const entry = Array.from(lobby.teamNames.entries())[result];
        io.to(entry[0]).emit("canWorkUpdated", true);
        if (lobby.rules.gameStateList[0] === "ban") {
          io.to(entry[0]).emit("canBan", true);
          setTimeout(() => {
            io.to(lobbyId).emit(
              "gameStateUpdated",
              entry[1] + " выбирают карту для бана",
            );
          }, 3000);
        } else if (lobby.rules.gameStateList[0] === "pick") {
          io.to(entry[0]).emit("canPick", true);
          setTimeout(() => {
            io.to(lobbyId).emit(
              "gameStateUpdated",
              entry[1] + " выбирают карту для пика",
            );
          }, 3000);
        }
      }
    } else {
      for (const [otherSocketIdKey] of lobby.teamNames.entries()) {
        io.to(otherSocketIdKey).emit("canWorkUpdated", true);
        io.to(lobbyId).emit("startWithoutCoin");
        if (lobby.rules.gameStateList[0] === "ban") {
          io.to(otherSocketIdKey).emit("canBan", true);
          io.to(lobbyId).emit("gameStateUpdated", "Выберите карту для бана");
        } else {
          io.to(otherSocketIdKey).emit("canPick", true);
          io.to(lobbyId).emit("gameStateUpdated", "Выберите карту для пика");
        }
      }
    }
  }
};

// Admin endpoint to get the list of lobbies and their members
app.get("/api/lobbies", (_req, res) => {
  const lobbyList = Array.from(lobbies.values()).map((lobby) => ({
    lobbyId: lobby.lobbyId,
    members: Array.from(lobby.members),
    teamNames: Array.from(lobby.teamNames.entries()),
    observers: Array.from(lobby.observers),
    picked: lobby.picked,
    banned: lobby.banned,
    rules: lobby.rules,
    gameStep: lobby.gameStep,
  }));
  res.json(lobbyList);
});

app.get("/api/mapPool", (req, res) => {
  res.json({ mapPool, mapNamesLists });
});

// Simple sanitization function
const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .slice(0, 32) // Reasonable length limit
    .replace(/[<>]/g, ""); // Remove potential HTML tags
};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  // Initialize the set of lobbies the socket is in
  socket.data.lobbies = new Set<string>();

  socket.on("joinLobbyTest", (lobbyId: string) => {
    socket.join(lobbyId);
    // Check if the lobby exists
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      io.to(socket.id).emit("lobbyUndefined", lobbyId);
      return;
    } else {
      io.to(socket.id).emit("lobbyExists", lobbyId);
      return;
    }
  });
  socket.on("joinLobby", (lobbyId: string) => {
    socket.join(lobbyId);
    console.log(`User ${socket.id} joined lobby ${lobbyId}`);

    // Check if the lobby exists
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      io.to(socket.id).emit("lobbyUndefined", lobbyId);
      return;
    }

    io.to(lobbyId).emit("mapNames", lobby.rules.mapNames);
    io.to(lobbyId).emit("gameName", lobby.rules.gameName);

    // Add the socket ID to the lobby's member list
    lobby.members.add(socket.id);

    // Add the lobbyId to the socket's list of lobbies
    socket.data.lobbies.add(lobbyId);
    io.to(socket.id).emit(
      "teamNamesUpdated",
      Array.from(lobby.teamNames.entries()),
    );
    if (lobby.picked.length > 0) {
      io.to(socket.id).emit("pickedUpdated", lobby.picked);
    }
    if (lobby.banned.length > 0) {
      io.to(socket.id).emit("bannedUpdated", lobby.banned);
    }
  });

  socket.on("joinLobbyObs", (lobbyId: string) => {
    socket.join(lobbyId);
    console.log(`User ${socket.id} observing lobby ${lobbyId}`);

    // Check if the lobby exists
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      io.to(socket.id).emit("lobbyUndefined", lobbyId);
      return;
    }

    io.to(lobbyId).emit("mapNames", lobby.rules.mapNames);
    io.to(lobbyId).emit("gameName", lobby.rules.gameName);

    // Add the socket ID to the lobby's member list
    lobby.observers.add(socket.id);

    // Add the lobbyId to the socket's list of lobbies
    socket.data.lobbies.add(lobbyId);
    io.to(socket.id).emit("pickedUpdated", lobby.picked);
    io.to(socket.id).emit("bannedUpdated", lobby.banned);

    // Add logging data
    console.log("Observer joined, sending picked data:", lobby.picked);
  });

  socket.on(
    "createLobby",
    (data: {
      lobbyId: string;
      gameName: keyof typeof mapPool;
      gameType: keyof typeof gameTypeLists;
      knifeDecider: boolean;
      mapPoolSize: number;
      customMapPool: Record<keyof typeof mapPool, string[]> | null;
    }) => {
      const {
        lobbyId,
        gameName,
        gameType,
        knifeDecider,
        mapPoolSize,
        customMapPool,
      } = data;
      console.log("Lobby created with id " + lobbyId);

      // Rule validation
      if ((gameType === "bo3" || gameType === "bo5") && mapPoolSize !== 7) {
        io.to(socket.id).emit(
          "lobbyCreationError",
          "Для BO3/BO5 размер маппула должен быть 7",
        );
        return;
      }

      if ((gameType === "bo1" || gameType === "bo2") && knifeDecider) {
        io.to(socket.id).emit(
          "lobbyCreationError",
          "У вас выбран десайдер, который не поддерживается",
        );
        return;
      }

      let lobby = lobbies.get(lobbyId);
      if (!lobby) {
        // Select map pool
        const sourceMapPool = customMapPool
          ? customMapPool[gameName]
          : mapPool[gameName];
        const selectedMapPool =
          mapPoolSize === 4 ? sourceMapPool.slice(0, 4) : sourceMapPool;

        // Create a new lobby
        lobby = {
          lobbyId,
          members: new Set<string>(),
          teamNames: new Map<string, string>(),
          observers: new Set<string>(),
          picked: [],
          banned: [],
          rules: {
            gameName: gameName,
            gameType: gameType,
            mapNames: selectedMapPool,
            gameStateList: gameTypeLists[gameType],
            coinFlip: globalCoinFlip,
            admin: false,
            knifeDecider: knifeDecider,
            mapPoolSize: mapPoolSize,
          },
          gameStep: 7 - mapPoolSize,
        };

        lobbies.set(lobbyId, lobby);
      }
    },
  );

  socket.on(
    "createObsLobby",
    (data: {
      lobbyId: string;
      gameName: keyof typeof mapPool;
      gameType: keyof typeof gameTypeLists;
      knifeDecider: boolean;
      mapPoolSize: number;
      customMapPool: Record<keyof typeof mapPool, string[]> | null;
      coinFlip: boolean;
    }) => {
      const {
        lobbyId,
        gameName,
        gameType,
        coinFlip,
        knifeDecider,
        mapPoolSize,
      } = data;
      console.log("Admin Lobby created with id " + lobbyId);

      // Rule validation
      if ((gameType === "bo3" || gameType === "bo5") && mapPoolSize !== 7) {
        io.to(socket.id).emit(
          "lobbyCreationError",
          "Для BO3/BO5 размер маппула должен быть 7",
        );
        return;
      }

      if ((gameType === "bo1" || gameType === "bo2") && knifeDecider) {
        io.to(socket.id).emit(
          "lobbyCreationError",
          "У вас выбран десайдер, который не поддерживается",
        );
        return;
      }

      let lobby = lobbies.get(lobbyId);
      if (!lobby) {
        // Create a new ADMIN lobby
        const fullMapPool = mapPool[gameName];
        const selectedMapPool =
          mapPoolSize === 4 ? fullMapPool.slice(0, 4) : fullMapPool;
        lobby = {
          lobbyId,
          members: new Set<string>(),
          teamNames: new Map<string, string>(),
          observers: new Set<string>(),
          picked: [],
          banned: [],
          rules: {
            gameName: gameName,
            gameType: gameType,
            mapNames: selectedMapPool,
            gameStateList: gameTypeLists[gameType],
            coinFlip: coinFlip,
            admin: true,
            knifeDecider: knifeDecider,
            mapPoolSize: mapPoolSize,
          },
          gameStep: 7 - mapPoolSize,
        };

        lobbies.set(lobbyId, lobby);
      }
    },
  );

  socket.on("editMapPool", (newMapPool: typeof mapPool) => {
    mapPool = newMapPool;
  });

  socket.on("resetMapPool", () => {
    mapPool = startMapPool;
  });

  socket.on("coinFlipUpdate", (coinFlip: boolean) => {
    globalCoinFlip = coinFlip;
    console.log("Coin Flip globally updated to " + coinFlip);
  });

  socket.on("getPatternList", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      io.to(socket.id).emit("patternList", lobby.rules.gameStateList);
    }
  });

  socket.on("teamName", (data: { lobbyId: string; teamName: string }) => {
    const { lobbyId } = data;
    const teamName = sanitizeInput(data.teamName);
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      lobby.teamNames.set(socket.id, teamName);
      io.to(lobbyId).emit(
        "teamNamesUpdated",
        Array.from(lobby.teamNames.entries()),
      );
      if (!lobby.rules.admin) {
        startGame(lobbyId);
      }
    }
  });

  socket.on("start", (lobbyId: string) => {
    startGame(lobbyId);
  });

  socket.on(
    "startPick",
    (data: { lobbyId: string; teamName: string; selectedMapIndex: number }) => {
      const { lobbyId, teamName, selectedMapIndex } = data;
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        let otherSocketId = "";
        for (const [
          otherSocketIdKey,
          otherNames,
        ] of lobby.teamNames.entries()) {
          if (otherNames !== teamName) {
            otherSocketId = otherSocketIdKey;
            break;
          }
        }

        // When picking a map, save it for later use
        const mapName = lobby.rules.mapNames[selectedMapIndex];
        socket.data.pickedMap = { map: mapName, teamName };

        const targetSocket =
          lobby.rules.gameType === "bo1" ? socket.id : otherSocketId;
        const otherSocket =
          lobby.rules.gameType === "bo1" ? otherSocketId : socket.id;

        io.to(targetSocket).emit("startPick", selectedMapIndex);
        io.to(otherSocket).emit("canWorkUpdated", false);
        io.to(otherSocket).emit("canPick", false);
      }
    },
  );

  socket.on(
    "pick",
    (data: {
      lobbyId: string;
      map: string;
      teamName: string;
      side: string;
    }) => {
      const { lobbyId, map, teamName, side } = data;
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        const sideTeamName = teamName;
        let mapTeamName = teamName;

        // For BO3 or BO5, determine who picked the map and who picked the side
        if (lobby.rules.gameType !== "bo1") {
          // Find the name of the other team - they picked the map
          for (const [, otherName] of lobby.teamNames.entries()) {
            if (otherName !== teamName) {
              mapTeamName = otherName;
              break;
            }
          }

          // Current team picks the side

          // Add information about the picked map and side
          lobby.picked.push({ map, teamName: mapTeamName, side, sideTeamName });
        } else {
          // For BO1/BO2 - regular pick, but now with sideTeamName
          lobby.picked.push({ map, teamName, side, sideTeamName });
        }

        lobby.gameStep++;

        // Display informative message
        let stateMessage = "";
        if (sideTeamName) {
          stateMessage = `${mapTeamName} выбрали карту ${map}, ${sideTeamName} выбрали ${
            side === "t"
              ? "атакующих"
              : side === "ct"
                ? "обороняющих"
                : side.toUpperCase()
          }`;
        } else {
          stateMessage = `${teamName} выбрали ${
            side === "t"
              ? "атакующих"
              : side === "ct"
                ? "обороняющих"
                : side.toUpperCase()
          } на карте ${map}`;
        }

        io.to(lobbyId).emit("gameStateUpdated", stateMessage);

        // Clear temporary data
        if (socket.data.pickedMap) {
          delete socket.data.pickedMap;
        }

        let otherSocketId = "";
        for (const [
          otherSocketIdKey,
          otherNames,
        ] of lobby.teamNames.entries()) {
          if (otherNames !== teamName) {
            otherSocketId = otherSocketIdKey;
            break;
          }
        }
        io.to(otherSocketId).emit("endPick");

        if (lobby.gameStep < 7) {
          io.to(socket.id).emit("canWorkUpdated", true);
          if (lobby.rules.gameStateList[lobby.gameStep] === "pick") {
            io.to(socket.id).emit("canPick", true);
            setTimeout(() => {
              io.to(lobbyId).emit(
                "gameStateUpdated",
                teamName + " выбирают карту для пика",
              );
            }, 3000);
          } else if (lobby.rules.gameStateList[lobby.gameStep] === "decider") {
            if (lobby.rules.knifeDecider) {
              io.to(otherSocketId).emit("canWorkUpdated", false);
              io.to(lobbyId).emit("canWorkUpdated", false);
              const mapNames = lobby.rules.mapNames;
              const pickedAndBannedMaps = lobby.picked
                .map((pickedMap) => pickedMap.map)
                .concat(lobby.banned.map((bannedMap) => bannedMap.map));
              let notPickedMap = "";
              for (const mapName of mapNames) {
                const mapExists = pickedAndBannedMaps.includes(mapName);
                if (!mapExists) {
                  notPickedMap = mapName;
                }
              }
              lobby.picked.push({
                map: notPickedMap,
                teamName: "",
                side: "DECIDER",
                sideTeamName: "",
              });
              lobby.gameStep++;
              // lobby.observers.forEach((observer) => {
              //   io.to(observer).emit("pickedUpdated", lobby.picked);
              // });
              io.to(lobbyId).emit("pickedUpdated", lobby.picked);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                "Десайдер - " + notPickedMap,
              );
            } else if (!lobby.rules.knifeDecider) {
              io.to(otherSocketId).emit("canWorkUpdated", false);
              io.to(socket.id).emit("canWorkUpdated", true);
              io.to(socket.id).emit("canPick", true);
              setTimeout(() => {
                io.to(lobbyId).emit(
                  "gameStateUpdated",
                  teamName + " выбирают карту для пика",
                );
              }, 3000);
            }
          } else if (lobby.rules.gameStateList[lobby.gameStep] === "ban") {
            io.to(socket.id).emit("canBan", true);
            setTimeout(() => {
              io.to(lobbyId).emit(
                "gameStateUpdated",
                teamName + " выбирают карту для бана",
              );
            }, 3000);
          }
        } else {
          io.to(lobbyId).emit("canWorkUpdated", false);
        }
        // After updating picked entries, add log
        console.log("Picked entries updated:", lobby.picked);
        io.to(lobbyId).emit("pickedUpdated", lobby.picked);
      }
    },
  );

  socket.on(
    "ban",
    (data: { lobbyId: string; map: string; teamName: string }) => {
      const { lobbyId, map, teamName } = data;
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        lobby.banned.push({ map, teamName });
        lobby.gameStep++;

        io.to(socket.id).emit("canWorkUpdated", false);
        io.to(socket.id).emit("canBan", false);

        let otherSocketId = "";
        let otherName = "";
        for (const [
          otherSocketIdKey,
          otherNames,
        ] of lobby.teamNames.entries()) {
          if (otherNames !== teamName) {
            otherName = otherNames;
            otherSocketId = otherSocketIdKey;
            break;
          }
        }
        if (lobby.gameStep < 7) {
          io.to(otherSocketId).emit("canWorkUpdated", true);
          if (lobby.rules.gameStateList[lobby.gameStep] === "pick") {
            io.to(otherSocketId).emit("canPick", true);
            io.to(lobbyId).emit(
              "gameStateUpdated",
              otherName + " выбирают карту для пика",
            );
          } else if (lobby.rules.gameStateList[lobby.gameStep] === "decider") {
            if (lobby.rules.knifeDecider) {
              io.to(otherSocketId).emit("canWorkUpdated", false);
              io.to(lobbyId).emit("canWorkUpdated", false);
              const mapNames = lobby.rules.mapNames;
              const pickedAndBannedMaps = lobby.picked
                .map((pickedMap) => pickedMap.map)
                .concat(lobby.banned.map((bannedMap) => bannedMap.map));
              let notPickedMap = "";
              for (const mapName of mapNames) {
                const mapExists = pickedAndBannedMaps.includes(mapName);
                if (!mapExists) {
                  notPickedMap = mapName;
                }
              }
              lobby.picked.push({
                map: notPickedMap,
                teamName: "",
                side: "DECIDER",
                sideTeamName: "",
              });
              lobby.gameStep++;
              // lobby.observers.forEach((observer) => {
              //   io.to(observer).emit("pickedUpdated", lobby.picked);
              // });
              io.to(lobbyId).emit("pickedUpdated", lobby.picked);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                "Десайдер - " + notPickedMap,
              );
            } else if (!lobby.rules.knifeDecider) {
              io.to(socket.id).emit("canWorkUpdated", false);
              io.to(otherSocketId).emit("canWorkUpdated", true);
              io.to(otherSocketId).emit("canPick", true);
              setTimeout(() => {
                io.to(lobbyId).emit(
                  "gameStateUpdated",
                  teamName + " выбирают карту для пика",
                );
              }, 3000);
            }
          } else if (lobby.rules.gameStateList[lobby.gameStep] === "ban") {
            io.to(otherSocketId).emit("canBan", true);
            io.to(lobbyId).emit(
              "gameStateUpdated",
              otherName + " выбирают карту для бана",
            );
          }
        } else {
          io.to(lobbyId).emit("canWorkUpdated", false);
        }
        // Broadcast the updated bans to all lobby members
        io.to(lobbyId).emit("bannedUpdated", lobby.banned);
      }
    },
  );

  socket.on("delete", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      // Notify all members that the lobby is being deleted
      io.to(lobbyId).emit("lobbyDeleted", lobbyId);

      // Remove all members from the lobby
      lobby.members.forEach((memberId) => {
        const memberSocket = io.sockets.sockets.get(memberId);
        if (memberSocket) {
          memberSocket.leave(lobbyId);
          memberSocket.data.lobbies.delete(lobbyId);
        }
      });

      // Delete the lobby from the lobbies Map
      lobbies.delete(lobbyId);

      console.log(`Lobby ${lobbyId} has been deleted`);
    }
  });

  socket.on("replay", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    let bannedIndex = 0;
    let pickedIndex = 0;
    const delayBetweenSteps = 5000; // e.g. 5 seconds delay
    let accumulatedDelay = 0;

    lobby.rules.gameStateList.forEach((step) => {
      accumulatedDelay += delayBetweenSteps;
      if (step === "ban") {
        const banEntry = lobby.banned[bannedIndex++];
        if (banEntry) {
          setTimeout(() => {
            // Emit this banned map to all members
            io.to(lobbyId).emit("bannedReplay", banEntry);
          }, accumulatedDelay);
        }
      } else if (step === "pick" || step === "decider") {
        const pickEntry = lobby.picked[pickedIndex++];
        if (pickEntry) {
          console.log("Sending pick entry to obs:", pickEntry); // Add log
          setTimeout(() => {
            // Emit this picked map to all members
            io.to(lobbyId).emit("pickedReplay", pickEntry);
          }, accumulatedDelay);
        }
      }
    });
  });

  // Socket calls for clearing and restarting animation for the observer (streamer)
  // Clear all action lists
  socket.on("clear", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      lobby.observers.forEach((observer) => {
        io.to(observer).emit("clear");
      });
    }
  });

  // Refill action lists again
  socket.on("play", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      lobby.observers.forEach((observer) => {
        io.to(observer).emit("bannedUpdated", lobby.banned);
        io.to(observer).emit("pickedUpdated", lobby.picked);
      });
    }
  });

  socket.on("editCardColors", (newCardColors) => {
    cardColors = newCardColors;
    console.log("Card colors updated:", cardColors);
    io.emit("cardColorsUpdated", cardColors);
  });

  socket.on("resetCardColors", () => {
    cardColors = defaultCardColors;
    console.log("Card colors reset to default");
    io.emit("cardColorsUpdated", cardColors);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);

    // Remove the socket ID from all lobbies it was in
    for (const lobbyId of socket.data.lobbies) {
      const lobby = lobbies.get(lobbyId);
      if (lobby !== undefined) {
        lobby.members.delete(socket.id);
        lobby.teamNames.delete(socket.id);
        console.log(`User ${socket.id} left lobby ${lobbyId}`);

        // Broadcast the updated team names to all lobby members
        io.to(lobbyId).emit(
          "teamNamesUpdated",
          Array.from(lobby.teamNames.entries()),
        );

        // Only delete non-admin lobbies when they're empty
        if (lobby.members.size === 0 && !lobby.rules.admin) {
          lobbies.delete(lobbyId);
          console.log(`Lobby ${lobbyId} deleted as it has no more members`);
        } else {
          // Broadcast the updated team names to all lobby members
          io.to(lobbyId).emit(
            "teamNamesUpdated",
            Array.from(lobby.teamNames.entries()),
          );
        }
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server is running at localhost:${port}`);
});
