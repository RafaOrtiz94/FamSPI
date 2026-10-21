jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const db = require("../../../config/db");
const { loadModel, loadUser, invalidateCentralCache } = require("../centralAuthorization");

const answer = (handlers) => db.query.mockImplementation(async (sql, params) => {
  const hit = handlers.find(([needle]) => sql.includes(needle));
  return hit ? hit[1](params) : { rows: [] };
});

describe("motor central con empresa", () => {
  beforeEach(() => { db.query.mockReset(); invalidateCentralCache(); delete process.env.RBAC_TENANT_MODE; });
  afterAll(() => { delete process.env.RBAC_TENANT_MODE; });

  it("apagado usa los nombres de rol y las consultas de siempre", async () => {
    answer([
      ["rbac_endpoint_permissions", () => ({ rows: [] })],
      ["role_permissions", () => ({ rows: [{ role: "comercial", permission_key: "a.b.read" }] })],
    ]);
    const model = await loadModel();
    expect([...model.permissionRoles.get("a.b.read")]).toEqual(["comercial"]);
    const sql = db.query.mock.calls.map(([text]) => text).find((text) => text.includes("role_permissions"));
    expect(sql).toContain("r.tenant_id IS NULL AND r.is_active");
  });

  it("encendido, el rol de una empresa lleva su prefijo y no coincide con el de otra ni con uno de sistema", async () => {
    process.env.RBAC_TENANT_MODE = "true";
    answer([
      ["rbac_endpoint_permissions", () => ({ rows: [] })],
      ["role_permissions", () => ({ rows: [
        { role: "comercial", tenant_id: null, permission_key: "a.b.read" },
        { role: "custom_ventas", tenant_id: "7", permission_key: "a.b.read" },
        { role: "custom_ventas", tenant_id: "8", permission_key: "a.b.create" },
      ] })],
    ]);
    const model = await loadModel();
    expect([...model.permissionRoles.get("a.b.read")].sort()).toEqual(["comercial", "t7:custom_ventas"]);
    expect([...model.permissionRoles.get("a.b.create")]).toEqual(["t8:custom_ventas"]);
  });

  it("encendido, el usuario solo carga los roles de su empresa", async () => {
    process.env.RBAC_TENANT_MODE = "true";
    answer([
      ["tenant_memberships", () => ({ rows: [{ tenant_id: "7" }] })],
      ["user_role_assignments", (params) => {
        expect(params).toEqual([5, 7]);
        return { rows: [{ key: "comercial", tenant_id: null, expires_at: null }, { key: "custom_ventas", tenant_id: "7", expires_at: null }] };
      }],
      ["user_permission_grants", (params) => { expect(params).toEqual([5, 7]); return { rows: [] }; }],
    ]);
    const user = await loadUser(5);
    expect([...user.roles].sort()).toEqual(["comercial", "t7:custom_ventas"]);
    expect(user.tenantId).toBe(7);
  });

  it("cambiar el modo invalida lo que estaba en cache", async () => {
    answer([
      ["user_role_assignments", () => ({ rows: [{ key: "comercial", expires_at: null }] })],
      ["user_permission_grants", () => ({ rows: [] })],
    ]);
    const off = await loadUser(6, 1000);
    expect(off.tenantMode).toBe(false);
    process.env.RBAC_TENANT_MODE = "true";
    answer([
      ["tenant_memberships", () => ({ rows: [{ tenant_id: "7" }] })],
      ["user_role_assignments", () => ({ rows: [] })],
      ["user_permission_grants", () => ({ rows: [] })],
    ]);
    const on = await loadUser(6, 2000);
    expect(on.tenantMode).toBe(true);
    expect(on.roles.size).toBe(0);
  });
});
