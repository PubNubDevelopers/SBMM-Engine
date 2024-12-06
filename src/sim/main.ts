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
      console.log(`User ${userId} is back in the matchmaking pool.`);
    }, cooldownTime);
  };

  setInterval(async () => {
    const eligibleUser = getEligibleUser();
    if (eligibleUser) {
      userStatusMap.set(eligibleUser.id, "Joining");
      console.log(`Simulating matchmaking for user: ${eligibleUser.id}`);
      await simulateUser("us-east-1", eligibleUser.id, userTracker, channelTracker, (userID) => {
        userTracker.push(userID);
      }, (channelID) => {
        if(channelTracker.length > 100){
          channelTracker.pop();
        }
        channelTracker.push(channelID);
      }); // Simulate matchmaking
      userStatusMap.set(eligibleUser.id, "InMatch");

      // Simulate user finishing a match
      setTimeout(() => {
        userStatusMap.set(eligibleUser.id, "Finished");
        console.log(`User ${eligibleUser.id} finished a match.`);
        setCooldown(eligibleUser.id); // Apply cooldown
      }, Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000); // Match duration 5-15 seconds
    } else {
      console.log("No eligible users for simulation at this time.");
    }
  }, Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000); // Random delay between 1-5 seconds
}

/**
 * Initializes users by fetching, cleaning, and organizing them.
 */
async function initializeUsers() {
  try {
    const response = await chat.getUsers({ limit: 100, sort: {name: "desc"} });
    if (response) {
      users = await cleanUserData(response.users);

      startMembershipCheckInterval();

      users.forEach((user) => {
        userStatusMap.set(user.id, "Finished");
      });

      console.log("Users initialized and status map updated.");
    }
  } catch (error) {
    console.error("Error fetching users:", error);
  }
}

// Sequential execution using setTimeout
async function startMembershipCheckInterval() {
  try {
    await checkForOutDatedMemberships();
  } catch (error) {
    console.error("Error checking memberships:", error);
  } finally {
    setTimeout(startMembershipCheckInterval, 60 * 1000); // Wait 1 minute before next call
  }
}


async function checkForOutDatedMemberships() {
  const tenMinutesInTimetokens = 10 * 60 * 1000 * 10_000; // 10 minutes in timeToken units

  await Promise.all(
    users.map(async (user) => {
      try {
        const obj = await user.getMemberships();
        const memberships = obj.memberships;

        memberships.forEach((membership: Membership) => {
          try {
            const timeToken = membership.lastReadMessageTimetoken;

            // Handle undefined timeToken
            if (timeToken === undefined) {
              console.warn(`timeToken is undefined for channel: ${membership.channel.id}`);
              return; // Skip processing this membership
            }

            const timeTokenBigInt = BigInt(timeToken); // Convert to BigInt
            const currentTimeToken = BigInt(Date.now()) * BigInt(10_000); // Current time in timeToken format
            const isOlderThanTenMinutes = currentTimeToken - timeTokenBigInt > BigInt(tenMinutesInTimetokens);

            const channelId = membership.channel.id;
            const startsWithCondition =
              channelId.startsWith("game-lobby") || channelId.startsWith("pre-lobby");

            if (isOlderThanTenMinutes && startsWithCondition) {
              membership.channel.delete();
              console.log(`Channel ${channelId} has been deleted`);
            }
          } catch (membershipError) {
            console.error(`Error processing membership for channel ${membership.channel.id}:`, membershipError);
          }
        });
      } catch (userError) {
        console.error(`Error retrieving memberships for user ${user.id}:`, userError);
      }
    })
  );
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
        elo: user.custom?.elo ?? (needsUpdate = true, generateLongTailElo()),
        punished: user.custom?.punished ?? (needsUpdate = true, false),
        confirmed: user.custom?.confirmed ?? (needsUpdate = true, false),
        inMatch: user.custom?.inMatch ?? (needsUpdate = true, false),
        inPreLobby: user.custom?.inPreLobby ?? (needsUpdate = true, false),
        server: user.custom?.server ?? (needsUpdate = true, "us-east-1"),
        latency: user.custom?.latency ?? (needsUpdate = true, Math.floor(Math.random() * 100) + 20),
        searching: user.custom?.searching ?? (needsUpdate = true, false),
      };

      if (needsUpdate) {
        try {
          const updatedUser = await user.update(updatedData);
          allUsers.push(updatedUser);
        } catch (error) {
          console.error(`Error updating user ${user.id}:`, error);
        }
      } else {
        allUsers.push(user);
      }
    })
  );

  return allUsers;
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