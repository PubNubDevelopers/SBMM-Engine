import axios from "axios";
import { User } from "@pubnub/chat"; // Import the PubNub User type

const API_BASE_URL = "https://qm6liddj56.execute-api.us-west-2.amazonaws.com"; // Backend URL

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

    return response.data.players; // Returns the list of matched User objects
  } catch (error) {
    console.error("Error calling matchmaking API:", error);
    throw error;
  }
}