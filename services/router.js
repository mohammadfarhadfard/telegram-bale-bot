const axios = require("axios");
const FormData = require("form-data");

const bot = require("../telegram/index");

const {
  sendText,
  sendPhoto,
  sendMediaGroup,
} = require("../bale/sender");

require("dotenv").config();

const telegramToken =
  process.env.TELEGRAM_BOT_TOKEN;

const mediaGroups = new Map();

async function downloadTelegramFile(fileId) {
  const file = await bot.getFile(fileId);

  const response = await axios.get(
    `https://api.telegram.org/file/bot${telegramToken}/${file.file_path}`,
    {
      responseType: "arraybuffer",
    }
  );

  return Buffer.from(response.data);
}

async function handleTelegramMessage(msg) {
  try {
    // Text
if (msg.text) {
  console.log("Telegram text:", JSON.stringify(msg.text));

  await sendText(
    process.env.BALE_CHAT_ID,
    msg.text
  );

  return;
}

    // Album
    if (
      msg.media_group_id &&
      msg.photo
    ) {
      const groupId =
        msg.media_group_id;

      if (!mediaGroups.has(groupId)) {
        mediaGroups.set(groupId, {
          messages: [],
          timer: null,
        });
      }

      const group =
        mediaGroups.get(groupId);

      group.messages.push(msg);

      if (group.timer) {
        clearTimeout(group.timer);
      }

      group.timer = setTimeout(
        async () => {
          const currentGroup =
            mediaGroups.get(groupId);

          if (!currentGroup) {
            return;
          }

          mediaGroups.delete(groupId);

          try {
            const media = [];
            const form =
              new FormData();

            form.append(
              "chat_id",
              process.env.BALE_CHAT_ID
            );

            for (
              let i = 0;
              i < currentGroup.messages.length;
              i++
            ) {
              const albumMsg =
                currentGroup.messages[i];

              const photo =
                albumMsg.photo[
                  albumMsg.photo.length - 1
                ];

              const buffer =
                await downloadTelegramFile(
                  photo.file_id
                );

              const attachName =
                `photo${i}`;

              form.append(
                attachName,
                buffer,
                {
                  filename:
                    `${attachName}.jpg`,
                  contentType:
                    "image/jpeg",
                }
              );

              const mediaItem = {
                type: "photo",
                media:
                  `attach://${attachName}`,
              };

              if (
                i === 0 &&
                albumMsg.caption
              ) {
                mediaItem.caption =
                  albumMsg.caption;
              }

              media.push(mediaItem);
            }

            form.append(
              "media",
              JSON.stringify(media)
            );

            await sendMediaGroup(
              process.env.BALE_CHAT_ID,
              form
            );

            console.log(
              `Album sent successfully. Photos: ${currentGroup.messages.length}`
            );
          } catch (error) {
            console.log(
              "Album error:",
              error.response?.data ||
                error.message
            );
          }
        },
        1000
      );

      return;
    }

    // Single photo
    if (msg.photo) {
      const photo =
        msg.photo[msg.photo.length - 1];

      const buffer =
        await downloadTelegramFile(
          photo.file_id
        );

      await sendPhoto(
        process.env.BALE_CHAT_ID,
        buffer,
        msg.caption
      );

      return;
    }

    console.log(
      "Message processed successfully."
    );
  } catch (error) {
    console.log(
      "Error:",
      error.response?.data ||
        error.message
    );
  }
}

module.exports = {
  handleTelegramMessage,
};