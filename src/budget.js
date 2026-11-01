import { config } from './config.js';

// Hard ceiling on paid Gnani calls per server run, so a bug, a retry loop or
// a load test can never drain the challenge credits. Restart to reset.
let used = 0;

export function spendGnaniCall(kind) {
  if (used >= config.maxLiveCalls) {
    throw new Error(`Gnani call budget of ${config.maxLiveCalls} reached for this run (restart to reset)`);
  }
  used++;
  console.log(`[budget] Gnani call ${used}/${config.maxLiveCalls} (${kind})`);
}

export const budgetStats = () => ({ used, max: config.maxLiveCalls });
