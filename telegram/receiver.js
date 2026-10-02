const bot = require("./index");
const { handleTelegramMessage } = require("../services/router");
function startReceiver() {
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `سلام ${msg.from.first_name} ربات اجرا شد`);
  });
  bot.on("channel_post", async (msg) => {
    try {
      await handleTelegramMessage(msg);
    } catch (error) {
      console.log("Error:", error.response?.data || error.message);
    }
  });
}
module.exports = startReceiver;
