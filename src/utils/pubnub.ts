import PubNub from 'pubnub';
import { Chat } from '@pubnub/chat';
import dotenv from 'dotenv';

dotenv.config();

export const getPubNubInstance = async (userID: string): Promise<PubNub> => {
  console.log("This is the userID for the PubNub Instance: ", userID);
  return new PubNub({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    userId: userID
  })
}

export const getPubNubChatInstance = async (userId: string): Promise<Chat> => {
  const chat: Chat = await Chat.init({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    userId: userId
  });

  return chat;
}

export const getWebPubNubChatInstance = async (userId: string): Promise<Chat> => {
  const chat: Chat = await Chat.init({
    publishKey: "pub-c-e8780ff9-1dfe-4317-91c7-ef63da4034ce",
    subscribeKey: "sub-c-e06a091a-a2d5-4030-9ab6-678a4cd68172",
    userId: userId
  });

  return chat;
}