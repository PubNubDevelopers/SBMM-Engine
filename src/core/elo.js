const config = require('../config/config');

/**
 * Updates the ELO rating for a player after a match.
 *
 * @param {number} playerElo - The player's current ELO rating.
 * @param {number} opponentElo - The opponent's current ELO rating.
 * @param {number} result - The result of the match (1 = win, 0.5 = draw, 0 = loss).
 * @returns {number} - The player's new ELO rating.
 */
function updateElo(playerElo, opponentElo, result) {
  const kFactor = config.elo.getKFactor(playerElo);  // Get dynamic K-factor
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  const newElo = playerElo + kFactor * (result - expectedScore);
  return Math.round(newElo);
}

/**
 * Calculates the expected score for a player based on their ELO rating
 * and their opponent's ELO rating.
 *
 * @param {number} playerElo - The ELO rating of the player.
 * @param {number} opponentElo - The ELO rating of the opponent.
 * @returns {number} - The expected score (probability of winning) for the player.
 */
function calculateExpectedScore(playerElo, opponentElo) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}









