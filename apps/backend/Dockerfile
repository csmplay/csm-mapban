# SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
# SPDX-License-Identifier: AGPL-3.0-only

FROM oven/bun:alpine@sha256:5ade1ec6fc2b74f825d48d33d98d7450fb960426d5d0df9a8f27b419da832012 AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

COPY . .

WORKDIR /app/apps/backend
RUN bun run --bun build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/apps/backend

CMD ["bun", "run", "dist/index.js"]

LABEL org.opencontainers.image.source="https://git.in.csmpro.ru/csmpro/csm-mapban"
LABEL org.opencontainers.image.url="https://git.in.csmpro.ru/csmpro/csm-mapban"
LABEL org.opencontainers.image.authors="CyberSport Masters"
LABEL org.opencontainers.image.title="CSM Mapban Backend"
LABEL org.opencontainers.image.description="Modern map veto and pick tool for tournaments."
LABEL org.opencontainers.image.licenses="AGPL-3.0-only AND CC-BY-SA-4.0 AND LicenseRef-CyberSportMasters AND LicenseRef-Proprietary AND OFL-1.1"