// Verificacion de vistas por rol (plan RBAC, Fase 0).
// Por cada rol abre cada enlace que su menu le muestra y registra: a donde llega, si la vista
// quedo en "no autorizado" o en construccion, y que llamadas a la API respondieron con error.
// Un enlace visible que el rol no puede abrir es un defecto: el menu ofrece algo que se le niega.
// Resultado: docs/plans/rbac-inventory/vistas-por-rol.json
//
// Corre aparte porque tarda varios minutos:  npx playwright test rbac-views
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { loginAs } = require("./helpers/session");

const DIR = path.join(__dirname, "..", "..", "docs", "plans", "rbac-inventory");
const navigation = JSON.parse(fs.readFileSync(path.join(DIR, "frontend-navigation-by-role.json"), "utf8"));
const RESULTS_PATH = path.join(DIR, "vistas-por-rol.json");

for (const [role, data] of Object.entries(navigation)) {
  test(`${role}: cada vista de su menu abre`, async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    await loginAs(page, role);
    const views = [];

    for (const link of data.links.filter((item) => item.href.startsWith("/"))) {
      const apiErrors = [];
      const onResponse = (response) => {
        const url = response.url();
        if (response.status() >= 400 && /\/api\/|\/asistencia\//.test(url)) {
          apiErrors.push(`${response.status()} ${response.request().method()} ${new URL(url).pathname}`);
        }
      };
      const pageErrors = [];
      const onPageError = (error) => pageErrors.push(String(error.message || error).slice(0, 160));
      page.on("response", onResponse);
      page.on("pageerror", onPageError);

      await page.goto(link.href);
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
      const landed = new URL(page.url()).pathname;
      const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);

      page.off("response", onResponse);
      page.off("pageerror", onPageError);

      let outcome = "abre";
      if (landed === "/unauthorized") outcome = "no_autorizado";
      else if (landed === "/login") outcome = "login";
      else if (/en construcci[oó]n|pr[oó]ximamente disponible/i.test(bodyText)) outcome = "en_construccion";
      else if (landed !== link.href && !landed.startsWith(link.href)) outcome = "redirige";

      views.push({
        href: link.href,
        label: link.label,
        outcome,
        landed,
        apiErrors: [...new Set(apiErrors)].sort(),
        pageErrors: [...new Set(pageErrors)],
      });
    }

    // Se guarda rol por rol: tras un fallo Playwright reinicia el proceso y lo acumulado en memoria se pierde.
    const saved = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) : {};
    saved[role] = views;
    const sorted = Object.fromEntries(Object.keys(saved).sort().map((key) => [key, saved[key]]));
    fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);

    const blocked = views.filter((view) => view.outcome === "no_autorizado" || view.outcome === "login");
    expect.soft(blocked.map((view) => `${view.label} (${view.href})`), `Enlaces del menu de ${role} que no puede abrir`).toEqual([]);
  });
}
