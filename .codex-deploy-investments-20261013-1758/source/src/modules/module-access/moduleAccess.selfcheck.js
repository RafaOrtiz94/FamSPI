// Run manually: node backend/src/modules/module-access/moduleAccess.selfcheck.js
const assert = require("assert");
const Module = require("module");

let queryCount = 0;
let enabledValue = false;

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../../config/db") {
    return {
      query: async () => {
        queryCount += 1;
        return { rows: [{ is_enabled: enabledValue }] };
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const { isModuleEnabledForUser, invalidateUserModuleAccessCache } = require("./moduleAccess.service");
Module._load = originalLoad;

(async () => {
  // First call hits the DB (plus one-time ensureSchema queries); second call
  // within TTL must be served from cache with zero additional queries.
  assert.strictEqual(await isModuleEnabledForUser({ userId: 1, moduleKey: "calidad" }), false);
  const afterFirstCall = queryCount;
  assert.strictEqual(await isModuleEnabledForUser({ userId: 1, moduleKey: "calidad" }), false);
  assert.strictEqual(queryCount, afterFirstCall);

  // A different user is not served from the first user's cache entry.
  await isModuleEnabledForUser({ userId: 2, moduleKey: "calidad" });
  assert.strictEqual(queryCount, afterFirstCall + 1);

  // Invalidating user 1 forces a fresh DB read on the next call.
  enabledValue = true;
  invalidateUserModuleAccessCache(1);
  assert.strictEqual(await isModuleEnabledForUser({ userId: 1, moduleKey: "calidad" }), true);
  assert.strictEqual(queryCount, afterFirstCall + 2);

  console.log("moduleAccess cache self-check passed");
})();
