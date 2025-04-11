import * as FPSGames from "../games/fps-games";
import * as Splatoon from "../games/splatoon";

// Game type definitions
export type GameType = "bo1" | "bo2" | "bo3" | "bo5";
export type GameName = "cs2" | "valorant" | "splatoon";
export type Roles = "member" | "observer" | "test";
export type FPSMapPool = typeof FPSGames.startMapPool;
export type SplatoonMapPool = typeof Splatoon.startMapPool;
export type MapPool = {
  fps: FPSMapPool;
  splatoon: SplatoonMapPool;
};
export type Lobby = BaseLobby | FPSGames.Lobby | Splatoon.Lobby;
// Base interface for common lobby properties
export interface BaseLobby {
  lobbyId: string; // Lobby ID
  members: Set<string>; // Set of member IDs
  teamNames: Map<string, string>; // Map of team names
  observers: Set<string>; // Set of observer IDs
  gameStep: number; // Game step
  rules: {
    gameName: GameName; // Name of the game (cs2, valorant, splatoon)
    gameType: GameType; // Type of the game (bo1, bo2, bo3, bo5)
    mapNames: Array<string>; // Array of this lobby mappool
    mapRulesList: string[]; // Array of map rules (rules of bo1, bo2, bo3, bo5)
    coinFlip: boolean; // Coin flip
    admin: boolean; // Is lobby admin created
  };
  pickedMaps: Array<{ map: string; teamName: string }>; // Array of picked maps
  bannedMaps: Array<{ map: string; teamName: string }>; // Array of banned maps
  deciderMap?: { map: string; side: string }; // Optional decider map
}
