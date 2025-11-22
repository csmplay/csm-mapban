// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React from "react";
import { CDN, slugify } from "../../lib/cdn";
import Image from "next/image";

export type MapTileProps = {
  gameId: "cs2" | "valorant";
  value: string;
  index: number;
  allMaps: string[];
  onChange: (idx: number, next: string) => void;
};

export function MapTile({
  gameId,
  value,
  index,
  allMaps,
  onChange,
}: MapTileProps) {
  const imgSrc = value ? CDN.map(gameId, slugify(value)) : CDN.map("cs2", "nuke");
  return (
    <div className="group bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="relative w-full pt-[70%] overflow-hidden">
        <Image
          src={imgSrc}
          alt={value}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
          priority={true}
        />
      </div>
      <div className="p-2">
        <select
          value={value}
          onChange={(e) => onChange(index, e.target.value)}
          className="w-full bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100 transition-colors duration-200"
        >
          <option value="" disabled>
            Выберите карту
          </option>
          {allMaps?.map((mapName, mapIndex) => (
            <option key={mapIndex} value={mapName}>
              {mapName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
