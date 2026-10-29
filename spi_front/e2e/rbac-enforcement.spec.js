// Enforcement central de punta a punta (plan RBAC, Fases 5 a 8), contra el staging local con RBAC_CENTRAL_ENFORCE="*".
// Comprueba por la API real: una asignacion manual da acceso, un vencimiento lo quita, una revocacion lo quita,
// un grant individual funciona, nadie se modifica a si mismo, y todo queda auditado con antes y despues.
const { test, expect, request } = require("@playwright/test");

const API = process.env.STAGING_API_URL || "http://localhost:8090/api/v1";
const PROTECTED = "/collab-deliveries/summary"; // area `collab-deliveries`: comercial no entra; financiero si (barrido de 229 endpoints GET: 18 cambian de 403 a 200 solo por la asignacion)
const GRANT_PERMISSION = "collab-deliveries.summary.read";

async function token(api, username) {
  const response = await api.post(`${API}/auth/local-login`, { data: { username, password: process.env.STAGING_TEST_PASSWORD } });
  expect(response.ok(), `login de ${username}`).toBeTruthy();
  return (await response.json()).accessToken;
}
const headers = (jwt) => ({ Authorization: `Bearer ${jwt}`, "x-app-path": "/dashboard/finanzas/viaticos" });

// Con el backend reiniciado sin RBAC_CENTRAL_ENFORCE estas expectativas no aplican: ver rbac-rollback.spec.js.
test.skip(process.env.RBAC_EXPECT_ENFORCEMENT === "off", "Enforcement central apagado");

test.describe.configure({ mode: "serial" });

let api;
let ti;
let comercial;
let comercialId;

test.beforeAll(async () => {
  api = await request.newContext();
  ti = await token(api, "prueba.jefe_ti");
  comercial = await token(api, "prueba.comercial");
  const me = await (await api.get(`${API}/auth/me`, { headers: headers(comercial) })).json();
  comercialId = me?.user?.id || me?.data?.id || me?.id;
  expect(comercialId, "id del usuario de prueba").toBeTruthy();
});

const status = async (jwt) => (await api.get(`${API}${PROTECTED}`, { headers: headers(jwt) })).status();
const access = async () => (await (await api.get(`${API}/rbac/users/${comercialId}`, { headers: headers(ti) })).json()).data;

async function cleanup() {
  const data = await access();
  for (const a of data.assignments.filter((x) => x.source === "manual")) {
    await api.delete(`${API}/rbac/users/${comercialId}/roles/${a.id}`, { headers: headers(ti), data: { reason: "limpieza de la prueba" } });
  }
  for (const g of data.grants) await api.delete(`${API}/rbac/users/${comercialId}/grants/${g.id}`, { headers: headers(ti) });
}
test.beforeEach(cleanup);
// Primero se limpia y despues se cierra el contexto: al reves la limpieza fallaria.
test.afterAll(async () => { await cleanup(); await api.dispose(); });

test("sin asignacion, comercial no entra al area de entregas", async () => {
  expect(await status(comercial)).toBe(403);
});

test("una asignacion manual da acceso real y revocarla lo quita", async () => {
  const assigned = await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: headers(ti), data: { role: "financiero", reason: "prueba de enforcement central" } });
  expect(assigned.status()).toBe(200);
  expect(await status(comercial)).toBe(200);

  const manual = (await access()).assignments.find((a) => a.source === "manual");
  const revoked = await api.delete(`${API}/rbac/users/${comercialId}/roles/${manual.id}`, { headers: headers(ti), data: { reason: "fin de la prueba" } });
  expect(revoked.status()).toBe(200);
  expect(await status(comercial)).toBe(403);
});

test("un grant individual da acceso a ese permiso y se retira al revocarlo", async () => {
  const granted = await api.post(`${API}/rbac/users/${comercialId}/grants`, { headers: headers(ti), data: { permission: GRANT_PERMISSION, reason: "prueba de grant individual" } });
  expect(granted.status()).toBe(200);
  expect(await status(comercial)).toBe(200);
  const grant = (await access()).grants[0];
  await api.delete(`${API}/rbac/users/${comercialId}/grants/${grant.id}`, { headers: headers(ti) });
  expect(await status(comercial)).toBe(403);
});

test("un rol con vencimiento deja de valer solo al vencer, sin esperar al TTL de la cache", async () => {
  test.setTimeout(60000);
  const expiresAt = new Date(Date.now() + 4000).toISOString();
  const assigned = await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: headers(ti), data: { role: "financiero", reason: "prueba de vencimiento", expires_at: expiresAt } });
  expect(assigned.status()).toBe(200);
  expect(await status(comercial)).toBe(200); // vigente: entra y queda en cache
  await new Promise((resolve) => setTimeout(resolve, 5500));
  expect(await status(comercial)).toBe(403); // vencido: la cache no lo sostiene
});

test("el motivo es obligatorio, el vencimiento debe ser futuro y nadie se modifica a si mismo", async () => {
  const noReason = await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: headers(ti), data: { role: "financiero", reason: " " } });
  expect(noReason.status()).toBe(400);
  const past = await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: headers(ti), data: { role: "financiero", reason: "motivo valido", expires_at: "2020-01-01" } });
  expect(past.status()).toBe(400);
  const tiMe = await (await api.get(`${API}/auth/me`, { headers: headers(ti) })).json();
  const tiId = tiMe?.user?.id || tiMe?.data?.id || tiMe?.id;
  const self = await api.post(`${API}/rbac/users/${tiId}/roles`, { headers: headers(ti), data: { role: "financiero", reason: "intento sobre mi mismo" } });
  expect(self.status()).toBe(403);
});

test("quien no es de TI no puede administrar roles aunque conozca la ruta", async () => {
  const attempt = await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: headers(comercial), data: { role: "financiero", reason: "intento de escalar privilegios" } });
  expect(attempt.status()).toBe(403);
  expect(await status(comercial)).toBe(403);
});

test("los cambios quedan auditados con el valor anterior y el nuevo", async () => {
  await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: headers(ti), data: { role: "financiero", reason: "prueba de auditoria" } });
  const manual = (await access()).assignments.find((a) => a.source === "manual");
  await api.delete(`${API}/rbac/users/${comercialId}/roles/${manual.id}`, { headers: headers(ti), data: { reason: "cierre de la prueba de auditoria" } });
  const audit = (await (await api.get(`${API}/rbac/audit?user_id=${comercialId}&limit=5`, { headers: headers(ti) })).json()).data;
  const revoke = audit.find((entry) => entry.action === "revocar_rol");
  expect(revoke, "entrada de revocacion").toBeTruthy();
  expect(revoke.before.role).toBe("financiero");
  expect(revoke.after.revoked).toBe(true);
  expect(audit.some((entry) => entry.action === "asignar_rol" && entry.after.role === "financiero")).toBe(true);
});
