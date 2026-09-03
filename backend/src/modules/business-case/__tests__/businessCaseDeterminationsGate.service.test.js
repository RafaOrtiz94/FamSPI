const service = require("../businessCaseDeterminationsGate.service");

describe("businessCaseDeterminationsGate.service", () => {
  test("buildGateInfo en private_comodato asigna roles correctos", () => {
    const gate = service.buildGateInfo({
      businessCase: {
        bc_purchase_type: "private_comodato",
        modern_bc_metadata: {
          determinations_gate: {
            enabled: true,
            enabled_at: "2026-02-01T10:00:00.000Z",
            deadline_at: "2026-02-03T10:00:00.000Z",
            document: {
              drive_file_id: "abc123",
              drive_link: "https://drive.google.com/file/d/abc123/view",
              uploaded_at: "2026-02-01T10:00:00.000Z",
              uploaded_by_email: "comercial@fam-project.com",
            },
          },
        },
      },
      role: "backoffice_comercial",
      now: new Date("2026-02-01T12:00:00.000Z"),
    });

    expect(gate.workflowType).toBe("private_comodato");
    expect(gate.editors).toEqual(["jefe_comercial", "jefe_de_comercial", "backoffice_comercial"]);
    expect(gate.permissions.canEditDeterminations).toBe(true);
    expect(gate.documentUploaded).toBe(true);
  });

  test("buildGateInfo en public asigna acp_comercial como responsable de la fase comercial", () => {
    const gate = service.buildGateInfo({
      businessCase: {
        bc_purchase_type: "public",
        modern_bc_metadata: {
          determinations_gate: {
            enabled: true,
            enabled_at: "2026-02-01T10:00:00.000Z",
            deadline_at: "2026-02-03T10:00:00.000Z",
            document: {
              drive_file_id: "pub123",
              drive_link: "https://drive.google.com/file/d/pub123/view",
              uploaded_at: "2026-02-01T10:00:00.000Z",
              uploaded_by_email: "comercial@fam-project.com",
            },
          },
        },
      },
      role: "acp_comercial",
      now: new Date("2026-02-01T12:00:00.000Z"),
    });

    expect(gate.workflowType).toBe("public");
    expect(gate.editors).toEqual(["jefe_comercial", "jefe_de_comercial", "acp_comercial"]);
    expect(gate.permissions.canUploadDocument).toBe(false);
    expect(gate.permissions.canEditDeterminations).toBe(true);
  });

  test("assertCanEditDeterminationsOrThrow falla sin documento", () => {
    const gate = {
      documentUploaded: false,
      isExpired: false,
      permissions: { canEditDeterminations: false },
    };
    expect(() => service.assertCanEditDeterminationsOrThrow(gate)).toThrow(
      /documento estadistico/i,
    );
  });

  test("usa el SLA de revision tecnica y bloquea al vencer", () => {
    const gate = service.buildGateInfo({
      businessCase: {
        bc_purchase_type: "public",
        modern_bc_metadata: {
          preflow_phase: "review",
          preflow_review_role: "jefe_servicio",
          preflow_review_deadline_at: "2026-02-02T10:00:00.000Z",
          determinations_gate: {
            enabled: true,
            phase: "technical_review",
            enabled_at: "2026-02-01T10:00:00.000Z",
            deadline_at: "2026-02-03T10:00:00.000Z",
            document: {
              drive_file_id: "tech123",
              drive_link: "https://drive.google.com/file/d/tech123/view",
              uploaded_at: "2026-02-01T10:00:00.000Z",
            },
          },
        },
      },
      role: "jefe_servicio",
      now: new Date("2026-02-02T11:00:00.000Z"),
    });

    expect(gate.deadlineAt).toBe("2026-02-02T10:00:00.000Z");
    expect(gate.technicalSlaExpired).toBe(true);
    // El vencimiento de SLA ya no bloquea edicion/sincronizacion -- solo se
    // expone via gate.isExpired/technicalSlaExpired para el aviso en UI.
    // jefe_servicio sigue siendo editor valido de la fase technical_review,
    // asi que canEditDeterminations es true pese al vencimiento.
    expect(gate.permissions.canEditDeterminations).toBe(true);
    expect(() => service.assertCanEditDeterminationsOrThrow(gate)).not.toThrow();
  });
});
