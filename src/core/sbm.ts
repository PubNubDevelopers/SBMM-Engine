import { User } from "@pubnub/chat";
import { minWeightAssign } from "munkres-algorithm";

/**
 * Calculate the score between two users based solely on their ELO difference
 *
 * @param userA - First user
 * @param userB - Second user
 * @returns A score representing the cost of pairing these two users based on skill
 */
function calculateScore(userA: User, userB: User): number {
  const eloA = userA.custom?.elo ?? 0;
  const eloB = userB.custom?.elo ?? 0;
  const eloDifference = Math.abs(eloA - eloB);

  // Use only skill difference as the score
  return eloDifference;
}

/**
 * Create the cost matrix for all possible pairings based solely on skill.
 * Only compute the upper diagonal of the matrix to avoid redundant calculations.
 *
 * @param users - List of users containing user information.
 * @returns A square cost matrix for the Hungarian algorithm.
 */
function createCostMatrix(users: User[]): number[][] {
  const numUsers = users.length;
  const costMatrix: number[][] = Array.from({ length: numUsers }, () => Array(numUsers).fill(Infinity));

  for (let i = 0; i < numUsers; i++) {
    for (let j = i + 1; j < numUsers; j++) {
      // Compute the score based on skill only
      const score = calculateScore(users[i], users[j]);
      costMatrix[i][j] = score;
      costMatrix[j][i] = score; // Mirror the score to the lower diagonal
    }
  }

  // Principal diagonal remains Infinity, so no further modifications are needed
  return costMatrix;
}

/**
 * Pair users for matchmaking based on skill using the Hungarian algorithm (munkres-algorithm).
 * This function creates a cost matrix based on skill and uses the Hungarian algorithm
 * to find the optimal pairings.
 *
 * @param users - List of users containing user information.
 * @returns An object with pairs of users and a list of unpaired user IDs.
 */
export function pairUsersBySkill(users: User[]): { pairs: [User, User][], unpaired: string[] } {
  // Create the cost matrix for all pairings based on skill
  const costMatrix = createCostMatrix(users);

  // Run the Hungarian algorithm using minWeightAssign to find the optimal pairs
  const { assignments } = minWeightAssign(costMatrix);

  // Convert the resulting assignments into User pairs
  const pairs: [User, User][] = [];
  const unpaired: string[] = [];

  // Track paired users
  const pairedSet = new Set<number>();

  for (let i = 0; i < assignments.length; i++) {
    const j = assignments[i];
    // Ensure a valid pairing (assignment is not null and within bounds)
    if (j !== null && j < users.length && i < j) {
      pairs.push([users[i], users[j]]);
      pairedSet.add(i);
      pairedSet.add(j);
    }
  }

  // Find unpaired users by excluding those in the paired set
  for (let i = 0; i < users.length; i++) {
    if (!pairedSet.has(i)) {
      unpaired.push(users[i].id);
    }
  }

  return { pairs, unpaired };
}