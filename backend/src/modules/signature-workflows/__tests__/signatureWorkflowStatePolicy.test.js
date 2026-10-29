const { resolveParallelWorkflowState } = require("../signatureWorkflowStatePolicy");

describe("resolveParallelWorkflowState", () => {
  test("completa solo cuando todos los firmantes obligatorios firmaron", () => {
    expect(resolveParallelWorkflowState([
      { id: 1, is_required: true, status: "signed" },
      { id: 2, is_required: true, status: "signed" },
    ])).toEqual({
      status: "completed",
      canComplete: true,
      unsignedRequiredIds: [],
      hasRequiredRejection: false,
    });
  });

  test("un rechazo obligatorio mantiene el workflow parcial aunque los demas firmaron", () => {
    const result = resolveParallelWorkflowState([
      { id: 1, is_required: true, status: "signed" },
      { id: 2, is_required: true, status: "rejected" },
      { id: 3, is_required: true, status: "signed" },
    ]);
    expect(result.status).toBe("partially_signed");
    expect(result.canComplete).toBe(false);
    expect(result.unsignedRequiredIds).toEqual([2]);
    expect(result.hasRequiredRejection).toBe(true);
  });

  test("un rechazo opcional no bloquea las firmas obligatorias completas", () => {
    const result = resolveParallelWorkflowState([
      { id: 1, is_required: true, status: "signed" },
      { id: 2, is_required: false, status: "rejected" },
    ]);
    expect(result.status).toBe("completed");
    expect(result.canComplete).toBe(true);
  });

  test("un firmante obligatorio disponible mantiene el workflow parcial", () => {
    const result = resolveParallelWorkflowState([
      { id: 1, is_required: true, status: "signed" },
      { id: 2, is_required: true, status: "available" },
    ]);
    expect(result.status).toBe("partially_signed");
    expect(result.canComplete).toBe(false);
    expect(result.unsignedRequiredIds).toEqual([2]);
  });
});
