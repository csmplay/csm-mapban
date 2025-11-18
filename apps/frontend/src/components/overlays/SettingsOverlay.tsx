// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { OverlayShell } from "@/components/ui/overlay-shell";

export type SettingsOverlayProps = {
  gamePrettyName?: string;
  gameType: string;
  setGameType: (t: string) => void;
  localModesSize: number;
  setLocalModesSize: (n: number) => void;
  localKnifeDecider: boolean;
  setLocalKnifeDecider: (v: boolean) => void;
  mapPoolSize: number;
  setMapPoolSize: (n: number) => void;
  type: "fps" | "splatoon" | string | undefined;
  onBack: () => void;
  onOpenMapPool: () => void;
  onCreate: () => void;
  creating: boolean;
  disabled?: boolean;
};

const availableFormats = [
  { id: "BO1", name: "BO1" },
  { id: "BO2", name: "BO2" },
  { id: "BO3", name: "BO3" },
  { id: "BO5", name: "BO5" },
];

export function SettingsOverlay(props: SettingsOverlayProps) {
  const {
    gamePrettyName,
    gameType,
    setGameType,
    localModesSize,
    setLocalModesSize,
    localKnifeDecider,
    setLocalKnifeDecider,
    mapPoolSize,
    setMapPoolSize,
    type,
    onBack,
    onOpenMapPool,
    onCreate,
    creating,
    disabled,
  } = props;

  return (
    <OverlayShell motionKey="overlay-settings" size="md">
      <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-5">
        Настройки для {gamePrettyName}
      </h2>

      <div className="space-y-4">
        {type !== "splatoon" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
              Формат игры
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {availableFormats.map((format) => (
                <Button
                  key={format.id}
                  onClick={() => setGameType(format.id)}
                  className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                    gameType === format.id
                      ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                  }`}
                >
                  {format.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {type === "splatoon" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
              Количество режимов
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[2, 4].map((size) => (
                <Button
                  key={size}
                  onClick={() => setLocalModesSize(size)}
                  className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                    localModesSize === size
                      ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                  }`}
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>
        )}

        {["BO1", "BO2"].includes(gameType) && type !== "splatoon" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
              Размер маппула
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[4, 7].map((size) => (
                <Button
                  key={size}
                  onClick={() => setMapPoolSize(size)}
                  className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                    mapPoolSize === size
                      ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                  }`}
                >
                  {size} карт
                </Button>
              ))}
            </div>
          </div>
        )}

        {["BO1", "BO3", "BO5"].includes(gameType) && type !== "splatoon" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 text-center uppercase tracking-wider">
              Десайдер
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Выкл", value: false },
                { label: "Вкл", value: true },
              ].map((option) => (
                <Button
                  key={option.label}
                  onClick={() => setLocalKnifeDecider(option.value)}
                  className={`h-9 rounded-2xl font-medium transition-all duration-200 ${
                    localKnifeDecider === option.value
                      ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0"
                  }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {type === "fps" && (
          <Button
            onClick={onOpenMapPool}
            className={`w-full h-10 rounded-2xl font-medium transition-all duration-200 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0`}
          >
            Редактировать маппул
          </Button>
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
            onClick={onCreate}
            className={`flex-1 h-10 rounded-2xl font-medium transition-all duration-200 ${
              creating
                ? "bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                : "bg-neutral-900 dark:bg-green-300 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-green-200"
            }`}
            disabled={creating || disabled}
          >
            {creating ? "Создание..." : "Создать"}
          </Button>
        </div>
      </div>
    </OverlayShell>
  );
}
