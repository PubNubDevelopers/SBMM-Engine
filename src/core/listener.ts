import { Channel, Membership, Message } from "@pubnub/chat";
import { getPubNubChatInstance } from '../utils/pubnub';
import { processMatchMaking } from "./matcher";

const MATCHMAKING_INTERVAL_MS = 5000; // Interval (in milliseconds) to run the matchmaking process
let regionChannelID = 'matchmaking-us-east-1';
const serverID = "server";

// A queue to hold users waiting to be processed
const matchmakingQueue: Membership[] = [];

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
export async function startMatchmaking() {
  const chat = await getPubNubChatInstance(serverID);

  // Set up an interval to repeatedly run the matchmaking logic for this region
  setInterval(async () => {
    try{
      let regionChannel = await chat.getChannel(regionChannelID); // Get the channel for this region

      // If the channel doesn't exist, create it
      if (!regionChannel) {
        regionChannel = await chat.createPublicConversation({ channelId: regionChannelID });
      }

      // Fetch members from the matchmaking channel
      const members: Membership[] = await getChannelMembers(regionChannel);

      // Add members to matchmaking queue
      await enqueueMatchmakingUsers(members);

      // Process matchmaking queue
      await processMatchmakingQueue();
    }
    catch(e){
      console.log("Request Failed Trying Again");
    }
  }, MATCHMAKING_INTERVAL_MS); // Run matchmaking logic at the specified interval
}

// Enqueue members for matchmaking
async function enqueueMatchmakingUsers(members: Membership[]) {
  for (const member of members) {
    if (!processingUserIds.includes(member.user.id)) {
      matchmakingQueue.push(member);
      processingUserIds.push(member.user.id);
    }
  }
}

// Process users in the matchmaking queue
async function processMatchmakingQueue() {
  if (isProcessingQueue || matchmakingQueue.length < 2) return;
  isProcessingQueue = true;

  try {
    // Extract users from the queue for processing
    const usersToProcess: Membership[] = matchmakingQueue.splice(0, matchmakingQueue.length);
    const userIds = usersToProcess.map((member) => member.user.id);

    for (const member of usersToProcess) {
      const userId = member.user.id;
      await kickUserFromMatchmakingChannel(userId, regionChannelID); // Remove user from matchmaking channel
      await notifyClientMatchmakingStarted(userId, userIds); // Notify the user
    }

    // Notify web client for testing purposes
    await notifyTestingClientUsersMatchmaking(userIds);

    // Run matchmaking logic on extracted users
    await processMatchMaking(usersToProcess);

    // Clear processed user IDs from processing list
    processingUserIds = processingUserIds.filter((id) => !userIds.includes(id));
  } catch (error) {
    console.log("Error processing matchmaking queue:", error);
  } finally {
    isProcessingQueue = false;
  }
}

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
 * Notify a client that their matchmaking request has started
 *
 * This function sends a message to a specific user, notifying them that their matchmaking request is being processed
 * and includes a list of other users involved in the matchmaking process as a JSON string.
 *
 * @param userId - The ID of the user to notify.
 * @param userIds - A list of other user IDs involved in the matchmaking process.
 */
async function notifyClientMatchmakingStarted(userId: string, userIds: string[]) {
  const chat = await getPubNubChatInstance(serverID);

  // Get or create the user's matchmaking channel
  let channel = await chat.getChannel(`Matchmaking-In-Progress-${userId}`);

  if (channel === null) {
    // If the channel doesn't exist, create a new one
    channel = await chat.createPublicConversation({
      channelId: `Matchmaking-In-Progress-${userId}`
    });
  }

  // Create a JSON object that includes the list of user IDs
  const messagePayload = {
    message: "Processing",
    matchedUsers: userIds
  };

  // Convert the object to a JSON string
  const jsonString = JSON.stringify(messagePayload);

  // Notify the client that their matchmaking request is being processed with the list of users as JSON
  await channel.sendText(jsonString);
}

/**
 * Remove a user from the matchmaking channel
 *
 * This function removes (or "kicks") a user from the matchmaking channel once their request starts processing.
 *
 * @param userId - The ID of the user to remove from the matchmaking channel.
 * @param regionChannelID - The ID of the region-specific matchmaking channel.
 */
async function kickUserFromMatchmakingChannel(userId: string, regionChannelID: string) {
  // Get the user's specific PubNub instance (user chat session)
  const userChatInstance = await getPubNubChatInstance(userId);

  // Get the region-specific matchmaking channel that the user is currently in
  const userChannel = await userChatInstance.getChannel(regionChannelID);

  if (!userChannel) {
    console.log("Error deleting membership from user");
  } else {
    // Remove the user from the matchmaking channel (leave the channel)
    userChannel.leave();
  }
}


// async function createLatencyMapChannel(matchID: string): Promise<Channel> {
//   const chat = await getPubNubChatInstance(serverID);

//   let channel = await chat.getChannel(`${matchID}-latency-channel`);

//   if(channel === null){
//     // If the channel doesn't exist, create a new one
//     channel = await chat.createPublicConversation({
//       channelId: `${matchID}-latency-channel`
//     });
//   }

//   return channel;
// }


/**
 * Receive and store latency maps from users
 *
 * @param matchChannel - The channel to listen for latency maps
 * @returns A Promise that resolves to the aggregated latency maps for all users as a Map<string, number>
 */
// async function receiveMatchmakingLatencyMaps(matchChannel: Channel): Promise<Map<string, Map<string, number>>> {
//   // Map to store the latency maps for each user
//   const aggregatedLatencyMaps: Map<string, Map<string, number>> = new Map();

//   // Listen for messages from the matchChannel
//   matchChannel.join(async (message: Message) => {
//     try {
//       // Parse the incoming message as JSON
//       const parsedMessage = JSON.parse(message.content.text);

//       // Ensure the message contains a latency map
//       if (parsedMessage.latencyMap) {
//         if(!aggregatedLatencyMaps.has(message.userId)){
//           aggregatedLatencyMaps.set(message.userId, new Map<string, number>());
//         }
//         // Store the latency map for the user, assuming latencyMap is a single number per user
//         aggregatedLatencyMaps.set(message.userId, parsedMessage.latencyMap);
//         console.log(`Received latency map from user ${message.userId}`);
//       }
//     } catch (error) {
//       console.error("Error parsing message or storing latency map:", error);
//     }
//   });

//   // Wait for 1 second to collect all latency maps
//   await new Promise(resolve => setTimeout(resolve, 1000));

//   // Return the aggregated latency maps after the timeout
//   return aggregatedLatencyMaps;
// }

// Utility function to generate a random match ID
function generateMatchID(): string {
  return `match-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
}

// Testing Server to Client Functions


async function notifyTestingClientUsersMatchmaking(userIds: string[]){
  const chat = await getPubNubChatInstance(serverID);

  // Get or create the user's matchmaking channel
  let channel = await chat.getChannel(`Matchmaking-In-Progress-Client-Testing`);

  if(channel === null){
    // If the channel doesn't exist, create a new one
    channel = await chat.createPublicConversation({
      channelId: `Matchmaking-In-Progress-Client-Testing`
    })
  }

  // Create a JSON object that includes the list of user IDs
  const messagePayload = {
    message: "Joining",
    matchedUsers: userIds
  };

  const jsonString = JSON.stringify(messagePayload);

  await channel.sendText(jsonString);
}