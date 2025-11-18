// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { OverlayShell } from "@/components/ui/overlay-shell";
import { MapTile } from "@/components/ui/map-tile";

export type MapPoolEditorOverlayProps = {
  activeTab: number;
  setActiveTab: (n: number) => void;
  mapPool: Record<string, string[]>;
  allMapsList: Record<string, string[]>;
  onChange: (index: number, value: string, gameName: string) => void;
  onBack: () => void;
  onReset: () => void;
  onSave: () => void;
};

export function MapPoolEditorOverlay(props: MapPoolEditorOverlayProps) {
  const { activeTab, setActiveTab, mapPool, allMapsList, onChange, onBack, onReset, onSave } = props;

  return (
    <OverlayShell motionKey="overlay-mapPool" size="xl">
      <h2 className="text-xl font-light text-neutral-900 dark:text-neutral-100 text-center mb-4">
        Редактирование маппула
      </h2>

      <div className="mb-4 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
        <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
          При выборе пула из 4 карт используются только первые 4 карты в списке
        </p>
      </div>

      <div className="flex mb-4 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl max-w-xs mx-auto">
        <button
          onClick={() => setActiveTab(0)}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-xl transition-all duration-200 ${
            activeTab === 0
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          CS2
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-xl transition-all duration-200 ${
            activeTab === 1
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          VALORANT
        </button>
      </div>

      {activeTab === 0 && Array.isArray(mapPool["cs2"]) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
          {mapPool["cs2"].map((value, index) => (
            <MapTile
              key={`cs2-${index}`}
              gameId="cs2"
              value={value}
              index={index}
              allMaps={allMapsList["cs2"] || []}
              onChange={(i, v) => onChange(i, v, "cs2")}
            />
          ))}
        </div>
      )}

      {activeTab === 1 && Array.isArray(mapPool["valorant"]) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
          {mapPool["valorant"].map((value, index) => (
            <MapTile
              key={`valorant-${index}`}
              gameId="valorant"
              value={value}
              index={index}
              allMaps={allMapsList["valorant"] || []}
              onChange={(i, v) => onChange(i, v, "valorant")}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
        <Button
          type="button"
          onClick={onBack}
          className="flex-1 h-9 rounded-xl font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-0 transition-all duration-200"
        >
          Назад
        </Button>
        <Button
          type="button"
          onClick={onReset}
          className="flex-1 h-9 rounded-xl font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 border-0 transition-all duration-200"
        >
          Сбросить
        </Button>
        <Button
          type="button"
          onClick={onSave}
          className="flex-1 h-9 rounded-xl font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all duration-200"
        >
          Сохранить
        </Button>
      </div>
    </OverlayShell>
  );
}
