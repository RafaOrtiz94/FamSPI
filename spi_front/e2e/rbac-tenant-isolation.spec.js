// Aislamiento entre empresas del catalogo central de RBAC (plan RBAC, enfoque SaaS, paso 2).
// Corre solo con el backend local en modo multiempresa:  STAGING_TENANT_MODE=on  (RBAC_TENANT_MODE=true) y las
// cuentas de la segunda empresa sembradas con  backend/scripts/rbac/seed_tenants.js --test-tenant.
//   Empresa A ("principal"):  prueba.jefe_ti (administra), prueba.comercial
//   Empresa B ("empresa-b"):  prueba.admin_b (administra), prueba.vendedor_b
const { test, expect, request } = require("@playwright/test");

test.skip(process.env.RBAC_EXPECT_TENANT !== "on", "Requiere el backend local con RBAC_TENANT_MODE=true");

const API = process.env.STAGING_API_URL || "http://localhost:8090/api/v1";
const PROTECTED = "/collab-deliveries/summary"; // comercial no entra; con ese permiso en un rol, si
const PERMISSION = "collab-deliveries.summary.read";
const KEY = `iso${Date.now()}`;
const ROLE_KEY = `custom_${KEY}`;

test.describe.configure({ mode: "serial" });

let api;
let adminA;
let adminB;
let comercialA;
let sellerB;
const ids = {};
const h = (jwt) => ({ Authorization: `Bearer ${jwt}`, "x-app-path": "/dashboard/finanzas" });
const login = async (username) => {
  const response = await api.post(`${API}/auth/local-login`, { data: { username, password: process.env.STAGING_TEST_PASSWORD } });
  expect(response.ok(), `login de ${username}`).toBeTruthy();
  return (await response.json()).accessToken;
};
const me = async (jwt) => (await (await api.get(`${API}/auth/me`, { headers: h(jwt) })).json()).user.id;
const get = async (jwt, path) => api.get(`${API}${path}`, { headers: h(jwt) });
const json = async (response) => (await response.json()).data;
const status = async (jwt) => (await get(jwt, PROTECTED)).status();

async function cleanup() {
  for (const [admin, userId] of [[adminA, ids.comercialA], [adminB, ids.sellerB]]) {
    if (!admin || !userId) continue;
    const access = await json(await get(admin, `/rbac/users/${userId}`));
    for (const a of access.assignments.filter((x) => x.source === "manual")) {
      await api.delete(`${API}/rbac/users/${userId}/roles/${a.id}`, { headers: h(admin), data: { reason: "limpieza de aislamiento" } });
    }
    for (const g of access.grants) await api.delete(`${API}/rbac/users/${userId}/grants/${g.id}`, { headers: h(admin) });
    for (const r of (await json(await get(admin, "/rbac/roles"))).filter((x) => !x.is_system && x.key.startsWith("custom_iso"))) {
      await api.delete(`${API}/rbac/roles/${r.id}`, { headers: h(admin), data: { reason: "limpieza de aislamiento" } });
    }
  }
}

test.beforeAll(async () => {
  api = await request.newContext();
  [adminA, adminB, comercialA, sellerB] = [await login("prueba.jefe_ti"), await login("prueba.admin_b"), await login("prueba.comercial"), await login("prueba.vendedor_b")];
  ids.adminA = await me(adminA);
  ids.adminB = await me(adminB);
  ids.comercialA = await me(comercialA);
  ids.sellerB = await me(sellerB);
  await cleanup();
});
test.afterAll(async () => { await cleanup(); await api.dispose(); });

test("cada administrador ve solo a los miembros de su empresa", async () => {
  const a = (await json(await get(adminA, "/rbac/members"))).map((u) => u.id);
  const b = (await json(await get(adminB, "/rbac/members"))).map((u) => u.id);
  expect(a).toContain(ids.comercialA);
  expect(a).not.toContain(ids.sellerB);
  expect(a).not.toContain(ids.adminB);
  expect(b.sort()).toEqual([ids.adminB, ids.sellerB].sort());
});

test("no se puede leer ni modificar a un usuario de otra empresa; se responde 404 como si no existiera", async () => {
  expect((await get(adminA, `/rbac/users/${ids.sellerB}`)).status()).toBe(404);
  expect((await get(adminB, `/rbac/users/${ids.comercialA}`)).status()).toBe(404);
  const assign = await api.post(`${API}/rbac/users/${ids.sellerB}/roles`, { headers: h(adminA), data: { role: "financiero", reason: "intento entre empresas" } });
  expect(assign.status()).toBe(404);
  const grant = await api.post(`${API}/rbac/users/${ids.comercialA}/grants`, { headers: h(adminB), data: { permission: PERMISSION, reason: "intento entre empresas" } });
  expect(grant.status()).toBe(404);
  expect(await status(sellerB)).toBe(403);
  expect(await status(comercialA)).toBe(403);
});

test("un rol personalizado es de su empresa: la otra no lo ve, no lo edita y puede crear uno con el mismo nombre", async () => {
  const created = await api.post(`${API}/rbac/roles`, { headers: h(adminA), data: { key: KEY, label: "Iso A", permissions: [PERMISSION], reason: "aislamiento: rol de la empresa A" } });
  expect(created.status()).toBe(201);
  const roleA = await json(created);

  const rolesB = await json(await get(adminB, "/rbac/roles"));
  expect(rolesB.some((r) => r.key === ROLE_KEY)).toBe(false);
  expect((await get(adminB, `/rbac/roles/${roleA.id}`)).status()).toBe(404);
  const edit = await api.put(`${API}/rbac/roles/${roleA.id}`, { headers: h(adminB), data: { label: "robado", reason: "intento entre empresas" } });
  expect(edit.status()).toBe(404);
  const archive = await api.delete(`${API}/rbac/roles/${roleA.id}`, { headers: h(adminB), data: { reason: "intento entre empresas" } });
  expect(archive.status()).toBe(404);

  // La empresa B crea un rol con el MISMO nombre tecnico y distintos permisos.
  const createdB = await api.post(`${API}/rbac/roles`, { headers: h(adminB), data: { key: KEY, label: "Iso B", permissions: ["clients.root.read"], reason: "aislamiento: rol de la empresa B" } });
  expect(createdB.status()).toBe(201);
  ids.roleA = roleA.id;
  ids.roleB = (await json(createdB)).id;
  expect(ids.roleB).not.toBe(ids.roleA);

  // Cada empresa ve solo el suyo.
  expect((await json(await get(adminA, "/rbac/roles"))).filter((r) => r.key === ROLE_KEY).map((r) => r.label)).toEqual(["Iso A"]);
  expect((await json(await get(adminB, "/rbac/roles"))).filter((r) => r.key === ROLE_KEY).map((r) => r.label)).toEqual(["Iso B"]);
});

test("el mismo nombre de rol en dos empresas no se mezcla en el acceso real", async () => {
  // A: el rol incluye el permiso protegido. B: el rol del mismo nombre NO lo incluye.
  const assignA = await api.post(`${API}/rbac/users/${ids.comercialA}/roles`, { headers: h(adminA), data: { role: ROLE_KEY, reason: "aislamiento: acceso de A" } });
  expect(assignA.status()).toBe(200);
  const assignB = await api.post(`${API}/rbac/users/${ids.sellerB}/roles`, { headers: h(adminB), data: { role: ROLE_KEY, reason: "aislamiento: acceso de B" } });
  expect(assignB.status()).toBe(200);

  expect(await status(comercialA), "el rol de A da acceso a A").toBe(200);
  expect(await status(sellerB), "el rol de B, del mismo nombre, no hereda los permisos del de A").toBe(403);

  // B agrega el permiso a SU rol: ahora B entra, sin tocar a A.
  const edit = await api.put(`${API}/rbac/roles/${ids.roleB}`, { headers: h(adminB), data: { permissions: ["clients.root.read", PERMISSION], reason: "aislamiento: B suma el permiso" } });
  expect(edit.status()).toBe(200);
  expect(await status(sellerB)).toBe(200);

  // A quita el permiso de SU rol: A deja de entrar y B sigue entrando.
  const editA = await api.put(`${API}/rbac/roles/${ids.roleA}`, { headers: h(adminA), data: { permissions: ["clients.root.read"], reason: "aislamiento: A quita el permiso" } });
  expect(editA.status()).toBe(200);
  expect(await status(comercialA)).toBe(403);
  expect(await status(sellerB)).toBe(200);
});

test("los roles de sistema son los mismos para las dos empresas y siguen siendo de solo lectura", async () => {
  const system = async (jwt) => (await json(await get(jwt, "/rbac/roles"))).filter((r) => r.is_system).map((r) => r.key).sort();
  expect(await system(adminA)).toEqual(await system(adminB));
  const comercial = (await json(await get(adminB, "/rbac/roles"))).find((r) => r.key === "comercial");
  const edit = await api.put(`${API}/rbac/roles/${comercial.id}`, { headers: h(adminB), data: { label: "x", reason: "intento sobre rol de sistema" } });
  expect(edit.status()).toBe(403);
});

test("la auditoria y el resumen de cada empresa solo muestran lo suyo", async () => {
  const auditA = await json(await get(adminA, "/rbac/audit?limit=100"));
  const auditB = await json(await get(adminB, "/rbac/audit?limit=100"));
  const mentions = (rows) => rows.filter((e) => JSON.stringify([e.before, e.after, e.description]).includes(ROLE_KEY));
  expect(mentions(auditA).every((e) => e.after.tenant_id === mentions(auditA)[0].after.tenant_id)).toBe(true);
  expect(mentions(auditA).length).toBeGreaterThan(0);
  expect(mentions(auditB).length).toBeGreaterThan(0);
  expect(mentions(auditA).some((e) => e.description.includes("Iso B") || e.after.tenant_id === mentions(auditB)[0].after.tenant_id)).toBe(false);
  const summaryA = await json(await get(adminA, "/rbac/summary"));
  const summaryB = await json(await get(adminB, "/rbac/summary"));
  expect(summaryA.tenant_id).not.toBe(summaryB.tenant_id);
  expect(summaryB.assignments).toBeLessThan(summaryA.assignments);
});

test("un rol con usuarios de la empresa no se archiva; con la empresa B vacia del rol, si", async () => {
  const refused = await api.delete(`${API}/rbac/roles/${ids.roleB}`, { headers: h(adminB), data: { reason: "intento con usuarios activos" } });
  expect(refused.status()).toBe(409);
  const access = await json(await get(adminB, `/rbac/users/${ids.sellerB}`));
  const manual = access.assignments.find((a) => a.source === "manual");
  await api.delete(`${API}/rbac/users/${ids.sellerB}/roles/${manual.id}`, { headers: h(adminB), data: { reason: "fin del aislamiento" } });
  expect((await api.delete(`${API}/rbac/roles/${ids.roleB}`, { headers: h(adminB), data: { reason: "fin del aislamiento" } })).status()).toBe(200);
  // El rol de A sigue intacto.
  expect((await get(adminA, `/rbac/roles/${ids.roleA}`)).status()).toBe(200);
});
