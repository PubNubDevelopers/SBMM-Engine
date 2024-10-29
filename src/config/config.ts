// Define the structure for Elo configuration settings
// This interface defines two properties:
// 1. `defaultKFactor`: The default K-factor value used for ELO calculations.
// 2. `getKFactor`: A function that calculates the K-factor dynamically based on the player's current ELO rating.
interface EloConfig {
  defaultKFactor: number;
  getKFactor: (playerElo: number) => number;
}

// Define the main configuration object structure
// The `Config` interface includes the EloConfig structure under the `elo` property,
// allowing for modular configuration management.
interface Config {
  elo: EloConfig;
}

// Define the configuration object itself with type definitions for better type safety.
// This object contains both the default K-factor and a dynamic adjustment function for calculating the K-factor
// based on a player's ELO rating.
const config: Config = {
  elo: {
    // The default K-factor value for general use (20).
    defaultKFactor: 20,

    // Function to dynamically adjust the K-factor based on player ELO rating:
    // - If the player's ELO is below 1400, a higher K-factor of 40 is used to adjust their rating more rapidly.
    // - If the player's ELO is between 1400 and 2000, the default K-factor of 20 is applied.
    // - If the player's ELO is above 2000, a lower K-factor of 10 is used, making their rating adjustments slower.
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

// Export the configuration object so it can be imported and used in other parts of the application.
// This allows easy access to the K-factor logic and configuration settings throughout the system.
export default config;