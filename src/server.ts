import app from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { bot } from "./bot/bot";

const PORT = Number(env.PORT);

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== "ISI_TOKEN_BOT_KAMU") {
      bot
        .launch({ dropPendingUpdates: true })
        .then(() => {
          console.log("Telegram bot started");
        })
        .catch((error) => {
          console.error("Failed to start Telegram bot:", error);
        });
    } else {
      console.log("Telegram bot token belum diisi, bot tidak dijalankan");
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

process.once("SIGINT", async () => {
  bot.stop("SIGINT");
  await prisma.$disconnect();
});

process.once("SIGTERM", async () => {
  bot.stop("SIGTERM");
  await prisma.$disconnect();
});
