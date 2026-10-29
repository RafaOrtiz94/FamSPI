// Caracterizacion E2E del acceso por rol (plan RBAC, Fase 1B).
// Por cada rol real: a que panel entra y que navegacion ve. El resultado se compara contra la
// linea base guardada en docs/plans/rbac-inventory/frontend-navigation-by-role.json.
//   Regenerar la linea base a proposito:  $env:UPDATE_RBAC_BASELINE = "1"; npx playwright test
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { loginAs } = require("./helpers/session");

const BASELINE_PATH = path.join(__dirname, "..", "..", "docs", "plans", "rbac-inventory", "frontend-navigation-by-role.json");
const UPDATE = process.env.UPDATE_RBAC_BASELINE === "1";

// Panel de inicio esperado por rol: mismo mapa que RoleRedirect (ProtectedRoute.jsx).
const ROLE_HOME = {
  acp_comercial: "/dashboard/comercial",
  comercial: "/dashboard/comercial",
  financiero: "/dashboard/finanzas",
  gerencia_general: "/dashboard/gerencia",
  ing_servicio: "/dashboard/servicio-tecnico",
  ing_servicio_ext: "/dashboard/ext",
  jefe_calidad: "/dashboard/calidad",
  jefe_comercial: "/dashboard/comercial",
  jefe_financiero: "/dashboard/finanzas",
  jefe_logistica: "/dashboard/logistica",
  jefe_operaciones: "/dashboard/operaciones",
  jefe_servicio: "/dashboard/servicio-tecnico",
  jefe_ti: "/dashboard/ti",
  logistica: "/dashboard/logistica",
  operaciones: "/dashboard/operaciones",
  pasante: "/dashboard/pasante",
  talento_humano: "/dashboard/talento-humano",
};

const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : {};
const captured = {};

// Lee la navegacion principal: enlaces directos y, por cada menu, los enlaces que despliega.
async function readNavigation(page) {
  const nav = page.getByRole("navigation").first();
  await expect(nav).toBeVisible({ timeout: 20000 });
  // Cada lectura es una sola evaluacion en la pagina: los menus se montan y desmontan, y
  // recorrer localizadores uno a uno deja referencias obsoletas.
  const readLinks = (anchors) => anchors
    .map((a) => ({ href: a.getAttribute("href"), label: (a.innerText || "").replace(/\s+/g, " ").trim() }))
    .filter((link) => link.href && link.label);
  const links = new Map();
  (await nav.locator("a[href]").evaluateAll(readLinks)).forEach((link) => links.set(link.href, link.label));

  const menuButtons = nav.getByRole("button", { name: /^Abrir / });
  const menuCount = await menuButtons.count();
  const menuNames = [];
  for (let index = 0; index < menuCount; index += 1) {
    const button = menuButtons.nth(index);
    const name = (await button.getAttribute("aria-label")) || (await button.innerText());
    menuNames.push(name.replace(/^Abrir /, "").trim());
    const before = new Set((await page.locator("a[href]").evaluateAll(readLinks)).map((link) => link.href));
    await button.click();
    await page.waitForTimeout(350);
    // Lo que aparece al abrir el menu son sus enlaces.
    (await page.locator("a[href]").evaluateAll(readLinks))
      .filter((link) => !before.has(link.href))
      .forEach((link) => links.set(link.href, link.label));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  return {
    menus: menuNames.sort(),
    links: [...links.entries()].map(([href, label]) => ({ href, label })).sort((a, b) => a.href.localeCompare(b.href)),
  };
}

for (const [role, home] of Object.entries(ROLE_HOME)) {
  test(`${role}: entra a su panel y ve su navegacion`, async ({ page }) => {
    await loginAs(page, role);
    await expect(page).toHaveURL(new RegExp(`${home.replace(/[/-]/g, "\\$&")}(\\b|/|$)`));
    const navigation = await readNavigation(page);
    captured[role] = { home: new URL(page.url()).pathname, ...navigation };
    if (!UPDATE) {
      expect(baseline[role], `No hay linea base para ${role}. Generala con UPDATE_RBAC_BASELINE=1.`).toBeTruthy();
      expect(captured[role]).toEqual(baseline[role]);
    }
  });
}

test("comercial no puede abrir por URL directa el panel de TI", async ({ page }) => {
  await loginAs(page, "comercial");
  await page.goto("/dashboard/ti");
  await expect(page).toHaveURL(/\/unauthorized$/);
});

test("sin sesion, una URL protegida lleva al login", async ({ page }) => {
  await page.goto("/dashboard/comercial");
  await expect(page).toHaveURL(/\/login$/);
});

test.afterAll(() => {
  if (!UPDATE) return;
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(captured).sort().map((role) => [role, captured[role]]));
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
});
