const axios = require("axios");

const baleToken =
  process.env.BALE_BOT_TOKEN;

const telegramChatId =
  process.env.TELEGRAM_CHAT_ID;

const {
  sendText,
  sendPhoto,
  sendMediaGroup,
} = require("../telegram/sender");

let baleOffset = 0;

const mediaGroups = new Map();

async function downloadBaleFile(fileId) {
  console.log("Bale: getting file...", fileId);

  try {
    const fileResponse = await axios.post(
      `https://tapi.bale.ai/bot${baleToken}/getFile`,
      {
        file_id: fileId,
      }
    );

    console.log(
      "Bale getFile:",
      JSON.stringify(
        fileResponse.data,
        null,
        2
      )
    );

    if (!fileResponse.data?.ok) {
      return null;
    }

    const filePath =
      fileResponse.data.result?.file_path;

    if (!filePath) {
      return null;
    }

    const fileUrl =
      `https://tapi.bale.ai/file/bot${baleToken}/${filePath}`;

    const response = await axios.get(
      fileUrl,
      {
        responseType: "arraybuffer",
        validateStatus: () => true,
      }
    );

    console.log(
      "Bale file download status:",
      response.status
    );

    console.log(
      "Bale file content-type:",
      response.headers["content-type"]
    );

    if (response.status !== 200) {
      return null;
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.log(
      "Bale file request error:",
      error.response?.data ||
        error.message
    );

    return null;
  }
}

async function sendBaleAlbum(groupId) {
  const group =
    mediaGroups.get(groupId);

  if (!group) {
    return;
  }

  mediaGroups.delete(groupId);

  try {
    const media = [];

    for (
      let i = 0;
      i < group.messages.length;
      i++
    ) {
      const message =
        group.messages[i];

      const photo =
        message.photo[
          message.photo.length - 1
        ];

      const photoBuffer =
        await downloadBaleFile(
          photo.file_id
        );

      if (!photoBuffer) {
        console.log(
          "Bale: album photo download failed"
        );
        continue;
      }

      const mediaItem = {
        type: "photo",
        media: photoBuffer,
      };

      if (
        i === 0 &&
        message.caption
      ) {
        mediaItem.caption =
          message.caption;
      }

      media.push(mediaItem);
    }

    if (!media.length) {
      return;
    }

    await sendMediaGroup(
      telegramChatId,
      media
    );

    console.log(
      `Album sent to Telegram. Photos: ${media.length}`
    );
  } catch (error) {
    console.log(
      "Telegram album error:",
      error.response?.data ||
        error.message
    );
  }
}

async function getBaleUpdates() {
  try {
    console.log("Bale: polling...");

    const response = await axios.post(
      `https://tapi.bale.ai/bot${baleToken}/getUpdates`,
      {
        offset: baleOffset,
        timeout: 10,
      }
    );

    if (!response.data?.ok) {
      console.log(
        "Bale getUpdates failed:",
        response.data
      );

      return;
    }

    const updates =
      response.data.result || [];

    console.log(
      "Bale updates:",
      updates.length
    );

    for (const update of updates) {
      console.log(
        "Bale update id:",
        update.update_id
      );

      baleOffset =
        update.update_id + 1;

      const message =
        update.message;

      if (!message) {
        continue;
      }

  
if (
  message.sender_chat?.username === "sernatest"
) {
  console.log(
    "Bale: ignoring own channel message"
  );

  continue;
}



      console.log(
  "Bale message:",
  JSON.stringify(message, null, 2)
);

      // Text
      if (message.text) {
        console.log(
          "Bale: sending text to Telegram"
        );

        await sendText(
          telegramChatId,
          message.text
        );

        continue;
      }

      // Album
      if (
        message.media_group_id &&
        message.photo?.length
      ) {
        const groupId =
          message.media_group_id;

        if (!mediaGroups.has(groupId)) {
          mediaGroups.set(groupId, {
            messages: [],
            timer: null,
          });
        }

        const group =
          mediaGroups.get(groupId);

        group.messages.push(message);

        if (group.timer) {
          clearTimeout(group.timer);
        }

        group.timer = setTimeout(
          () => {
            sendBaleAlbum(groupId);
          },
          1000
        );

        continue;
      }

      // Single photo
      if (message.photo?.length) {
        const photo =
          message.photo[
            message.photo.length - 1
          ];

        console.log(
          "Bale: photo detected",
          photo.file_id
        );

        const photoBuffer =
          await downloadBaleFile(
            photo.file_id
          );

        if (!photoBuffer) {
          console.log(
            "Bale: photo download failed"
          );

          continue;
        }

        console.log(
          "Bale: photo downloaded, sending to Telegram..."
        );

        await sendPhoto(
          telegramChatId,
          photoBuffer,
          message.caption
        );

        console.log(
          "Bale: photo sent to Telegram"
        );
      }
    }
  } catch (error) {
    console.log(
      "Bale polling error:",
      error.response?.data ||
        error.message
    );

    await new Promise((resolve) =>
      setTimeout(resolve, 2000)
    );
  }

  getBaleUpdates();
}

function startReceiver() {
  getBaleUpdates();
}

module.exports = startReceiver;