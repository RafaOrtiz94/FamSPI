// Constructor de roles de punta a punta (plan RBAC, Fase 6 y enfoque SaaS): un administrador de TI crea un rol
// personalizado desde la pantalla, elige sus permisos, lo asigna y el acceso cambia de verdad en las areas con el
// control central activo (RBAC_CENTRAL_ENFORCE="*" en el staging local). Tambien se comprueban las protecciones.
const { test, expect, request } = require("@playwright/test");
const { loginAs } = require("./helpers/session");

test.skip(process.env.RBAC_EXPECT_ENFORCEMENT === "off", "Enforcement central apagado");

const API = process.env.STAGING_API_URL || "http://localhost:8090/api/v1";
const PROTECTED = "/collab-deliveries/summary"; // comercial no entra; con el permiso del rol personalizado, si
const PERMISSION = "collab-deliveries.summary.read";
const ROLE_LABEL = `Prueba constructor ${Date.now()}`;

test.describe.configure({ mode: "serial" });

let api;
let ti;
let comercial;
let comercialId;
const h = (jwt) => ({ Authorization: `Bearer ${jwt}`, "x-app-path": "/dashboard/finanzas" });
const login = async (username) => (await (await api.post(`${API}/auth/local-login`, { data: { username, password: process.env.STAGING_TEST_PASSWORD } })).json()).accessToken;
const status = async () => (await api.get(`${API}${PROTECTED}`, { headers: h(comercial) })).status();
const roles = async () => (await (await api.get(`${API}/rbac/roles`, { headers: h(ti) })).json()).data;

test.beforeAll(async () => {
  api = await request.newContext();
  ti = await login("prueba.jefe_ti");
  comercial = await login("prueba.comercial");
  comercialId = (await (await api.get(`${API}/auth/me`, { headers: h(comercial) })).json()).user.id;
});

async function cleanup() {
  const access = (await (await api.get(`${API}/rbac/users/${comercialId}`, { headers: h(ti) })).json()).data;
  for (const a of access.assignments.filter((x) => x.source === "manual")) {
    await api.delete(`${API}/rbac/users/${comercialId}/roles/${a.id}`, { headers: h(ti), data: { reason: "limpieza del constructor" } });
  }
  for (const role of (await roles()).filter((r) => !r.is_system && (r.key.startsWith("custom_prueba_constructor_") || r.key === "custom_admin"))) {
    await api.delete(`${API}/rbac/roles/${role.id}`, { headers: h(ti), data: { reason: "limpieza del constructor" } });
  }
}
test.beforeAll(async () => { await cleanup(); });
test.afterAll(async () => { await cleanup(); await api.dispose(); });

test("crear el rol desde la pantalla, con permisos elegidos y motivo", async ({ page }) => {
  test.setTimeout(90000);
  await loginAs(page, "jefe_ti");
  await page.goto("/dashboard/ti/modulos");
  await page.getByRole("button", { name: /Roles y permisos/ }).click();
  await page.getByRole("tab", { name: "Roles" }).click();
  await expect(page.getByRole("table", { name: "Roles del catálogo" })).toBeVisible();

  await page.getByRole("button", { name: "Nuevo rol" }).click();
  await page.getByLabel("Nombre del rol").fill(ROLE_LABEL);
  await expect(page.getByText("custom_prueba_constructor_", { exact: false }).first()).toBeVisible();

  // Los permisos de administracion del RBAC no se ofrecen.
  await page.getByLabel("Buscar permiso").fill("rbac");
  await expect(page.getByLabel("rbac.manage")).toHaveCount(0);

  await page.getByLabel("Buscar permiso").fill(PERMISSION);
  await page.getByLabel(PERMISSION, { exact: true }).check();
  await expect(page.getByText(/1 elegidos de/)).toBeVisible();

  // Sin motivo no se envia.
  await page.getByRole("button", { name: "Crear rol" }).click();
  await expect(page.getByRole("table", { name: "Roles del catálogo" }).getByText(ROLE_LABEL)).toHaveCount(0);

  await page.getByLabel(/Motivo/).fill("Prueba E2E del constructor de roles");
  await page.getByRole("button", { name: "Crear rol" }).click();
  await expect(page.getByRole("table", { name: "Roles del catálogo" }).getByText(ROLE_LABEL)).toBeVisible();
  await expect(page.getByRole("button", { name: `Editar ${ROLE_LABEL}` })).toBeVisible();
});

test("el rol personalizado, asignado a un usuario, abre acceso real y el que no lo tiene sigue sin entrar", async () => {
  const role = (await roles()).find((r) => r.label === ROLE_LABEL);
  expect(role, "rol creado").toBeTruthy();
  expect(role.is_system).toBe(false);
  expect(role.key.startsWith("custom_")).toBe(true);

  expect(await status()).toBe(403);
  const assigned = await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: h(ti), data: { role: role.key, reason: "prueba del rol personalizado" } });
  expect(assigned.status()).toBe(200);
  expect(await status()).toBe(200);
});

test("un rol que alguien tiene no se archiva; editarlo quita el acceso; al retirarlo se puede archivar", async () => {
  const role = (await roles()).find((r) => r.label === ROLE_LABEL);

  const refused = await api.delete(`${API}/rbac/roles/${role.id}`, { headers: h(ti), data: { reason: "intento con usuarios activos" } });
  expect(refused.status()).toBe(409);

  // Cambiar los permisos del rol cambia el acceso de quien lo tiene, de inmediato (la cache se invalida).
  const edited = await api.put(`${API}/rbac/roles/${role.id}`, { headers: h(ti), data: { permissions: ["clients.root.read"], reason: "quita el permiso de entregas" } });
  expect(edited.status()).toBe(200);
  expect(await status()).toBe(403);

  const access = (await (await api.get(`${API}/rbac/users/${comercialId}`, { headers: h(ti) })).json()).data;
  const manual = access.assignments.find((a) => a.source === "manual");
  await api.delete(`${API}/rbac/users/${comercialId}/roles/${manual.id}`, { headers: h(ti), data: { reason: "fin de la prueba" } });
  const archived = await api.delete(`${API}/rbac/roles/${role.id}`, { headers: h(ti), data: { reason: "fin de la prueba del constructor" } });
  expect(archived.status()).toBe(200);
  expect((await roles()).some((r) => r.id === role.id)).toBe(false);
});

test("protecciones: los roles de sistema no se editan, no se delegan permisos de administracion y quien no es de TI no puede", async () => {
  const system = (await roles()).find((r) => r.key === "comercial");
  const editSystem = await api.put(`${API}/rbac/roles/${system.id}`, { headers: h(ti), data: { label: "otro", reason: "intento sobre rol de sistema" } });
  expect(editSystem.status()).toBe(403);

  const escalate = await api.post(`${API}/rbac/roles`, { headers: h(ti), data: { key: "prueba_constructor_escalada", label: "Escalada", permissions: ["rbac.manage"], reason: "intento de delegar administracion" } });
  expect(escalate.status()).toBe(400);

  const imitate = await api.post(`${API}/rbac/roles`, { headers: h(ti), data: { key: "admin", label: "Admin falso", permissions: [PERMISSION], reason: "intento de imitar al superrol" } });
  // 201 la primera vez; 409 si ya existe (un rol archivado conserva su nombre). En ambos casos el prefijo
  // impide que exista un rol personalizado llamado `admin`, que seria el superrol.
  expect([201, 409]).toContain(imitate.status());
  const all = await roles();
  expect(all.filter((r) => r.key === "admin" && !r.is_system)).toHaveLength(0);
  const fake = all.find((r) => r.key === "custom_admin");
  if (fake) await api.delete(`${API}/rbac/roles/${fake.id}`, { headers: h(ti), data: { reason: "limpieza de la prueba de proteccion" } });

  const create = await api.post(`${API}/rbac/roles`, { headers: h(comercial), data: { key: "prueba_constructor_x", label: "X", permissions: [PERMISSION], reason: "intento sin ser de TI" } });
  expect(create.status()).toBe(403);
});

test("la creacion, edicion y archivo quedan auditados con antes y despues", async () => {
  const audit = (await (await api.get(`${API}/rbac/audit?limit=40`, { headers: h(ti) })).json()).data;
  const actions = audit.map((entry) => entry.action);
  expect(actions).toEqual(expect.arrayContaining(["crear_rol", "editar_rol", "archivar_rol"]));
  const edit = audit.find((entry) => entry.action === "editar_rol");
  expect(edit.after.removed).toContain(PERMISSION);
  expect(edit.before.permissions).toBeGreaterThan(0);
});
