import { User } from "@pubnub/chat";
import { minWeightAssign } from "munkres-algorithm";
import { getConstraints } from "./constraints";

/**
 * Calculate the score between two users based on multiple conditions.
 *
 * @param userA - First user.
 * @param userB - Second user.
 * @returns A score representing the cost of pairing these two users, or Infinity if pairing is not allowed.
 */
function calculateScore(userA: User, userB: User): number {
  const { MAX_ELO_GAP, SKILL_GAP_WEIGHT, REGIONAL_PRIORITY } = getConstraints();

  const eloA = userA.custom?.elo ?? 0;
  const eloB = userB.custom?.elo ?? 0;
  const regionA = userA.custom?.server ?? "global";
  const regionB = userB.custom?.server ?? "global";

  const eloDifference = Math.abs(eloA - eloB);
  if (eloDifference > MAX_ELO_GAP) return Infinity; // Skip pairs exceeding max ELO gap

  const regionMismatchPenalty = regionA !== regionB ? REGIONAL_PRIORITY : 0;

  // Compute pairing cost with weights
  const score = SKILL_GAP_WEIGHT * eloDifference + regionMismatchPenalty;

  return score;
}

/**
 * Create the cost matrix for all possible pairings based on multiple conditions.
 *
 * @param users - List of users containing user information.
 * @returns A square cost matrix for the Hungarian algorithm.
 */
function createCostMatrix(users: User[]): number[][] {
  const numUsers = users.length;
  const costMatrix: number[][] = Array.from({ length: numUsers }, () => Array(numUsers).fill(Infinity));

  for (let i = 0; i < numUsers; i++) {
    for (let j = i + 1; j < numUsers; j++) {
      const score = calculateScore(users[i], users[j]);
      costMatrix[i][j] = score;
      costMatrix[j][i] = score; // Mirror the score
    }
  }

  return costMatrix;
}

/**
 * Pair users for matchmaking using the Hungarian algorithm (munkres-algorithm).
 * This function adapts matchmaking based on real-time adjustable constants.
 *
 * @param users - List of users containing user information.
 * @returns An object with pairs of users and a list of unpaired user IDs.
 */
export function pairUsersBySkill(users: User[]): { pairs: [User, User][], unpaired: string[] } {
  const costMatrix = createCostMatrix(users);
  const { assignments } = minWeightAssign(costMatrix);

  const pairs: [User, User][] = [];
  const unpaired: string[] = [];
  const pairedSet = new Set<number>();

  for (let i = 0; i < assignments.length; i++) {
    const j = assignments[i];
    if (j !== null && j < users.length && i < j) {
      pairs.push([users[i], users[j]]);
      pairedSet.add(i);
      pairedSet.add(j);
    }
  }

  // Add penalty for unpaired users
  for (let i = 0; i < users.length; i++) {
    if (!pairedSet.has(i)) {
      unpaired.push(users[i].id);
    }
  }

  return { pairs, unpaired };
}

type ToxicityLevel = "high" | "medium" | "low";

// Define a new type that extends PubNub's User object with compatibilityScore
type UserWithScore = User & { compatibilityScore: number };

// Toxicity Compatibility Scoring Table
const toxicityScoreMap: Record<string, Record<string, number>> = {
  low: { low: 20, medium: 10, high: 0 },
  medium: { low: 10, medium: 20, high: 10 },
  high: { low: 0, medium: 10, high: 20 },
};

export function calculateCompatibilityScore(
  toxicityLevel: string,
  playStyle: string,
  elo: number,
  region: string,
  preferredGameMode: string,
  playerPool: User[]
): UserWithScore[] {
  if (!playerPool.length) return [];

  return playerPool
    .map((otherUser) => {
      if (!otherUser.custom) return undefined; // Skip users without `custom` fields

      const otherElo = otherUser.custom.elo ?? 0;
      const eloDiff = Math.abs(elo - otherElo);

      const otherPlayStyle = otherUser.custom.playStyle ?? "Unknown";
      const playStyleMatch = playStyle === otherPlayStyle ? 20 : 0;

      const otherToxicity = otherUser.custom.toxicityLevel ?? "medium"; // Default to medium
      const toxicityScore = toxicityScoreMap[toxicityLevel]?.[otherToxicity] ?? 0;

      const otherGameMode = otherUser.custom.gameModePreference ?? "Default";
      const gameModeMatch = preferredGameMode === otherGameMode ? 10 : 0;

      // Compatibility Score Calculation
      const score =
        (1 / (1 + eloDiff)) * 50 + // Closer Elo gets higher score
        playStyleMatch + // Playstyle match adds 20 points
        toxicityScore + // Toxicity compatibility score
        gameModeMatch; // Game mode match adds 10 points

      return { ...otherUser, compatibilityScore: score }; // Add score while keeping the original PubNub User object
    })
    .filter((user): user is UserWithScore => user !== undefined) // Type-safe filtering
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore) // Sort by highest score
    .slice(0, 5); // Return top 5 users
}