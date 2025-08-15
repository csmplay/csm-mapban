// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

import { BaseLobby } from "../utils/types";
import { io } from "../utils/server";
import { getGameCategory } from "../index";

export type GameName = "splatoon";
export type GameType = "bo3" | "preview";
export type GameMode = "clam" | "rainmaker" | "tower" | "zones";

// Splatoon specific lobby interface
export interface Lobby extends BaseLobby {
  rules: BaseLobby["rules"] & {
    gameName: GameName;
    gameType: GameType; // Splatoon supports both BO3 and preview
    mapPoolSize: 32; // Map pool size (8 maps * 4 modes)
    modesRulesList: string[]; // Current modes pick/ban rules
    mapRulesList: string[]; // Current maps pick/ban rules
    activeModes: Array<GameMode>; // Available modes after bans
    roundNumber: number; // Current round number (1, 2, 3, etc.)
    lastWinner?: string; // Team name of the last winner
    coinFlip: boolean;
    admin: boolean;
    mapNames: string[];
    modesSize: number; // 2 or 4 modes
  };
  bannedModes: Array<{
    mode: GameMode;
    teamName: string;
    translatedMode: string;
  }>; // Array of banned modes
  pickedMode?: { mode: GameMode; teamName: string; translatedMode: string }; // Selected mode
  pickedMaps: Array<{ map: string; teamName: string; roundNumber?: number }>; // Array of picked maps
  bannedMaps: Array<{ map: string; teamName: string; roundNumber?: number }>; // Array of banned maps
  priorityTeam?: string; // Team name that has priority (won coin flip or is first team)
  roundHistory?: {
    roundNumber: number;
    pickedMaps: Array<{ map: string; teamName: string; roundNumber?: number }>;
    pickedMode?: { mode: GameMode; teamName: string; translatedMode: string };
  }[];
}

// Alias for SplatoonLobby to match the interface
export type SplatoonLobby = Lobby;

// Modes ban rules - different for 2 and 4 modes
export const modesRulesLists = {
  bo3: {
    first: {
      2: ["mode_pick"], // 2 modes: priority team picks directly
      4: ["mode_ban", "mode_ban", "mode_pick"], // 4 modes: first round
    },
    subsequent: {
      2: ["mode_pick"], // 2 modes: losing team picks
      4: ["mode_ban", "mode_pick"], // 4 modes: subsequent rounds
    },
  },
  preview: {
    first: {
      2: ["mode_pick"], // 2 modes: priority team picks directly
      4: ["mode_ban", "mode_pick"], // 4 modes: first round
    },
    subsequent: {
      2: ["mode_pick"], // 2 modes: losing team picks
      4: ["mode_ban", "mode_pick"], // 4 modes: subsequent rounds
    },
  },
};

// Maps ban rules - different for 2 and 4 modes
export const mapRulesLists = {
  bo3: {
    first: {
      2: ["ban", "ban", "ban", "ban", "ban", "pick"], // 2 modes: priority bans 2, other bans 3, priority picks
      4: ["ban", "ban", "ban", "ban", "ban", "pick"], // 4 modes: first round (2 + 3 + 1 pick)
    },
    subsequent: {
      2: ["ban", "ban", "ban", "ban", "ban", "pick"], // 2 modes: winner bans 2, loser bans 3, winner picks
      4: ["ban", "ban", "ban", "pick"], // 4 modes: subsequent rounds (3 + 1 pick)
    },
  },
  preview: {
    first: {
      2: ["ban", "ban", "ban", "ban", "ban", "pick"], // 2 modes: priority bans 2, other bans 3, priority picks
      4: ["ban", "pick", "decider"], // 4 modes: first round (2 + 1 pick + 2 decider)
    },
    subsequent: {
      2: ["ban", "ban", "ban", "ban", "ban", "pick"], // 2 modes: winner bans 2, loser bans 3, winner picks
      4: ["ban", "ban", "ban", "pick"], // 4 modes: subsequent rounds (3 + 1 pick)
    },
  },
};

// Splatoon map lists
export const startMapPool = {
  clam: [
    // устробол
    'Академия "Лепота"',
    "Палтус-карго",
    "Роборамэн",
    'Галерея "Де Берикс"',
    "Тухловодск",
    "Опаленное ущелье",
    'Рынок "Свисторыб"',
    "Вокзал Лемурия",
  ],
  rainmaker: [
    // мегакарп
    'Рынок "Свисторыб"',
    "Крабхеттен",
    "Приливослив",
    "УсоногТорг",
    'Велозал "9-й вал"',
    "Опаленное ущелье",
    'Галерея "Де Берикс"',
    "Вокзал Лемурия",
  ],
  tower: [
    // башня
    "Приливослив",
    "Горбуша-маркет",
    "Манта-Мария",
    'Академия "Лепота"',
    "Аэропорт Пенково",
    "Вокзал Лемурия",
    "Палтус-карго",
    "Угрево-Скатово",
  ],
  zones: [
    // зоны
    "Роборамэн",
    'Велозал "9-й вал"',
    "УсоногТорг",
    'Микрорайон "Камбалово"',
    "Горбуша-маркет",
    "Рыбожирные руины",
    "Манта-Мария",
    "Осетровые верфи",
  ],
};

// Available game modes
export const gameModes: GameMode[] = ["clam", "rainmaker", "tower", "zones"];

// Mode name translations
export const modeTranslations = {
  clam: "Устробол",
  rainmaker: "Мегакарп",
  tower: "Бой за башню",
  zones: "Бой за зоны",
};

// Game rules configuration
interface GameStep {
  action: "ban" | "pick" | "decider";
  count: number;
  team: "priority" | "non-priority" | "winner" | "loser";
}

interface GamePhase {
  steps: GameStep[];
  rules: string[];
}

interface GameRound {
  modes: GamePhase;
  maps: GamePhase;
}

interface GameTypeRules {
  first: GameRound;
  subsequent: GameRound;
}

export const gameRules: Record<GameType, GameTypeRules> = {
  bo3: {
    first: {
      modes: {
        steps: [
          { action: "ban", count: 1, team: "priority" },
          { action: "ban", count: 1, team: "non-priority" },
          { action: "pick", count: 1, team: "priority" },
        ],
        rules: ["mode_ban", "mode_ban", "mode_pick"],
      },
      maps: {
        steps: [
          { action: "ban", count: 2, team: "priority" },
          { action: "ban", count: 3, team: "non-priority" },
          { action: "pick", count: 1, team: "priority" },
        ],
        rules: ["ban", "ban", "ban", "ban", "ban", "pick"],
      },
    },
    subsequent: {
      modes: {
        steps: [
          { action: "ban", count: 1, team: "winner" },
          { action: "pick", count: 1, team: "loser" },
        ],
        rules: ["mode_ban", "mode_pick"],
      },
      maps: {
        steps: [
          { action: "ban", count: 3, team: "winner" },
          { action: "pick", count: 1, team: "loser" },
        ],
        rules: ["ban", "ban", "ban", "pick"],
      },
    },
  },
  preview: {
    first: {
      modes: {
        steps: [
          { action: "ban", count: 1, team: "priority" },
          { action: "pick", count: 1, team: "priority" },
        ],
        rules: ["mode_ban", "mode_pick"],
      },
      maps: {
        steps: [
          { action: "ban", count: 2, team: "priority" },
          { action: "pick", count: 1, team: "priority" },
          { action: "decider", count: 2, team: "priority" },
        ],
        rules: ["ban", "pick", "decider"],
      },
    },
    subsequent: {
      modes: {
        steps: [
          { action: "ban", count: 1, team: "winner" },
          { action: "pick", count: 1, team: "loser" },
        ],
        rules: ["mode_ban", "mode_pick"],
      },
      maps: {
        steps: [
          { action: "ban", count: 3, team: "winner" },
          { action: "pick", count: 1, team: "loser" },
        ],
        rules: ["ban", "ban", "ban", "pick"],
      },
    },
  },
};

// function getPriorityTeam(lobby: Lobby): { name: string; socketId: string } {
//   const firstTeam = Array.from(lobby.teamNames.values())[0];
//   const firstSocketId = Array.from(lobby.teamNames.keys())[0];
//   return { name: firstTeam, socketId: firstSocketId };
// }

// function disableAllControls(lobbyId: string) {
//   io.to(lobbyId).emit("canWorkUpdated", false);
//   io.to(lobbyId).emit("canBan", false);
//   io.to(lobbyId).emit("canPick", false);
//   io.to(lobbyId).emit("canModeBan", false);
//   io.to(lobbyId).emit("canModePick", false);
// }

// function enableControls(socketId: string, controls: { canWork?: boolean; canBan?: boolean; canPick?: boolean; canModeBan?: boolean; canModePick?: boolean }) {
//   if (controls.canWork) io.to(socketId).emit("canWorkUpdated", true);
//   if (controls.canBan) io.to(socketId).emit("canBan", true);
//   if (controls.canPick) io.to(socketId).emit("canPick", true);
//   if (controls.canModeBan) io.to(socketId).emit("canModeBan", true);
//   if (controls.canModePick) io.to(socketId).emit("canModePick", true);
// }

// Main game functions
export function startGame(lobbyId: string, lobbies: Map<string, Lobby>) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  console.log(`Starting Splatoon game in lobby ${lobbyId} with ${lobby.rules.modesSize} modes`);

  // Initialize game state
  lobby.rules.roundNumber = 1;
  lobby.rules.activeModes = [...gameModes];
  lobby.bannedModes = [];
  lobby.gameStep = 0;

  // Set rules for first round based on modesSize
  const rules = gameRules[lobby.rules.gameType].first;
  lobby.rules.modesRulesList = modesRulesLists[lobby.rules.gameType].first[lobby.rules.modesSize as 2 | 4];
  lobby.rules.mapRulesList = mapRulesLists[lobby.rules.gameType].first[lobby.rules.modesSize as 2 | 4];

  // Emit startWithoutCoin to hide the team name overlay
  io.to(lobbyId).emit("startWithoutCoin");
  io.to(lobbyId).emit("isCoin", lobby.rules.coinFlip);

  if (lobby.rules.coinFlip) {
    if (lobby.teamNames.size === 2) {
      const result =
        Math.floor(Math.random() * 2) ^
        Date.now() % 2 ^
        (Math.random() > 0.5 ? 1 : 0);
      io.to(lobbyId).emit("coinFlip", result);

      console.log(`Coin flip result: ${result} (0 = first team, 1 = second team)`);

      // Wait for coin flip animation to complete
      setTimeout(() => {
        const entry = Array.from(lobby.teamNames.entries())[result] as [
          string,
          string,
        ];

        // Set the priority team
        lobby.priorityTeam = entry[1];
        console.log(`Priority team set to: ${entry[1]} (socket: ${entry[0]})`);

        // Disable all controls first
        io.to(lobbyId).emit("canWorkUpdated", false);
        io.to(lobbyId).emit("canModeBan", false);
        io.to(lobbyId).emit("canModePick", false);
        io.to(lobbyId).emit("canBan", false);
        io.to(lobbyId).emit("canPick", false);

        // Enable controls based on modesSize
        if (lobby.rules.modesSize === 2) {
          // For 2 modes: priority team picks mode directly
          io.to(entry[0]).emit("canWorkUpdated", true);
          io.to(entry[0]).emit("canModePick", true);
          
          console.log(`Enabled mode pick for priority team: ${entry[1]}`);
          
          io.to(lobbyId).emit(
            "gameStateUpdated",
            `${entry[1]} выбирают режим для игры`,
          );
        } else {
          // For 4 modes: priority team bans mode first
          io.to(entry[0]).emit("canWorkUpdated", true);
          io.to(entry[0]).emit("canModeBan", true);

          console.log(`Enabled mode ban for priority team: ${entry[1]}`);

          io.to(lobbyId).emit(
            "gameStateUpdated",
            `${entry[1]} выбирают режим для бана`,
          );
        }

        // Send available modes to clients
        io.to(lobbyId).emit("modesUpdated", {
          banned: lobby.bannedModes,
          active: lobby.rules.activeModes,
          modesSize: lobby.rules.modesSize,
        });
      }, 3000); // Wait for 3 seconds (coin flip animation duration)
    }
  } else {
    // If no coin flip, enable controls for all teams
    for (const [socketId] of lobby.teamNames.entries()) {
      io.to(socketId).emit("canWorkUpdated", true);
      if (lobby.rules.modesSize === 2) {
        io.to(socketId).emit("canModePick", true);
      } else {
        io.to(socketId).emit("canModeBan", true);
      }
    }

    // Get the first team from the lobby
    const firstTeam = Array.from(lobby.teamNames.entries())[0];
    if (firstTeam) {
      const firstTeamName = firstTeam[1];
      // Set the priority team (first team when no coin flip)
      lobby.priorityTeam = firstTeamName;
      console.log(`No coin flip: Priority team set to first team: ${firstTeamName}`);
      
      if (lobby.rules.modesSize === 2) {
        io.to(lobbyId).emit(
          "gameStateUpdated",
          `${firstTeamName} выбирают режим для игры`,
        );
      } else {
        io.to(lobbyId).emit(
          "gameStateUpdated",
          `${firstTeamName} выбирают режим для бана`,
        );
      }
    } else {
      if (lobby.rules.modesSize === 2) {
        io.to(lobbyId).emit(
          "gameStateUpdated",
          "Первая команда выбирает режим для игры",
        );
      } else {
        io.to(lobbyId).emit(
          "gameStateUpdated",
          "Первая команда выбирают режим для бана",
        );
      }
    }
  }
}

export function startNextRound(lobbyId: string, lobbies: Map<string, Lobby>) {
  const lobby = lobbies.get(lobbyId) as Lobby;
  if (!lobby) return;

  // Increment round number
  lobby.rules.roundNumber++;

  // Reset all modes and maps
  lobby.rules.activeModes = [...gameModes];
  lobby.bannedModes = [];
  lobby.pickedMode = undefined;
  lobby.pickedMaps = [];
  lobby.bannedMaps = [];

  // Reset game step
  lobby.gameStep = 0;

  // Disable all controls initially
  io.to(lobbyId).emit("canWorkUpdated", false);
  io.to(lobbyId).emit("canModeBan", false);
  io.to(lobbyId).emit("canModePick", false);
  io.to(lobbyId).emit("canBan", false);
  io.to(lobbyId).emit("canPick", false);

  // Get the winning team's socket ID
  let winningTeamSocketId = "";
  let winningTeamName = "";
  for (const [socketId, teamName] of lobby.teamNames.entries()) {
    if (teamName === lobby.rules.lastWinner) {
      winningTeamSocketId = socketId;
      winningTeamName = teamName;
      break;
    }
  }

  // If no last winner found, use first team as fallback
  if (!winningTeamSocketId) {
    const firstTeam = Array.from(lobby.teamNames.entries())[0];
    if (firstTeam) {
      winningTeamSocketId = firstTeam[0];
      winningTeamName = firstTeam[1];
    }
  }

  // Set the priority team for subsequent rounds (winner has priority)
  lobby.priorityTeam = winningTeamName;

  // Set rules for subsequent rounds based on modesSize
  lobby.rules.modesRulesList = modesRulesLists[lobby.rules.gameType].subsequent[lobby.rules.modesSize as 2 | 4];
  lobby.rules.mapRulesList = mapRulesLists[lobby.rules.gameType].subsequent[lobby.rules.modesSize as 2 | 4];

  if (lobby.rules.modesSize === 2) {
    // For 2 modes: losing team picks mode directly
    let losingTeamSocketId = "";
    let losingTeamName = "";
    for (const [socketId, teamName] of lobby.teamNames.entries()) {
      if (teamName !== winningTeamName) {
        losingTeamSocketId = socketId;
        losingTeamName = teamName;
        break;
      }
    }

    io.to(losingTeamSocketId).emit("canWorkUpdated", true);
    io.to(losingTeamSocketId).emit("canModePick", true);

    io.to(lobbyId).emit(
      "gameStateUpdated",
      `${losingTeamName} выбирают режим для игры`,
    );
  } else {
    // For 4 modes: winning team bans mode first
    io.to(winningTeamSocketId).emit("canWorkUpdated", true);
    io.to(winningTeamSocketId).emit("canModeBan", true);

    io.to(lobbyId).emit(
      "gameStateUpdated",
      `${winningTeamName} выбирают режим для бана`,
    );
  }

  // Send updated modes to clients
  io.to(lobbyId).emit("modesUpdated", {
    banned: lobby.bannedModes,
    active: lobby.rules.activeModes,
    modesSize: lobby.rules.modesSize,
  });
}

export function handleModeBan(
  lobbyId: string,
  mode: GameMode,
  teamName: string,
  lobbies: Map<string, Lobby>,
) {
  const lobby = lobbies.get(lobbyId) as Lobby;
  if (!lobby) return;

  // Safety check: mode banning is not used for 2 modes
  if (lobby.rules.modesSize === 2) {
    console.warn("Mode banning called for 2-mode game, this shouldn't happen");
    return;
  }

  // Add the mode to the banned modes list
  lobby.bannedModes.push({
    mode,
    teamName,
    translatedMode: modeTranslations[mode] || mode,
  });

  // Remove the mode from active modes
  const modeIndex = lobby.rules.activeModes.indexOf(mode);
  if (modeIndex !== -1) {
    lobby.rules.activeModes.splice(modeIndex, 1);
  }

  // Increment game step
  lobby.gameStep++;

  // Broadcast the state update
  const translatedMode = modeTranslations[mode] || mode;
  io.to(lobbyId).emit(
    "gameStateUpdated",
    `${teamName} забанили режим ${translatedMode}`,
  );

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

  // Disable all controls first
  io.to(lobbyId).emit("canWorkUpdated", false);
  io.to(lobbyId).emit("canModeBan", false);
  io.to(lobbyId).emit("canModePick", false);
  io.to(lobbyId).emit("canBan", false);
  io.to(lobbyId).emit("canPick", false);

  // Enable mode picking for the winning team
  io.to(winningTeamSocketId).emit("canWorkUpdated", true);
  io.to(winningTeamSocketId).emit("canModePick", true);

  io.to(lobbyId).emit(
    "gameStateUpdated",
    `${winningTeamName} выбирают режим для игры`,
  );

  // Broadcast updated modes to all clients
  io.to(lobbyId).emit("modesUpdated", {
    banned: lobby.bannedModes,
    active: lobby.rules.activeModes,
    picked: lobby.pickedMode,
    modesSize: lobby.rules.modesSize,
  });
}

// Helper function to start map selection phase for Splatoon
export function startMapSelectionPhase(
  lobbyId: string,
  lobbies: Map<string, Lobby>,
  getGameCategory: (gameName: GameName) => string,
) {
  const lobby = lobbies.get(lobbyId) as Lobby;

  if (lobby && getGameCategory(lobby.rules.gameName) === "splatoon") {
    console.log(`Starting map selection phase for lobby ${lobbyId}`);
    console.log(`Round number: ${lobby.rules.roundNumber}`);
    console.log(`Priority team: ${lobby.priorityTeam}`);
    console.log(`Coin flip enabled: ${lobby.rules.coinFlip}`);
    console.log(`Teams: ${Array.from(lobby.teamNames.values()).join(', ')}`);

    // Reset game step to start map selection phase
    lobby.gameStep = 0;

    // Determine who starts the map ban phase based on round and modesSize
    let mapBanTeam = "";
    let mapBanSocketId = "";

    if (lobby.rules.roundNumber === 1) {
      // In first round, use the priority team that was set during startGame
      if (lobby.priorityTeam) {
        mapBanTeam = lobby.priorityTeam;
        // Find the socket ID for the priority team
        for (const [socketId, teamName] of lobby.teamNames.entries()) {
          if (teamName === lobby.priorityTeam) {
            mapBanSocketId = socketId;
            break;
          }
        }
        console.log(`First round: Priority team is ${mapBanTeam} (from lobby.priorityTeam)`);
        console.log(`Map ban team: ${mapBanTeam} (socket: ${mapBanSocketId})`);
      } else {
        // Fallback: use first team if priorityTeam is not set
        const firstTeam = Array.from(lobby.teamNames.entries())[0];
        mapBanTeam = firstTeam[1];
        mapBanSocketId = firstTeam[0];
        console.log(`First round: Fallback to first team ${mapBanTeam} (socket: ${mapBanSocketId})`);
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
      console.log(`Subsequent round: Winner team starts map bans: ${mapBanTeam} (socket: ${mapBanSocketId})`);
    }

    // Update UI states
    io.to(lobbyId).emit("canWorkUpdated", false);
    io.to(mapBanSocketId).emit("canWorkUpdated", true);
    io.to(mapBanSocketId).emit("canBan", true);

    console.log(`Enabled map banning for team: ${mapBanTeam}`);

    // Determine the ban count based on round number, team, and modesSize
    let banCount = 0;
    let totalBans = 0;

    if (lobby.rules.modesSize === 2) {
      // 2 modes: Always priority/winner bans 2, other team bans 3
      if (lobby.rules.roundNumber === 1) {
        // First round: Priority team bans 2
        banCount = 1;
        totalBans = 2;
      } else {
        // Subsequent rounds: Winner bans 2
        banCount = 1;
        totalBans = 2;
      }
    } else {
      // 4 modes: Original logic
      if (lobby.rules.roundNumber === 1) {
        // First round: Priority team bans 2, other team bans 3
        banCount = 1;
        totalBans = 2;
      } else {
        // Subsequent rounds: Winner bans 3
        banCount = 1;
        totalBans = 3;
      }
    }

    console.log(`Ban count: ${banCount}/${totalBans} for ${mapBanTeam}`);

    io.to(lobbyId).emit(
      "gameStateUpdated",
      `${mapBanTeam} выбирают карту для бана (${banCount}/${totalBans})`,
    );

    // Send available maps to clients
    io.to(lobbyId).emit("availableMaps", lobby.rules.mapNames);
  }
}

export function handleModePick(
  lobbyId: string,
  mode: GameMode,
  teamName: string,
  lobbies: Map<string, Lobby>,
) {
  const lobby = lobbies.get(lobbyId) as Lobby;
  if (!lobby) return;

  // Set the picked mode
  lobby.pickedMode = { mode, teamName, translatedMode: modeTranslations[mode] };

  // Increment game step
  lobby.gameStep++;

  // Update the active maps for the selected mode
  lobby.rules.mapNames = startMapPool[mode];

  // Broadcast the picked mode
  const translatedMode = modeTranslations[mode] || mode;
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

  // Move to map selection phase
  startMapSelectionPhase(lobbyId, lobbies, getGameCategory);

  // Broadcast updated mode to all clients
  io.to(lobbyId).emit("modePicked", {
    mode,
    teamName,
    translatedMode: modeTranslations[mode],
  });
}

export function handleMapBan(
  lobbyId: string,
  map: string,
  teamName: string,
  lobbies: Map<string, Lobby>,
) {
  const lobby = lobbies.get(lobbyId) as Lobby;
  if (!lobby) return;

  // Add the map to the banned maps list
  lobby.bannedMaps.push({ map, teamName });

  // Increment game step
  lobby.gameStep++;

  // Broadcast the state update - commented out as it's duplicated in index.ts
  // io.to(lobbyId).emit("gameStateUpdated", `${teamName} забанили карту ${map}`);

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

  // Check if winning team has finished their bans (3 bans)
  const winningTeamBans = lobby.bannedMaps.filter(
    (ban) => ban.teamName === winningTeamName,
  );

  if (winningTeamBans.length < 3) {
    // Winning team still needs to ban more maps
    io.to(lobbyId).emit("canWorkUpdated", false);
    io.to(lobbyId).emit("canBan", false);
    io.to(winningTeamSocketId).emit("canWorkUpdated", true);
    io.to(winningTeamSocketId).emit("canBan", true);

    io.to(lobbyId).emit(
      "gameStateUpdated",
      `${winningTeamName} выбирают карту для бана (${winningTeamBans.length + 1}/3)`,
    );
  } else {
    // Winning team has finished banning, enable map picking for losing team
    let losingTeamSocketId = "";
    let losingTeamName = "";
    for (const [socketId, team] of lobby.teamNames.entries()) {
      if (team !== winningTeamName) {
        losingTeamSocketId = socketId;
        losingTeamName = team;
        break;
      }
    }

    io.to(lobbyId).emit("canWorkUpdated", false);
    io.to(lobbyId).emit("canBan", false);
    io.to(losingTeamSocketId).emit("canWorkUpdated", true);
    io.to(losingTeamSocketId).emit("canPick", true);

    io.to(lobbyId).emit(
      "gameStateUpdated",
      `${losingTeamName} выбирают карту для игры`,
    );
  }

  // Broadcast updated bans to all clients
  io.to(lobbyId).emit("bannedUpdated", lobby.bannedMaps);
}

export function handleMapPick(
  lobbyId: string,
  map: string,
  teamName: string,
  lobbies: Map<string, Lobby>,
) {
  const lobby = lobbies.get(lobbyId) as Lobby;
  if (!lobby) return;

  // Add the map to the picked maps list
  lobby.pickedMaps.push({ map, teamName });

  // Increment game step
  lobby.gameStep++;

  // Broadcast the state update - commented out as it's duplicated in index.ts
  // io.to(lobbyId).emit("gameStateUpdated", `${teamName} выбрали карту ${map}`);

  // Disable all controls
  io.to(lobbyId).emit("canWorkUpdated", false);
  io.to(lobbyId).emit("canBan", false);
  io.to(lobbyId).emit("canPick", false);

  // Enable winner reporting
  io.to(lobbyId).emit("canReportWinner", true);

  // Broadcast updated picks to all clients
  io.to(lobbyId).emit("pickedUpdated", lobby.pickedMaps);
}
