// main.ts
import { startListener } from './src/core/listener';
import { simulateMatchmaking } from './src/sim/main';
import { simulatePlayer } from './src/sim/player';

const main = async () => {
  startListener();
  simulateMatchmaking();
  simulatePlayer();
}

main();