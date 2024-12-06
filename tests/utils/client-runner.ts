// import { Chat, Message, User } from "@pubnub/chat";
// import { getPubNubChatInstance } from "../../src/utils/pubnub";

// /**
//  * Simulate a single user in the matchmaking process.
//  * Users join the matchmaking queue, listen for updates on their personal channel,
//  * and join the game lobby when notified.
//  *
//  * @param region - The user's matchmaking region.
//  * @param userID - Unique identifier for the user.
//  */
// async function simulateUser(region: string, userID: string) {
//   const chat: Chat = await getPubNubChatInstance(userID);
//   const user: User = chat.currentUser;
//   const personalChannelID = `Matchmaking-${user.id}`;

//   console.log(`Simulating user ${user.id} in region ${region}`);

//   // Ensure personal channel exists
//   let personalChannel = await chat.getChannel(personalChannelID);
//   if (!personalChannel) {
//     personalChannel = await chat.createPublicConversation({ channelId: personalChannelID });
//   }

//   // Listen for matchmaking messages on the personal channel
//   await personalChannel.join(async (message: Message) => {
//     const parsedMessage = parseMessage(message);

//     if (parsedMessage.type === "MATCH_FOUND") {
//       if (!parsedMessage.gameLobbyID) {
//         console.error("Received MATCH_FOUND but gameLobbyID is undefined.");
//         return;
//       }

//       console.log(`User ${userID} matched. Joining game lobby: ${parsedMessage.gameLobbyID}`);
//       await joinGameLobby(parsedMessage.gameLobbyID, chat);
//     } else if (parsedMessage.type === "TIMEOUT") {
//       console.log(`User ${userID} matchmaking timed out.`);
//       await leaveMatchmakingQueue(region, chat);
//     }
//   });

//   // Start the matchmaking process
//   await joinMatchmakingQueue(region, chat);
// }

// /**
//  * Start matchmaking by joining the regional queue.
//  *
//  * @param region - The user's matchmaking region.
//  * @param chat - PubNub chat instance for the user.
//  */
// async function joinMatchmakingQueue(region: string, chat: Chat) {
//   try {
//     const matchmakingChannelID = `matchmaking-${region}`;
//     let matchmakingChannel = await chat.getChannel(matchmakingChannelID);

//     if (!matchmakingChannel) {
//       matchmakingChannel = await chat.createPublicConversation({ channelId: matchmakingChannelID });
//     }

//     await matchmakingChannel.join(() => {});
//     console.log(`User joined matchmaking queue: ${matchmakingChannelID}`);
//   } catch (error) {
//     console.error("Error joining matchmaking queue:", error);
//   }
// }

// /**
//  * Leave matchmaking by exiting the regional queue.
//  *
//  * @param region - The user's matchmaking region.
//  * @param chat - PubNub chat instance for the user.
//  */
// async function leaveMatchmakingQueue(region: string, chat: Chat) {
//   try {
//     const matchmakingChannelID = `matchmaking-${region}`;
//     const matchmakingChannel = await chat.getChannel(matchmakingChannelID);

//     if (matchmakingChannel) {
//       await matchmakingChannel.leave();
//       console.log(`User left matchmaking queue: ${matchmakingChannelID}`);
//     }
//   } catch (error) {
//     console.error("Error leaving matchmaking queue:", error);
//   }
// }

// /**
//  * Join a game lobby and simulate game participation.
//  *
//  * @param gameLobbyID - The ID of the game lobby to join.
//  * @param chat - PubNub chat instance for the user.
//  */
// async function joinGameLobby(gameLobbyID: string, chat: Chat) {
//   try {
//     let gameLobbyChannel = await chat.getChannel(gameLobbyID);
//     if (!gameLobbyChannel) {
//       gameLobbyChannel = await chat.createPublicConversation({ channelId: gameLobbyID });
//     }

//     await gameLobbyChannel.join(() => {});
//     console.log(`User joined game lobby: ${gameLobbyID}`);

//     // Simulate game participation for 2 minutes
//     await new Promise((resolve) => setTimeout(resolve, 120000));

//     await gameLobbyChannel.leave();
//     console.log(`User left game lobby: ${gameLobbyID}`);
//   } catch (error) {
//     console.error("Error joining game lobby:", error);
//   }
// }

// /**
//  * Parse a received message for type and content.
//  *
//  * @param message - The PubNub message received.
//  * @returns Parsed message object.
//  */
// function parseMessage(message: Message): { type: string; gameLobbyID?: string } {
//   try {
//     return JSON.parse(message.content.text);
//   } catch {
//     return { type: "UNKNOWN" };
//   }
// }