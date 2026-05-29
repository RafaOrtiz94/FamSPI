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
    expect(gate.editors).toEqual(["backoffice_comercial", "backoffice"]);
    expect(gate.permissions.canEditDeterminations).toBe(true);
    expect(gate.documentUploaded).toBe(true);
  });

  test("buildGateInfo en public asigna comercial como responsable de la fase comercial", () => {
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
      role: "comercial",
      now: new Date("2026-02-01T12:00:00.000Z"),
    });

    expect(gate.workflowType).toBe("public");
    expect(gate.editors).toEqual(["comercial"]);
    expect(gate.permissions.canUploadDocument).toBe(true);
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
});
