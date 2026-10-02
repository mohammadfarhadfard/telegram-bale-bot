const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(telegramToken, { polling: true });
module.exports = bot;
