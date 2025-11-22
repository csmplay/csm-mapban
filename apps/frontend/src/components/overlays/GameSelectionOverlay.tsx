// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React from "react";
import Image from "next/image";
import { CDN } from "../../lib/cdn";
import { Button } from "@/components/ui/button";
import { OverlayShell } from "@/components/ui/overlay-shell";

export type GameInfo = {
  id: string;
  prettyName: string;
  type: string;
  developer: string;
  disabled?: boolean;
};

export function GameSelectionOverlay({
  games,
  onSelect,
  onCancel,
}: {
  games: GameInfo[];
  onSelect: (gameId: string) => void;
  onCancel: () => void;
}) {
  return (
    <OverlayShell motionKey="overlay-game" size="md">
      <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
        Выберите игру
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {games.map((game) => (
            <Button
              key={game.id}
              onClick={() => onSelect(game.id)}
              disabled={game.disabled}
              className="h-20 rounded-2xl font-medium transition-all duration-200 flex flex-col items-center justify-center gap-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
            >
              <Image
                    src={CDN.logo(game.id)}
                alt={game.prettyName}
                width={28}
                height={28}
                className="opacity-90"
                priority={true}
              />
              <div className="text-center">
                <div className="text-sm font-medium">{game.prettyName}</div>
                <div className="text-xs opacity-60">{game.developer}</div>
              </div>
            </Button>
          ))}
        </div>

        <div className="flex pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button
            type="button"
            onClick={onCancel}
            className="w-full h-10 rounded-2xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
          >
            Отмена
          </Button>
        </div>
      </div>
    </OverlayShell>
  );
}
