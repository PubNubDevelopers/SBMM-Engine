import { Channel, Chat, Membership, Message, User } from "@pubnub/chat";
import { v4 as uuidv4 } from 'uuid';
import { getPubNubChatInstance, getWebPubNubChatInstance } from "../../src/utils/pubnub";

// Define the regions for matchmaking
const regions = ['us-east-1', 'us-west-1', 'eu-central-1', 'ap-southeast-1'];

/**
 * Simulate 10 matchmaking users from different regions
 *
 * This function creates 10 users and assigns them to random regions from the predefined regions list.
 * Each user is then simulated to join the matchmaking process.
 */
export async function simulateMatchmakingUsers() {
  const numberOfUsers = 10; // Number of users to simulate
  const usersPromises: Promise<void>[] = []; // Array to hold promises for each user simulation

  // Loop through the number of users and assign each a random region
  for (let i = 0; i < numberOfUsers; i++) {
    const region = 'us-east-1';
    // Create a consistnat userID
    const userID = uuidv4();
    usersPromises.push(simulateUser(region, userID)); // Simulate each user and add to promises array
  }

  // Wait for all user simulations to complete
  await Promise.all(usersPromises);
}

/**
 * Simulate an individual user with a specific region
 *
 * This function simulates an individual user joining a matchmaking channel, listens for pre-lobby messages,
 * and handles the user joining the pre-lobby or game lobby based on received messages.
 *
 * @param region - The region assigned to the user (e.g., 'us-east-1')
 * @param userIndex - The index number of the user being simulated
 */
export async function simulateUser(region: string, userID: string) {
  // Create a progress bar for this user
  const chat: Chat = await getWebPubNubChatInstance(userID); // Get a new instance of a random user
  const user: User = chat.currentUser; // Fetch the current user for the chat instance
  let personalChannelID: string = `Matchmaking-In-Progress-${user.id}`;
  let gameLobbyChannelID: string | undefined; // To store the game lobby ID if received
  let joinedPreLobby = false;

  /**
   * Join the pre-lobby channel and listen for updates
   *
   * This function joins the pre-lobby channel and waits for a message indicating the game lobby ID.
   * Once received, it joins the game lobby and leaves the pre-lobby.
   */
  async function joinPreLobby(preLobbyChannel: Channel) {
    // Join the pre-lobby channel and listen for updates
    await preLobbyChannel.join(async (message: Message) => {

      // If a game lobby message is received, handle joining the game lobby
      if (message.content.text.startsWith(`game-lobby-`)) {
        gameLobbyChannelID = message.content.text; // Save the game lobby channel ID

        joinGameLobby(gameLobbyChannelID, chat); // Join the game lobby using the gameLobbyChannelID and user's ID

        await preLobbyChannel.leave(); // Leave the pre-lobby after joining the game lobby
      }
    });
  }

  /**
   * Define a matchmaking channel based on the user's region and index
   *
   * This function retrieves a matchmaking channel for the user based on their region and index,
   * then joins the channel and listens for matchmaking-related messages.
   */
  let userChannel: Channel | null = await chat.getChannel(personalChannelID);

  if(!userChannel){
    userChannel = await chat.createPublicConversation({channelId: personalChannelID});
  }

  // User joins the matchmaking channel and listens for messages
  await userChannel?.join(async (message: Message) => {
    try {
      let parsedMessage: any;

      // Try to parse the message as JSON
      try {
        parsedMessage = JSON.parse(message.content.text);
      } catch (error) {
        // If parsing fails, treat it as a plain string
        parsedMessage = { message: message.content.text };
      }

      // Handle pre-lobby messages (whether as JSON or plain text)
      if (parsedMessage.message && parsedMessage.message.startsWith("pre-lobby-")) {
        console.log("Received Pre-Lobby Joining request for user: ", user.id);
        // If the message contains a pre-lobby channel ID
        const preLobbyChannelID = parsedMessage.message; // Save the pre-lobby channel ID

        const preLobbyChannel = await chat.getChannel(preLobbyChannelID); // Retrieve the pre-lobby channel instance

        if (preLobbyChannel === null) {
          throw new Error("Error finding pre-lobby channel"); // Throw error if the channel cannot be found
        }
        if(!joinedPreLobby){
          joinedPreLobby = true;
          await joinPreLobby(preLobbyChannel); // Join the pre-lobby
          console.log("Confirming match for: ", userID);
          await simulateJoiningLobby(preLobbyChannel); // Simulate the user joining the pre-lobby
        }
      } else if (parsedMessage.message === `Processing`) {
        await stopMatchmakingRequest(region, chat); // Stop the matchmaking request
      } else if (parsedMessage.message === `TIMEOUT`) {
        await stopMatchmakingRequest(region, chat); // Stop the matchmaking request due to timeout
      }
    } catch (e) {
      console.log("Error with the matchmaking request: ", e); // Log error
      await stopMatchmakingRequest(region, chat); // Stop the matchmaking request on error
    }
  });

  await startMatchmakingRequest(region, chat);
}

/**
 * Start a matchmaking request in a specific region
 *
 * This function starts a matchmaking request by joining the matchmaking channel associated with the region.
 *
 * @param region - The region where matchmaking will take place
 * @param chat - The current chat instance
 */
async function startMatchmakingRequest(region: string, chat: Chat) {
  try {
    const regionalMatchmakingChannelID = `matchmaking-${region}`; // Define the matchmaking channel ID based on region
    const regionalMatchmakingChannel: Channel | null = await chat.getChannel(regionalMatchmakingChannelID); // Fetch the matchmaking channel for the region

    if (!regionalMatchmakingChannel) {
      throw new Error("Failed to find matchmaking channel"); // Throw an error if the matchmaking channel is not found
    }

    // Join the regional matchmaking channel (no message handling for simplicity)
    regionalMatchmakingChannel.join((_) => {});
  } catch (e) {
    console.log('(Client) Error starting matchmaking request: ', e); // Log error if the matchmaking request fails
  }
}

/**
 * Stop a matchmaking request in a specific region
 *
 * This function stops a matchmaking request by leaving the matchmaking channel associated with the region.
 *
 * @param region - The region where matchmaking is being stopped
 * @param chat - The current chat instance
 */
async function stopMatchmakingRequest(region: string, chat: Chat) {
  try {
    const regionalMatchmakingChannelID = `matchmaking-${region}`; // Define the matchmaking channel ID based on region
    const regionalMatchmakingChannel: Channel | null = await chat.getChannel(regionalMatchmakingChannelID); // Fetch the matchmaking channel for the region

    if (!regionalMatchmakingChannel) {
      throw new Error("Failed to find matchmaking channel"); // Throw an error if the channel is not found
    }

    const leave = await regionalMatchmakingChannel.leave(); // Attempt to leave the matchmaking channel

    if (!leave) {
      throw new Error("Failed to leave matchmaking request"); // Throw an error if leaving the channel fails
    }
  } catch (e) {
    console.log('(Client) Error leaving matchmaking request: ', e); // Log error if stopping the matchmaking request fails
  }
}

/**
 * Simulate a user joining a pre-lobby channel
 *
 * This function simulates a delay before a user joins the pre-lobby and sends a "match_confirmed" message.
 *
 * @param preLobbyChannel - The pre-lobby channel the user is joining
 * @param callback - A function to execute after the "match_confirmed" message is sent
 */
async function simulateJoiningLobby(preLobbyChannel: Channel) {
  // // Generate a random delay between 0 and 30 seconds
  // const randomDelay = Math.floor(Math.random() * 10000); // Time in milliseconds

  // // Wait for the random amount of time before proceeding
  // await new Promise((resolve) => setTimeout(resolve, randomDelay));

  // Send the "match_confirmed" message after the delay
  await preLobbyChannel.sendText("match_confirmed");
}

/**
 * Simulate joining a game lobby after leaving the pre-lobby
 *
 * This function logs the user joining the game lobby.
 *
 * @param gameLobbyID - The ID of the game lobby the user will join
 * @param userID - The ID of the user joining the game lobby
 */
async function joinGameLobby(gameLobbyID: string, chat: Chat) {

  const gameLobbyChannel: Channel | null = await chat.getChannel(gameLobbyID); // Fetch thet gamelobby

  if (!gameLobbyChannel) {
    throw new Error("Failed to find matchmaking channel"); // Throw an error if the channel is not found
  }

  await gameLobbyChannel.join((_) => {})

  // Wait for 2 minutes (120,000 milliseconds)
  await new Promise((resolve) => setTimeout(resolve, 120000));

  await gameLobbyChannel.leave();
}

