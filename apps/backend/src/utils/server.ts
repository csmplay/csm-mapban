// SPDX-FileCopyrightText: 2025 CyberSport Masters <git@csmpro.ru>
// SPDX-License-Identifier: AGPL-3.0-only

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// Server configuration
const port = 4000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

// Referrer check middleware
const checkReferrer = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const referrer = req.get("referer");

  if (
    (!referrer || !referrer.startsWith(frontendUrl)) &&
    process.env.NODE_ENV === "production"
  ) {
    res.status(403).send("Unauthorized request");
    return;
  }

  next();
};

// Security headers middleware
const securityHeaders = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
};

// Initialize server configuration
export function initializeServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: frontendUrl,
      methods: ["GET", "POST"],
    },
  });

  // Apply the referrer check middleware to all API routes
  app.use("/api", checkReferrer);

  // Use cors middleware
  app.use(
    express.json(),
    express.urlencoded({ extended: true }),
    express.static("public"),
    cors({
      origin: frontendUrl,
    }),
  );

  // Apply security headers
  app.use(securityHeaders);

  // Start the server
  server.listen(port, () => {
    console.log(`Server is running at localhost:${port}`);
  });

  return {
    app,
    io,
    server,
  };
}

// Export initialized server
export const serverInstance = initializeServer();
export const app = serverInstance.app;
export const io = serverInstance.io;
export const server = serverInstance.server;
