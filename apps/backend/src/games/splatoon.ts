import { BaseLobby } from "../utils/types";

export type GameName = "splatoon";
export type GameType = "bo3" | "bo5";
// Splatoon specific lobby interface
export interface Lobby extends BaseLobby {
  rules: BaseLobby["rules"] & {
    gameName: GameName;
    gameType: GameType; // Splatoon only supports BO3 and BO5
    mapPoolSize: 32; // Map pool size
    modesRulesLists: Array<string[]>;
  };
}

// Modes ban rules
export const modesRulesLists = [
  ["ban", "ban", "pick"], // first round
  ["ban", "pick"], // other rounds
];

// Maps ban rules
export const mapRulesLists = [
  ["ban", "", "ban", "ban", "", "ban", "", "ban", "pick"], // first round
  ["ban", "", "ban", "", "ban", "pick"],
];

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
