import http from "http";
import app from "./app";
import env from "./config/env";
import { prisma } from "./lib/prisma";
import { seed } from "./helpers/seed";
import { initSocketServer, realtimeEmitter } from "./realtime";

let server: http.Server;

async function main() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log("✅ Database connected");
    await seed();
    server = http.createServer(app);

    initSocketServer(server);
    await realtimeEmitter.init(); // subscribes to Redis before accepting traffic

    server.listen(env.PORT, () => {
      console.log(`PulseDesk API listening on :${env.PORT}`);
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

  await prisma.$disconnect();
  await realtimeEmitter.shutdown();

  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
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
