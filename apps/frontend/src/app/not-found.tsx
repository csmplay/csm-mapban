// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-sm text-center"
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/CSM White.svg"
            alt="CSM"
            width={120}
            height={32}
            className="mx-auto mb-6 opacity-90"
          />
        </motion.div>
        <h1 className="text-3xl font-light text-neutral-900 dark:text-neutral-100 mb-3 tracking-tight">
          404
        </h1>
        <p className="text-neutral-500 dark:text-neutral-500 text-sm font-normal mb-6">
          Страница не найдена
        </p>
        <Button
          className="w-full h-11 rounded-2xl font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all duration-200"
          onClick={() => router.push("/")}
        >
          На главную
        </Button>
      </motion.div>
    </div>
  );
}
