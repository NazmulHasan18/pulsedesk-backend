import http from "http";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { seed } from "./helpers/seed.js";
import { closeSocketServer, initSocketServer, presence, realtimeEmitter } from "./realtime/index.js";
import env from "./config/env.js";

let server: http.Server;

const PORT = env.PORT;

async function main() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log("✅ Database connected");
    await seed();
    server = http.createServer(app);

    initSocketServer(server);
    await realtimeEmitter.init(); // subscribes to Redis before accepting traffic

    server.listen(Number(PORT), () => {
      console.log(`PulseDesk API listening on :${PORT}`);
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

main();

const shutdown = async (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received. Shutting down gracefully...`);

  await closeSocketServer();
  await Promise.all([realtimeEmitter.shutdown(), presence.shutdown()]);
  await prisma.$disconnect();

  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled Rejection:", reason);
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error("Uncaught Exception:", error);
  shutdown("uncaughtException");
});
