// main.ts
import { matchMakingListener } from './src/core/listener';

const main = async () => {
  /// Intialize the server by calling the matchmaking listener
  matchMakingListener();
}

main();