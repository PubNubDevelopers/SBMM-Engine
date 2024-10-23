import { Channel, Membership, Message, User } from "@pubnub/chat";
import { getPubNubInstance } from "../utils/pubnub";

/**
 * Process matchmaking logic
 */
export async function processMatchMaking(channel: any, members: any[]) {
  // Pair members based on some criteria (e.g., skill rating)
  const pairs = pairMembers(members);

  for (const [player1, player2] of pairs){
    console.log(`Matched players: ${player1.id} and ${player2.id}`);

    // Send match message to both users
    await notifyClientsOfSharedMatchmakingChannel(player1.id, player2.id);

    // Create a pre-lobby listener for confirmation
    await createPreLobbyListener(player1, player2);
  }
}

/**
 * Pair members for matchmaking based on skill or other criteria
 */
function pairMembers(members: Membership[]): [User, User][] {
  const pairs: [User, User][] = [];

  // sort members by skill, region, or any other matchmaking critera
  // Assuming skill ELO rating exsists in the user
  const sortedMembers = members.sort((a, b) => a.user.custom.elo - b.user.custom.elo);

  // Create pairs from sorted members
  for(let i = 0; i < sortedMembers.length; i += 2){
    if(sortedMembers[i + 1]){
      pairs.push([sortedMembers[i].user, sortedMembers[i + 1].user]);
    }
  }

  return pairs;
}

/**
 * Notifify clients of shared matchmaking channel
 */
async function notifyClientsOfSharedMatchmakingChannel(player1Id: string, player2Id: string){
  const chat = await getPubNubInstance();

  let channel1 = await chat.getChannel(`Matchmaking-In-Progress-${player1Id}`);
  let channel2 = await chat.getChannel(`Matchmaking-In-Progress-${player2Id}`);

  if(channel1 === null){
    channel1 = await chat.createPublicConversation({
      channelId: `Matchmaking-In-Progress-${player1Id}`
    });
  }

  if(channel2 === null){
    channel2 = await chat.createPublicConversation({
      channelId: `Matchmaking-In-Progress-${player2Id}`
    })
  }

  // Define a shared lobby ID to notify the clients on what channel to send the message through when they have confirmed the match
  const sharedLobbyID = `pre-lobby-${player1Id}-${player2Id}`;

  // Notify the client that their matchmaking request is being processed
  await channel1.sendText(sharedLobbyID);
  await channel2.sendText(sharedLobbyID);

  console.log(`Notified user ${player1Id} and ${player2Id} that their matchmaking request is being processed.`);
}

/**
 * Create a pre-lobby listener to confirm the match
 */
async function createPreLobbyListener(player1: User, player2: User) {
  const chat = await getPubNubInstance();
  const preLobbyChannelID = `pre-lobby-${player1.id}-${player2.id}`;

  // Create or get the pre-lobby channel
  let preLobbyChannel = await chat.getChannel(preLobbyChannelID);
  if (!preLobbyChannel) {
    preLobbyChannel = await chat.createPublicConversation({ channelId: preLobbyChannelID });
    console.log(`Created pre-lobby channel: ${preLobbyChannelID}`);
  }

  let player1Confirmed = false;
  let player2Confirmed = false;

  // Set a timeout of 30 seconds for confirmation
  const confirmationTimeout = new Promise((resolve) => {
    setTimeout(() => {
      resolve('timeout');
    }, 30000); // 30 seconds
  });

  // Listener for confirmation from both players
  const confirmationPromise = new Promise((resolve) => {
    preLobbyChannel.join(async (message: Message) => {
      if (message.content.text === "match_confirmed") {
        const { userId } = message;

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

  // Wait for either both players to confirm or the timeout
  const result = await Promise.race([confirmationPromise, confirmationTimeout]);

  if (result === 'confirmed') {
    // If both players confirm, create the actual game lobby
    await createChannelLobby(player1, player2, preLobbyChannel);
  } else if (result === 'timeout') {
    console.log('Timeout: Both players did not confirm within 30 seconds');
    // Punish the player(s) who didn't confirm
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
 */
async function updatePlayerMetadata(user: User, newCustomData: any) {
  const chat = await getPubNubInstance();

  try {
    // First, get the current metadata for the user
    const userMetadata = user.custom;

    // Merge the new custom data with the existing custom data
    const updatedCustomData = {
      ...userMetadata.custom, // Existing custom data
      ...newCustomData        // New custom fields to add or update
    };

    // Now update the user metadata with the merged custom data
    await user.update({
      custom: updatedCustomData, // Update the metadata with merged data
    });

    console.log(`Player metadata updated for ${user.id} with data:`, updatedCustomData);
  } catch (error) {
    console.error(`Error updating metadata for user ${user.id}:`, error);
  }
}

/**
 * Create the actual game lobby once both players agree
 */
async function createChannelLobby(player1: User, player2: User, preLobbyChannel: Channel) {
  const chat = await getPubNubInstance();
  const gameLobbyChannelID = `game-lobby-${player1.id}-${player2.id}`;

  let gameLobbyChannel = await chat.getChannel(gameLobbyChannelID);

  if(!gameLobbyChannel){
    // Create the actual game lobby channel
    gameLobbyChannel = await chat.createPublicConversation({ channelId: gameLobbyChannelID });
    console.log(`Game lobby created: ${gameLobbyChannelID}`);
  }

  preLobbyChannel.sendText(`game-lobby-${player1.id}-${player2.id}`);
}

/**
 * Send matchmaking message to both users
 */
// async function sendMatchUserIdMessage(channel: Channel, userId1: string, userId2: string){
//   const chat = await getPubNubInstance();

//   // send a message to both players informing them of the match
//   await channel.sendText("")
// }




