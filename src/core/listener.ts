import { Chat, Membership, User } from "@pubnub/chat";
import { getPubNubChatInstance } from '../utils/pubnub';
import { processMatchMaking } from "./matcher";
import { getChannelMembersWithHandling, getOrCreateChannel, notifyClient, updatePlayerMetadataWithRetry } from "../utils/chatSDK";
import { retryOnFailure, isTransientError } from "../utils/error";

const MATCHMAKING_INTERVAL_MS = 5000; // Interval (in milliseconds) to run the matchmaking process
let regionChannelID = 'matchmaking-us-east-1';
const serverID = "server";
const avgWaitTime = 0;

// A queue to hold users waiting to be processed
let matchmakingQueue: Membership[] = [];

// Array to track user IDs currently being processed
let processingUserIds: string[] = [];

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

  // Set up an interval to repeatedly run the matchmaking logic for this region
  setInterval(async () => {
    try {
      await handleMatchmaking(chat);
    } catch (e) {
      console.error("Critical error in matchmaking loop:", e);
    }
  }, MATCHMAKING_INTERVAL_MS); // Run matchmaking logic at the specified interval
}

async function handleMatchmaking(chat: Chat) {
  try {
    let regionChannel = await getOrCreateChannel(chat, regionChannelID);

    if(regionChannel){
      // Fetch members with retry and graceful fallback on failure
      const members: Membership[] = await retryOnFailure(
        () => getChannelMembersWithHandling(regionChannel),
        3,
        1000
      );

      if (members.length === 0) {
        console.warn("No members retrieved");
      }
      else {
        console.log(`Found ${members.length} in channel`);
      }

      await enqueueMatchmakingUsers(members);

      // Process matchmaking queue
      await processMatchmakingQueue();
    }
  } catch (e) {
    console.error("Request Failed Trying Again", e);
  }
}

// Enqueue members for matchmaking
async function enqueueMatchmakingUsers(members: Membership[]) {
  for (const member of members) {
    if (!processingUserIds.includes(member.user.id)) {
      processingUserIds.push(member.user.id);
    }
    // Add user to matchmakingQueue if not already in the queue
    if (!matchmakingQueue.some((queuedMember) => queuedMember.user.id === member.user.id)) {
      matchmakingQueue.push(member);
    }
  }
}

// Process users in the matchmaking queue
async function processMatchmakingQueue() {
  console.log(`Found ${matchmakingQueue.length} ready to be processed`);
  console.log(`Found ${processingUserIds.length} UserIDs for processing`);

  if (isProcessingQueue || matchmakingQueue.length < 2) return;

  isProcessingQueue = true;
  console.log("Processing");

  try {
    const usersToProcess: Membership[] = matchmakingQueue.splice(0, matchmakingQueue.length);
    const userIds = usersToProcess.map((member) => member.user.id);

    for (const member of usersToProcess) {
      const userId = member.user.id;
      await kickUserFromMatchmakingChannel(member.user, regionChannelID);
      await notifyClientMatchmakingStarted(userId, userIds);
    }

    await notifyTestingClientUsersMatchmaking(userIds);
    await processMatchMaking(usersToProcess);

    processingUserIds = processingUserIds.filter((id) => !userIds.includes(id));
    matchmakingQueue = matchmakingQueue.filter((member) => !userIds.includes(member.user.id));
  } catch (error) {
    console.error("Error processing matchmaking queue:", error);
  } finally {
    console.log("Finished Processing Batch");
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

/**
 * Remove a user from the matchmaking channel
 *
 * This function removes (or "kicks") a user from the matchmaking channel once their request starts processing.
 *
 * @param user - The User object representing the user to remove from the matchmaking channel.
 * @param regionChannelID - The ID of the region-specific matchmaking channel.
 */
async function kickUserFromMatchmakingChannel(user: User, regionChannelID: string) {
  // Retry the kick logic if there is a transient error
  await retryOnFailure(async () => {
    try {
      // Update user metadata to represent that the user is searching for a match
      await updatePlayerMetadataWithRetry(user, {
        searching: true,
      });

      // Get the user's specific PubNub instance (user chat session)
      const userChatInstance = await getPubNubChatInstance(user.id);

      // Get the region-specific matchmaking channel that the user is currently in
      const userChannel = await userChatInstance.getChannel(regionChannelID);

      if (!userChannel) {
        console.error("User is not currently in the channel, unable to remove membership");
        return;
      }

      // Attempt to remove the user from the matchmaking channel (leave the channel)
      await userChannel.leave();
    } catch (error) {
      if (isTransientError(error)) {
        console.warn("Transient error in kickUserFromMatchmakingChannel (listener.TS): ", error);
        throw error; // Allow retry logic in retryOnFailure
      } else {
        console.error("Critical error in kickUserFromMatchmakingChannel (listener.TS), aborting request: ", error);
        return; // Return an empty array or handle gracefully
      }
    }
  }, 3, 2000); // Retry up to 3 times with a 2-second delay between attempts
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

