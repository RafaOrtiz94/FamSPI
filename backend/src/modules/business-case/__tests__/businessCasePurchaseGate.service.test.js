const { buildGate } = require("../businessCasePurchaseGate.service");

describe("businessCasePurchaseGate", () => {
  test("deja pasar un expediente que no requiere Business Case", () => {
    expect(buildGate({ requires_business_case: false, business_case_id: null })).toMatchObject({
      required: false,
      open: true,
      status: "not_required",
    });
  });

  test("bloquea cuando el expediente requiere BC pero el vinculo falta", () => {
    expect(buildGate({ requires_business_case: true, business_case_id: null })).toMatchObject({
      required: true,
      open: false,
      status: "link_missing",
    });
  });

  test("no abre solo por tener bc_stage factible sin una decision explicita", () => {
    expect(buildGate({
      requires_business_case: true,
      business_case_id: "bc-1",
      business_case_exists: true,
      business_case_stage: "factible",
      modern_bc_metadata: { feasibility: {} },
    })).toMatchObject({ open: false, status: "pending" });
  });

  test("abre cuando etapa y decision confirman factibilidad", () => {
    expect(buildGate({
      requires_business_case: true,
      business_case_id: "bc-1",
      business_case_exists: true,
      business_case_stage: "factible",
      modern_bc_metadata: {
        feasibility: {
          status: "factible",
          decision: { is_feasible: true, decided_at: "2026-09-18T00:00:00.000Z" },
        },
      },
    })).toMatchObject({
      required: true,
      open: true,
      status: "approved",
    });
  });

  test("mantiene cerrado un BC rechazado", () => {
    expect(buildGate({
      requires_business_case: true,
      business_case_id: "bc-1",
      business_case_exists: true,
      business_case_stage: "cerrado_no_factible",
      modern_bc_metadata: {
        feasibility: { decision: { is_feasible: false } },
      },
    })).toMatchObject({ open: false, status: "rejected" });
  });
});
