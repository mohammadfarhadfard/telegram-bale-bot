const axios = require("axios");
const FormData = require("form-data");

const {
  baleRequest,
} = require("./index");

require("dotenv").config();

const baleToken =
  process.env.BALE_BOT_TOKEN;

async function sendText(chatId, text) {
  console.log("Bale sendText chatId:", chatId);
  console.log("Bale sendText text:", JSON.stringify(text));

  await baleRequest("sendMessage", {
    chat_id: chatId,
    text: text,
  });
}

async function sendPhoto(
  chatId,
  photo,
  caption
) {
  const form = new FormData();

  form.append(
    "chat_id",
    chatId
  );

  form.append(
    "photo",
    photo,
    {
      filename: "photo.jpg",
      contentType: "image/jpeg",
    }
  );

  form.append(
    "caption",
    caption || ""
  );

  await axios.post(
    `https://tapi.bale.ai/bot${baleToken}/sendPhoto`,
    form,
    {
      headers: form.getHeaders(),
    }
  );
}

async function sendMediaGroup(
  chatId,
  form
) {
  await axios.post(
    `https://tapi.bale.ai/bot${baleToken}/sendMediaGroup`,
    form,
    {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
    }
  );
}

module.exports = {
  sendText,
  sendPhoto,
  sendMediaGroup,
};