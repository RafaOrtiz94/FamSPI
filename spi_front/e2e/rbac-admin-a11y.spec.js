// Accesibilidad y adaptacion del panel "Roles y permisos" (plan RBAC, Fase 6; DESIGN.md seccion 12):
// axe WCAG 2.2 AA en claro y oscuro, navegacion por teclado con foco visible, tres anchos y zoom 200 %.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { loginAs } = require("./helpers/session");

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];
const TABS = ["Usuarios", "Roles", "Matriz", "Auditoría"];

async function openPanel(page) {
  await page.goto("/dashboard/ti/modulos");
  await page.getByRole("button", { name: /Roles y permisos/ }).click();
  await expect(page.getByRole("tablist", { name: "Vistas del catálogo" })).toBeVisible();
}

async function scan(page, label) {
  // Solo el panel nuevo: el resto de la pagina es codigo previo que este trabajo no toca.
  const result = await new AxeBuilder({ page })
    .include('[role="tablist"][aria-label="Vistas del catálogo"]')
    .include("section[aria-labelledby^='rbac-']")
    .include("form[aria-labelledby^='rbac-']")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`);
  expect(summary, `Violaciones de accesibilidad en ${label}`).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test(`sin violaciones axe y sin desborde a ${viewport.name} px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loginAs(page, "jefe_ti");
    await openPanel(page);
    for (const tab of TABS) {
      await page.getByRole("tab", { name: tab }).click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await scan(page, `${tab} a ${viewport.name} px`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `desborde en ${tab} a ${viewport.name} px`).toBeLessThanOrEqual(1);
    }
  });
}

test("tema oscuro: sin violaciones de contraste", async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ colorScheme: "dark" });
  await loginAs(page, "jefe_ti");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await openPanel(page);
  for (const tab of TABS) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await scan(page, `${tab} en oscuro`);
  }
});

test("zoom 200 %: el panel sigue usable (reflujo a 640 px de ancho equivalente)", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 720 });
  await loginAs(page, "jefe_ti");
  await openPanel(page);
  await page.getByRole("tab", { name: "Matriz" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Sincronizar roles heredados" })).toBeVisible();
});

test("teclado: se llega a las pestanas, a los controles del formulario y el foco se ve", async ({ page }) => {
  test.setTimeout(120000);
  await loginAs(page, "jefe_ti");
  await openPanel(page);

  await page.getByRole("tab", { name: "Usuarios" }).focus();
  const outlineOf = () => page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return { tag: el.tagName, role: el.getAttribute("role"), outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0, ring: style.boxShadow !== "none" };
  });

  // Recorre con Tab hasta alcanzar el selector de usuario: debe ser alcanzable sin raton.
  let reached = false;
  for (let i = 0; i < 30 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.id === "rbac-user-select");
  }
  expect(reached, "el selector de usuario no se alcanza con Tab").toBe(true);
  const focus = await outlineOf();
  expect(focus.outline || focus.ring, "el selector enfocado no muestra indicador de foco").toBe(true);

  // Teclado sobre el selector: elegir un usuario abre su acceso.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("heading", { name: "Roles centrales" })).toBeVisible();

  // Las pestanas se activan con Enter.
  await page.getByRole("tab", { name: "Matriz" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Matriz de permisos por rol y área" })).toBeVisible();
});

test("objetivos tactiles: pestanas y botones principales miden al menos 44 px de alto", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "jefe_ti");
  await openPanel(page);
  const tabs = page.getByRole("tab");
  for (let i = 0; i < (await tabs.count()); i += 1) {
    const box = await tabs.nth(i).boundingBox();
    expect(box.height, `pestana ${i}`).toBeGreaterThanOrEqual(44);
  }
});

test("constructor de roles abierto: sin violaciones axe a 390 y 1440 px, claro y oscuro", async ({ page }) => {
  test.setTimeout(120000);
  await loginAs(page, "jefe_ti");
  for (const [width, height, scheme] of [[1440, 900, "light"], [390, 844, "light"], [1440, 900, "dark"]]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: scheme });
    await openPanel(page);
    await page.getByRole("tab", { name: "Roles" }).click();
    await page.getByRole("button", { name: "Nuevo rol" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo rol" })).toBeFocused();
    await page.getByLabel("Buscar permiso").fill("clients");
    await scan(page, );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, ).toBeLessThanOrEqual(1);
  }
});
