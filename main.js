const { Chat } = require("@pubnub/chat");
require('dotenv').config();



const main = async () => {
  const pubnub = await Chat.init({
    publishKey: process.env.PUBLISH_KEY,
    subscribeKey: process.env.SUBSCRIBE_KEY,
    secretKey: process.env.SECRET_KEY,
    userId: "sim"
  });


}

main();