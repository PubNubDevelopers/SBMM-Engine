// main.ts
import { startMatchmaking } from './src/core/listener';

const main = async () => {
  /// Intialize the server by calling the matchmaking listener
  console.log("Starting SBM Matchmaking Server");
  startMatchmaking();
}

main();