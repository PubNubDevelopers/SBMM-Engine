import { Chat } from '@pubnub/chat';

export const getWebPubNubChatInstance = async (userId: string): Promise<Chat> => {
  const chat: Chat = await Chat.init({
    publishKey: process.env.NEXT_PUBLIC_PUBLISH_KEY,
    subscribeKey: process.env.NEXT_PUBLIC_SUBSCRIBE_KEY,
    userId: userId
  });

  return chat;
}