// Inicio de sesion de las cuentas de prueba (prueba.<rol>) por el acceso local del login.
const { expect } = require("@playwright/test");

function testPassword() {
  const password = process.env.STAGING_TEST_PASSWORD;
  if (!password) {
    throw new Error("Falta STAGING_TEST_PASSWORD (secreto STAGING_TEST_USERS_PASSWORD del proyecto famspi-sbox).");
  }
  return password;
}

async function loginAs(page, role) {
  await page.goto("/login");
  // La marca del ambiente confirma que no se esta probando contra produccion.
  await expect(page.getByRole("status", { name: /Ambiente STAGING/i })).toBeVisible();
  await page.getByRole("button", { name: "Acceso pasantes" }).click();
  await page.getByRole("textbox", { name: "Usuario" }).fill(`prueba.${role}`);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(testPassword());
  await page.getByRole("button", { name: "Ingresar como pasante" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 });
}

module.exports = { loginAs };
