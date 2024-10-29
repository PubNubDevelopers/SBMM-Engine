import PubNub from 'pubnub';
import { Chat } from '@pubnub/chat';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

let pubnubInstance: Chat | null = null;
let userID: string | null = null;

// Function to initialize and return the PubNub instance
export const getPubNubChatInstance = async (): Promise<Chat> => {
  if(!userID){
    userID = uuidv4();
  }
  if (!pubnubInstance) {
    pubnubInstance = await Chat.init({
      publishKey: process.env.PUBLISH_KEY as string,
      subscribeKey: process.env.SUBSCRIBE_KEY as string,
      secretKey: process.env.SECRET_KEY as string,
      userId: userID
    });
  }
  return pubnubInstance;
};

export const getPubNubInstance = async (): Promise<PubNub> => {
  if(!userID){
    userID = uuidv4();
  }
  return new PubNub({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    userId: userID
  })
}

export const getUsersPubNubChatInstance = async (userId: string): Promise<Chat> => {
  const chat: Chat = await Chat.init({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    userId: userId
  });

  return chat;
}

export const getRandomUserChatInstance = async (): Promise<Chat> => {
  const chat: Chat = await Chat.init({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    userId: uuidv4() // Generates a random UUID for the userId
  });

  return chat;
}