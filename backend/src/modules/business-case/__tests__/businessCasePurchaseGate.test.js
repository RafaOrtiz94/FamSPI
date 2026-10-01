jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const db = require("../../../config/db");
const { requirePurchaseBusinessCaseGate } = require("../businessCasePurchaseGate.service");

const row = (stage, feasible) => ({
  business_case_id: "bc-1",
  requires_business_case: true,
  business_case_exists: true,
  business_case_stage: stage,
  modern_bc_metadata: feasible === undefined ? {} : { feasibility: { decision: { is_feasible: feasible } } },
});

const run = async (method, url, dbRow) => {
  db.query.mockResolvedValue({ rows: [dbRow] });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await requirePurchaseBusinessCaseGate("private")({ method, originalUrl: url, url, params: { id: "9" } }, res, next);
  return { res, next };
};

const base = "/api/v1/private-purchases/9";

describe("gate de Business Case: solo bloquea el contrato mientras la factibilidad esta pendiente", () => {
  test.each(["start-availability", "offer", "inspection-request", "send-to-acp"])(
    "BC pendiente: %s pasa",
    async (action) => {
      const { next, res } = await run("POST", `${base}/${action}`, row("en_proceso"));
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    },
  );

  test.each(["submit-contract", "contract/client-signed", "contract/acp-signed", "provider-contract/upload"])(
    "BC pendiente: %s se bloquea con 409",
    async (action) => {
      const { next, res } = await run("POST", `${base}/${action}`, row("en_proceso"));
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
    },
  );

  test("BC factible: el contrato pasa", async () => {
    const { next } = await run("POST", `${base}/submit-contract`, row("factible", true));
    expect(next).toHaveBeenCalled();
  });

  test("BC rechazado: se cierra todo el flujo, no solo el contrato", async () => {
    const { next, res } = await run("POST", `${base}/start-availability`, row("cerrado_no_factible", false));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
