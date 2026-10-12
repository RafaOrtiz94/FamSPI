jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("../../../modules/module-access/moduleAccess.service", () => ({ isModuleEnabledForUser: jest.fn() }));
jest.mock("../centralAuthorization", () => ({ centralHasPermission: jest.fn() }));

const { requirePermission } = require("../authorization.middleware");
const { centralHasPermission } = require("../centralAuthorization");

const call = async (user) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await requirePermission("module_access.manage")({ user, originalUrl: "/api/v1/module-access/catalog" }, res, next);
  return { res, next };
};

describe("piloto de enforcement central (module_access.manage)", () => {
  beforeEach(() => { jest.clearAllMocks(); process.env.RBAC_CENTRAL_PILOT = "true"; });
  afterAll(() => { delete process.env.RBAC_CENTRAL_PILOT; });

  it("apagado no consulta al motor central", async () => {
    delete process.env.RBAC_CENTRAL_PILOT;
    const { next } = await call({ id: 1, role: "jefe_ti" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(centralHasPermission).not.toHaveBeenCalled();
  });

  it("encendido, decide el motor central", async () => {
    centralHasPermission.mockResolvedValue({ allowed: true, reason: "rol" });
    expect((await call({ id: 1, role: "jefe_ti" })).next).toHaveBeenCalledTimes(1);
    centralHasPermission.mockResolvedValue({ allowed: false, reason: "sin_rol" });
    const denied = await call({ id: 2, role: "jefe_ti" });
    expect(denied.next).not.toHaveBeenCalled();
    expect(denied.res.status).toHaveBeenCalledWith(403);
  });

  it("si el motor falla, decide la regla de siempre", async () => {
    centralHasPermission.mockRejectedValue(new Error("sin base"));
    expect((await call({ id: 1, role: "jefe_ti" })).next).toHaveBeenCalledTimes(1);
    const denied = await call({ id: 3, role: "comercial" });
    expect(denied.res.status).toHaveBeenCalledWith(403);
  });

  it("si el catalogo no conoce el permiso, decide la regla de siempre", async () => {
    centralHasPermission.mockResolvedValue(null);
    expect((await call({ id: 1, role: "jefe_ti" })).next).toHaveBeenCalledTimes(1);
    expect((await call({ id: 3, role: "comercial" })).res.status).toHaveBeenCalledWith(403);
  });

  it("sin id de usuario no usa el motor central", async () => {
    const { next } = await call({ role: "jefe_ti" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(centralHasPermission).not.toHaveBeenCalled();
  });
});
