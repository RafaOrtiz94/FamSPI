/**
 * run-tests-integration-off.js
 *
 * Ejecuta la suite principal de Jest forzando:
 *   ODOO_INTEGRATION_ENABLED=false
 */

const { spawnSync } = require("node:child_process");

const env = {
  ...process.env,
  ODOO_INTEGRATION_ENABLED: "false",
};

const jestBin = require.resolve("jest/bin/jest");
const result = spawnSync(process.execPath, [jestBin], {
  stdio: "inherit",
  env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
