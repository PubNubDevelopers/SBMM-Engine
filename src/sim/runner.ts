import { Channel, Chat, Membership, Message, User } from "@pubnub/chat";
import { getPubNubChatInstance } from "../../src/utils/pubnub";
import { updateChannelStatus } from "../api/membership";
import { retryOnFailure } from "../utils/error";
import { updatePlayerMetadataWithRetry } from "../utils/chatSDK";

type UserTrackCallBackFunction = (data: string) => void;
type ChannelTrackCallBackFunction = (data: string) => void;

/**
 * Simulate an individual user with a specific region
 *
 * This function simulates an individual user joining a matchmaking channel, listens for pre-lobby messages,
 * and handles the user joining the pre-lobby or game lobby based on received messages.
 *
 * @param region - The region assigned to the user (e.g., 'us-east-1')
 * @param userIndex - The index number of the user being simulated
 */
export async function simulateUser(region: string, userID: string, userTracker: string[], channelTracker: string[], userTrackerCallBackFunction: UserTrackCallBackFunction, channelTrackerCallBackFunction: ChannelTrackCallBackFunction) {
  try {
    if(!userTracker.includes(userID)){
      userTrackerCallBackFunction(userID);
      userTracker.push(userID);
    }
    var startTime = Date.now();
    // Create a PubNub chat instance for the user
    const chat: Chat = await retryOnFailure(
      () => getPubNubChatInstance(userID),
      3,
      2000
    );
    const user: User = chat.currentUser;
    const personalChannelID = `Matchmaking-In-Progress-${user.id}`;
    let gameLobbyChannelID: string | undefined;
    let joinedPreLobby = false;

    // Helper to join a pre-lobby and listen for updates
    async function joinPreLobby(preLobbyChannel: Channel) {
      await retryOnFailure(async () => {
        await preLobbyChannel.join(async (message: Message) => {
          if (message.content.text.startsWith("game-lobby-")) {
            gameLobbyChannelID = message.content.text;
            await retryOnFailure(
              () => joinGameLobby(gameLobbyChannelID!, chat),
              3,
              2000
            );
            if(!channelTracker.includes(gameLobbyChannelID)){
              channelTrackerCallBackFunction(gameLobbyChannelID);
            }
            await updateMatchesFormed(chat, gameLobbyChannelID, channelTracker);
            await retryOnFailure(() => preLobbyChannel.leave(), 3, 2000);
          }
        });
      }, 3, 2000);
    }

    // Get or create the user's personal channel
    const userChannel = await retryOnFailure(async () => {
      const channel = await chat.getChannel(personalChannelID);
      return (
        channel || chat.createPublicConversation({ channelId: personalChannelID })
      );
    }, 3, 2000);

    // Join the personal channel and listen for matchmaking messages
    await retryOnFailure(async () => {
      await userChannel.join(async (message: Message) => {
        try {
          await updateStatsUser(chat, startTime, userTracker);
          const parsedMessage =
            tryParseJSON(message.content.text) || { message: message.content.text };

          if (parsedMessage.message?.startsWith("pre-lobby-")) {
            const preLobbyChannelID = parsedMessage.message;
            const preLobbyChannel = await retryOnFailure(
              () => chat.getChannel(preLobbyChannelID),
              3,
              2000
            );

            if (!preLobbyChannel) {
              throw new Error("Error finding pre-lobby channel");
            }

            if (!joinedPreLobby) {
              joinedPreLobby = true;
              await joinPreLobby(preLobbyChannel);
              await retryOnFailure(
                () => simulateJoiningLobby(preLobbyChannel),
                3,
                2000
              );
            }
          } else if (parsedMessage.message === "Processing") {
            await retryOnFailure(() => stopMatchmakingRequest(region, chat), 3, 2000);
          } else if (parsedMessage.message === "TIMEOUT") {
            await retryOnFailure(() => stopMatchmakingRequest(region, chat), 3, 2000);
          }
        } catch (error) {
          console.error("Error processing matchmaking message: ", error);
          await retryOnFailure(() => stopMatchmakingRequest(region, chat), 3, 2000);
        }
      });
    }, 3, 2000);

    // Start matchmaking request
    await retryOnFailure(() => startMatchmakingRequest(region, chat), 3, 2000);
  } catch (error) {
    console.error("Failed to simulate user:", error);
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
    var { membership, disconnect } = await regionalMatchmakingChannel.join((_) => {});
    try{
      await updateChannelStatus({
        status: regionalMatchmakingChannelID,
        uuid: membership.user.id,
        channelId: regionalMatchmakingChannelID
      });
      // Get or create the user's matchmaking channel
      let channel = await getOrCreateChannel(chat, `Matchmaking-In-Progress-${chat.currentUser.id}`);
      if(channel){
        // Convert the object to a JSON string
        const jsonString = "Hello World!";
        // Notify the client that their matchmaking request is being processed with the list of users as JSON
        await channel.sendText(jsonString);
      }

    }
    catch(e){
      console.error("Failed to update membership: ", e);
    }
  } catch (e) {
    console.log('(Client) Error starting matchmaking request: ', e); // Log error if the matchmaking request fails
  }
}

export async function getOrCreateChannel(chat: Chat, channelId: string) {
  try {
    let channel = await chat.getChannel(channelId);
    if (!channel) {
      channel = await chat.createPublicConversation({ channelId });
    }
    return channel;
  } catch (error) {
    console.log(error);
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

// Utility to safely parse JSON
function tryParseJSON(json: string): any | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function updateStatsUser(chat: Chat, startTime: number, userTracker: string[]) {
  try{
    const endTime = Date.now();
    const timeDifferenceInSeconds = (endTime - startTime) / 1000;

    let user: User | null = await chat.getUser("stats-sim");

    if(!user){
      user = await chat.createUser("stats-sim", {
        name: "Stats Data",
        custom: {
          totalPlayers: 0,
          avgWaitTime: 0,
          MatchesFormed: 0
        }
      });
    }

    var totalPlayers = user.custom?.totalPlayers ?? 0;
    var avgWaitTime = user.custom?.avgWaitTime ?? 0;
    var matchesFormed = user.custom?.matchesFormed ?? 0;

    totalPlayers = userTracker.length;
    avgWaitTime = (avgWaitTime * matchesFormed + timeDifferenceInSeconds) / (matchesFormed + 1);
    matchesFormed = matchesFormed + 1;

    const json = {
      totalPlayers: totalPlayers,
      avgWaitTime: avgWaitTime,
      matchesFormed: matchesFormed
    }

    await updatePlayerMetadataWithRetry(user, json);
  }
  catch(e){
    console.log("Failed to update stats user: ", e);
  }
}

async function updateMatchesFormed(chat: Chat, channel: string, channelTracker: string[]){
  if(channelTracker.length > 100){
    channelTracker.pop();
  }
  if(!channelTracker.includes(channel)){
    channelTracker.push(channel);
    let user: User | null = await chat.getUser("stats-sim");

    if(!user){
      user = await chat.createUser("stats-sim", {
        name: "Stats Data",
        custom: {
          totalPlayers: 0,
          avgWaitTime: 0,
          MatchesFormed: 0
        }
      });
    }

    var matchesFormed = user.custom?.matchesFormed ?? 0;
    matchesFormed = matchesFormed + 1;

    const json = {
      matchesFormed: matchesFormed
    }

    await updatePlayerMetadataWithRetry(user, json);
  }
}
