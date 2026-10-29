jest.mock("../../../config/logger", () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../../modules/module-access/moduleAccess.service", () => ({
  isModuleEnabledForUser: jest.fn(),
}));

const {
  requirePermission,
  requireModule,
} = require("../authorization.middleware");
const { isModuleEnabledForUser } = require("../../../modules/module-access/moduleAccess.service");

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("authorization middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rechaza una petición sin usuario", () => {
    const res = response();
    const next = jest.fn();

    requirePermission("module_access.manage")({}, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("permite el permiso piloto y deja evidencia en req.authorization", () => {
    const req = { user: { id: 1, role: "jefe_ti" }, originalUrl: "/api/v1/module-access/catalog" };
    const res = response();
    const next = jest.fn();

    requirePermission("module_access.manage")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authorization).toEqual({ permission: "module_access.manage" });
  });

  it("rechaza permisos desconocidos y roles no autorizados", () => {
    const resUnknown = response();
    const resDenied = response();

    requirePermission("unknown.permission")({ user: { role: "jefe_ti" } }, resUnknown, jest.fn());
    requirePermission("module_access.manage")({ user: { role: "comercial" } }, resDenied, jest.fn());

    expect(resUnknown.status).toHaveBeenCalledWith(403);
    expect(resUnknown.json).toHaveBeenCalledWith(expect.objectContaining({ code: "UNKNOWN_PERMISSION" }));
    expect(resDenied.status).toHaveBeenCalledWith(403);
    expect(resDenied.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PERMISSION_DENIED" }));
  });

  it("protege el módulo usando su clave explícita", async () => {
    isModuleEnabledForUser.mockResolvedValue(true);
    const req = { user: { id: 9 } };
    const next = jest.fn();

    await requireModule("crm_fam")(req, response(), next);

    expect(isModuleEnabledForUser).toHaveBeenCalledWith({ userId: 9, moduleKey: "crm_fam" });
    expect(req.authorization).toEqual({ module: "crm_fam" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("devuelve MODULE_DISABLED cuando el entitlement está apagado", async () => {
    isModuleEnabledForUser.mockResolvedValue(false);
    const res = response();

    await requireModule("crm_fam")({ user: { id: 9 } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: "MODULE_DISABLED",
      module_key: "crm_fam",
    }));
  });
});
