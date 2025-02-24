import { Message } from "@pubnub/chat";
import { getPubNubChatInstance } from "../utils/pubnub";
import { getOrCreateChannel } from "../utils/chatSDK";

// Function to simulate player matchmaking and respond
export async function simulatePlayer() {
  try {
    // Initialize PubNub Chat instance
    let chat = await getPubNubChatInstance("server");

    // Create or get channel
    let channel = await getOrCreateChannel(chat, "create_player");

    if (channel) {
      // Listen for incoming messages
      channel.join(async (message: Message) => {
        try {
          const json = JSON.parse(message.content.text);
          if (json.type === "MatchmakingRequest") {
            console.log("Received matchmaking request:", json);

            // Simulate 5 players
            const players = ["001b97ba-d6d3-4aff-b0b1-faa7f167a13c", "0080b353-0a1e-4f8a-b2f7-73520b634a29", "00878cfe-d328-4730-94e6-b37046a7e6e6", "0129e344-5e2d-4ed2-bb3f-1cbfe5db271b"];

            // Send response back to the channel
            await channel.sendText(JSON.stringify({
                type: "MatchmakingResponse",
                players,
              }),
            );
          }
        } catch (err) {
          console.error("Error processing message:", err);
        }
      });
    }
  } catch (e) {
    console.error("Error in simulatePlayer:", e);
  }
}