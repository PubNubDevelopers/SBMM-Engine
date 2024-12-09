import { Chat, User } from "@pubnub/chat";
import { getPubNubChatInstance, getPubNubInstance } from '../utils/pubnub';
import { processMatchMaking } from "./matcher";
import { getOrCreateChannel, notifyClient, updatePlayerMetadataWithRetry } from "../utils/chatSDK";
import { retryOnFailure, isTransientError } from "../utils/error";

const MATCHMAKING_INTERVAL_MS = 5000; // Interval (in milliseconds) to run the matchmaking process
const regionChannelID = "matchmaking-us-east-1";
const serverID = "server";

// A map to track users waiting to be processed
let matchmakingQueue: Map<string, { userId: string; message: string }> = new Map();

// Flag to indicate if the queue is currently being processed
let isProcessingQueue = false;

/**
 * Start the matchmaking process loop
 *
 * This function sets up a matchmaking loop for each region. For every region, it checks if a matchmaking channel exists.
 * If not, it creates one. Then, every 5 seconds (or the defined interval), it fetches the members in the channel and
 * processes matchmaking logic if there are enough players.
 */
export async function startListener() {
  const chat = await getPubNubChatInstance(serverID);

  // Set up the matchmaking channel
  const regionChannel = await getOrCreateChannel(chat, regionChannelID);

  if (regionChannel) {

    // Add a message listener for the matchmaking channel
    regionChannel.join(async (message) => {
      const userId = message.userId;
      const messageContent = message.content.text;

      // Add the user to the matchmaking queue if not already queued
      if (!matchmakingQueue.has(userId)) {
        matchmakingQueue.set(userId, { userId, message: messageContent });
      }
    });

    // Run the matchmaking process at regular intervals
    setInterval(async () => {
      try {
        await processMatchmakingQueue(chat);
      } catch (e) {
        console.error("Critical error in matchmaking loop:", e);
      }
    }, MATCHMAKING_INTERVAL_MS);
  } else {
    console.error(`Failed to set up the matchmaking channel: ${regionChannelID}`);
  }
}

/**
 * Process users in the matchmaking queue
 */
async function processMatchmakingQueue(chat: Chat) {
  if (isProcessingQueue || matchmakingQueue.size < 2) return;

  isProcessingQueue = true;

  try {
    // Extract all users from the queue
    const usersToProcess = Array.from(matchmakingQueue.values());
    const userIds = usersToProcess.map((entry) => entry.userId);

    // Fetch user details and filter out null values
    const userDetails: User[] = (
      await Promise.all(userIds.map((userId) => chat.getUser(userId)))
    ).filter((user): user is User => user !== null);

    console.log("CURRENT QUEUE");
    console.log(userDetails.length);
    for (const user of userDetails) {
      console.log(user.name);
    }

    // Notify clients and process matchmaking
    for (const user of usersToProcess) {
      await notifyClientMatchmakingStarted(user.userId, userIds);
      matchmakingQueue.delete(user.userId); // Ensure the user is removed from the queue after processing
    }

    await notifyTestingClientUsersMatchmaking(userIds);

    // Pass user details into the matchmaking logic
    processMatchMaking(userDetails, (unpaired: string[]) => {
      // Re-add unpaired users to the matchmaking queue
      console.log("UNPAIRED USERIDs");
      for (const userId of unpaired) {
        console.log(userId);
        if (!matchmakingQueue.has(userId)) {
          matchmakingQueue.set(userId, { userId, message: "Re-queued for matchmaking" });
        }
      }
    });
  } catch (error) {
    console.error("Error processing matchmaking queue:", error);
  } finally {
    // console.log("Finished processing matchmaking batch");
    isProcessingQueue = false;
  }
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
async function notifyClientMatchmakingStarted(userId: string, userIds: string[]) {
  // Retry the kick logic if there is a transient error
  await retryOnFailure(async () => {
    try{
      // Create a JSON object that includes the list of user IDs
      const messagePayload = {
        message: "Processing",
        matchedUsers: userIds
      };

      await notifyClient(`Matchmaking-In-Progress-${userId}`, messagePayload);
    }
    catch(e){
      console.error("Failed to notify client that matchmaking started: ", userId);
    }
  }, 3, 2000);
}

// Testing Server to Client Functions
async function notifyTestingClientUsersMatchmaking(userIds: string[]){
  try{
    // Create a JSON object that includes the list of user IDs
    const messagePayload = {
      message: "Joining",
      matchedUsers: userIds
    };

    await notifyClient(`Matchmaking-In-Progress-Client-Testing`, messagePayload);
  }
  catch(e){
    console.error("Failed to notify testing client for joinging request listener.ts");
  }
}

