let queue = [];  // Queue for players ready for matchmaking

/**
 * Adds a player to the matchmaking queue if they are ready.
 *
 * @param {Object} player - The player object to be added to the queue.
 */
function addToQueue(player) {
  if (player.isReady) {
    queue.push(player);
    console.log(`Player ${player.id} added to the queue.`);
  } else {
    console.log(`Player ${player.id} is not ready and cannot be added to the queue.`);
  }
}

/**
 * Collects players from the matchmaking queue with optional filters for region and latency.
 *
 * @param {number} minPlayers - The minimum number of players required to initiate matchmaking.
 * @param {Object} [options] - Optional filters for matchmaking.
 * @param {string} [options.region] - Filter players by region.
 * @param {number} [options.maxLatency] - Filter players by maximum latency (ms).
 * @returns {Array} - The list of players ready for matchmaking.
 */
function collectPlayersForMatchmaking(minPlayers = 2, options = {}) {
  const { region, maxLatency } = options;

  // Filter players by readiness, region, and latency (if specified)
  let readyPlayers = queue.filter(player => player.isReady);

  if (region) {
    readyPlayers = readyPlayers.filter(player => player.region === region);
  }

  if (maxLatency) {
    readyPlayers = readyPlayers.filter(player => player.latency <= maxLatency);
  }

  // Ensure enough players are ready for matchmaking
  if (readyPlayers.length >= minPlayers) {
    return readyPlayers;
  } else {
    console.log('Not enough players ready for matchmaking with the specified criteria');
    return [];
  }
}

