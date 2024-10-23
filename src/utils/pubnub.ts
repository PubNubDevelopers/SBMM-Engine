import { Chat } from '@pubnub/chat';
import dotenv from 'dotenv';

dotenv.config();

let pubnubInstance: Chat | null = null;

// Function to initialize and return the PubNub instance
export const getPubNubInstance = async (): Promise<Chat> => {
  if (!pubnubInstance) {
    pubnubInstance = await Chat.init({
      publishKey: process.env.PUBLISH_KEY as string,
      subscribeKey: process.env.SUBSCRIBE_KEY as string,
      secretKey: process.env.SECRET_KEY as string,
      userId: "sim"
    });
  }
  return pubnubInstance;
};