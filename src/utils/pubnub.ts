import PubNub from 'pubnub';
import { Chat } from '@pubnub/chat';
import dotenv from 'dotenv';

dotenv.config();

export const getPubNubInstance = async (userID: string): Promise<PubNub> => {
  return new PubNub({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    secretKey: process.env.SECRET_KEY as string,
    userId: userID
  })
}

export const getPubNubChatInstance = async (userId: string): Promise<Chat> => {
  const chat: Chat = await Chat.init({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    secretKey: process.env.SECRET_KEY as string,
    userId: userId
  });

  return chat;
}