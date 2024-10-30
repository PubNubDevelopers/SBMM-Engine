import { Channel, Chat, Membership, Message, User } from "@pubnub/chat";
import { startPingPong } from "./test-latency-runner";
import { v4 as uuidv4 } from 'uuid';
import { getPubNubChatInstance } from "../../src/utils/pubnub";

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
    const region = 'us-east-1'; // Randomly pick a region
    usersPromises.push(simulateUser(region, i)); // Simulate each user and add to promises array
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
export async function simulateUser(region: string, userIndex: number) {
  console.log("Simulate single user request received");
  // Create a consistnat userID
  const userID = uuidv4();
  // Create a progress bar for this user
  const chat: Chat = await getPubNubChatInstance(userID); // Get a new instance of a random user
  const user: User = chat.currentUser; // Fetch the current user for the chat instance
  let personalChannelID: string = `Matchmaking-In-Progress-${user.id}`;
  let gameLobbyChannelID: string | undefined; // To store the game lobby ID if received

  /**
   * Join the pre-lobby channel and listen for updates
   *
   * This function joins the pre-lobby channel and waits for a message indicating the game lobby ID.
   * Once received, it joins the game lobby and leaves the pre-lobby.
   */
  async function joinPreLobby(preLobbyChannel: Channel) {
    // Join the pre-lobby channel and listen for updates
    await preLobbyChannel.join(async (message: Message) => {
      console.log(`(Client) Joined the pre-lobby channel: Listening for updates`);

      // If a game lobby message is received, handle joining the game lobby
      if (message.content.text.startsWith(`game-lobby-`)) {
        gameLobbyChannelID = message.content.text; // Save the game lobby channel ID

        joinGameLobby(gameLobbyChannelID, user.id); // Join the game lobby using the gameLobbyChannelID and user's ID

        await preLobbyChannel.leave(); // Leave the pre-lobby after joining the game lobby
      }
    });
  }

  /**
   * Update the current user to give the user a "fake" elo level
   * You might also want to specify the region within the app context of the user
  */
  await updateCurrentUser(Math.floor(Math.random() * 2001), user);

  /**
   * Define a matchmaking channel based on the user's region and index
   *
   * This function retrieves a matchmaking channel for the user based on their region and index,
   * then joins the channel and listens for matchmaking-related messages.
   */
  let userChannel: Channel | null = await chat.getChannel(personalChannelID);

  if(!userChannel){
    console.log(`Channel with ID: ${personalChannelID} was not created. Creating Channel...`);
    userChannel = await chat.createPublicConversation({channelId: personalChannelID});
    console.log(`Successfully created channel with ID: ${personalChannelID}`);
  }

  console.log(`(Server) User ${user.id} from region ${region} is joining channel ${userChannel?.id}`);

  // User joins the matchmaking channel and listens for messages
  await userChannel?.join(async (message: Message) => {
    console.log(`(Client) Message received by User ${user.id} from region ${region}:`, message.content.text);
    try {
      let parsedMessage: any;

      // Try to parse the message as JSON
      try {
        parsedMessage = JSON.parse(message.content.text);
      } catch (error) {
        // If parsing fails, treat it as a plain string
        parsedMessage = { message: message.content.text };
      }

      console.log("Parsed Message: ", parsedMessage);

      // Handle pre-lobby messages (whether as JSON or plain text)
      if (parsedMessage.message && parsedMessage.message.startsWith("pre-lobby-")) {
        // If the message contains a pre-lobby channel ID
        const preLobbyChannelID = parsedMessage.message; // Save the pre-lobby channel ID

        console.log("Received pre-lobby channel: ", preLobbyChannelID);

        const preLobbyChannel = await chat.getChannel(preLobbyChannelID); // Retrieve the pre-lobby channel instance

        if (preLobbyChannel === null) {
          throw new Error("Error finding pre-lobby channel"); // Throw error if the channel cannot be found
        }

        await joinPreLobby(preLobbyChannel); // Join the pre-lobby
        await simulateJoiningLobby(preLobbyChannel); // Simulate the user joining the pre-lobby
      } else if (parsedMessage.message === `Processing`) {
        // If the message indicates that the matchmaking is in progress
        console.log("Stopping matchmaking request"); // Log when matchmaking is stopped
        const matchedUsers: string[] = parsedMessage.matchedUsers as string[];
        const matchID: string = parsedMessage.matchID as string;
        await stopMatchmakingRequest(region, chat); // Stop the matchmaking request
        console.log("Starting Ping Pong");
        const layencyMap: Map<string, number> = await startPingPong(matchedUsers, userID);
        await sendLatencyMap(layencyMap, matchID, chat);
      } else if (parsedMessage.message === `TIMEOUT`) {
        // If the message indicates a timeout
        console.log("Matchmaking request timed out"); // Log timeout event
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
 * Update the current user to specify region and skill level
 *
 * @param elo
 */
async function updateCurrentUser(elo: number, user: User){
  try{
    const customData = user.custom || {};
    // Specifies the new data we want to upload to the user
    const newData = {
      elo: elo
    }
    // This ensures no prior data is overwritten within AppContext
    await user.update({
      custom: { ...customData, ...newData }
    });
  }
  catch(e){
    console.log("Failed to update the current users elo rating within AppContext: ", e);
  }
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

async function sendLatencyMap(latencyMap: Map<string, number>, matchID: string, chat: Chat){
  try{
    // Find latency map channel
    let channel = await chat.getChannel(`${matchID}-latency-channel`);

    if(!channel){
      throw new Error(`Can not find latency map channel at ID: ${matchID}-latency-channel`);
    }

    // Create a JSON object that includes the latencyMap
    const parsedMessage = {
      latencyMap: latencyMap
    }

    const jsonString = JSON.stringify(parsedMessage);

    // Send the latency map
    channel.sendText(jsonString);
  }
  catch(e){
    console.log("Error sending letency map: ", e);
  }
}

/**
 * Simulate a user joining a pre-lobby channel
 *
 * This function simulates a delay before a user joins the pre-lobby and sends a "match_confirmed" message.
 *
 * @param preLobbyChannel - The pre-lobby channel the user is joining
 */
async function simulateJoiningLobby(preLobbyChannel: Channel) {
  // Generate a random delay between 0 and 40 seconds
  const randomDelay = Math.floor(Math.random() * 40000); // Time in milliseconds

  // Wait for the random amount of time before proceeding
  await new Promise((resolve) => setTimeout(resolve, randomDelay));

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
function joinGameLobby(gameLobbyID: string, userID: string) {
  // console.log(`User: ${userID} has successfully joined game lobby: ${gameLobbyID}`);
}