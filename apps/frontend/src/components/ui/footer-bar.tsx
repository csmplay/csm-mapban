// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React from "react";

export type FooterBarProps = {
  repoUrl: string;
  licenseUrl: string;
  version?: string;
};

export function FooterBar({ repoUrl, licenseUrl, version }: FooterBarProps) {
  return (
    <nav
      role="toolbar"
      aria-label="Footer actions"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40"
    >
      <div className="flex flex-col items-center text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-500">
        <div className="leading-tight mb-1.5 text-center">
          <a
            href="https://github.com/goosemooz"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 underline-offset-4 hover:underline"
          >
            GooseMooz
          </a>
          <span> & </span>
          <a
            href="https://github.com/ch4og"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 underline-offset-4 hover:underline"
          >
            ch4og
          </a>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-900 dark:hover:text-neutral-200 underline-offset-4 hover:underline"
            title={version ? `v${version}` : "Unknown version"}
          >
            Source code
          </a>
          <span className="text-neutral-300 dark:text-neutral-700">•</span>
          <a
            href={licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-900 dark:hover:text-neutral-200 underline-offset-4 hover:underline"
          >
            Licenses
          </a>
        </div>
      </div>
    </nav>
  );
}
