# SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
# SPDX-License-Identifier: AGPL-3.0-only

FROM node:lts-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock turbo.json ./

COPY apps/backend ./apps/backend

RUN yarn install --frozen-lockfile

RUN yarn turbo run build --filter=backend...

FROM node:lts-alpine
WORKDIR /app

COPY --from=builder /app/apps/backend ./apps/backend

COPY --from=builder /app/yarn.lock ./apps/backend/

WORKDIR /app/apps/backend
RUN yarn install --production --frozen-lockfile

CMD ["yarn", "start"]
