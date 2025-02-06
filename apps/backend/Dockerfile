# Stage 1: Build the backend in a monorepo
FROM node:lts-alpine AS builder
WORKDIR /app

# Copy root-level config and lockfile.
COPY package.json yarn.lock turbo.json ./

# Copy the backend workspace code.
COPY apps/backend ./apps/backend

# Install dependencies in the monorepo context.
RUN yarn install --frozen-lockfile

# Build only the backend workspace (filter by the package name "backend").
RUN yarn turbo run build --filter=backend...

# Stage 2: Create the production image for the backend.
FROM node:lts-alpine
WORKDIR /app

# Copy the built backend files from the builder stage.
COPY --from=builder /app/apps/backend ./apps/backend

# Copy the root-level yarn.lock into the backend folder.
COPY --from=builder /app/yarn.lock ./apps/backend/

# Change to the backend directory and install only production dependencies.
WORKDIR /app/apps/backend
RUN yarn install --production --frozen-lockfile

CMD ["yarn", "start"]
