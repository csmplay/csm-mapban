import { serializeForJSON } from "./utils/serialization";
import { sanitizeInput } from "./utils/input-validation";
import { defaultCardColors } from "./utils/card-colors";
import type { Serializable } from "./utils/serialization";
import { app, io } from "./utils/server";
import * as FPSGames from "./games/fps-games";
import * as Splatoon from "./games/splatoon";
import { GameName, GameType, MapPool, Lobby, Roles } from "./utils/types";
import { Lobby as SplatoonLobby, startGame as SplatoonStartGame, startNextRound as SplatoonStartNextRound, gameRules } from "./games/splatoon";

const lobbies = new Map<string, Lobby>();
let globalCoinFlip = true;
let cardColors = defaultCardColors;

const mapPool: MapPool = {
  fps: JSON.parse(JSON.stringify(FPSGames.startMapPool)),
  splatoon: JSON.parse(JSON.stringify(Splatoon.startMapPool)),
};

export const getGameCategory = (gameName: GameName) => {
  return gameName === "splatoon" ? "splatoon" : "fps";
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

const startGame = (lobbyId: string) => {
  const lobby = lobbies.get(lobbyId);
  if (lobby) {
    if (getGameCategory(lobby.rules.gameName) === "splatoon") {
      SplatoonStartGame(lobbyId, lobbies as Map<string, SplatoonLobby>);

      // Determine which team starts (based on coin flip)
      let firstTeam = "";
      let firstSocketId = "";
      let secondSocketId = "";

      // Get the teams in order
      const teamEntries = Array.from(lobby.teamNames.entries());
      if (teamEntries.length >= 1) {
        firstSocketId = teamEntries[0][0];
        firstTeam = teamEntries[0][1];

        if (teamEntries.length >= 2) {
          secondSocketId = teamEntries[1][0];
        }
      }

      console.log(`Starting Splatoon game in lobby ${lobbyId}`);
      console.log(`First team: ${firstTeam} (${firstSocketId})`);
      if (secondSocketId)
        console.log(`Second team: ${teamEntries[1][1]} (${secondSocketId})`);

      // Only emit startWithoutCoin if coin flip is disabled
      if (!(lobby as SplatoonLobby).rules.coinFlip) {
        io.to(lobbyId).emit("startWithoutCoin");
      }

      // Ensure controls are reset for everyone
      io.to(lobbyId).emit("canWorkUpdated", false);
      io.to(lobbyId).emit("canModeBan", false);
      io.to(lobbyId).emit("canModePick", false);
      io.to(lobbyId).emit("canBan", false);
      io.to(lobbyId).emit("canPick", false);

      // Only enable controls for first team if coin flip is disabled
      if (!(lobby as SplatoonLobby).rules.coinFlip && firstSocketId) {
        console.log(`Enabling mode ban for ${firstTeam}`);
        // Send canWorkUpdated first
        io.to(firstSocketId).emit("canWorkUpdated", true);
        // Then send canModeBan
        setTimeout(() => {
          io.to(firstSocketId).emit("canModeBan", true);
        }, 100); // Small delay to ensure events are processed in order
      }

      // Send available modes to clients
      io.to(lobbyId).emit("modesUpdated", {
        banned: (lobby as SplatoonLobby).bannedModes,
        active: (lobby as SplatoonLobby).rules.activeModes,
      });
    } else {
      FPSGames.startGame(lobbyId, lobbies as Map<string, FPSGames.Lobby>);
    }
  }
};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.data.lobbies = new Set<string>();

  socket.on("joinLobby", (lobbyId: string, role: Roles = "member") => {
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
  });

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
        admin,
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
        io.to(socket.id).emit("lobbyCreated", lobbyId);
      }
    },
  );

  socket.on(
    "createSplatoonLobby",
    (data: {
      lobbyId: string;
      gameType: Splatoon.GameType;
      coinFlip: boolean | null;
      admin: boolean | null;
    }) => {
      const { lobbyId, gameType, coinFlip, admin } = data;
      console.log("Splatoon Lobby created with id " + lobbyId);

      let lobby = lobbies.get(lobbyId) as SplatoonLobby;
      if (!lobby) {
        // Create a new Splatoon lobby
        lobby = {
          lobbyId,
          members: new Set<string>(),
          teamNames: new Map<string, string>(),
          observers: new Set<string>(),
          pickedMaps: [],
          bannedMaps: [],
          bannedModes: [],
          gameStep: 0,
          rules: {
            gameName: "splatoon",
            gameType,
            mapNames: [],
            mapRulesList: Splatoon.mapRulesLists[gameType].first,
            modesRulesList: Splatoon.modesRulesLists[gameType].first,
            activeModes: [...Splatoon.gameModes],
            roundNumber: 1,
            coinFlip: coinFlip ?? globalCoinFlip,
            admin: admin ?? false,
            mapPoolSize: 32,
          },
        };

        lobbies.set(lobbyId, lobby);
        io.to(socket.id).emit("lobbyCreated", lobbyId);
      }
    },
  );

  socket.on("admin.editFPSMapPool", (newMapPool?: Record<string, string[]>) => {
    mapPool.fps = (newMapPool as typeof mapPool.fps) || FPSGames.startMapPool;
  });

  socket.on("admin.coinFlipUpdate", (coinFlip: boolean) => {
    globalCoinFlip = coinFlip;
    console.log("Coin Flip globally updated to " + coinFlip);
  });

  socket.on("obs.getPatternList", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      if (getGameCategory(lobby.rules.gameName) === "splatoon") {
        // For Splatoon, we need to combine mode and map rules
        const splatoonLobby = lobby as SplatoonLobby;
        const pattern = [...splatoonLobby.rules.modesRulesList, ...splatoonLobby.rules.mapRulesList];
        io.to(socket.id).emit("patternList", pattern);
      } else {
        // For FPS games, just send the map rules
        io.to(socket.id).emit("patternList", lobby.rules.mapRulesList);
      }
    }
  });

  socket.on("lobby.teamName", (data: { lobbyId: string; teamName: string }) => {
    const { lobbyId } = data;
    const teamName = sanitizeInput(data.teamName);
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      lobby.teamNames.set(socket.id, teamName);
      console.log(`Team ${teamName} joined lobby ${lobbyId}`);
      console.log(
        `Current teams: ${Array.from(lobby.teamNames.entries())
          .map(([id, name]) => `${id}:${name}`)
          .join(", ")}`,
      );

      io.to(lobbyId).emit(
        "teamNamesUpdated",
        Array.from(lobby.teamNames.entries()),
      );

      // Start the game if we have 2 teams and admin mode is off
      if (!lobby.rules.admin && lobby.teamNames.size === 2) {
        console.log(`Auto-starting game for lobby ${lobbyId} with 2 teams`);
        startGame(lobbyId);
      }
    }
  });

  socket.on("admin.start", (lobbyId: string) => {
    startGame(lobbyId);
  });

  socket.on("getLobbyGameCategory", (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      // Get the game type from the lobby rules
      const gameType = lobby.rules.gameName;
      io.to(socket.id).emit("lobbyGameCategory", getGameCategory(gameType));
    } else {
      io.to(socket.id).emit("lobbyNotFound");
    }
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
          const splatoonLobby = lobby as SplatoonLobby;

          // Add round number to pick
          splatoonLobby.pickedMaps.push({
            map,
            teamName,
            roundNumber: splatoonLobby.rules.roundNumber,
          });

          // Generate appropriate message
          const activeMode = splatoonLobby.pickedMode?.mode;
          const translatedMode = activeMode
            ? Splatoon.modeTranslations[activeMode]
            : "unknown";
          stateMessage = `${teamName} выбрали карту ${map} (${translatedMode})`;

          // Round complete - disable all controls and enable winner reporting
          io.to(lobbyId).emit("canWorkUpdated", false);
          io.to(lobbyId).emit("canBan", false);
          io.to(lobbyId).emit("canPick", false);
          io.to(lobbyId).emit("canModeBan", false);
          io.to(lobbyId).emit("canModePick", false);
          io.to(lobbyId).emit("canReportWinner", true);
        }

        lobby.gameStep++;

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
        // Add round number for Splatoon
        if (getGameCategory(lobby.rules.gameName) === "splatoon") {
          (lobby as SplatoonLobby).bannedMaps.push({
            map,
            teamName,
            roundNumber: (lobby as SplatoonLobby).rules.roundNumber,
          });
          // Add game state message for Splatoon map bans
          io.to(lobbyId).emit("gameStateUpdated", `${teamName} забанили карту ${map}`);
        } else {
          lobby.bannedMaps.push({ map, teamName });
        }

        lobby.gameStep++;

        // Emit bannedUpdated to all clients, including observers
        io.to(lobbyId).emit("bannedUpdated", lobby.bannedMaps);

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

        // Handle Splatoon specific ban logic
        if (getGameCategory(lobby.rules.gameName) === "splatoon") {
          const splatoonLobby = lobby as SplatoonLobby;

          // First round has different rules than subsequent rounds
          if (splatoonLobby.rules.roundNumber === 1) {
            // First round rule: Team 1 bans 2, Team 2 bans 3, Team 1 picks
            // Check if Team 1 (coinFlip team) has completed their 2 bans
            const isCoinFlipTeam = splatoonLobby.rules.coinFlip
              ? teamName === Array.from(lobby.teamNames.values())[0]
              : teamName === Array.from(lobby.teamNames.values())[1];

            const coinFlipTeamBans = splatoonLobby.bannedMaps
              .filter(
                (ban) => ban.roundNumber === splatoonLobby.rules.roundNumber,
              )
              .filter((ban) => {
                const banTeam = ban.teamName;
                return splatoonLobby.rules.coinFlip
                  ? banTeam === Array.from(lobby.teamNames.values())[0]
                  : banTeam === Array.from(lobby.teamNames.values())[1];
              });

            if (isCoinFlipTeam && coinFlipTeamBans.length < 2) {
              // Team 1 (with coinFlip advantage) still needs to ban more
              io.to(socket.id).emit("canWorkUpdated", true);
              io.to(socket.id).emit("canBan", true);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                `${teamName} выбирают карту для бана (${coinFlipTeamBans.length + 1}/2)`,
              );
            } else if (!isCoinFlipTeam && coinFlipTeamBans.length >= 2) {
              // Team 2 can now ban
              const team2Bans = splatoonLobby.bannedMaps
                .filter(
                  (ban) => ban.roundNumber === splatoonLobby.rules.roundNumber,
                )
                .filter((ban) => ban.teamName === teamName);

              if (team2Bans.length < 3) {
                // Team 2 still needs to ban more
                io.to(socket.id).emit("canWorkUpdated", true);
                io.to(socket.id).emit("canBan", true);
                io.to(lobbyId).emit(
                  "gameStateUpdated",
                  `${teamName} выбирают карту для бана (${team2Bans.length + 1}/3)`,
                );
              } else {
                // Team 2 has finished banning, Team 1 now picks
                const team1 = splatoonLobby.rules.coinFlip
                  ? Array.from(lobby.teamNames.values())[0]
                  : Array.from(lobby.teamNames.values())[1];
                const team1SocketId = splatoonLobby.rules.coinFlip
                  ? Array.from(lobby.teamNames.keys())[0]
                  : Array.from(lobby.teamNames.keys())[1];

                // Disable Team 2's controls
                io.to(socket.id).emit("canWorkUpdated", false);
                io.to(socket.id).emit("canBan", false);

                // Enable Team 1's controls
                io.to(team1SocketId).emit("canWorkUpdated", true);
                io.to(team1SocketId).emit("canPick", true);
                io.to(lobbyId).emit(
                  "gameStateUpdated",
                  `${team1} выбирают карту для игры`,
                );
              }
            } else if (!isCoinFlipTeam && coinFlipTeamBans.length < 2) {
              // Team 2's turn but Team 1 hasn't finished their bans yet
              io.to(socket.id).emit("canWorkUpdated", false);
              io.to(socket.id).emit("canBan", false);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                `Ожидание, пока ${Array.from(lobby.teamNames.values())[splatoonLobby.rules.coinFlip ? 0 : 1]} завершат свои баны`,
              );
            } else if (isCoinFlipTeam && coinFlipTeamBans.length >= 2) {
              // Team 1 has finished their 2 bans, enable Team 2 to ban
              let team2SocketId = "";
              let team2Name = "";
              for (const [socketId, teamName] of lobby.teamNames.entries()) {
                if (
                  (splatoonLobby.rules.coinFlip &&
                    socketId !== Array.from(lobby.teamNames.keys())[0]) ||
                  (!splatoonLobby.rules.coinFlip &&
                    socketId !== Array.from(lobby.teamNames.keys())[1])
                ) {
                  team2SocketId = socketId;
                  team2Name = teamName;
                  break;
                }
              }

              // Disable Team 1's controls
              io.to(socket.id).emit("canWorkUpdated", false);
              io.to(socket.id).emit("canBan", false);

              // Enable Team 2's controls
              io.to(team2SocketId).emit("canWorkUpdated", true);
              io.to(team2SocketId).emit("canBan", true);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                `${team2Name} выбирают карту для бана (1/3)`,
              );
            }
          } else {
            // Subsequent rounds rule: Winning team bans 3, Losing team picks
            const isWinningTeam = teamName === splatoonLobby.rules.lastWinner;

            if (isWinningTeam) {
              // Winning team banning
              const winningTeamBans = splatoonLobby.bannedMaps
                .filter(
                  (ban) => ban.roundNumber === splatoonLobby.rules.roundNumber,
                )
                .filter((ban) => ban.teamName === teamName);

              if (winningTeamBans.length < 3) {
                // Winning team still needs to ban more
                io.to(socket.id).emit("canWorkUpdated", true);
                io.to(socket.id).emit("canBan", true);
                io.to(lobbyId).emit(
                  "gameStateUpdated",
                  `${teamName} выбирают карту для бана (${winningTeamBans.length + 1}/3)`,
                );
              } else {
                // Winning team has finished banning, losing team now picks
                let losingTeam = "";
                let losingSocketId = "";
                for (const [socketId, team] of lobby.teamNames.entries()) {
                  if (team !== teamName) {
                    losingTeam = team;
                    losingSocketId = socketId;
                    break;
                  }
                }

                // Disable winning team's controls
                io.to(socket.id).emit("canWorkUpdated", false);
                io.to(socket.id).emit("canBan", false);

                // Enable losing team's controls
                io.to(losingSocketId).emit("canWorkUpdated", true);
                io.to(losingSocketId).emit("canPick", true);
                io.to(lobbyId).emit(
                  "gameStateUpdated",
                  `${losingTeam} выбирают карту для игры`,
                );
              }
            }
          }
        }
        // FPS game logic (unchanged)
        else if (
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
        if (getGameCategory(lobby.rules.gameName) === "splatoon") {
          const splatoonLobby = lobby as SplatoonLobby;
          // Send all relevant data for Splatoon lobbies
          io.to(observer).emit("bannedUpdated", splatoonLobby.bannedMaps);
          io.to(observer).emit("pickedUpdated", splatoonLobby.pickedMaps);
          io.to(observer).emit("modesUpdated", {
            banned: splatoonLobby.bannedModes,
            active: splatoonLobby.rules.activeModes,
          });
          if (splatoonLobby.pickedMode) {
            io.to(observer).emit("modePicked", {
              mode: splatoonLobby.pickedMode.mode,
              teamName: splatoonLobby.pickedMode.teamName,
              translatedMode: Splatoon.modeTranslations[splatoonLobby.pickedMode.mode],
            });
          }
        } else {
          // Handle FPS lobbies as before
          io.to(observer).emit("bannedUpdated", lobby.bannedMaps);
          io.to(observer).emit("pickedUpdated", lobby.pickedMaps);
        }
      });
    }
  });

  socket.on("admin.editCardColors", (newCardColors?) => {
    cardColors = newCardColors || defaultCardColors;
    console.log("Card colors updated:", cardColors);
    io.emit("cardColorsUpdated", cardColors);
  });

  // Track OBS views

  socket.on("joinObsView", () => {
    console.log("OBS view joined:", socket.id);
    socket.join("obs_views");
  });

  socket.on("admin.setObsLobby", (lobbyId: string) => {
    console.log("Setting OBS lobby:", lobbyId);
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      // Broadcast to all OBS views using the room
      io.to("obs_views").emit("admin.setObsLobby", lobbyId);
      
      // Send current game state data
      if (getGameCategory(lobby.rules.gameName) === "splatoon") {
        const splatoonLobby = lobby as SplatoonLobby;
        // Send all relevant data for Splatoon lobbies
        io.to("obs_views").emit("bannedUpdated", splatoonLobby.bannedMaps);
        io.to("obs_views").emit("pickedUpdated", splatoonLobby.pickedMaps);
        io.to("obs_views").emit("modesUpdated", {
          banned: splatoonLobby.bannedModes,
          active: splatoonLobby.rules.activeModes,
        });
        if (splatoonLobby.pickedMode) {
          io.to("obs_views").emit("modePicked", {
            mode: splatoonLobby.pickedMode.mode,
            teamName: splatoonLobby.pickedMode.teamName,
            translatedMode: Splatoon.modeTranslations[splatoonLobby.pickedMode.mode],
          });
        }
      } else {
        // Handle FPS lobbies as before
        io.to("obs_views").emit("bannedUpdated", lobby.bannedMaps);
        io.to("obs_views").emit("pickedUpdated", lobby.pickedMaps);
      }
    }
  });

  socket.on(
    "lobby.modeBan",
    (data: { lobbyId: string; mode: Splatoon.GameMode; teamName: string }) => {
      const { lobbyId, mode, teamName } = data;
      const lobby = lobbies.get(lobbyId) as SplatoonLobby;

      if (lobby && getGameCategory(lobby.rules.gameName) === "splatoon") {
        console.log(`Lobby ${lobbyId}: ${teamName} banning mode ${mode}`);

        // Add the mode to the banned modes list
        lobby.bannedModes.push({ mode, teamName });

        // Remove the mode from active modes
        const modeIndex = lobby.rules.activeModes.indexOf(mode);
        if (modeIndex !== -1) {
          lobby.rules.activeModes.splice(modeIndex, 1);
        }

        // Increment game step
        lobby.gameStep++;

        // Broadcast the state update
        const translatedMode = Splatoon.modeTranslations[mode] || mode;
        io.to(lobbyId).emit(
          "gameStateUpdated",
          `${teamName} забанили режим ${translatedMode}`,
        );

        // Determine next action
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

        console.log(`Other team is ${otherName} (${otherSocketId})`);

        // Disable current team's controls
        io.to(socket.id).emit("canWorkUpdated", false);
        io.to(socket.id).emit("canModeBan", false);
        io.to(socket.id).emit("canModePick", false);

        // For subsequent rounds, after priority player bans, non-priority player picks
        if (lobby.rules.roundNumber > 1) {
          // If this was the priority player's ban
          if (teamName === lobby.rules.lastWinner) {
            // Enable mode picking for the non-priority player
            console.log(`Enabling mode pick for ${otherName}`);
            io.to(otherSocketId).emit("canWorkUpdated", true);
            io.to(otherSocketId).emit("canModePick", true);
            io.to(otherSocketId).emit("canModeBan", false);
            io.to(lobbyId).emit(
              "gameStateUpdated",
              `${otherName} выбирают режим для игры`,
            );
          }
        } else {
          // First round logic
          if (lobby.bannedModes.length === 2) {
            // The team that banned first (has priority) gets to pick
            const firstBanTeam = lobby.bannedModes[0].teamName;
            if (firstBanTeam === teamName) {
              // If we were the first team to ban, we get to pick
              console.log(`Enabling mode pick for ${teamName}`);
              io.to(socket.id).emit("canWorkUpdated", true);
              io.to(socket.id).emit("canModePick", true);
              io.to(socket.id).emit("canModeBan", false);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                `${teamName} выбирают режим для игры`,
              );
            } else {
              // If we weren't the first team to ban, the other team gets to pick
              console.log(`Enabling mode pick for ${otherName}`);
              io.to(socket.id).emit("canWorkUpdated", false);
              io.to(socket.id).emit("canModeBan", false);
              io.to(otherSocketId).emit("canWorkUpdated", true);
              io.to(otherSocketId).emit("canModePick", true);
              io.to(otherSocketId).emit("canModeBan", false);
              io.to(lobbyId).emit(
                "gameStateUpdated",
                `${otherName} выбирают режим для игры`,
              );
            }
          } else {
            // Next team's turn to ban a mode
            console.log(`Enabling mode ban for ${otherName}`);

            // Make sure both events are sent separately and explicitly
            io.to(otherSocketId).emit("canWorkUpdated", true);
            io.to(otherSocketId).emit("canModeBan", true);
            io.to(otherSocketId).emit("canModePick", false);

            // Disable current team's controls
            io.to(socket.id).emit("canWorkUpdated", false);
            io.to(socket.id).emit("canModeBan", false);

            io.to(lobbyId).emit(
              "gameStateUpdated",
              `${otherName} выбирают режим для бана`,
            );
          }
        }

        // Broadcast updated modes to all clients
        io.to(lobbyId).emit("modesUpdated", {
          banned: lobby.bannedModes,
          active: lobby.rules.activeModes,
        });
      }
    },
  );

  socket.on(
    "lobby.modePick",
    (data: { lobbyId: string; mode: Splatoon.GameMode; teamName: string }) => {
      const { lobbyId, mode, teamName } = data;
      const lobby = lobbies.get(lobbyId) as SplatoonLobby;

      if (lobby && getGameCategory(lobby.rules.gameName) === "splatoon") {
        // Set the active mode
        lobby.pickedMode = { mode, teamName };

        // Increment game step
        lobby.gameStep++;

        // Update the active maps for the selected mode
        lobby.rules.mapNames = mapPool.splatoon[mode];

        // Broadcast the picked mode
        const translatedMode = Splatoon.modeTranslations[mode] || mode;
        io.to(lobbyId).emit(
          "gameStateUpdated",
          `${teamName} выбрали режим ${translatedMode}`,
        );

        // Disable all controls first
        io.to(lobbyId).emit("canWorkUpdated", false);
        io.to(lobbyId).emit("canModeBan", false);
        io.to(lobbyId).emit("canModePick", false);
        io.to(lobbyId).emit("canBan", false);
        io.to(lobbyId).emit("canPick", false);

        // For subsequent rounds, the winning team gets to ban maps first
        if (lobby.rules.roundNumber > 1) {
          // Find the winning team's socket ID
          let winningTeamSocketId = "";
          let winningTeamName = "";
          for (const [socketId, team] of lobby.teamNames.entries()) {
            if (team === lobby.rules.lastWinner) {
              winningTeamSocketId = socketId;
              winningTeamName = team;
              break;
            }
          }

          // Enable map banning for the winning team
          io.to(winningTeamSocketId).emit("canWorkUpdated", true);
          io.to(winningTeamSocketId).emit("canBan", true);
          io.to(lobbyId).emit(
            "gameStateUpdated",
            `${winningTeamName} выбирают карту для бана`,
          );
        } else {
          // First round logic remains the same
          // Move to map selection phase
          startMapSelectionPhase(lobbyId);
        }

        // Broadcast updated mode to all clients
        io.to(lobbyId).emit("modePicked", {
          mode,
          teamName,
          translatedMode: Splatoon.modeTranslations[mode],
        });
      }
    },
  );

  // Helper function to start map selection phase for Splatoon
  function startMapSelectionPhase(lobbyId: string) {
    const lobby = lobbies.get(lobbyId) as SplatoonLobby;

    if (lobby && getGameCategory(lobby.rules.gameName) === "splatoon") {
      // Reset game step to start map selection phase
      lobby.gameStep = 0;

      // Determine who starts the map ban phase based on round
      let mapBanTeam = "";
      let mapBanSocketId = "";

      if (lobby.rules.roundNumber === 1) {
        // In first round, the team with coin flip advantage starts map bans
        for (const [socketId, teamName] of lobby.teamNames.entries()) {
          if (
            (lobby.rules.coinFlip && !mapBanTeam) ||
            (!lobby.rules.coinFlip && mapBanTeam)
          ) {
            mapBanTeam = teamName;
            mapBanSocketId = socketId;
            break;
          } else {
            mapBanTeam = teamName;
            mapBanSocketId = socketId;
          }
        }
      } else {
        // In subsequent rounds, the winning team starts map bans
        for (const [socketId, teamName] of lobby.teamNames.entries()) {
          if (teamName === lobby.rules.lastWinner) {
            mapBanTeam = teamName;
            mapBanSocketId = socketId;
            break;
          }
        }
      }

      // Update UI states
      io.to(lobbyId).emit("canWorkUpdated", false);
      io.to(mapBanSocketId).emit("canWorkUpdated", true);
      io.to(mapBanSocketId).emit("canBan", true);

      // Determine the ban count based on round number and team
      let banCount = 0;
      let totalBans = 0;
      
      if (lobby.rules.roundNumber === 1) {
        // First round: Team 1 bans 2, Team 2 bans 3
        const isCoinFlipTeam = lobby.rules.coinFlip
          ? mapBanTeam === Array.from(lobby.teamNames.values())[0]
          : mapBanTeam === Array.from(lobby.teamNames.values())[1];
          
        if (isCoinFlipTeam) {
          banCount = 1;
          totalBans = 2;
        } else {
          banCount = 1;
          totalBans = 3;
        }
      } else {
        // Subsequent rounds: Winner bans 3
        banCount = 1;
        totalBans = 3;
      }

      io.to(lobbyId).emit(
        "gameStateUpdated",
        `${mapBanTeam} выбирают карту для бана (${banCount}/${totalBans})`,
      );

      // Send available maps to clients
      io.to(lobbyId).emit("availableMaps", lobby.rules.mapNames);
    }
  }

  socket.on(
    "lobby.reportWinner",
    (data: { lobbyId: string; winnerTeam: string }) => {
      const { lobbyId} = data;
      const lobby = lobbies.get(lobbyId);

      if (lobby && getGameCategory(lobby.rules.gameName) === "splatoon") {
        // Start the next round with the reported winner
        SplatoonStartNextRound(lobbyId, lobbies as Map<string, SplatoonLobby>);

        // Send updated modes to clients
        io.to(lobbyId).emit("modesUpdated", {
          banned: (lobby as SplatoonLobby).bannedModes,
          active: (lobby as SplatoonLobby).rules.activeModes,
        });
      }
    },
  );

  socket.on(
    "lobby.proposeWinner",
    (data: { lobbyId: string; winnerTeam: string; reportingTeam: string }) => {
      const { lobbyId, winnerTeam, reportingTeam } = data;

      // Broadcast the winner proposal to all clients
      io.to(lobbyId).emit("winnerProposed", {
        winnerTeam,
        reportingTeam,
      });
    },
  );

  socket.on(
    "lobby.confirmWinner",
    (data: {
      lobbyId: string;
      winnerTeam: string;
      confirmed: boolean;
      confirmingTeam: string;
    }) => {
      const { lobbyId, winnerTeam, confirmed, confirmingTeam } = data;
      const lobby = lobbies.get(lobbyId);

      if (lobby && getGameCategory(lobby.rules.gameName) === "splatoon") {
        if (confirmed) {
          // Store current round history before starting next round
          const splatoonLobby = lobby as SplatoonLobby;
          if (!splatoonLobby.roundHistory) {
            splatoonLobby.roundHistory = [];
          }

          // Add current round to history
          splatoonLobby.roundHistory.push({
            roundNumber: splatoonLobby.rules.roundNumber,
            pickedMaps: [...splatoonLobby.pickedMaps],
            pickedMode: splatoonLobby.pickedMode,
          });

          // Set the winner for the next round
          splatoonLobby.rules.lastWinner = winnerTeam;

          // Start the next round with the confirmed winner
          SplatoonStartNextRound(lobbyId, lobbies as Map<string, SplatoonLobby>);

          // Emit winner confirmation event to all players
          io.to(lobbyId).emit("winnerConfirmed", { winnerTeam });

          // Send updated modes to clients
          io.to(lobbyId).emit("modesUpdated", {
            banned: (lobby as SplatoonLobby).bannedModes,
            active: (lobby as SplatoonLobby).rules.activeModes,
          });
        } else {
          // If winner was not confirmed, notify only the rejecting team
          let rejectingSocketId = "";
          for (const [socketId, teamName] of lobby.teamNames.entries()) {
            if (teamName === confirmingTeam) {
              rejectingSocketId = socketId;
              break;
            }
          }

          // Enable winner reporting only for the rejecting team
          io.to(rejectingSocketId).emit("canReportWinner", true);
          io.to(lobbyId).emit("winnerRejected", {
            rejectingTeam: confirmingTeam,
          });
          io.to(lobbyId).emit(
            "gameStateUpdated",
            `${confirmingTeam} отклонили победителя. Ожидание нового выбора.`,
          );
        }
      }
    },
  );

  socket.on("winnerReported", ({ lobbyId, winnerTeam }) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      // Store the winner for the next round
      if ('lastWinner' in lobby.rules) {
        lobby.rules.lastWinner = winnerTeam;
      }

      // Check if the game is over
      if (lobby.pickedMaps.length >= getMaxRounds(lobby.rules.gameType)) {
        // Game is over, handle game end
        handleGameEnd(lobbyId, lobbies);
      } else {
        // Start the next round
        SplatoonStartNextRound(lobbyId, lobbies as Map<string, SplatoonLobby>);
      }
    }
  });

  socket.on("winnerConfirmed", ({ lobbyId, confirmed }) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby) {
      if (confirmed) {
        // Store current round history before starting next round
        const splatoonLobby = lobby as SplatoonLobby;
        if (!splatoonLobby.roundHistory) {
          splatoonLobby.roundHistory = [];
        }
        splatoonLobby.roundHistory.push({
          roundNumber: splatoonLobby.rules.roundNumber,
          pickedMaps: [...splatoonLobby.pickedMaps],
          pickedMode: splatoonLobby.pickedMode,
        });

        // Start the next round with the confirmed winner
        SplatoonStartNextRound(lobbyId, lobbies as Map<string, SplatoonLobby>);

        // Send updated modes to clients
        io.to(lobbyId).emit("modesUpdated", {
          banned: (lobby as SplatoonLobby).bannedModes,
          active: (lobby as SplatoonLobby).rules.activeModes,
        });
      } else {
        // If not confirmed, reset the winner and enable controls for both teams
        if ('lastWinner' in lobby.rules) {
          lobby.rules.lastWinner = undefined;
        }
        io.to(lobbyId).emit("canWorkUpdated", true);
        io.to(lobbyId).emit("canModeBan", true);
        io.to(lobbyId).emit("canModePick", true);
        io.to(lobbyId).emit("canBan", true);
        io.to(lobbyId).emit("canPick", true);
        io.to(lobbyId).emit(
          "gameStateUpdated",
          "Победитель не подтвержден. Выберите победителя снова.",
        );
      }
    }
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

function handleGameEnd(lobbyId: string, lobbies: Map<string, Lobby>) {
  const lobby = lobbies.get(lobbyId);
  if (lobby) {
    // Calculate final score
    const team1Score = lobby.pickedMaps.filter(
      (pick) => pick.teamName === Array.from(lobby.teamNames.values())[0],
    ).length;
    const team2Score = lobby.pickedMaps.filter(
      (pick) => pick.teamName === Array.from(lobby.teamNames.values())[1],
    ).length;

    // Determine winner
    const winnerTeam =
      team1Score > team2Score
        ? Array.from(lobby.teamNames.values())[0]
        : Array.from(lobby.teamNames.values())[1];

    // Store the winner for the next round
    if ('lastWinner' in lobby.rules) {
      lobby.rules.lastWinner = winnerTeam;
    }

    // Start the next round
    SplatoonStartNextRound(lobbyId, lobbies as Map<string, SplatoonLobby>);
  }
}

// Helper function to get max rounds based on game type
function getMaxRounds(gameType: string): number {
  return gameType === "bo3" ? 3 : 5;
}
