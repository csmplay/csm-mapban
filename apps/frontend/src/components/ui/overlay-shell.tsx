// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import React from "react";
import { motion } from "framer-motion";

export type OverlayShellProps = {
  motionKey: string;
  size?: "md" | "xl";
  children: React.ReactNode;
};

export function OverlayShell({
  motionKey,
  size = "md",
  children,
}: OverlayShellProps) {
  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={
          size === "xl"
            ? "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xl w-full max-w-5xl max-h-[85vh] overflow-y-auto"
            : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xl max-w-md w-full"
        }
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
