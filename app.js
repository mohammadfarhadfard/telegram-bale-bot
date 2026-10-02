require("dotenv").config();
const startTelegramReceiver = require("./telegram/receiver");
const startBaleReceiver = require("./bale/receiver");
startTelegramReceiver();
startBaleReceiver();
console.log("Bot started.");
