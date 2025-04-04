import { Channel, Message, User } from "@pubnub/chat";
import { getPubNubChatInstance } from "../utils/pubnub";
import { pairUsersBySkill } from "./sbm";
import { getOrCreateChannel, notifyClient, sendIlluminateData, sendTextWithRetry, updatePlayerMetadataWithRetry } from "../utils/chatSDK";
import { delay } from "../utils/general";
import { retryOnFailure } from "../utils/error";
import { simulateGame } from "./game";
import { createSessionAPI } from "../api/session";

const serverID = "server"

/**
 * Process matchmaking logic
 *
 * This function receives a list of players/members and pairs them up based on predefined criteria
 * (such as skill level and latency). After pairing the members, it triggers the pre-lobby setup where players
 * will confirm their participation in the match. Unpaired user IDs are added to the list and passed back through a callback.
 *
 * @param members - List of players or users to be paired for matchmaking.
 * @param onMatched - Callback function to handle matched and unpaired user IDs.
 */
export async function processMatchMaking(
  members: User[],
  onFinish: (unpaired: string[]) => void
) {
  // Pair members using the latency and skill-based matchmaking algorithm
  const { pairs, unpaired } = pairUsersBySkill(members);

  // Process each pair of players
  for (const [player1, player2] of pairs) {
    // Notify Testing Client of Matched Players
    await notifyTestingClientofMatchedUsers(player1.id, player2.id);

    // Create a pre-lobby listener to handle confirmation between the two players
    await createPreLobbyListener(player1, player2);
  }

  // Pass matched and unpaired user IDs to the callback
  onFinish(unpaired);
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
  try {
    const waitTime = 3000;
    await delay(waitTime); // Wait 3 seconds to simulate network delay

    // Get PubNub instance and retry if the operation fails
    const chat = await retryOnFailure(() => getPubNubChatInstance(serverID), 3, 1000);

    // Check and create channels for each player with retries
    const channel1 = await retryOnFailure(() => getOrCreateChannel(chat, `Matchmaking-In-Progress-${player1Id}`), 3, 1000);
    const channel2 = await retryOnFailure(() => getOrCreateChannel(chat, `Matchmaking-In-Progress-${player2Id}`), 3, 1000);

    if(channel1 && channel2){
      // Create a shared lobby ID for both players
      const sharedLobbyID = `pre-lobby-${player1Id}-${player2Id}`;

      // Notify both players of the shared matchmaking channel
      await sendTextWithRetry(channel1, sharedLobbyID);
      await sendTextWithRetry(channel2, sharedLobbyID);
    }
  } catch (e) {
    console.error("Failed to notify clients of shared matchmaking channel:", e);
  }
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
  try {
    const chat = await retryOnFailure(() => getPubNubChatInstance(serverID), 3, 1000);
    const preLobbyChannelID = `pre-lobby-${player1.id}-${player2.id}`;

    // Get or create the pre-lobby channel where confirmation takes place
    let preLobbyChannel = await retryOnFailure(() => getOrCreateChannel(chat, preLobbyChannelID), 3, 1000);

    if(preLobbyChannel){
      // Notify both players about the shared matchmaking channel
      await notifyClientsOfSharedMatchmakingChannel(player1.id, player2.id);

      let player1Confirmed = false;
      let player2Confirmed = false;

      // Set up a timeout to cancel confirmation after 30 seconds
      const confirmationTimeout = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), 30000);
      });

      // Listen for confirmation from both players
      const confirmationPromise = new Promise((resolve) => {
        preLobbyChannel.join(async (message: Message) => {
          try {
            if (message.content.text === "match_confirmed") {
              const { userId } = message;
              await notifyTestingClientofUserConfirmed(userId);

              // Update player confirmation status
              if (userId === player1.id) player1Confirmed = true;
              if (userId === player2.id) player2Confirmed = true;

              if (player1Confirmed && player2Confirmed) resolve('confirmed');
            }
          } catch (error) {
            console.error("Error processing player confirmation:", error);
          }
        });
      });

      // Wait for both confirmations or timeout
      const result = await Promise.race([confirmationPromise, confirmationTimeout]);

      if (result === 'confirmed') {
        // ✅ Call the createSession API
        const sessionId = await createSessionAPI(player1.id, player2.id);

        if (sessionId) {
          console.log(`🎮 Session created successfully: ${sessionId}`);
          await createChannelLobby(player1, player2, preLobbyChannel);
          await simulateGame(player1, player2, sessionId);
          await notifyClientofMatchFinished(player1.id, player2.id);
        } else {
          console.error("❌ Failed to create session before starting game!");
        }
      } else if (result === 'timeout') {
        await punishUnconfirmedPlayers(player1, player2, player1Confirmed, player2Confirmed);
        await sendTextWithRetry(preLobbyChannel, "TIMEOUT");
      }
    }
  } catch (e) {
    console.error("Error in createPreLobbyListener: ", e);
  }
}

// Helper function to punish unconfirmed players
async function punishUnconfirmedPlayers(player1: User, player2: User, player1Confirmed: boolean, player2Confirmed: boolean) {
  try {
    if (!player1Confirmed) {
      await updatePlayerMetadataWithRetry(player1, { punished: true, searching: false, confirmed: false });
      if (player2Confirmed) {
        await updatePlayerMetadataWithRetry(player2, { searching: false, confirmed: false });
      }
    }

    if (!player2Confirmed) {
      await updatePlayerMetadataWithRetry(player2, { punished: true, searching: false, confirmed: false });
      if (player1Confirmed) {
        await updatePlayerMetadataWithRetry(player1, { searching: false, confirmed: false });
      }
    }
  } catch (error) {
    console.error("Error punishing unconfirmed players:", error);
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
  try {
    const chat = await retryOnFailure(() => getPubNubChatInstance(serverID), 3, 1000);
    const gameLobbyChannelID = `game-lobby-${player1.id}-${player2.id}`;

    // Get or create the game lobby channel with retries
    let gameLobbyChannel = await retryOnFailure(() => getOrCreateChannel(chat, gameLobbyChannelID), 3, 1000);

    // Notify both players that the game lobby has been created
    await sendTextWithRetry(preLobbyChannel, `game-lobby-${player1.id}-${player2.id}`);

    // Update the database to mark players as done searching
    await updatePlayerMetadataWithRetry(player1, { searching: false });
    await updatePlayerMetadataWithRetry(player2, { searching: false });

    // Testing: Notify web client of users in match
    await notifyTestingClientofUsersInMatch(player1.id, player2.id);
  } catch (error) {
    console.error("Error in createChannelLobby:", error);
  }
}

// Testing Client Funcitons

// Testing Server to Client Functions
async function notifyTestingClientofMatchedUsers(player1: string, player2: string){
  try{
    // Create a JSON object that includes the list of user IDs
    const messagePayload = {
      message: "Matched",
      matchedUsers: [player1, player2]
    };

    await notifyClient(`Matchmaking-In-Progress-Client-Testing`, messagePayload);
  }
  catch(e){
    console.error("Failed to notify testing client for Matched request matcher.ts: ", e);
  }
}

async function notifyTestingClientofUserConfirmed(id: string){
  try{
    // Create a JSON object that includes the list of user IDs
    const messagePayload = {
      message: "Confirmed",
      user: id
    };

    await notifyClient(`Matchmaking-In-Progress-Client-Testing`, messagePayload);
  }
  catch(e){
    console.error("Failed to notify testing client for Confirmed request matcher.ts: ", e);
  }
}

async function notifyTestingClientofUsersInMatch(player1: string, player2: string){
  try{
    // Create a JSON object that includes the list of user IDs
    const messagePayload = {
      message: "InMatch",
      matchedUsers: [player1, player2]
    };

    await notifyClient(`Matchmaking-In-Progress-Client-Testing`, messagePayload);
  }
  catch(e){
    console.error("Failed to notify testing client for InMatch request matcher.ts: ", e);
  }
}

async function notifyClientofMatchFinished(player1: string, player2: string){
  try{
    // Create a JSON object that includes the list of user IDs
    const messagePayload = {
      message: "Finished",
      matchedUsers: [player1, player2]
    };

    await notifyClient(`Matchmaking-In-Progress-Client-Testing`, messagePayload);
  }
  catch(e){
    console.error("Failed to notify testing client for Finished request matcher.ts ", e);
  }
}

