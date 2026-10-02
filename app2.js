const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const axios = require("axios");
const FormData = require("form-data");

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(telegramToken, {
  polling: true,
});

const mediaGroups = new Map();

let baleOffset = 0;

// Telegram → Bale

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `سلام ${msg.from.first_name} ربات اجرا شد`);
});

bot.on("channel_post", async (msg) => {
  try {
    const baleToken = process.env.BALE_BOT_TOKEN;
    const baleChatId = process.env.BALE_CHAT_ID;

    // Text
    if (msg.text) {
      await axios.post(`https://tapi.bale.ai/bot${baleToken}/sendMessage`, {
        chat_id: baleChatId,
        text: msg.text,
      });
    }

    // Album
    if (msg.media_group_id && msg.photo) {
      const groupId = msg.media_group_id;

      if (!mediaGroups.has(groupId)) {
        mediaGroups.set(groupId, {
          messages: [],
          timer: null,
        });
      }

      const group = mediaGroups.get(groupId);

      group.messages.push(msg);

      // Reset timer
      if (group.timer) {
        clearTimeout(group.timer);
      }

      // Wait for all photos
      group.timer = setTimeout(async () => {
        const currentGroup = mediaGroups.get(groupId);

        if (!currentGroup) {
          return;
        }

        mediaGroups.delete(groupId);

        try {
          const media = [];
          const form = new FormData();

          form.append("chat_id", baleChatId);

          for (let i = 0; i < currentGroup.messages.length; i++) {
            const albumMsg = currentGroup.messages[i];

            const photo = albumMsg.photo[albumMsg.photo.length - 1];

            // Get file
            const file = await bot.getFile(photo.file_id);

            // Download file
            const response = await axios.get(
              `https://api.telegram.org/file/bot${telegramToken}/${file.file_path}`,
              {
                responseType: "arraybuffer",
              },
            );

            const attachName = `photo${i}`;

            // Add file
            form.append(attachName, Buffer.from(response.data), {
              filename: `${attachName}.jpg`,
              contentType: "image/jpeg",
            });

            const mediaItem = {
              type: "photo",
              media: `attach://${attachName}`,
            };

            // First caption only
            if (i === 0 && albumMsg.caption) {
              mediaItem.caption = albumMsg.caption;
            }

            media.push(mediaItem);
          }

          form.append("media", JSON.stringify(media));

          // Send album
          await axios.post(
            `https://tapi.bale.ai/bot${baleToken}/sendMediaGroup`,
            form,
            {
              headers: form.getHeaders(),
            },
          );

          console.log(
            `Album sent successfully. Photos: ${currentGroup.messages.length}`,
          );
        } catch (error) {
          console.log("Album error:", error.response?.data || error.message);
        }
      }, 1000);

      return;
    }

    // Single photo
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];

      // Get file
      const file = await bot.getFile(photo.file_id);

      // Download file
      const response = await axios.get(
        `https://api.telegram.org/file/bot${telegramToken}/${file.file_path}`,
        {
          responseType: "arraybuffer",
        },
      );

      // Send photo
      const form = new FormData();

      form.append("chat_id", baleChatId);

      form.append("photo", Buffer.from(response.data), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

      form.append("caption", msg.caption || "");

      await axios.post(`https://tapi.bale.ai/bot${baleToken}/sendPhoto`, form, {
        headers: form.getHeaders(),
      });
    }

    console.log("Message processed successfully.");
  } catch (error) {
    console.log("Error:", error.response?.data || error.message);
  }
});

// Bale → Node.js

const baleMediaGroups = {};
const baleMediaGroupTimers = {};

async function getBaleUpdates() {
  try {
    const baleToken = process.env.BALE_BOT_TOKEN;

    const response = await axios.post(
      `https://tapi.bale.ai/bot${baleToken}/getUpdates`,
      {
        offset: baleOffset,
        timeout: 10,
      },
    );

    const updates = response.data.result || [];

    for (const update of updates) {
      baleOffset = update.update_id + 1;

      if (update.message?.text) {
        const text = update.message.text;

        console.log("Bale message:", text);

        await bot.sendMessage(telegramChatId, text);
      }

      if (update.message?.photo) {
        try {
          const mediaGroupId = update.message.media_group_id;

          // ================================
          // Bale Album
          // ================================
          if (mediaGroupId) {
            if (!baleMediaGroups[mediaGroupId]) {
              baleMediaGroups[mediaGroupId] = [];
            }

            baleMediaGroups[mediaGroupId].push(update.message.photo);

            console.log(
              "Bale media group:",
              mediaGroupId,
              "photos:",
              baleMediaGroups[mediaGroupId].length,
            );

            // Reset timer whenever another photo arrives
            clearTimeout(baleMediaGroupTimers[mediaGroupId]);

            baleMediaGroupTimers[mediaGroupId] = setTimeout(async () => {
              try {
                const photos = baleMediaGroups[mediaGroupId];

                console.log(
                  "Sending Bale album to Telegram:",
                  photos.length,
                  "photos",
                );

                const media = [];

                for (const photoSizes of photos) {
                  const photo = photoSizes[photoSizes.length - 1];

                  const fileId = photo.file_id;

                  // Get file information from Bale
                  const fileResponse = await axios.post(
                    `https://tapi.bale.ai/bot${baleToken}/getFile`,
                    {
                      file_id: fileId,
                    },
                  );

                  const filePath = fileResponse.data.result.file_path;

                  // Download file from Bale
                  const fileDownload = await axios.get(
                    `https://tapi.bale.ai/file/bot${baleToken}/${filePath}`,
                    {
                      responseType: "arraybuffer",
                    },
                  );

                  const mediaItem = {
                    type: "photo",
                    media: Buffer.from(fileDownload.data),
                  };

                  if (media.length === 0 && update.message.caption) {
                    mediaItem.caption = update.message.caption;
                  }

                  media.push(mediaItem);
                }

                // Send album to Telegram
                await bot.sendMediaGroup(telegramChatId, media);

                console.log("Bale album sent to Telegram successfully.");

                // Clean up
                delete baleMediaGroups[mediaGroupId];
                delete baleMediaGroupTimers[mediaGroupId];
              } catch (error) {
                console.log(
                  "Bale album error:",
                  error.response?.data || error.message,
                );
              }
            }, 10000);

            // Do not send each album photo separately
            continue;
          }

          // ================================
          // Single Bale Photo
          // ================================

          const photo = update.message.photo[update.message.photo.length - 1];

          const fileId = photo.file_id;

          // Get file information from Bale
          const fileResponse = await axios.post(
            `https://tapi.bale.ai/bot${baleToken}/getFile`,
            {
              file_id: fileId,
            },
          );

          const filePath = fileResponse.data.result.file_path;

          // Download file from Bale
          const fileDownload = await axios.get(
            `https://tapi.bale.ai/file/bot${baleToken}/${filePath}`,
            {
              responseType: "arraybuffer",
            },
          );

          // Send photo to Telegram
          await bot.sendPhoto(telegramChatId, Buffer.from(fileDownload.data), {
            filename: "photo.jpg",
            contentType: "image/jpeg",
            caption: update.message.caption || "",
          });
        } catch (error) {
          console.log(
            "Bale photo error:",
            error.response?.data || error.message,
          );
        }
      }
    }
  } catch (error) {
    console.log("Bale polling error:", error.response?.data || error.message);
  }

  getBaleUpdates();
}

getBaleUpdates();
