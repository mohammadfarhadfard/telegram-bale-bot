const bot = require("./index");

async function sendText(chatId, text) {
  await bot.sendMessage(chatId, text);
}

async function sendPhoto(chatId, photo, caption) {
  await bot.sendPhoto(chatId, photo, {
    caption: caption || "",
  });
}

async function sendMediaGroup(chatId, media) {
  await bot.sendMediaGroup(chatId, media);
}

module.exports = {
  sendText,
  sendPhoto,
  sendMediaGroup,
};