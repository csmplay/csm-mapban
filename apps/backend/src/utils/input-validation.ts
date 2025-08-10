// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sanitizes user input by trimming, limiting length, and removing unsafe characters
 * @param input The user input string to sanitize
 * @returns The sanitized string
 */
export const sanitizeInput = (input: string): string => {
  return input.trim().slice(0, 32).replace(/[<>]/g, "");
};
