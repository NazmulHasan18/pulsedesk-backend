import { Server } from "http";
import app from "./app";
import env from "./config/env";
import { prisma } from "./lib/prisma";

let server: Server;

async function main() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log("✅ Database connected");

    server = app.listen(env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 PulseDesk API listening on port ${env.PORT}`);
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
