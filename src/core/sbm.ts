import { Membership, User } from "@pubnub/chat";
import { minWeightAssign } from 'munkres-algorithm';


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
 * @param members - List of memberships containing user information.
 * @returns A square cost matrix for the Hungarian algorithm.
 */
function createCostMatrix(members: Membership[]): number[][] {
  const numMembers = members.length;
  const costMatrix: number[][] = Array.from({ length: numMembers }, () => Array(numMembers).fill(Infinity));

  for (let i = 0; i < numMembers; i++) {
    for (let j = i + 1; j < numMembers; j++) {
      // Compute the score based on skill only
      const score = calculateScore(members[i].user, members[j].user);
      costMatrix[i][j] = score;
      costMatrix[j][i] = score; // Mirror the score to the lower diagonal
    }
  }

  // Principal diagonal remains Infinity, so no further modifications are needed
  return costMatrix;
}

/**
 * Pair members for matchmaking based on skill using the Hungarian algorithm (munkres-algorithm).
 * This function creates a cost matrix based on skill and uses the Hungarian algorithm
 * to find the optimal pairings.
 *
 * @param members - List of memberships containing user information.
 * @returns An array of pairs of users to be matched together based on skill.
 */
export function pairMembersBySkill(members: Membership[]): [User, User][] {
  // Create the cost matrix for all pairings based on skill
  const costMatrix = createCostMatrix(members);

  // Run the Hungarian algorithm using minWeightAssign to find the optimal pairs
  const { assignments } = minWeightAssign(costMatrix);

  // Convert the resulting assignments into User pairs
  const result: [User, User][] = [];
  for (let i = 0; i < assignments.length; i++) {
    const j = assignments[i];
    if (j !== null && i < j) { // Ensure we only add each pair once
      result.push([members[i].user, members[j].user]);
    }
  }

  return result;
}