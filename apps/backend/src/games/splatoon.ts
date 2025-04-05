import { BaseLobby } from "../utils/types";
import { io } from "../utils/server";
import { getGameCategory } from "../index";

export type GameName = "splatoon";
export type GameType = "bo3";
export type GameMode = "clam" | "rainmaker" | "tower" | "zones";

// Splatoon specific lobby interface
export interface Lobby extends BaseLobby {
  rules: BaseLobby["rules"] & {
    gameName: GameName;
    gameType: GameType; // Splatoon only supports BO3 and BO5
    mapPoolSize: 32; // Map pool size (8 maps * 4 modes)
    modesRulesList: string[]; // Current modes pick/ban rules
    mapRulesList: string[]; // Current maps pick/ban rules
    activeModes: Array<GameMode>; // Available modes after bans
    roundNumber: number; // Current round number (1, 2, 3, etc.)
    lastWinner?: string; // Team name of the last winner
    coinFlip: boolean;
    admin: boolean;
    mapNames: string[];
  };
  bannedModes: Array<{ mode: GameMode; teamName: string }>; // Array of banned modes
  pickedMode?: { mode: GameMode; teamName: string }; // Selected mode
  pickedMaps: Array<{ map: string; teamName: string; roundNumber?: number }>; // Array of picked maps
  bannedMaps: Array<{ map: string; teamName: string; roundNumber?: number }>; // Array of banned maps
  roundHistory?: {
    roundNumber: number;
    pickedMaps: Array<{ map: string; teamName: string; roundNumber?: number }>;
    pickedMode?: { mode: GameMode; teamName: string };
  }[];
}

// Modes ban rules
export const modesRulesLists = {
  bo3: {
    first: ["mode_ban", "mode_ban", "mode_pick"], // first round
    subsequent: ["mode_ban", "mode_pick"], // subsequent rounds: priority bans, non-priority picks
  },
};

// Maps ban rules
export const mapRulesLists = {
  bo3: {
    first: ["ban", "ban", "ban", "ban", "ban", "pick"], // first round (2 + 3 + 1 pick)
    subsequent: ["ban", "ban", "ban", "pick"], // subsequent rounds (3 + 1 pick)
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
  action: "ban" | "pick";
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
        rules: [
          "mode_ban",
          "mode_ban",
          "mode_pick",
        ],
      },
      maps: {
        steps: [
          { action: "ban", count: 2, team: "priority" },
          { action: "ban", count: 3, team: "non-priority" },
          { action: "pick", count: 1, team: "priority" },
        ],
        rules: [
          "ban",
          "ban",
          "ban",
          "ban",
          "ban",
          "pick",
        ],
      },
    },
    subsequent: {
      modes: {
        steps: [
          { action: "ban", count: 1, team: "winner" },
          { action: "pick", count: 1, team: "loser" },
        ],
        rules: [
          "mode_ban",
          "mode_pick",
        ],
      },
      maps: {
        steps: [
          { action: "ban", count: 3, team: "winner" },
          { action: "pick", count: 1, team: "loser" },
        ],
        rules: [
          "ban",
          "ban",
          "ban",
          "pick",
        ],
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

  // Initialize game state
  lobby.rules.roundNumber = 1;
  lobby.rules.activeModes = [...gameModes];
  lobby.bannedModes = [];
  lobby.gameStep = 0;

  // Set rules for first round
  const rules = gameRules[lobby.rules.gameType].first;
  lobby.rules.modesRulesList = rules.modes.rules;
  lobby.rules.mapRulesList = rules.maps.rules;

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

      // Wait for coin flip animation to complete
      setTimeout(() => {
        const entry = Array.from(lobby.teamNames.entries())[result] as [
          string,
          string,
        ];

        // Disable all controls first
        io.to(lobbyId).emit("canWorkUpdated", false);
        io.to(lobbyId).emit("canModeBan", false);
        io.to(lobbyId).emit("canModePick", false);
        io.to(lobbyId).emit("canBan", false);
        io.to(lobbyId).emit("canPick", false);

        // Enable controls for the winning team
        io.to(entry[0]).emit("canWorkUpdated", true);
        io.to(entry[0]).emit("canModeBan", true);

        // Update game state message
        io.to(lobbyId).emit(
          "gameStateUpdated",
          `${entry[1]} выбирают режим для бана`,
        );

        // Send available modes to clients
        io.to(lobbyId).emit("modesUpdated", {
          banned: lobby.bannedModes,
          active: lobby.rules.activeModes,
        });
      }, 3000); // Wait for 3 seconds (coin flip animation duration)
    }
  } else {
    // If no coin flip, enable controls for all teams
    for (const [socketId] of lobby.teamNames.entries()) {
      io.to(socketId).emit("canWorkUpdated", true);
      io.to(socketId).emit("canModeBan", true);
    }

    // Get the first team from the lobby
    const firstTeam = Array.from(lobby.teamNames.entries())[0];
    if (firstTeam) {
      const firstTeamName = firstTeam[1];
      io.to(lobbyId).emit(
        "gameStateUpdated",
        `${firstTeamName} выбирают режим для бана`,
      );
    } else {
      io.to(lobbyId).emit(
        "gameStateUpdated",
        "Первая команда выбирает режим для бана",
      );
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

  // Enable mode banning only for the winning team
  io.to(winningTeamSocketId).emit("canWorkUpdated", true);
  io.to(winningTeamSocketId).emit("canModeBan", true);

  io.to(lobbyId).emit(
    "gameStateUpdated",
    `${winningTeamName} выбирают режим для бана`,
  );

  // Send updated modes to clients
  io.to(lobbyId).emit("modesUpdated", {
    banned: lobby.bannedModes,
    active: lobby.rules.activeModes,
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
  });
}

// Helper function to start map selection phase for Splatoon
function startMapSelectionPhase(
  lobbyId: string,
  lobbies: Map<string, Lobby>,
  getGameCategory: (gameName: GameName) => string,
) {
  const lobby = lobbies.get(lobbyId) as Lobby;

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

    // Update game state message
    // io.to(lobbyId).emit(
    //   "gameStateUpdated",
    //   `${mapBanTeam} выбирают карту для бана`,
    // );

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
  lobby.pickedMode = { mode, teamName };

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
    // io.to(lobbyId).emit(
    //   "gameStateUpdated",
    //   `${winningTeamName} выбирают карту для бана`,
    // );
  } else {
    // First round logic remains the same
    // Move to map selection phase
    startMapSelectionPhase(lobbyId, lobbies, getGameCategory);
  }

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
