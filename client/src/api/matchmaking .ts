import axios from "axios";
import { User } from "@pubnub/chat"; // Import the PubNub User type

const API_BASE_URL = "http://34.219.145.240:3000"; // Backend URL

export async function sendMatchmakingRequest(
  uuid: string
): Promise<User[]> {
  try {
    const response = await axios.post<{ players: User[] }>(
      `${API_BASE_URL}/matchmaking`,
      {
        userId: uuid
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Matchmaking Response:", response.data.players);
    return response.data.players; // Returns the list of matched User objects
  } catch (error) {
    console.error("Error calling matchmaking API:", error);
    throw error;
  }
}