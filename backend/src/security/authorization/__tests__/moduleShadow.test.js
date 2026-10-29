jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("../../../modules/module-access/moduleAccess.service", () => ({
  isModuleEnabledForUser: jest.fn(),
  resolveModuleKeyByPath: jest.requireActual("../../../modules/module-access/moduleAccess.service").resolveModuleKeyByPath,
}));
jest.mock("../apiModuleRegistry", () => {
  const actual = jest.requireActual("../apiModuleRegistry");
  const registry = {
    "/api/v1/viaticos": ["finanzas_viaticos"],
    "/api/v1/clients": ["comercial_clientes", "business_case"],
    "/api/v1/dashboard": [],
  };
  return { ...actual, resolveDeclaredModules: (path) => actual.resolveDeclaredModules(path, registry) };
});

const logger = require("../../../config/logger");
const { isModuleEnabledForUser } = require("../../../modules/module-access/moduleAccess.service");
const { observeModuleDecision, getShadowCounts, resetShadowCounts } = require("../moduleShadow");
const { moduleAccessGuard } = require("../../../middlewares/moduleAccess");
const { apiPrefixOf, resolveDeclaredModules } = jest.requireActual("../apiModuleRegistry");

const request = (path, appPath, extra = {}) => ({
  method: "GET",
  path,
  headers: appPath ? { "x-app-path": appPath } : {},
  user: { id: 7, role: "pasante" },
  ...extra,
});
const disabled = (...keys) => isModuleEnabledForUser.mockImplementation(async ({ moduleKey }) => !keys.includes(moduleKey));

describe("modo sombra de autorizacion modular", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetShadowCounts();
    process.env.RBAC_MODULE_SHADOW = "true";
    disabled();
  });
  afterAll(() => { delete process.env.RBAC_MODULE_SHADOW; });

  it("apagado no evalua ni registra nada", async () => {
    delete process.env.RBAC_MODULE_SHADOW;
    expect(await observeModuleDecision(request("/api/v1/viaticos/1"), { moduleKey: null, allowed: true })).toBeNull();
    expect(isModuleEnabledForUser).not.toHaveBeenCalled();
    expect(getShadowCounts()).toEqual([]);
  });

  it("encabezado ausente: lo vigente permite y el registro habria denegado", async () => {
    disabled("finanzas_viaticos");
    const entry = await observeModuleDecision(request("/api/v1/viaticos/55"), { moduleKey: null, allowed: true });
    expect(entry).toMatchObject({ divergence: "decision_distinta", legacyAllowed: true, shadowAllowed: false, headerModule: null });
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it("encabezado de otro modulo: misma decision, modulo distinto", async () => {
    const entry = await observeModuleDecision(request("/api/v1/viaticos"), { moduleKey: "calidad", allowed: true });
    expect(entry.divergence).toBe("modulo_distinto");
  });

  it("encabezado falsificado hacia un modulo habilitado no engana al registro", async () => {
    disabled("finanzas_viaticos");
    const entry = await observeModuleDecision(request("/api/v1/viaticos"), { moduleKey: "inicio", allowed: true });
    expect(entry).toMatchObject({ divergence: "decision_distinta", shadowAllowed: false });
  });

  it("con varios modulos declarados basta uno habilitado", async () => {
    disabled("comercial_clientes");
    const entry = await observeModuleDecision(request("/api/v1/clients"), { moduleKey: "business_case", allowed: true });
    expect(entry).toMatchObject({ divergence: "coincide", shadowAllowed: true });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("transversal coincide y ruta sin declarar se marca", async () => {
    expect((await observeModuleDecision(request("/api/v1/dashboard/x"), { moduleKey: null, allowed: true })).divergence).toBe("coincide");
    expect((await observeModuleDecision(request("/api/v1/otra/x"), { moduleKey: null, allowed: true })).divergence).toBe("sin_declarar");
  });

  it("cada combinacion se escribe una vez y se cuenta; no guarda ids", async () => {
    const legacy = { moduleKey: "calidad", allowed: true };
    await observeModuleDecision(request("/api/v1/viaticos/1"), legacy);
    await observeModuleDecision(request("/api/v1/viaticos/2"), legacy);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(getShadowCounts()).toEqual([expect.objectContaining({ apiPrefix: "/api/v1/viaticos", count: 2 })]);
    expect(JSON.stringify(getShadowCounts())).not.toMatch(/"(userId|id|email)"/);
  });

  it("un error del registro se descarta", async () => {
    isModuleEnabledForUser.mockRejectedValue(new Error("sin base"));
    expect(await observeModuleDecision(request("/api/v1/viaticos"), { moduleKey: null, allowed: true })).toBeNull();
  });
});

describe("moduleAccessGuard con sombra encendida responde igual que apagada", () => {
  const run = async (req) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    await moduleAccessGuard(req, res, next);
    return { status: res.status.mock.calls[0]?.[0] || null, body: res.json.mock.calls[0]?.[0] || null, next: next.mock.calls, verified: req._moduleAccessVerified || false };
  };
  const cases = [
    ["sin encabezado", () => request("/api/v1/viaticos/1")],
    ["modulo habilitado", () => request("/api/v1/viaticos/1", "/dashboard/calidad")],
    ["modulo deshabilitado", () => request("/api/v1/viaticos/1", "/dashboard/finanzas/viaticos")],
    ["ruta exenta", () => request("/api/v1/notifications/x", "/dashboard/finanzas/viaticos")],
  ];

  it.each(cases)("%s", async (_name, build) => {
    disabled("finanzas_viaticos");
    delete process.env.RBAC_MODULE_SHADOW;
    const off = await run(build());
    process.env.RBAC_MODULE_SHADOW = "true";
    const on = await run(build());
    expect(on).toEqual(off);
  });

  it("si la sombra falla, la respuesta vigente no cambia", async () => {
    process.env.RBAC_MODULE_SHADOW = "true";
    isModuleEnabledForUser.mockResolvedValueOnce(true).mockRejectedValue(new Error("sin base"));
    const result = await run(request("/api/v1/viaticos/1", "/dashboard/calidad"));
    expect(result).toMatchObject({ status: null, verified: true });
    expect(result.next).toEqual([[]]);
  });
});

describe("registro ruta API -> modulo", () => {
  it("prefijo estable sin identificadores", () => {
    expect(apiPrefixOf("/api/v1/business-case/123/items?x=1")).toBe("/api/v1/business-case");
    expect(apiPrefixOf("/asistencia/ping")).toBe("/asistencia");
    expect(apiPrefixOf("/internal/jobs/x")).toBe("/internal/jobs");
  });

  it("gana el prefijo mas largo y no confunde prefijos parecidos", () => {
    const registry = { "/api/v1/servicio": ["a"], "/api/v1/servicio/external-cases": ["b"] };
    expect(resolveDeclaredModules("/api/v1/servicio/external-cases/9", registry)).toEqual(["b"]);
    expect(resolveDeclaredModules("/api/v1/servicio/x", registry)).toEqual(["a"]);
    expect(resolveDeclaredModules("/api/v1/servicios", registry)).toBeNull();
  });
});

describe("la sombra no depende de que la ruta siga intacta", () => {
  it("usa la ruta del momento de la llamada aunque Express la recorte despues", async () => {
    process.env.RBAC_MODULE_SHADOW = "true";
    resetShadowCounts();
    isModuleEnabledForUser.mockResolvedValue(true);
    const req = request("/api/v1/viaticos/stats");
    const pending = observeModuleDecision(req, { moduleKey: "calidad", allowed: true });
    req.path = "/stats";
    expect((await pending).apiPrefix).toBe("/api/v1/viaticos");
    delete process.env.RBAC_MODULE_SHADOW;
  });
});
