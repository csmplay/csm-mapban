import { BaseLobby } from "../utils/types";
import { io } from "../utils/server";

export type GameName = "cs2" | "valorant";

// FPS specific lobby interface
export interface Lobby extends BaseLobby {
  pickedMaps: Array<
    BaseLobby["pickedMaps"][number] & {
      side: string;
      sideTeamName: string;
    }
  >; // Array of picked maps
  rules: BaseLobby["rules"] & {
    gameName: GameName;
    mapNames: Array<string>; // Array of this lobby mappool
    knifeDecider: boolean; // Knife decider
    mapPoolSize: number; // Map pool size
  };
}

// Game type patterns for different match formats
export const mapRulesLists = {
  bo1: ["ban", "ban", "ban", "ban", "ban", "ban", "pick"],
  bo2: ["ban", "ban", "ban", "ban", "ban", "pick", "pick"],
  bo3: ["ban", "ban", "pick", "pick", "ban", "ban", "decider"],
  bo5: ["ban", "ban", "pick", "pick", "pick", "pick", "decider"],
};

// Complete map lists for each game
export const mapNamesLists = {
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

// Default map pools for each game
export const startMapPool = {
  cs2: ["Dust 2", "Mirage", "Inferno", "Nuke", "Ancient", "Anubis", "Train"],
  valorant: ["Ascent", "Bind", "Pearl", "Haven", "Abyss", "Sunset", "Split"],
};

export const startGame = (lobbyId: string, lobbies: Map<string, Lobby>) => {
  const lobby = lobbies.get(lobbyId) as Lobby;
  if (lobby) {
    console.log("Game Started in lobby: " + lobbyId);
    io.to(lobbyId).emit(
      "teamNamesUpdated",
      Array.from(lobby.teamNames.entries()),
    );
    io.to(lobbyId).emit("isCoin", lobby.rules.coinFlip);

    if (lobby.rules.coinFlip) {
      if (lobby.teamNames.size === 2) {
        const result =
          Math.floor(Math.random() * 2) ^
          Date.now() % 2 ^
          (Math.random() > 0.5 ? 1 : 0);
        io.to(lobbyId).emit("coinFlip", result);
        const entry = Array.from(lobby.teamNames.entries())[result] as [
          string,
          string,
        ];
        io.to(entry[0]).emit("canWorkUpdated", true);
        if (lobby.rules.mapRulesList[0] === "ban") {
          io.to(entry[0]).emit("canBan", true);
          setTimeout(() => {
            io.to(lobbyId).emit(
              "gameStateUpdated",
              entry[1] + " выбирают карту для бана",
            );
          }, 3000);
        } else if (lobby.rules.mapRulesList[0] === "pick") {
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
        if (lobby.rules.mapRulesList[0] === "ban") {
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
