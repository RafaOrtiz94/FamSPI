const { resolveDefaultTarget, withDefaultTarget } = require("../notificationTargets");

describe("destino por defecto de notificaciones", () => {
  test("transicion de compra privada (caso Evelyn Rojas): abre el expediente privado", () => {
    const meta = { purchaseId: "20a15bfe", toState: "acp_availability_requested", data: { purchase_id: "20a15bfe" } };
    const out = withDefaultTarget({ source: "private_purchase.state_transition", meta });
    expect(out.target_path).toBe("/dashboard/purchases/workspace?tab=private&requestId=20a15bfe&requestType=private");
    expect(out.cta_label).toBe("Abrir expediente");
  });

  test("compra publica, Business Case y disponibilidad BC", () => {
    expect(resolveDefaultTarget({ source: "equipment_purchase.x", meta: { requestId: 7 } }).target_path).toContain("tab=public&requestId=7");
    expect(resolveDefaultTarget({ source: "business_case.section_review", meta: { businessCaseId: "bc1" } }).target_path).toBe("/dashboard/business-case/workspace/bc1");
    expect(resolveDefaultTarget({ source: "bc_availability", meta: { business_case_id: "bc1" } }).target_path).toBe("/dashboard/business-case/workspace/bc1");
  });

  test("solicitudes genericas: F.VE-02 va a comercial, el resto a servicio tecnico", () => {
    expect(resolveDefaultTarget({ source: "requests", meta: { request_id: 5, request_type: "F.VE-02" } }).target_path).toBe("/dashboard/comercial/solicitudes?request=5");
    expect(resolveDefaultTarget({ source: "requests", meta: { request_id: 6, request_type: "F.ST-20" } }).target_path).toBe("/dashboard/servicio-tecnico?request=6");
  });

  test("un destino explicito no se pisa", () => {
    const meta = { purchaseId: "x", target_path: "/otra/ruta", cta_label: "Ir" };
    expect(withDefaultTarget({ source: "private_purchase.state_transition", meta })).toBe(meta);
  });

  test("la alerta de SLA vencido del preflow no ofrece acceso directo, y sin datos no se inventa destino", () => {
    expect(resolveDefaultTarget({ source: "business_case.preflow.expiry", meta: { businessCaseId: "bc1" } })).toBeNull();
    expect(resolveDefaultTarget({ source: "security.offhours_login", meta: { userId: 1 } })).toBeNull();
    expect(withDefaultTarget({ source: "private_purchase.state_transition", meta: {} }).target_path).toBeUndefined();
  });
});
