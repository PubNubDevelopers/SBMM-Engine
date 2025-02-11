import { calculateCompatibilityScore } from "../core/sbm";
import { Chat, User } from "@pubnub/chat";
import { fetchUsersByIds } from "../sim/main";
import { getUUIDs } from "../utils/general";
import { getPubNubChatInstance } from "../utils/pubnub";
import { retryOnFailure } from "../utils/error";

// Helper function to clean user objects
const cleanUser = (user: User) => ({
  id: user.id,
  name: user.name,
  profileUrl: user.profileUrl,
  custom: user.custom,
  updated: user.updated,
  status: user.status,
  type: user.type,
  lastActiveTimestamp: user.lastActiveTimestamp,
});

export async function handleMatchmakingRequest(req: any, res: any) {
  try {
    console.log(JSON.stringify(req.body));
    const userID = req.body.userId;
    let chat: Chat;

    chat = await getPubNubChatInstance("server");

    let user: User | null = await chat.getUser(userID);

    if(!user){
      return res.status(404).json({error: "User is not found"});
    }

    let users: User[] = [];

    await retryOnFailure(async () => {
      // Fetch users from the database
      users = await fetchUsersByIds(getUUIDs());
    }, 3, 1000);

    if (!users) {
      return res.status(404).json({ error: "No available players for matchmaking" });
    }

    const { toxicityLevel, playStyle, elo, region, preferredGameMode } = user.custom;

    // Run matchmaking algorithm
    const bestMatches = calculateCompatibilityScore(toxicityLevel, playStyle, elo, region, preferredGameMode, users);

    // Clean user objects before returning (removes circular references)
    const sanitizedMatches = bestMatches.map(cleanUser);

    return res.json({
      message: "Matchmaking response sent",
      players: sanitizedMatches,
    });


  } catch (error) {
    console.error("Error in matchmaking:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
