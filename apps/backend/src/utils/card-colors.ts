// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

// Configuration for card colors in map ban/pick UI
export class CardColors {
  static readonly default = {
    ban: {
      text: ["#dfdfdf", "#dfdfdf", "#dfdfdf"],
      bg: ["#282828", "#282828", "#282828", "#dfdfdf"],
    },
    pick: {
      text: ["#dfdfdf", "#dfdfdf", "#dfdfdf"],
      bg: ["#42527e", "#282828", "#42527e", "#dfdfdf"],
    },
    pick_mode: {
      text: ["#dfdfdf", "#dfdfdf", "#dfdfdf"],
      bg: ["#5d4037", "#282828", "#5d4037", "#dfdfdf"],
    },
    decider: {
      text: ["#dfdfdf", "#dfdfdf", "#dfdfdf"],
      bg: ["#2e7d32", "#282828", "#2e7d32", "#dfdfdf"],
    },
    ban_mode: {
      text: ["#dfdfdf", "#dfdfdf", "#dfdfdf"],
      bg: ["#2e7d32", "#282828", "#2e7d32", "#dfdfdf"],
    },
  };
}

// Default configuration
export const defaultCardColors = CardColors.default;
