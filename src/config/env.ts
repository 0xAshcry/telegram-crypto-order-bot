import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT || "3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
  ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS || "",
};
