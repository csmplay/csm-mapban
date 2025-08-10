// SPDX-FileCopyrightText: 2024, 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    FRONTEND_URL: process.env.FRONTEND_URL,
    BACKEND_URL: process.env.BACKEND_URL,
  },
};

export default nextConfig;
