// Run manually: node backend/src/jobs/offHoursCoordinator.selfcheck.js
const assert = require("assert");
const Module = require("module");

let mockOffHours = true;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith("utils/offHoursPolicy")) {
    return { isOffHours: () => ({ isOffHours: mockOffHours }) };
  }
  return originalLoad.apply(this, arguments);
};

const { registerOffHoursJob, tick } = require("./offHoursCoordinator");
Module._load = originalLoad;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let fastRuns = 0;
  let slowRuns = 0;
  registerOffHoursJob({ name: "fast", runOnce: async () => { fastRuns += 1; }, offHoursIntervalMs: 30 });
  registerOffHoursJob({ name: "slow", runOnce: async () => { slowRuns += 1; }, offHoursIntervalMs: 1000 });

  // First tick: both jobs are due (lastRunAt starts at 0).
  await tick();
  assert.strictEqual(fastRuns, 1);
  assert.strictEqual(slowRuns, 1);

  // Immediately again: neither is due yet.
  await tick();
  assert.strictEqual(fastRuns, 1);
  assert.strictEqual(slowRuns, 1);

  // After 40ms only the fast job (30ms interval) is due again.
  await sleep(40);
  await tick();
  assert.strictEqual(fastRuns, 2);
  assert.strictEqual(slowRuns, 1);

  // During business hours the coordinator must not run anything at all.
  mockOffHours = false;
  await sleep(40);
  await tick();
  assert.strictEqual(fastRuns, 2);
  assert.strictEqual(slowRuns, 1);

  console.log("offHoursCoordinator self-check passed");
})();
