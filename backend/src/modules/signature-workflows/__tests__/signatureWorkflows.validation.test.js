// Verificacion del motor de validacion de firmas (control critico GxP):
// decodificacion de PDF, reglas de creacion de workflow y accion de firmante.

const {
  validateCreateWorkflowPayload,
  validateSignerActionPayload,
} = require("../signatureWorkflows.validation");

const pdfBase64 = Buffer.from("%PDF-1.4 contenido de prueba").toString("base64");

const validCreateBody = () => ({
  source_module: "permisos",
  source_entity: "permiso",
  source_entity_id: 42,
  document_type: "permiso_laboral",
  title: "Permiso de prueba",
  document: { filename: "permiso.pdf", pdf_base64: pdfBase64 },
  signers: [
    { email: "Firmante.Uno@fam.com", name: "Uno", sequence_order: 1 },
    { email: "firmante.dos@fam.com", name: "Dos", sequence_order: 2 },
  ],
});

describe("validateCreateWorkflowPayload – documento PDF", () => {
  it("acepta pdf_base64 con prefijo data: y calcula el hash", () => {
    const body = validCreateBody();
    body.document.pdf_base64 = "data:application/pdf;base64," + pdfBase64;
    const out = validateCreateWorkflowPayload(body);
    expect(out.document.source_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exige document.pdf_base64", () => {
    const body = validCreateBody();
    body.document.pdf_base64 = "";
    expect(() => validateCreateWorkflowPayload(body)).toThrow(/pdf_base64/);
  });
});

describe("validateCreateWorkflowPayload", () => {
  it("normaliza un payload valido, ordena firmantes y calcula sha256", () => {
    const out = validateCreateWorkflowPayload(validCreateBody());
    expect(out.sourceEntityId).toBe(42);
    expect(out.signers).toHaveLength(2);
    expect(out.signers[0].sequence_order).toBe(1);
    // email normalizado a minusculas
    expect(out.signers[0].email).toBe("firmante.uno@fam.com");
    // sha256 en hex (64 chars) calculado del contenido
    expect(out.document.source_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exige source_module", () => {
    const body = validCreateBody();
    body.source_module = "";
    expect(() => validateCreateWorkflowPayload(body)).toThrow(/source_module/);
  });

  it("exige source_entity_id numerico y positivo", () => {
    const body = validCreateBody();
    body.source_entity_id = 0;
    expect(() => validateCreateWorkflowPayload(body)).toThrow(/source_entity_id/);
  });

  it("exige al menos un firmante", () => {
    const body = validCreateBody();
    body.signers = [];
    expect(() => validateCreateWorkflowPayload(body)).toThrow(/al menos un firmante/);
  });

  it("rechaza sequence_order duplicado", () => {
    const body = validCreateBody();
    body.signers[1].sequence_order = 1;
    expect(() => validateCreateWorkflowPayload(body)).toThrow(/duplicado/);
  });

  it("exige email en cada firmante", () => {
    const body = validCreateBody();
    body.signers[0].email = "";
    expect(() => validateCreateWorkflowPayload(body)).toThrow(/email/);
  });
});

describe("validateSignerActionPayload", () => {
  it("exige consentimiento cuando requireConsent es true", () => {
    expect(() => validateSignerActionPayload({}, { requireConsent: true })).toThrow(/consentimiento/);
    expect(validateSignerActionPayload({ consent: true }, { requireConsent: true })).toBeTruthy();
  });

  it("exige razon cuando requireReason es true", () => {
    expect(() => validateSignerActionPayload({}, { requireReason: true })).toThrow(/reason/);
  });

  it("acepta y normaliza una ubicacion de firma valida", () => {
    const out = validateSignerActionPayload({
      signature_placement: { page_number: 2, x_pct: 10, y_pct: 90 },
    });
    expect(out.signature_placement).toEqual({ page_number: 2, x_pct: 10, y_pct: 90 });
  });

  it("descarta una ubicacion de firma invalida (page_number < 1)", () => {
    const out = validateSignerActionPayload({
      signature_placement: { page_number: 0, x_pct: 10, y_pct: 90 },
    });
    expect(out.signature_placement).toBeNull();
  });
});
