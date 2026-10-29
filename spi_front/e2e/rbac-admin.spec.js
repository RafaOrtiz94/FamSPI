// Panel "Roles y permisos" (plan RBAC, Fase 6): solo TI lo ve, exige motivo, y asignar o revocar un rol
// manual funciona de punta a punta. Corre contra el staging local con las cuentas prueba.<rol>.
const { test, expect } = require("@playwright/test");
const { loginAs } = require("./helpers/session");

const TARGET = "prueba.comercial";

async function openPanel(page) {
  await page.goto("/dashboard/ti/modulos");
  await page.getByRole("button", { name: /Roles y permisos/ }).click();
  await expect(page.getByText("todavía no modifica el acceso real de nadie")).toBeVisible();
}

test("un usuario que no es de TI no entra al panel de modulos", async ({ page }) => {
  await loginAs(page, "comercial");
  await page.goto("/dashboard/ti/modulos");
  await expect(page).toHaveURL(/unauthorized/);
});

test("jefe_ti asigna y revoca un rol manual con motivo", async ({ page }) => {
  test.setTimeout(90000);
  await loginAs(page, "jefe_ti");
  await openPanel(page);

  await page.locator("#rbac-user-select").selectOption({ label: await userLabel(page) });
  await expect(page.getByRole("heading", { name: "Roles centrales" })).toBeVisible();

  // Sin motivo el formulario no se envia.
  await page.getByLabel("Rol", { exact: true }).selectOption("logistica");
  await page.getByRole("button", { name: "Asignar rol" }).click();
  await expect(page.getByText("Asignación manual")).toHaveCount(0);

  await page.getByLabel("Motivo (obligatorio)").first().fill("Prueba E2E del panel de roles");
  await page.getByRole("button", { name: "Asignar rol" }).click();
  await expect(page.getByText("Asignación manual")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Fin de la prueba E2E"));
  await page.getByRole("button", { name: "Revocar" }).first().click();
  await expect(page.getByText("Asignación manual")).toHaveCount(0);
});

async function userLabel(page) {
  const select = page.locator("#rbac-user-select");
  await expect(select.locator("option")).not.toHaveCount(1);
  const labels = await select.locator("option").allTextContents();
  const match = labels.find((label) => /comercial/i.test(label) && !/jefe|acp|backoffice/i.test(label)) || labels[1];
  return match;
}

test("la matriz y la auditoria muestran datos y los cambios quedan con antes y despues", async ({ page }) => {
  test.setTimeout(90000);
  await loginAs(page, "jefe_ti");
  await openPanel(page);

  await page.getByRole("tab", { name: "Matriz" }).click();
  await expect(page.getByRole("heading", { name: "Matriz de permisos por rol y área" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Permisos por rol y área" }).locator("tbody tr").first()).toBeVisible();

  await page.getByRole("tab", { name: "Auditoría" }).click();
  await expect(page.getByRole("heading", { name: "Cambios de roles y permisos" })).toBeVisible();
  // El test anterior asigno y reviso un rol: queda al menos una entrada con antes/despues.
  await expect(page.getByText("Rol revocado").first()).toBeVisible();
  await expect(page.getByText(/^Antes:/).first()).toBeVisible();
  await expect(page.getByText(/^Después:/).first()).toBeVisible();
});

test("a 390 px el panel no genera desplazamiento horizontal de la pagina", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await loginAs(page, "jefe_ti");
  await openPanel(page);
  for (const name of ["Matriz", "Auditoría", "Usuarios"]) {
    await page.getByRole("tab", { name }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `desborde horizontal en ${name}`).toBeLessThanOrEqual(1);
  }
});
