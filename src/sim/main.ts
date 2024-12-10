import { Chat, Membership, User } from "@pubnub/chat";
import dotenv from "dotenv";
import { getPubNubChatInstance } from "../utils/pubnub"; // Custom utility
import { generateUsername } from "unique-username-generator";
import { simulateUser } from "./runner";

dotenv.config(); // Load environment variables

let chat: Chat;
const userStatusMap = new Map<string, string>();
let users: User[] = [];
const cooldownMap = new Map(); // Tracks users' cooldown periods

let userTracker: string[] = [];
let channelTracker: string[] = [];

export async function simulateMatchmaking() {
  try {
    // Initialize PubNub Chat instance
    chat = await getPubNubChatInstance("server");

    // Fetch and clean all users
    await initializeUsers();

    // Start organic matchmaking simulation
    await organicallySimulateMatchmaking();

  } catch (error) {
    console.error("Error initializing server:", error);
  }
}

/**
 * Simulates matchmaking organically for users over time.
 */
async function organicallySimulateMatchmaking() {
  const getEligibleUser = () => {
    for (let [userId, status] of userStatusMap) {
      if (status === "Finished" && !cooldownMap.has(userId)) {
        return { id: userId };
      }
    }
    return null; // No eligible users found
  };

  const setCooldown = (userId: string) => {
    const cooldownTime = Math.floor(Math.random() * (1200000 - 30000 + 1)) + 30000;
    cooldownMap.set(userId, Date.now() + cooldownTime);
    setTimeout(() => {
      cooldownMap.delete(userId); // Remove from cooldown after time expires
      userStatusMap.set(userId, "Finished");
    }, cooldownTime);
  };

  setInterval(async () => {
    const eligibleUser = getEligibleUser();
    if (eligibleUser) {
      userStatusMap.set(eligibleUser.id, "Joining");
      await simulateUser(eligibleUser.id, userTracker, channelTracker, (channelID) => {
        if(channelTracker.length > 100){
          channelTracker.pop();
        }
        if(!channelTracker.includes(channelID)){
          channelTracker.push(channelID);
        }
      }); // Simulate matchmaking
      userStatusMap.set(eligibleUser.id, "InMatch");
      userTracker = getUserIdsWithoutCooldown();

      // Simulate user finishing a match
      setTimeout(() => {
        userStatusMap.set(eligibleUser.id, "Finished");
        setCooldown(eligibleUser.id); // Apply cooldown
      }, Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000); // Match duration 5-15 seconds
    } else {
      // console.log("No eligible users for simulation at this time.");
    }
  }, Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000); // Random delay between 1-5 seconds
}

/**
 * Initializes users by fetching, cleaning, and organizing them.
 */
async function initializeUsers() {
  try {
    let users = await fetchUsersByIds([
      "7094df60-11d9-47fe-8690-10b5932b3a29",
      "5c44ac5e-23eb-455f-8100-23ba69969225",
      "3b598d50-3582-4284-b2eb-ca1842bd1ae2",
      "0812a3db-ea89-40a4-ad79-c3acc4a2e578",
      "1f18ae65-398b-4718-8fa4-18bcee5cfb22",
      "1444d002-6145-4521-a47a-c1ffedfb9765",
      "eb688e7b-7b5d-4a4f-af16-a842f6a15845",
      "62ad1b37-fe77-40ec-895c-572ad0b7232a",
      "5d62b43b-7216-4257-8f85-001871f65981",
      "user-998",
      "user-959",
      "user-949",
      "user-937",
      "user-913",
      "user-911",
      "user-910",
      "user-908",
      "user-898",
      "user-880",
      "user-866",
      "user-848",
      "user-847",
      "user-837",
      "user-833",
      "user-825",
      "user-816",
      "user-811",
      "user-790",
      "user-778",
      "user-761",
      "user-759",
      "user-755",
      "user-741",
      "user-740",
      "user-74",
      "user-730",
      "user-727",
      "user-719",
      "user-707",
      "user-706",
      "user-703",
      "user-702",
      "user-701",
      "user-666",
      "user-649",
      "user-615",
      "user-58",
      "user-560",
      "user-557",
      "user-555",
      "user-549",
      "user-540",
      "user-531",
      "user-525",
      "user-515",
      "user-50",
      "user-498",
      "user-495",
      "user-490",
      "user-483",
      "user-457",
      "user-434",
      "user-427",
      "user-404",
      "user-399",
      "user-390",
      "user-387",
      "user-380",
      "user-355",
      "user-352",
      "user-342",
      "user-33",
      "user-327",
      "user-318",
      "user-317",
      "user-311",
      "user-293",
      "user-279",
      "user-260",
      "user-252",
      "user-248",
      "user-243",
      "user-213",
      "user-197",
      "user-19",
      "user-177",
      "user-173",
      "user-162",
      "user-161",
      "user-14",
      "user-139",
      "user-124",
      "user-116",
      "da8a747f-b0fe-4bf4-bfe3-8360abac4a85",
      "9bd55bd5-1ca0-4fd1-b9b4-b2f26240d709",
      "24d48e78-5dbe-440f-8887-40ba51a947f7",
      "d1d32a18-a9b4-4e3d-aa09-6a914091c45a",
      "5acc0c67-8355-4aea-b202-9fa376151826",
      "001b97ba-d6d3-4aff-b0b1-faa7f167a13c",
      "eeb379d1-5224-46a5-9706-8b89eeb5e747"
    ]);

    if (users) {
      users = await cleanUserData(users);

      users.forEach((user) => {
        userStatusMap.set(user.id, "Finished");
      });
    }
  } catch (error) {
    console.error("Error fetching users:", error);
  }
}

/**
 * Cleans user data and ensures all fields are present.
 */
async function cleanUserData(users: User[]): Promise<User[]> {
  const allUsers: User[] = [];

  await Promise.all(users.map(async (user) => {
      let needsUpdate = false;
      const updatedData: {
        name?: string;
        profileUrl?: string;
        custom: {
          elo: number;
          punished: boolean;
          confirmed: boolean;
          inMatch: boolean;
          inPreLobby: boolean;
          server: string;
          latency: number;
          searching: boolean;
        };
      } = { custom: {} as any };

      if (!user.name || /^\d/.test(user.name)) {
        updatedData.name = generateUsername();
        needsUpdate = true;
      }

      if (!user.profileUrl) {
        updatedData.profileUrl = `/assets/Avatar${Math.floor(Math.random() * 6) + 1}.png`;
        needsUpdate = true;
      }

      updatedData.custom = {
        elo: generateLongTailElo(),
        punished: user.custom?.punished ?? (needsUpdate = true, false),
        confirmed: user.custom?.confirmed ?? (needsUpdate = true, false),
        inMatch: user.custom?.inMatch ?? (needsUpdate = true, false),
        inPreLobby: user.custom?.inPreLobby ?? (needsUpdate = true, false),
        server: user.custom?.server ?? (needsUpdate = true, "us-east-1"),
        latency: user.custom?.latency ?? (needsUpdate = true, Math.floor(Math.random() * 100) + 20),
        searching: user.custom?.searching ?? (needsUpdate = true, false),
      };

      try {
        const updatedUser = await user.update(updatedData);
        allUsers.push(updatedUser);
      } catch (error) {
        console.error(`Error updating user ${user.id}:`, error);
      }
    })
  );

  return allUsers;
}

async function fetchUsersByIds(ids: string[]): Promise<User[]> {
  if(chat){
    try {
      // Create the filter expression for the given list of IDs
      const filterExpression = ids.map((id) => `id == "${id}"`).join(" || ");

      // Fetch users from PubNub with the filter expression
      const response = await chat.getUsers({
        limit: 100, // Adjust the limit if necessary
        filter: filterExpression,
      });

      return response.users; // Return the list of fetched users
    } catch (error) {
      console.error("Error fetching users by IDs:", error);
      return [];
    }
  }
  return [];
}

/*
 * Generates an elo value with a long-tail distribution between 0 and 3000.
 * The result is skewed towards lower values, with fewer high-end values.
 */
function generateLongTailElo() {
  const maxElo = 3000;
  const random = Math.random();
  return Math.floor(maxElo * Math.pow(random, 3)); // Cubic distribution for long tail
}

function getUserIdsWithoutCooldown(): string[] {
  return Array.from(userStatusMap.keys()).filter((userId) => !cooldownMap.has(userId));
}
