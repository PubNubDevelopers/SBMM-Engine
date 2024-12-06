import { Chat } from "@pubnub/chat";
import { isTransientError } from "./general";

export async function getOrCreateChannel(chat: Chat, channelId: string) {
  try {
    let channel = await chat.getChannel(channelId);
    if (!channel) {
      channel = await chat.createPublicConversation({ channelId });
    }
    return channel;
  } catch (error) {
    if (isTransientError(error)) {
      console.warn("Transient error in getOrCreateChannel (ChatSDK.TS), retrying...", error);
      throw error; // Allow retry logic in retryOnFailure
    } else {
      console.error("Critical error in getOrCreateChannel (ChatSDK.TS), aborting request", error);
      return undefined; // Return an empty array or handle gracefully
    }
  }
}