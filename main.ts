// main.ts
import { startListener } from './src/core/listener';
import { simulateMatchmaking } from './src/sim/main';

const main = async () => {
  startListener();
  simulateMatchmaking();
}

main();