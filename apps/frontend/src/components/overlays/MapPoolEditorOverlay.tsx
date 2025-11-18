// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { OverlayShell } from "@/components/ui/overlay-shell";
import { MapTile } from "@/components/ui/map-tile";

export type MapPoolEditorOverlayProps = {
  gameId: "cs2" | "valorant";
  gamePrettyName?: string;
  mapPool: Record<string, string[]>;
  allMapsList: Record<string, string[]>;
  onChange: (index: number, value: string, gameName: string) => void;
  onBack: () => void;
  onReset: () => void;
  onSave: () => void;
};

export function MapPoolEditorOverlay(props: MapPoolEditorOverlayProps) {
  const { gameId, gamePrettyName, mapPool, allMapsList, onChange, onBack, onReset, onSave } = props;

  const currentPool = mapPool[gameId] || [];
  const currentAllMaps = allMapsList[gameId] || [];

  return (
    <OverlayShell motionKey="overlay-mapPool" size="md">
      <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
        Маппул для {gamePrettyName}
      </h2>

      <div className="space-y-4">
        <div className="mb-2 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
            При выборе пула из 4 карт используются только первые 4 карты в списке
          </p>
        </div>

        {Array.isArray(currentPool) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {currentPool.map((value, index) => (
              <MapTile
                key={`${gameId}-${index}`}
                gameId={gameId}
                value={value}
                index={index}
                allMaps={currentAllMaps}
                onChange={(i, v) => onChange(i, v, gameId)}
              />
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button
            type="button"
            onClick={onBack}
            className="h-10 px-6 rounded-2xl font-medium bg-neutral-100 dark:bg-red-400 text-neutral-600 dark:text-neutral-900 hover:bg-red-200 dark:hover:bg-red-300 border-0 transition-all duration-200"
          >
            Назад
          </Button>
          <Button
            type="button"
            onClick={onReset}
            className="h-10 px-6 rounded-2xl font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 border-0 transition-all duration-200"
          >
            Сбросить
          </Button>
          <Button
            type="button"
            onClick={onSave}
            className="flex-1 h-10 rounded-2xl font-medium bg-neutral-900 dark:bg-green-300 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-green-200 transition-all duration-200"
          >
            Сохранить
          </Button>
        </div>
      </div>
    </OverlayShell>
  );
}
