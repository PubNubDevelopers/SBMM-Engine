import PubNub from 'pubnub';
import { Channel, Chat, Membership, User } from "@pubnub/chat";
import { getPubNubChatInstance } from "./pubnub";
import { retryOnFailure, isTransientError } from "./error";
import { Payload } from 'pubnub/lib/types/core/types/api';

const serverID = "server";

/// Initialize PubNub
const pubnub = new PubNub({
  publishKey: process.env.PUBLISH_KEY!,
  subscribeKey: process.env.SUBSCRIBE_KEY!,
  userId: 'Illuminate-Sim',
});

/**
 * Fetch members from the matchmaking channel
 *
 * This function retrieves the members (players) from a specific matchmaking channel.
 *
 * @param channel - The matchmaking channel from which to fetch members.
 * @returns A list of members (users) in the channel.
 */
async function getChannelMembers(channel: Channel): Promise<any[]> {
  // Fetch members with a limit of 100 at a time
  const result = await channel.getMembers({
    limit: 100
  });

  return result.members;
}

/**
 * Update player metadata in PubNub without overwriting existing custom attributes.
 *
 * This function merges the existing custom attributes with new data and updates the player's metadata.
 *
 * @param user - The player/user whose metadata needs updating.
 * @param newCustomData - New custom data to be merged with the existing metadata.
 */
async function updatePlayerMetadata(user: User, newCustomData: any) {
  try {
    // Fetch the user's existing metadata
    const userMetadata = user.custom;

    // Merge existing custom data with new custom fields
    const updatedCustomData = {
      ...userMetadata, // Existing data
      ...newCustomData        // New data to update
    };

    // Update the user's metadata
    await user.update({
      custom: updatedCustomData, // Merged data
    });
  } catch (error) {
    if (isTransientError(error)) {
      console.warn("Transient error in updatePlayerMetaData (ChatSDK.TS), retrying...", error);
      throw error; // Allow retry logic in retryOnFailure
    } else {
      console.error("Critical error in updatePlayerMetaData (ChatSDK.TS), aborting request", error);
      return undefined; // Return an empty array or handle gracefully
    }
  }
}

/// Exported

export async function getChannelMembersWithHandling(channel: Channel): Promise<Membership[]> {
  try {
    return await getChannelMembers(channel);
  } catch (error) {
    if (isTransientError(error)) {
      console.warn("Transient error in getChannelMembers, retrying...", error);
      throw error; // Allow retry logic in retryOnFailure
    } else {
      console.error("Critical error in getChannelMembers, aborting request", error);
      return []; // Return an empty array or handle gracefully
    }
  }
}

// Helper function to update player metadata with retry logic
export async function updatePlayerMetadataWithRetry(player: User, metadata: Record<string, any>) {
  await retryOnFailure(async () => {
    await updatePlayerMetadata(player, metadata);
  }, 3, 1000);
}

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

// Helper function to send a text message with retry logic
export async function sendTextWithRetry(channel: Channel, message: string) {
  await retryOnFailure(async () => {
    await channel.sendText(message);
  }, 3, 1000);
}

export async function sendIlluminateData(message: Payload){
  await retryOnFailure(async () => {
    await pubnub.publish({
      channel: "illuminate-data",
      message: message
    });
  }, 3, 1000);
}

/**
 * Notify a client that their matchmaking request has started
 *
 * This function sends a message to a specific user, notifying them that their matchmaking request is being processed
 * and includes a list of other users involved in the matchmaking process as a JSON string.
 *
 * @param userId - The ID of the user to notify.
 * @param userIds - A list of other user IDs involved in the matchmaking process.
 */
export async function notifyClient(channelID: string, payload: Object) {
  try{
    const chat = await getPubNubChatInstance(serverID);

    // Get or create the user's matchmaking channel
    let channel = await getOrCreateChannel(chat, channelID);

    if(channel){
      // Convert the object to a JSON string
      const jsonString = JSON.stringify(payload);

      // Notify the client that their matchmaking request is being processed with the list of users as JSON
      await channel.sendText(jsonString);
    }
  }
  catch(error){
    if (isTransientError(error)) {
      console.warn("Transient error in notifyClient (ChatSDK.TS), retrying...", error);
      throw error; // Allow retry logic in retryOnFailure
    } else {
      console.error("Critical error in notifyClient (ChatSDK.TS), aborting request", error);
      return undefined; // Return an empty array or handle gracefully
    }
  }
}




