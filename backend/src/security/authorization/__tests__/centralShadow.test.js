jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("../centralAuthorization", () => ({ centralDecisionForRequest: jest.fn() }));

const logger = require("../../../config/logger");
const { centralDecisionForRequest } = require("../centralAuthorization");
const { centralShadow, classify, getCentralShadowCounts, resetCentralShadowCounts } = require("../centralShadow");

const run = async (statusCode, central, { enabled = true, route = { path: "/:id" } } = {}) => {
  if (enabled) process.env.RBAC_CENTRAL_SHADOW = "true"; else delete process.env.RBAC_CENTRAL_SHADOW;
  centralDecisionForRequest.mockReset();
  if (central instanceof Error) centralDecisionForRequest.mockRejectedValue(central);
  else centralDecisionForRequest.mockResolvedValue(central);
  let finish;
  const res = { statusCode, on: (event, cb) => { if (event === "finish") finish = cb; } };
  const req = { method: "GET", originalUrl: "/api/v1/x/5?a=1", route, user: { id: 7, role: "Comercial" } };
  const next = jest.fn();
  centralShadow(req, res, next);
  if (finish) finish();
  await new Promise((resolve) => setImmediate(resolve));
  return { next };
};

describe("modo sombra del motor central", () => {
  beforeEach(() => { jest.clearAllMocks(); resetCentralShadowCounts(); });
  afterAll(() => { delete process.env.RBAC_CENTRAL_SHADOW; });

  it("clasifica la comparacion con el 403 real", () => {
    expect(classify({ allowed: true }, 200)).toBe("coincide");
    expect(classify({ allowed: false }, 403)).toBe("coincide");
    expect(classify({ allowed: false }, 200)).toBe("central_niega_legacy_permite");
    expect(classify({ allowed: false }, 500)).toBe("central_niega_legacy_error");
    expect(classify({ allowed: true }, 403)).toBe("central_permite_legacy_403");
  });

  it("apagado no consulta nada y deja pasar", async () => {
    const { next } = await run(200, { allowed: true }, { enabled: false });
    expect(next).toHaveBeenCalledTimes(1);
    expect(centralDecisionForRequest).not.toHaveBeenCalled();
  });

  it("deja pasar la peticion y registra solo diferencias, sin identificadores", async () => {
    const { next } = await run(200, { permissionKey: "x.root.read", allowed: false, reason: "sin_rol" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(centralDecisionForRequest).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, method: "GET", path: "/api/v1/x/5", routePath: "/:id" }));
    expect(logger.info).toHaveBeenCalledTimes(1);
    const text = JSON.stringify(getCentralShadowCounts());
    expect(text).toContain("central_niega_legacy_permite");
    expect(text).not.toMatch(/"(userId|email|id)"/);
  });

  it("las coincidencias solo se cuentan", async () => {
    await run(200, { permissionKey: "x.root.read", allowed: true, reason: "rol" });
    await run(200, { permissionKey: "x.root.read", allowed: true, reason: "rol" });
    expect(logger.info).not.toHaveBeenCalled();
    expect(getCentralShadowCounts()).toEqual([expect.objectContaining({ divergence: "coincide", count: 2 })]);
  });

  it("ignora respuestas sin ruta resuelta, 401 y endpoints sin permiso; descarta errores del motor", async () => {
    await run(404, { allowed: true }, { route: null });
    await run(401, { allowed: true });
    await run(200, null);
    await run(200, new Error("sin base"));
    expect(getCentralShadowCounts()).toEqual([]);
  });
});
