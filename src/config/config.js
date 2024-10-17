// config.js

const config = {
  elo: {
    // Default K-factor
    defaultKFactor: 20,

    // Dynamic K-factor adjustment based on player rating
    getKFactor: (playerElo) => {
      if (playerElo < 1400) {
        return 40; // Higher K-factor for lower-rated players (faster adjustment)
      } else if (playerElo < 2000) {
        return 20; // Default K-factor for intermediate players
      } else {
        return 10; // Lower K-factor for higher-rated players (slower adjustment)
      }
    }
  }
};

module.exports = config;