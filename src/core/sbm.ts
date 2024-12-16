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