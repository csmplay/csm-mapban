import { serializeForJSON } from "./utils/serialization";
import { sanitizeInput } from "./utils/input-validation";
import { CardColors, defaultCardColors } from "./utils/card-colors";
import type { Serializable } from "./utils/serialization";
import { app, io } from "./utils/server";
import * as FPSGames from "./games/fps-games";
import * as Splatoon from "./games/splatoon";
import { GameName, GameType, MapPool, Lobby, Roles } from "./utils/types";

const lobbies = new Map<string, Lobby>();
let globalCoinFlip = true;
let cardColors = defaultCardColors;

const mapPool: MapPool = {
  fps: JSON.parse(JSON.stringify(FPSGames.startMapPool)),
  splatoon: JSON.parse(JSON.stringify(Splatoon.startMapPool)),
};

app.get("/api/cardColors", (_req, res) => {
  res.json(cardColors);
});

app.get("/api/lobbies", (_req, res) => {
  res.json(
    serializeForJSON(Array.from(lobbies.values()) as unknown as Serializable),
  );
});

app.get("/api/mapPool", (_req, res) => {
  res.json({
    mapPool: { fps: mapPool.fps, splatoon: mapPool.splatoon },
    mapNamesLists: { fps: FPSGames.mapNamesLists },
  });
});

const getGameCategory = (gameName: GameName) => {
  return gameName === "splatoon" ? "splatoon" : "fps";
};

const startGame = (lobbyId: string) => {
  const lobby = lobbies.get(lobbyId);
  if (lobby) {
    if (getGameCategory(lobby.rules.gameName) === "splatoon") {
      // Splatoon.startGame(lobbyId);
    } else {
      FPSGames.startGame(lobbyId, lobbies as Map<string, FPSGames.Lobby>);
    }
  }
};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.data.lobbies = new Set<string>();

  socket.on(
    "joinLobby",
    (lobbyId: string, role: Roles = "member") => {
      socket.join(lobbyId);

      // Handle test case
      if (role === "test") {
        io.to(socket.id).emit(
          lobbies.get(lobbyId) ? "lobbyExists" : "lobbyUndefined",
          lobbyId,
        );
        return;
      }

      console.log(
        `User ${socket.id} ${role === "observer" ? "observing" : "joined"} lobby ${lobbyId}`,
      );

      // Check if the lobby exists
      if (!lobbies.has(lobbyId)) {
        io.to(socket.id).emit("lobbyUndefined", lobbyId);
        return;
      }
      const lobby = lobbies.get(lobbyId)!;

      io.to(lobbyId).emit("mapNames", lobby.rules.mapNames);
      io.to(lobbyId).emit("gameName", lobby.rules.gameName);

      // Add the socket ID to the appropriate list based on role
      if (role === "observer") {
        lobby.observers.add(socket.id);
      } else if (role === "member") {
        lobby.members.add(socket.id);
      }

      // Add the lobbyId to the socket's list of lobbies
      socket.data.lobbies.add(lobbyId);
      if (role === "member") {
        io.to(socket.id).emit(
          "teamNamesUpdated",
          Array.from(lobby.teamNames.entries()),
        );
      }
      if (lobby.pickedMaps.length > 0) {
        io.to(socket.id).emit("pickedUpdated", lobby.pickedMaps);
      }
      if (lobby.bannedMaps.length > 0) {
        io.to(socket.id).emit("bannedUpdated", lobby.bannedMaps);
      }
    },
  );

  socket.on(
    "createFPSLobby",
    (data: {
      lobbyId: string;
      gameName: FPSGames.GameName;
      gameType: GameType;
      knifeDecider: boolean;
      mapPoolSize: number;
      customMapPool: Record<string, string[]> | null;
      coinFlip: boolean | null;
      admin: boolean | null;
    }) => {
      const {
        lobbyId,
        gameName,
        gameType,
        knifeDecider,
        mapPoolSize,
        customMapPool,
        coinFlip,
        admin
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

      let lobby = lobbies.get(lobbyId) as FPSGames.Lobby;
      if (!lobby) {
        // Select map pool based on game type
        const sourceMapPool = customMapPool
          ? customMapPool[gameName]
          : mapPool["fps"][gameName];
        const selectedMapPool =
          mapPoolSize === 4 ? sourceMapPool.slice(0, 4) : sourceMapPool;

        // Create a new lobby
        lobby = {
          lobbyId,
          members: new Set<string>(),
          teamNames: new Map<string, string>(),
          observers: new Set<string>(),
          pickedMaps: [],
          bannedMaps: [],
          rules: {
            gameName: gameName,
            gameType: gameType,
            mapNames: selectedMapPool,
            mapRulesList: FPSGames.mapRulesLists[gameType as GameType],
            coinFlip: coinFlip ?? globalCoinFlip,
            admin: admin ?? false,
            knifeDecider: knifeDecider,
            mapPoolSize: mapPoolSize,
          },
          gameStep: 7 - mapPoolSize,
        };

        lobbies.set(lobbyId, lobby);
      }
    },
  );

  socket.on("admin.editFPSMapPool", (newMapPool?: Record<string, string[]>) => {
    mapPool.fps = newMapPool as typeof mapPool.fps || FPSGames.startMapPool;
  });

  socket.on("admin.coinFlipUpdate", (coinFlip: boolean) => {
    globalCoinFlip = coinFlip;
    console.log("Coin Flip globally updated to " + coinFlip);
  });

  socket.on("obs.getPatternList", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      io.to(socket.id).emit("patternList", lobby.rules.mapRulesList);
    }
  });

  socket.on("lobby.teamName", (data: { lobbyId: string; teamName: string }) => {
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

  socket.on("admin.start", (lobbyId: string) => {
    startGame(lobbyId);
  });

  socket.on(
    "lobby.startPick",
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

        io.to(targetSocket).emit("backend.startPick", selectedMapIndex);
        io.to(otherSocket).emit("canWorkUpdated", false);
        io.to(otherSocket).emit("canPick", false);
      }
    },
  );

  socket.on(
    "lobby.pick",
    (data: {
      lobbyId: string;
      map: string;
      teamName: string;
      side: string;
    }) => {
      const { lobbyId, map, teamName, side = "" } = data;
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        const sideTeamName = teamName;
        let mapTeamName = teamName;

        // Handle map picking based on game type and category
        let stateMessage = "";
        if (getGameCategory(lobby.rules.gameName) === "fps") {
          // For BO3/BO5, the other team picked the map
          stateMessage = `${mapTeamName} выбрали карту ${map}, ${sideTeamName} выбрали ${
            side === "t"
              ? "атакующих"
              : side === "ct"
                ? "обороняющих"
                : side.toUpperCase()
          }`;
          if (lobby.rules.gameType !== "bo1") {
            stateMessage = `${teamName} выбрали ${
              side === "t"
                ? "атакующих"
                : side === "ct"
                  ? "обороняющих"
                  : side.toUpperCase()
            } на карте ${map}`;
            for (const [, otherName] of lobby.teamNames.entries()) {
              if (otherName !== teamName) {
                mapTeamName = otherName;
                break;
              }
            }
          }
          (lobby as FPSGames.Lobby).pickedMaps.push({
            map,
            teamName: mapTeamName,
            side,
            sideTeamName,
          });
        } else if (getGameCategory(lobby.rules.gameName) === "splatoon") {
          (lobby as Splatoon.Lobby).pickedMaps.push({
            map,
            teamName,
          });
          stateMessage = `${teamName} выбрали карту ${map}`;
        }

        lobby.gameStep++;
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

        if (
          lobby.gameStep < 7 &&
          getGameCategory(lobby.rules.gameName) === "fps"
        ) {
          io.to(socket.id).emit("canWorkUpdated", true);
          if (lobby.rules.mapRulesList[lobby.gameStep] === "pick") {
            io.to(socket.id).emit("canPick", true);
            io.to(lobbyId).emit(
              "gameStateUpdated",
              teamName + " выбирают карту для пика",
            );
          } else if (lobby.rules.mapRulesList[lobby.gameStep] === "decider") {
            if ((lobby as FPSGames.Lobby).rules.knifeDecider) {
              io.to(otherSocketId).emit("canWorkUpdated", false);
              io.to(lobbyId).emit("canWorkUpdated", false);
              const mapNames = lobby.rules.mapNames;
              const pickedAndBannedMaps = lobby.pickedMaps
                .map((pickedMap: { map: string }) => pickedMap.map)
                .concat(
                  lobby.bannedMaps.map(
                    (bannedMap: { map: string }) => bannedMap.map,
                  ),
                );
              let notPickedMap = "";
              for (const mapName of mapNames) {
                const mapExists = pickedAndBannedMaps.includes(mapName);
                if (!mapExists) {
                  notPickedMap = mapName;
                }
              }
              (lobby as FPSGames.Lobby).pickedMaps.push({
                map: notPickedMap,
                teamName: "",
                side: "DECIDER",
                sideTeamName: "",
              });
              lobby.gameStep++;
              io.to(lobbyId).emit("pickedUpdated", lobby.pickedMaps);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                "Десайдер - " + notPickedMap,
              );
            } else if (!(lobby as FPSGames.Lobby).rules.knifeDecider) {
              io.to(otherSocketId).emit("canWorkUpdated", false);
              io.to(socket.id).emit("canWorkUpdated", true);
              io.to(socket.id).emit("canPick", true);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                teamName + " выбирают карту для пика",
              );
            }
          } else if (lobby.rules.mapRulesList[lobby.gameStep] === "ban") {
            io.to(socket.id).emit("canBan", true);
            io.to(lobbyId).emit(
              "gameStateUpdated",
              teamName + " выбирают карту для бана",
            );
          }
        } else {
          io.to(lobbyId).emit("canWorkUpdated", false);
        }
        // After updating picked entries, add log
        console.log("Picked entries updated:", lobby.pickedMaps);
        io.to(lobbyId).emit("pickedUpdated", lobby.pickedMaps);
      }
    },
  );

  socket.on(
    "lobby.ban",
    (data: { lobbyId: string; map: string; teamName: string }) => {
      const { lobbyId, map, teamName } = data;
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        lobby.bannedMaps.push({ map, teamName });
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
        if (
          lobby.gameStep < 7 &&
          getGameCategory(lobby.rules.gameName) === "fps"
        ) {
          io.to(otherSocketId).emit("canWorkUpdated", true);
          if (
            (lobby as FPSGames.Lobby).rules.mapRulesList[lobby.gameStep] ===
            "pick"
          ) {
            io.to(otherSocketId).emit("canPick", true);
            io.to(lobbyId).emit(
              "gameStateUpdated",
              otherName + " выбирают карту для пика",
            );
          } else if (lobby.rules.mapRulesList[lobby.gameStep] === "decider") {
            if ((lobby as FPSGames.Lobby).rules.knifeDecider) {
              io.to(otherSocketId).emit("canWorkUpdated", false);
              io.to(lobbyId).emit("canWorkUpdated", false);
              const mapNames = lobby.rules.mapNames;
              const pickedAndBannedMaps = lobby.pickedMaps
                .map((pickedMap: { map: string }) => pickedMap.map)
                .concat(
                  lobby.bannedMaps.map(
                    (bannedMap: { map: string }) => bannedMap.map,
                  ),
                );
              let notPickedMap = "";
              for (const mapName of mapNames) {
                const mapExists = pickedAndBannedMaps.includes(mapName);
                if (!mapExists) {
                  notPickedMap = mapName;
                }
              }
              (lobby as FPSGames.Lobby).pickedMaps.push({
                map: notPickedMap,
                teamName: "",
                side: "DECIDER",
                sideTeamName: "",
              });
              lobby.gameStep++;
              io.to(lobbyId).emit("pickedUpdated", lobby.pickedMaps);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                "Десайдер - " + notPickedMap,
              );
            } else if (!(lobby as FPSGames.Lobby).rules.knifeDecider) {
              io.to(socket.id).emit("canWorkUpdated", false);
              io.to(otherSocketId).emit("canWorkUpdated", true);
              io.to(otherSocketId).emit("canPick", true);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                teamName + " выбирают карту для пика",
              );
            }
          } else if (lobby.rules.mapRulesList[lobby.gameStep] === "ban") {
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
        io.to(lobbyId).emit("bannedUpdated", lobby.bannedMaps);
      }
    },
  );

  socket.on("admin.delete", (lobbyId: string) => {
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

  socket.on("admin.clear_obs", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      lobby.observers.forEach((observer) => {
        io.to(observer).emit("backend.clear_obs");
      });
    }
  });

  socket.on("admin.play_obs", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      lobby.observers.forEach((observer) => {
        io.to(observer).emit("bannedUpdated", lobby.bannedMaps);
        io.to(observer).emit("pickedUpdated", lobby.pickedMaps);
      });
    }
  });

  socket.on("admin.editCardColors", (newCardColors?) => {
    cardColors = newCardColors || defaultCardColors;
    console.log("Card colors updated:", cardColors);
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