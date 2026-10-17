// Rollback del enforcement central (plan RBAC, Fases 5 y 7): con RBAC_CENTRAL_ENFORCE quitado, decide solo
// requireRole. Una asignacion manual SE GUARDA pero NO abre el acceso, y los roles de siempre siguen entrando.
// Solo corre con el backend local reiniciado sin la variable:  RBAC_EXPECT_ENFORCEMENT=off npx playwright test rbac-rollback
const { test, expect, request } = require("@playwright/test");

test.skip(process.env.RBAC_EXPECT_ENFORCEMENT !== "off", "Requiere el backend local reiniciado sin RBAC_CENTRAL_ENFORCE");

const API = process.env.STAGING_API_URL || "http://localhost:8090/api/v1";
const PROTECTED = "/collab-deliveries/summary";

test("sin enforcement central, la asignacion manual no abre el acceso y el acceso de siempre se conserva", async () => {
  test.setTimeout(60000);
  const api = await request.newContext();
  const login = async (username) => {
    const response = await api.post(`${API}/auth/local-login`, { data: { username, password: process.env.STAGING_TEST_PASSWORD } });
    return (await response.json()).accessToken;
  };
  const h = (jwt) => ({ Authorization: `Bearer ${jwt}`, "x-app-path": "/dashboard/finanzas" });
  const ti = await login("prueba.jefe_ti");
  const comercial = await login("prueba.comercial");
  const financiero = await login("prueba.financiero");
  const comercialId = (await (await api.get(`${API}/auth/me`, { headers: h(comercial) })).json()).user.id;

  try {
    expect((await api.get(`${API}${PROTECTED}`, { headers: h(financiero) })).status(), "financiero conserva su acceso").toBe(200);
    expect((await api.get(`${API}${PROTECTED}`, { headers: h(comercial) })).status()).toBe(403);

    const assigned = await api.post(`${API}/rbac/users/${comercialId}/roles`, { headers: h(ti), data: { role: "financiero", reason: "prueba de rollback" } });
    expect(assigned.status(), "la asignacion se guarda").toBe(200);
    expect((await api.get(`${API}${PROTECTED}`, { headers: h(comercial) })).status(), "sin enforcement no abre el acceso").toBe(403);
  } finally {
    const access = (await (await api.get(`${API}/rbac/users/${comercialId}`, { headers: h(ti) })).json()).data;
    for (const a of access.assignments.filter((x) => x.source === "manual")) {
      await api.delete(`${API}/rbac/users/${comercialId}/roles/${a.id}`, { headers: h(ti), data: { reason: "limpieza del rollback" } });
    }
    await api.dispose();
  }
});
