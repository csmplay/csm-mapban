// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActionLogProps {
  entries: string[];
  blueTeamName: string;
  redTeamName: string;
}

export function ActionLog({
  entries,
  blueTeamName,
  redTeamName,
}: ActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries]);

  const getEntryStyle = (entry: string) => {
    if (entry.includes(blueTeamName)) {
      return "border-blue-500";
    } else if (entry.includes(redTeamName)) {
      return "border-red-500";
    }
    return "border-transparent";
  };

  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-md w-full max-w-md">
      <h2 className="text-lg font-semibold mb-2 text-gray-800">Лог действий</h2>
      <ScrollArea className="h-[calc(6*2.5rem+5*0.5rem)] rounded-md">
        <div ref={scrollRef} className="space-y-2 pr-4">
          {entries.map((entry, index) => (
            <div
              key={`${entry}-${index}`}
              className={`bg-white p-2 rounded shadow-sm text-gray-700 border-2 ${getEntryStyle(entry)}`}
            >
              {entry}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
