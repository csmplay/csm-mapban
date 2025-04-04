# Stage 1: Build the frontend in a monorepo
FROM node:lts-alpine AS builder
WORKDIR /app

# Copy root-level config and lockfile.
COPY package.json yarn.lock turbo.json ./

# Copy the frontend workspace code.
COPY apps/frontend ./apps/frontend

# Install dependencies in the monorepo context.
RUN yarn install --frozen-lockfile

# Build only the frontend workspace (filter by the package name "frontend").
RUN yarn turbo run build --filter=frontend...

# Stage 2: Create the production image for the frontend.
FROM node:lts-alpine
WORKDIR /app

# Copy the built frontend files from the builder stage.
COPY --from=builder /app/apps/frontend ./apps/frontend

# Copy the root-level yarn.lock into the frontend folder.
COPY --from=builder /app/yarn.lock ./apps/frontend/

# Switch to the frontend directory and install only production dependencies.
WORKDIR /app/apps/frontend
RUN yarn install --production --frozen-lockfile && yarn cache clean

COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static

CMD ["yarn", "start"]
