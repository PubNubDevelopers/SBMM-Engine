// Define the configuration structure and types
interface EloConfig {
  defaultKFactor: number;
  getKFactor: (playerElo: number) => number;
}

// Define the configuration object type
interface Config {
  elo: EloConfig;
}

// Configuration object with type definitions
const config: Config = {
  elo: {
    // Default K-factor
    defaultKFactor: 20,

    // Dynamic K-factor adjustment based on player rating
    getKFactor: (playerElo: number): number => {
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

// Export the config object
export default config;