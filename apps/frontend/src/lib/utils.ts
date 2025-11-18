// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fetches map pool data from the backend API
 * @param backendUrl The backend API URL
 * @returns Promise containing map pool data and map names list
 */
export async function fetchMapPool(backendUrl: string) {
  try {
    const response = await fetch(
      `${backendUrl.endsWith("/") ? backendUrl : backendUrl + "/"}api/mapPool`,
    );
    const data: {
      mapPool: {
        fps: Record<string, string[]>;
        splatoon: Record<string, string[]>;
      };
      mapNamesLists: {
        fps: Record<string, string[]>;
      };
    } = await response.json();

    const mapPool: Record<string, string[]> = {
      ...data.mapPool.fps,
      ...data.mapPool.splatoon,
    };
    const mapNamesLists: Record<string, string[]> = {
      ...data.mapNamesLists.fps,
    };

    return {
      mapPool,
      mapNamesLists,
      success: true,
    };
  } catch (error) {
    console.error("Error fetching map pool:", error);
    return {
      mapPool: {},
      mapNamesLists: {},
      success: false,
      error,
    };
  }
}
