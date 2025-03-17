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
  };
}

// Default configuration
export const defaultCardColors = CardColors.default;
