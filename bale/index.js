require("dotenv").config();

const axios = require("axios");

const baleToken =
  process.env.BALE_BOT_TOKEN;

async function baleRequest(
  method,
  data
) {
  return axios.post(
    `https://tapi.bale.ai/bot${baleToken}/${method}`,
    data
  );
}

module.exports = {
  baleRequest,
};