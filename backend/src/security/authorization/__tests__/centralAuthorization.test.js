jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const db = require("../../../config/db");
const { loadUser, invalidateCentralCache } = require("../centralAuthorization");

const answer = ({ roles = [], grants = [] }) => db.query.mockImplementation(async (sql) =>
  ({ rows: sql.includes("user_role_assignments") ? roles : grants }));

describe("cache de roles del motor central", () => {
  beforeEach(() => { db.query.mockReset(); invalidateCentralCache(); });

  it("reutiliza la entrada dentro del TTL", async () => {
    answer({ roles: [{ key: "finanzas", expires_at: null }] });
    await loadUser(1, 1000);
    await loadUser(1, 5000);
    expect(db.query).toHaveBeenCalledTimes(2); // una carga: roles y grants
  });

  it("un rol con vencimiento deja de valer al vencer aunque no haya pasado el TTL", async () => {
    const expires = new Date(10000).toISOString();
    answer({ roles: [{ key: "finanzas", expires_at: expires }] });
    const first = await loadUser(2, 1000);
    expect(first.roles.has("finanzas")).toBe(true);
    answer({ roles: [] }); // la base ya no devuelve el rol vencido
    const after = await loadUser(2, 10001);
    expect(after.roles.has("finanzas")).toBe(false);
    expect(db.query.mock.calls.length).toBeGreaterThan(2);
  });

  it("un grant con vencimiento tambien limita la vigencia de la entrada", async () => {
    answer({ grants: [{ permission_key: "x.root.read", expires_at: new Date(8000).toISOString() }] });
    const entry = await loadUser(3, 1000);
    expect(entry.validUntil).toBe(8000);
  });

  it("sin vencimientos la entrada vale hasta el TTL", async () => {
    answer({ roles: [{ key: "finanzas", expires_at: null }] });
    expect((await loadUser(4, 1000)).validUntil).toBe(Infinity);
  });
});

describe("piloto: roles del token + roles de la base", () => {
  const { centralHasPermission } = require("../centralAuthorization");
  const handlers = (permissionRows) => db.query.mockImplementation(async (sql) => {
    if (sql.includes("rbac_endpoint_permissions")) return { rows: [] };
    if (sql.includes("FROM public.role_permissions")) return { rows: permissionRows };
    return { rows: [] }; // sin asignaciones en la base: usuario recien creado
  });
  beforeEach(() => { db.query.mockReset(); invalidateCentralCache(); delete process.env.RBAC_TENANT_MODE; });

  it("un usuario sin asignaciones en la base entra por el rol de su token", async () => {
    handlers([{ role: "admin_ti", permission_key: "rbac.read" }]);
    const verdict = await centralHasPermission({ userId: 90, permissionKey: "rbac.read", tokenRoles: ["admin_ti"] });
    expect(verdict).toMatchObject({ allowed: true, reason: "rol" });
  });

  it("sin el rol en el token ni en la base se niega", async () => {
    handlers([{ role: "admin_ti", permission_key: "rbac.read" }]);
    const verdict = await centralHasPermission({ userId: 91, permissionKey: "rbac.read", tokenRoles: ["comercial"] });
    expect(verdict).toMatchObject({ allowed: false });
  });
});
