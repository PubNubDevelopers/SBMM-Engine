import { Channel, Chat, Message, User } from "@pubnub/chat";
import { getPubNubChatInstance } from "../../src/utils/pubnub";
import { retryOnFailure } from "../utils/error";
import { sendIlluminateData, sendTextWithRetry, updatePlayerMetadataWithRetry } from "../utils/chatSDK";

type ChannelTrackCallBackFunction = (data: string) => void;

/**
 * Simulate an individual user with a specific region
 *
 * This function simulates an individual user joining a matchmaking channel, listens for matchmaking messages,
 * and handles the user joining the pre-lobby or game lobby based on received messages.
 *
 * @param region - The region assigned to the user (e.g., 'us-east-1')
 * @param userID - The ID of the user being simulated
 * @param userTracker - A tracker array for active users
 * @param channelTracker - A tracker array for active channels
 * @param userTrackerCallBackFunction - Callback to handle user tracking
 * @param channelTrackerCallBackFunction - Callback to handle channel tracking
 */
export async function simulateUser(
  userID: string,
  userTracker: string[],
  channelTracker: string[],
  channelTrackerCallBackFunction: ChannelTrackCallBackFunction
) {
  try {
    // Create a PubNub chat instance for the user
    const chat: Chat = await retryOnFailure(
      () => getPubNubChatInstance(userID),
      3,
      2000
    );

    const personalChannelID = `Matchmaking-In-Progress-${userID}`;
    let gameLobbyChannelID: string | undefined;
    let joinedPreLobby = false;

    // Get or create the matchmaking channel for the region
    const matchmakingChannelID = `matchmaking-us-east-1`;
    const matchmakingChannel = await retryOnFailure(
      () => getOrCreateChannel(chat, matchmakingChannelID),
      3,
      2000
    );

    if(matchmakingChannel){
      const startTime = Date.now();

      // Helper to join a pre-lobby and listen for updates
      async function joinPreLobby(preLobbyChannel: Channel) {
        await preLobbyChannel.join(async (message: Message) => {
          if (message.content.text.startsWith("game-lobby-")) {
            gameLobbyChannelID = message.content.text;

            // Join the game lobby
            await retryOnFailure(
              () => joinGameLobby(gameLobbyChannelID!, chat),
              3,
              2000
            );

            if (!channelTracker.includes(gameLobbyChannelID)) {
              channelTrackerCallBackFunction(gameLobbyChannelID);
            }

            await updateMatchesFormed(chat, gameLobbyChannelID, channelTracker);
            await retryOnFailure(() => preLobbyChannel.leave(), 3, 2000);
          }
        });
      }

      // Set up the user's personal channel for matchmaking messages
      const userChannel = await retryOnFailure(async () => {
        const channel = await chat.getChannel(personalChannelID);
        return (
          channel || chat.createPublicConversation({ channelId: personalChannelID })
        );
      }, 3, 2000);

      await userChannel.join(async (message: Message) => {
        try {
          const parsedMessage = tryParseJSON(message.content.text) || { message: message.content.text };

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
            await updateStatsUser(chat, startTime, userTracker);
            // await retryOnFailure(() => stopMatchmakingRequest(region, chat), 3, 2000);
          } else if (parsedMessage.message === "TIMEOUT") {
            // await retryOnFailure(() => stopMatchmakingRequest(region, chat), 3, 2000);
          }
        } catch (error) {
          console.error("Error processing matchmaking message: ", error);
          // await retryOnFailure(() => stopMatchmakingRequest(region, chat), 3, 2000);
        }
      });

      // Send a matchmaking request message to the matchmaking channel
      await retryOnFailure(async () => {
        await matchmakingChannel.sendText(
          JSON.stringify({ userID, message: "Matchmaking Request" })
        );
      }, 3, 2000);
    }
    else{
      console.error("Matchmaking Channel is not defined");
    }
  }
  catch (error) {
    console.error("Failed to simulate user:", error);
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
 * Simulate a user joining a pre-lobby channel
 *
 * This function simulates a delay before a user joins the pre-lobby and sends a "match_confirmed" message.
 *
 * @param preLobbyChannel - The pre-lobby channel the user is joining
 * @param callback - A function to execute after the "match_confirmed" message is sent
 */
async function simulateJoiningLobby(preLobbyChannel: Channel) {
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

  const gameLobbyChannel: Channel | undefined = await getOrCreateChannel(chat, gameLobbyID); // Fetch thet gamelobby

  if (!gameLobbyChannel) {
    throw new Error("Failed to find matchmaking channel"); // Throw an error if the channel is not found
  }

  await gameLobbyChannel.join((_) => {});

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
    let channel: Channel | null = await chat.getChannel("stats-sim");

    if(!channel){
      channel = await chat.createPublicConversation({ channelId: "stats-sim" });
    }

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
    avgWaitTime = timeDifferenceInSeconds;
    matchesFormed = matchesFormed + 1;

    const json = {
      totalPlayers: totalPlayers,
      avgWaitTime: avgWaitTime,
      matchesFormed: matchesFormed
    }

    await updatePlayerMetadataWithRetry(user, json);
    await sendIlluminateData({
      waitTime: timeDifferenceInSeconds
    });
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
