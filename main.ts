// main.ts
import { startListener } from './src/core/listener';
import { simulateMatchmaking } from './src/sim/main';
import app, { PORT } from "./src/api/server";

const main = async () => {
  startListener();
  simulateMatchmaking();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();