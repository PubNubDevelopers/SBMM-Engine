import { Membership, User } from "@pubnub/chat"; // Assuming you have these types defined
import { minWeightAssign } from 'munkres-algorithm';

// Define weights for latency and skill (you can adjust these based on priority)
const LATENCY_WEIGHT = 0.7;
const SKILL_WEIGHT = 0.3;


/**
 * Calculate the score between two users based on latency and ELO difference
 *
 * @param userA - First user
 * @param userB - Second user
 * @param latencyMap - Map<string, Map<string, number>> of latencies between users
 * @returns A score representing the cost of pairing these two users
 */
function calculateScore(userA: User, userB: User, latencyMap: Map<string, Map<string, number>>): number {
  const latencyAtoB = latencyMap.get(userA.id)?.get(userB.id) ?? Infinity;
  const latencyBtoA = latencyMap.get(userB.id)?.get(userA.id) ?? Infinity;

  // Average latency between the two users
  const averageLatency = (latencyAtoB + latencyBtoA) / 2;

  // ELO difference between the two users
  const eloA = userA.custom?.elo ?? 0;
  const eloB = userB.custom?.elo ?? 0;
  const eloDifference = Math.abs(eloA - eloB);

  // Combine latency and skill difference into a single score
  return LATENCY_WEIGHT * averageLatency + SKILL_WEIGHT * eloDifference;
}

/**
 * Create the cost matrix for all possible pairings based on latency and skill.
 * Only compute the upper diagonal of the matrix to avoid redundant calculations.
 *
 * @param members - List of memberships containing user information.
 * @param latencyMap - Map<string, Map<string, number>> of latencies between users
 * @returns A square cost matrix for the Hungarian algorithm.
 */
function createCostMatrix(members: Membership[], latencyMap: Map<string, Map<string, number>>): number[][] {
  const numMembers = members.length;
  const costMatrix: number[][] = Array.from({ length: numMembers }, () => Array(numMembers).fill(Infinity));

  for (let i = 0; i < numMembers; i++) {
    for (let j = i + 1; j < numMembers; j++) {
      // Compute the score only for the upper diagonal
      const score = calculateScore(members[i].user, members[j].user, latencyMap);
      costMatrix[i][j] = score;
      costMatrix[j][i] = score; // Mirror the score to the lower diagonal
    }
  }

  // Principal diagonal remains Infinity, so no further modifications are needed
  return costMatrix;
}

/**
 * Pair members for matchmaking using the Hungarian algorithm (munkres-algorithm).
 * This function creates a cost matrix based on latency and skill and uses the Hungarian algorithm
 * to find the optimal pairings.
 *
 * @param members - List of memberships containing user information.
 * @param latencyMap - Map<string, Map<string, number>> of latencies between users
 * @returns An array of pairs of users to be matched together.
 */
export function pairMembersWithLatencyAndSkill(members: Membership[], latencyMap: Map<string, Map<string, number>>): [User, User][] {
  // Create the cost matrix for all pairings
  const costMatrix = createCostMatrix(members, latencyMap);

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