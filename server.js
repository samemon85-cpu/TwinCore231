"use strict";
import "dotenv/config";
import http from "node:http";
import app from "./app.js";
import { initWebSocketServer } from "./services/websocket.service.js";
import { connectMQTT }         from "./services/mqtt.service.js";
import { connectDB }           from "./config/database.js";
import { connectRedis }        from "./config/redis.js";
import logger                  from "./config/logger.js";

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  // 1. Databases
  await connectDB();
  await connectRedis();

  // 2. HTTP server
  const server = http.createServer(app);

  // 3. WebSocket server (shares HTTP server port)
  initWebSocketServer(server);

  // 4. MQTT bridge
  await connectMQTT();

  server.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, "TwinCore API started");
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, "Shutting down gracefully…");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error(err, "Fatal error during bootstrap");
  process.exit(1);
});
