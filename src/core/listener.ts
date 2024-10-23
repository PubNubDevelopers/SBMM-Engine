import { Channel, Membership, Message } from "@pubnub/chat";
import { getPubNubInstance } from '../utils/pubnub';
import { processMatchMaking } from "./matcher";

const MATCHMAKING_INTERVAL_MS = 5000; // Interval for running the matchmaking process
const regions = ['us-east-1', 'us-west-1', 'eu-central-1', 'ap-southeast-1'];

/**
 * Start the matchmaking process loop
 */
export async function startMatchmaking() {
  const chat = await getPubNubInstance();

  for (const region of regions){
    const regionChannelID = `matchmaking-${region}`;
    let regionChannel = await chat.getChannel(regionChannelID);

    if(!regionChannel){
      regionChannel = await chat.createPublicConversation({channelId: regionChannelID});
      console.log(`Created channel: ${regionChannelID}`);
    }

    setInterval(async () => {
      // Get members from the matchmaking channel
      const members: Membership[] = await getChannelMembers(regionChannel);
      // Loop through members and let the client side know that users matchmaking request is being processed
      for (const member of members){
        const userId = member.user.id
        await notifiyClientMatchmakingStarted(userId);
      }

      if(members.length >= 2){
        // Process matchmaking logic
        await processMatchMaking(regionChannel, members);
      }
    }, MATCHMAKING_INTERVAL_MS);
  }
}

/**
 * Fetch members from the matchmaking channel
 */
async function getChannelMembers(channel: Channel): Promise<any[]> {
  const result = await channel.getMembers({
    limit: 100
  });
  console.log(`Found ${result.total} members in the channel.`);

  return result.members;
}

/**
 *
 * @param channel - the region channel
 * @param userId - The user to notifiy
 */
async function notifiyClientMatchmakingStarted(userId: string){
  const chat = await getPubNubInstance();

  let channel = await chat.getChannel(`Matchmaking-In-Progress-${userId}`);

  if(channel === null){
    channel = await chat.createPublicConversation({
      channelId: `Matchmaking-In-Progress-${userId}`
    });
  }

  // Notify the client that their matchmaking request is being processed
  channel.sendText(`Your matchmaking request is being processed for user: ${userId}`)

  console.log(`Notified user ${userId} that their matchmaking request is being processed.`);
}