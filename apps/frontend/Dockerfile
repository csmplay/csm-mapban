# SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
# SPDX-License-Identifier: AGPL-3.0-only

FROM node:lts-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock turbo.json ./

COPY apps/frontend ./apps/frontend

RUN yarn install --frozen-lockfile

RUN yarn turbo run build --filter=frontend...

FROM node:lts-alpine
WORKDIR /app

COPY --from=builder /app/apps/frontend ./apps/frontend

COPY --from=builder /app/yarn.lock ./apps/frontend/

WORKDIR /app/apps/frontend
RUN yarn install --production --frozen-lockfile && yarn cache clean

CMD ["yarn", "start"]
