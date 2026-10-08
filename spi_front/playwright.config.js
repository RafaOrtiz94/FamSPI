// Pruebas E2E de FamSPI (plan RBAC, Fase 1B). Corren SOLO contra el ambiente local de pruebas:
//   1. .\scripts\staging_local.ps1            (base, backend :8090 y frontend :3101)
//   2. $env:STAGING_TEST_PASSWORD = (gcloud secrets versions access latest --secret=STAGING_TEST_USERS_PASSWORD --project=famspi-sbox)
//   3. cd spi_front; npx playwright test
const { defineConfig } = require("@playwright/test");

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3101";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseURL)) {
  throw new Error(`Las pruebas E2E solo corren contra el ambiente local. E2E_BASE_URL=${baseURL} no esta permitido.`);
}

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  // Una sesion a la vez: el backend limita intentos de login por usuario e IP.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./e2e/.results",
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
