import { Channel, Membership, Message, User } from "@pubnub/chat";
import { getPubNubChatInstance } from "../utils/pubnub";
import { pairMembersWithLatencyAndSkill } from "./sbm";

const serverID = "server"

/**
 * Process matchmaking logic
 *
 * This function receives a list of players/members and pairs them up based on predefined criteria
 * (such as skill level and latency). After pairing the members, it triggers the pre-lobby setup where players
 * will confirm their participation in the match.
 *
 * @param members - List of players or users to be paired for matchmaking.
 * @param latencyMap - A map of latencies between the users.
 */
export async function processMatchMaking(members: any[], latencyMap: Map<string, Map<string, number>>) {
  console.log("Latency Map: ", latencyMap);
  // Pair members using the latency and skill-based matchmaking algorithm
  const pairs = pairMembersWithLatencyAndSkill(members, latencyMap);

  // Iterate over each pair of players
  for (const [player1, player2] of pairs) {
    console.log(`Matched players: ${player1.id} and ${player2.id}`);
    // Notify Testing Client of Matched Players
    await notifyTestingClientofMatchedUsers(player1.id, player2.id);

    // Create a pre-lobby listener to handle confirmation between the two players
    await createPreLobbyListener(player1, player2);
  }
}

/**
 * Notify clients of the shared matchmaking channel
 *
 * This function creates a shared pre-lobby channel between two players and notifies both players about
 * the matchmaking request through their respective channels.
 *
 * @param player1Id - The ID of the first player.
 * @param player2Id - The ID of the second player.
 */
async function notifyClientsOfSharedMatchmakingChannel(player1Id: string, player2Id: string) {
  // Wait 3s
  const waitTime = 3000;
  // Simulate network delay (1 second) before proceeding
  await new Promise(resolve => setTimeout(resolve, waitTime));

  const chat = await getPubNubChatInstance(serverID);

  // Check if the channels exist for each player, if not create them
  let channel1 = await chat.getChannel(`Matchmaking-In-Progress-${player1Id}`);
  let channel2 = await chat.getChannel(`Matchmaking-In-Progress-${player2Id}`);

  if (channel1 === null) {
    channel1 = await chat.createPublicConversation({
      channelId: `Matchmaking-In-Progress-${player1Id}`
    });
  }

  if (channel2 === null) {
    channel2 = await chat.createPublicConversation({
      channelId: `Matchmaking-In-Progress-${player2Id}`
    });
  }

  // Create a shared lobby ID for both players
  const sharedLobbyID = `pre-lobby-${player1Id}-${player2Id}`;

  console.log("Sending Text for shared lobby");
  // Notify both players of the shared matchmaking channel
  await channel1.sendText(sharedLobbyID);
  await channel2.sendText(sharedLobbyID);

  console.log(`Notified user ${player1Id} and ${player2Id} that their matchmaking request is being processed.`);
}

/**
 * Create a pre-lobby listener to confirm the match
 *
 * This function listens for match confirmation from both players within the pre-lobby.
 * If both players confirm within a 30-second window, a game lobby is created. Otherwise,
 * the players who didn't confirm will be punished.
 *
 * @param player1 - The first player object.
 * @param player2 - The second player object.
 */
async function createPreLobbyListener(player1: User, player2: User) {
  const chat = await getPubNubChatInstance(serverID);
  const preLobbyChannelID = `pre-lobby-${player1.id}-${player2.id}`;

  // Get or create the pre-lobby channel where confirmation takes place
  let preLobbyChannel = await chat.getChannel(preLobbyChannelID);
  if (!preLobbyChannel) {
    preLobbyChannel = await chat.createPublicConversation({ channelId: preLobbyChannelID });
    console.log(`Created pre-lobby channel: ${preLobbyChannelID}`);
  }

  // Notify both players about the shared matchmaking channel
  await notifyClientsOfSharedMatchmakingChannel(player1.id, player2.id);

  let player1Confirmed = false;
  let player2Confirmed = false;

  // Timeout after 30 seconds if no confirmation is received
  const confirmationTimeout = new Promise((resolve) => {
    setTimeout(() => {
      resolve('timeout');
    }, 30000); // 30-second timeout
  });

  // Listen for confirmation from both players
  const confirmationPromise = new Promise((resolve) => {
    preLobbyChannel.join(async (message: Message) => {
      if (message.content.text === "match_confirmed") {
        const { userId } = message;
        // Testing: Notify web client
        await notifyTestingClientofUserConfirmed(userId);

        // Mark player as confirmed and update their metadata
        if (userId === player1.id) {
          player1Confirmed = true;
          await updatePlayerMetadata(player1, { confirmed: true });
        }

        if (userId === player2.id) {
          player2Confirmed = true;
          await updatePlayerMetadata(player2, { confirmed: true });
        }

        // If both players confirm, resolve the promise
        if (player1Confirmed && player2Confirmed) {
          resolve('confirmed');
        }
      }
    });
  });

  // Wait for confirmation from both players or timeout
  const result = await Promise.race([confirmationPromise, confirmationTimeout]);

  if (result === 'confirmed') {
    // Create a game lobby if both players confirm
    await createChannelLobby(player1, player2, preLobbyChannel);
  } else if (result === 'timeout') {
    console.log('Timeout: Both players did not confirm within 30 seconds');

    // Punish players who didn't confirm
    if (!player1Confirmed) {
      await updatePlayerMetadata(player1, { punished: true });
      console.log(`Player ${player1.id} has been punished.`);
    }

    if (!player2Confirmed) {
      await updatePlayerMetadata(player2, { punished: true });
      console.log(`Player ${player2.id} has been punished.`);
    }

    await preLobbyChannel.sendText("TIMEOUT");
  }
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
      ...userMetadata.custom, // Existing data
      ...newCustomData        // New data to update
    };

    // Update the user's metadata
    await user.update({
      custom: updatedCustomData, // Merged data
    });

    console.log(`Player metadata updated for ${user.id} with data:`, updatedCustomData);
  } catch (error) {
    console.error(`Error updating metadata for user ${user.id}:`, error);
  }
}

/**
 * Create the actual game lobby once both players confirm the match
 *
 * This function creates a new game lobby channel after both players agree to the match in the pre-lobby.
 *
 * @param player1 - The first player object.
 * @param player2 - The second player object.
 * @param preLobbyChannel - The pre-lobby channel where confirmation occurred.
 */
async function createChannelLobby(player1: User, player2: User, preLobbyChannel: Channel) {
  const chat = await getPubNubChatInstance(serverID);
  const gameLobbyChannelID = `game-lobby-${player1.id}-${player2.id}`;

  // Get or create the game lobby channel
  let gameLobbyChannel = await chat.getChannel(gameLobbyChannelID);
  if (!gameLobbyChannel) {
    gameLobbyChannel = await chat.createPublicConversation({ channelId: gameLobbyChannelID });
    console.log(`Game lobby created: ${gameLobbyChannelID}`);
  }

  // Notify both players that the game lobby has been created
  preLobbyChannel.sendText(`game-lobby-${player1.id}-${player2.id}`);

  // Testing: Notify web client of users in match
  await notifyTestingClientofUsersInMatch(player1.id, player2.id);
}

// Testing Client Funcitons

// Testing Server to Client Functions
async function notifyTestingClientofMatchedUsers(player1: string, player2: string){
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
    message: "Matched",
    matchedUsers: [player1, player2]
  };

  const jsonString = JSON.stringify(messagePayload);

  await channel.sendText(jsonString);

  console.log(`Notified user client with the following JSON: ${jsonString}`);
}

async function notifyTestingClientofUserConfirmed(id: string){
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
    message: "Confirmed",
    user: id
  };

  const jsonString = JSON.stringify(messagePayload);

  await channel.sendText(jsonString);

  console.log(`Notified user client with the following JSON: ${jsonString}`);
}

async function notifyTestingClientofUsersInMatch(player1: string, player2: string){
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
    message: "InMatch",
    matchedUsers: [player1, player2]
  };

  const jsonString = JSON.stringify(messagePayload);

  await channel.sendText(jsonString);

  console.log(`Notified user client with the following JSON: ${jsonString}`);
}




