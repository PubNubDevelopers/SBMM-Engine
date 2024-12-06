import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

interface UpdateChannelStatusParams {
  status: string;
  uuid: string;
  channelId: string;
}

export async function updateChannelStatus({
  status,
  uuid,
  channelId,
}: UpdateChannelStatusParams): Promise<void> {
  const sub_key = process.env.SUBSCRIBE_KEY;

  if (!sub_key) {
    console.error("Subscribe key is missing from environment variables.");
    return;
  }

  // Remove all special characters from status
  const cleanedStatus = status.replace(/[^a-zA-Z0-9 ]/g, ""); // Keeps only letters, numbers, and spaces

  const data = JSON.stringify({
    set: [
      {
        channel: {
          id: channelId,
        },
        status: cleanedStatus,
        custom: {}
      },
    ],
  });

  const config = {
    method: "patch",
    maxBodyLength: Infinity,
    url: `https://ps.pndsn.com/v2/objects/${sub_key}/uuids/${uuid}/channels?include=custom`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data: data,
  };

  try {
    const response = await axios.request(config);

  } catch (error) {
    console.error("Error updating channel status:", error);
  }
}



