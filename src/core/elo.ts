import config from '../config/config';

/**
 * Updates the ELO rating for a player after a match.
 *
 * @param playerElo - The player's current ELO rating.
 * @param opponentElo - The opponent's current ELO rating.
 * @param result - The result of the match (1 = win, 0.5 = draw, 0 = loss).
 * @returns The player's new ELO rating.
 */
export function updateElo(playerElo: number, opponentElo: number, result: number): number {
  const kFactor: number = config.elo.getKFactor(playerElo);  // Get dynamic K-factor
  const expectedScore: number = calculateExpectedScore(playerElo, opponentElo);
  const newElo: number = playerElo + kFactor * (result - expectedScore);
  return Math.round(newElo);
}

/**
 * Calculates the expected score for a player based on their ELO rating
 * and their opponent's ELO rating.
 *
 * @param playerElo - The ELO rating of the player.
 * @param opponentElo - The ELO rating of the opponent.
 * @returns The expected score (probability of winning) for the player.
 */
export function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}









