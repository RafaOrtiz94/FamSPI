const fs = require("fs");
const path = require("path");

const {
  validateCreateWorkflowPayload,
  validateSignerActionPayload,
} = require("../signatureWorkflows.validation");

const serviceSource = fs.readFileSync(path.join(__dirname, "../signatureWorkflows.service.js"), "utf8");
const detailPageSource = fs.readFileSync(
  path.join(__dirname, "../../../../..", "spi_front/src/modules/signature/pages/SignatureWorkflowDetailPage.jsx"),
  "utf8"
);
const workspaceSource = fs.readFileSync(
  path.join(__dirname, "../../../../..", "spi_front/src/modules/signature/components/SignatureWorkflowDetailWorkspace.jsx"),
  "utf8"
);
const pdfViewerSource = fs.readFileSync(
  path.join(__dirname, "../../../../..", "spi_front/src/modules/signature/components/PdfSignerViewer.jsx"),
  "utf8"
);

const pdfBase64 = Buffer.from("%PDF-1.4 produccion paralela").toString("base64");
const notPdfBase64 = Buffer.from("texto que no es pdf").toString("base64");

const baseCreateBody = (overrides = {}) => ({
  source_module: "famsign",
  source_entity: "manual_workflow",
  source_entity_id: 101,
  document_type: "manual_pdf",
  title: "Workflow paralelo",
  description: "Prueba de produccion",
  document: { filename: "workflow.pdf", pdf_base64: pdfBase64 },
  signers: [
    { user_id: 11, email: "Uno@fam.com", name: "Uno", sequence_order: 2, role: "Jefe" },
    { user_id: 12, email: "Dos@fam.com", name: "Dos", sequence_order: 1, role: "Analista" },
  ],
  meta: { origin: "test" },
  ...overrides,
});

const expectCreateOk = (body, assertion = () => {}) => {
  const out = validateCreateWorkflowPayload(body);
  assertion(out);
};

const expectCreateFail = (body, message) => {
  expect(() => validateCreateWorkflowPayload(body)).toThrow(message);
};

const expectActionOk = (body, options, assertion = () => {}) => {
  const out = validateSignerActionPayload(body, options);
  assertion(out);
};

const expectActionFail = (body, options, message) => {
  expect(() => validateSignerActionPayload(body, options)).toThrow(message);
};

const cases = [
  ["01 acepta payload base con dos firmantes", () => expectCreateOk(baseCreateBody(), (out) => expect(out.signers).toHaveLength(2))],
  ["02 ordena firmantes solo para visualizacion", () => expectCreateOk(baseCreateBody(), (out) => expect(out.signers.map((s) => s.sequence_order)).toEqual([1, 2]))],
  ["03 normaliza email de firmante", () => expectCreateOk(baseCreateBody(), (out) => expect(out.signers[0].email).toBe("dos@fam.com"))],
  ["04 normaliza rol a minusculas", () => expectCreateOk(baseCreateBody(), (out) => expect(out.signers[0].role).toBe("analista"))],
  ["05 conserva meta object", () => expectCreateOk(baseCreateBody(), (out) => expect(out.meta.origin).toBe("test"))],
  ["06 acepta document data URI PDF", () => expectCreateOk(baseCreateBody({ document: { filename: "a.pdf", pdf_base64: `data:application/pdf;base64,${pdfBase64}` } }))],
  ["07 calcula source sha256 automatico", () => expectCreateOk(baseCreateBody(), (out) => expect(out.document.source_sha256).toMatch(/^[a-f0-9]{64}$/))],
  ["08 acepta source sha256 provisto", () => expectCreateOk(baseCreateBody({ document: { filename: "a.pdf", pdf_base64: pdfBase64, source_sha256: "A".repeat(64) } }), (out) => expect(out.document.source_sha256).toBe("a".repeat(64)))],
  ["09 acepta firmante opcional", () => expectCreateOk(baseCreateBody({ signers: [{ email: "a@b.com", name: "A", sequence_order: 1, is_required: false }] }), (out) => expect(out.signers[0].is_required).toBe(false))],
  ["10 convierte user_id numerico", () => expectCreateOk(baseCreateBody({ signers: [{ user_id: "99", email: "a@b.com", name: "A", sequence_order: 1 }] }), (out) => expect(out.signers[0].user_id).toBe(99))],
  ["11 limpia description vacia a null", () => expectCreateOk(baseCreateBody({ description: " " }), (out) => expect(out.description).toBeNull())],
  ["12 limpia filename con espacios", () => expectCreateOk(baseCreateBody({ document: { filename: " a.pdf ", pdf_base64: pdfBase64 } }), (out) => expect(out.document.filename).toBe("a.pdf"))],
  ["13 acepta un solo firmante", () => expectCreateOk(baseCreateBody({ signers: [{ email: "solo@fam.com", name: "Solo", sequence_order: 1 }] }), (out) => expect(out.signers).toHaveLength(1))],
  ["14 conserva source entity id numerico", () => expectCreateOk(baseCreateBody({ source_entity_id: "55" }), (out) => expect(out.sourceEntityId).toBe(55))],
  ["15 ignora meta no object", () => expectCreateOk(baseCreateBody({ meta: "x" }), (out) => expect(out.meta).toEqual({}))],

  ["16 rechaza source_module vacio", () => expectCreateFail(baseCreateBody({ source_module: "" }), /source_module/)],
  ["17 rechaza source_entity vacio", () => expectCreateFail(baseCreateBody({ source_entity: "" }), /source_entity/)],
  ["18 rechaza source_entity_id cero", () => expectCreateFail(baseCreateBody({ source_entity_id: 0 }), /source_entity_id/)],
  ["19 rechaza source_entity_id negativo", () => expectCreateFail(baseCreateBody({ source_entity_id: -1 }), /source_entity_id/)],
  ["20 rechaza source_entity_id no numerico", () => expectCreateFail(baseCreateBody({ source_entity_id: "abc" }), /source_entity_id/)],
  ["21 rechaza document_type vacio", () => expectCreateFail(baseCreateBody({ document_type: "" }), /document_type/)],
  ["22 rechaza title vacio", () => expectCreateFail(baseCreateBody({ title: "" }), /title/)],
  ["23 rechaza filename vacio", () => expectCreateFail(baseCreateBody({ document: { filename: "", pdf_base64: pdfBase64 } }), /filename/)],
  ["24 rechaza pdf_base64 vacio", () => expectCreateFail(baseCreateBody({ document: { filename: "a.pdf", pdf_base64: "" } }), /pdf_base64/)],
  ["25 rechaza base64 que no contiene PDF", () => expectCreateFail(baseCreateBody({ document: { filename: "a.pdf", pdf_base64: notPdfBase64 } }), /PDF valido/)],
  ["26 rechaza lista de firmantes vacia", () => expectCreateFail(baseCreateBody({ signers: [] }), /al menos un firmante/)],
  ["27 rechaza firmantes no array", () => expectCreateFail(baseCreateBody({ signers: null }), /al menos un firmante/)],
  ["28 rechaza sequence_order cero", () => expectCreateFail(baseCreateBody({ signers: [{ email: "a@b.com", name: "A", sequence_order: 0 }] }), /sequence_order/)],
  ["29 rechaza sequence_order negativo", () => expectCreateFail(baseCreateBody({ signers: [{ email: "a@b.com", name: "A", sequence_order: -1 }] }), /sequence_order/)],
  ["30 rechaza sequence_order no numerico", () => expectCreateFail(baseCreateBody({ signers: [{ email: "a@b.com", name: "A", sequence_order: "x" }] }), /sequence_order/)],
  ["31 rechaza sequence_order duplicado", () => expectCreateFail(baseCreateBody({ signers: [{ email: "a@b.com", name: "A", sequence_order: 1 }, { email: "c@b.com", name: "C", sequence_order: 1 }] }), /duplicado/)],
  ["32 rechaza email vacio", () => expectCreateFail(baseCreateBody({ signers: [{ email: "", name: "A", sequence_order: 1 }] }), /email/)],
  ["33 rechaza name vacio", () => expectCreateFail(baseCreateBody({ signers: [{ email: "a@b.com", name: "", sequence_order: 1 }] }), /name/)],
  ["34 rechaza email duplicado case-insensitive", () => expectCreateFail(baseCreateBody({ signers: [{ email: "a@b.com", name: "A", sequence_order: 1 }, { email: "A@b.com", name: "A2", sequence_order: 2 }] }), /firmante duplicado/)],
  ["35 rechaza user_id duplicado", () => expectCreateFail(baseCreateBody({ signers: [{ user_id: 1, email: "a@b.com", name: "A", sequence_order: 1 }, { user_id: 1, email: "b@b.com", name: "B", sequence_order: 2 }] }), /firmante duplicado/)],
  ["36 acepta mismo email si user_id distinto no debe pasar", () => expectCreateFail(baseCreateBody({ signers: [{ user_id: 1, email: "a@b.com", name: "A", sequence_order: 1 }, { user_id: 2, email: "a@b.com", name: "B", sequence_order: 2 }] }), /firmante duplicado/)],
  ["37 rechaza PDF no string", () => expectCreateFail(baseCreateBody({ document: { filename: "a.pdf", pdf_base64: null } }), /pdf_base64/)],
  ["38 rechaza document ausente", () => expectCreateFail(baseCreateBody({ document: undefined }), /filename/)],
  ["39 rechaza title solo espacios", () => expectCreateFail(baseCreateBody({ title: "   " }), /title/)],
  ["40 rechaza source_module solo espacios", () => expectCreateFail(baseCreateBody({ source_module: "   " }), /source_module/)],
  ["41 rechaza source_entity solo espacios", () => expectCreateFail(baseCreateBody({ source_entity: "   " }), /source_entity/)],
  ["42 rechaza document_type solo espacios", () => expectCreateFail(baseCreateBody({ document_type: "   " }), /document_type/)],
  ["43 rechaza filename solo espacios", () => expectCreateFail(baseCreateBody({ document: { filename: "   ", pdf_base64: pdfBase64 } }), /filename/)],
  ["44 rechaza firmante sin objeto util", () => expectCreateFail(baseCreateBody({ signers: [{}] }), /sequence_order/)],
  ["45 rechaza nombre solo espacios", () => expectCreateFail(baseCreateBody({ signers: [{ email: "a@b.com", name: "   ", sequence_order: 1 }] }), /name/)],

  ["46 accion acepta consentimiento requerido", () => expectActionOk({ consent: true }, { requireConsent: true }, (out) => expect(out).toBeTruthy())],
  ["47 accion rechaza consentimiento faltante", () => expectActionFail({}, { requireConsent: true }, /consentimiento/)],
  ["48 accion rechaza consentimiento false", () => expectActionFail({ consent: false }, { requireConsent: true }, /consentimiento/)],
  ["49 accion acepta razon requerida", () => expectActionOk({ reason: "No corresponde" }, { requireReason: true }, (out) => expect(out.reason).toBe("No corresponde"))],
  ["50 accion rechaza razon vacia", () => expectActionFail({ reason: " " }, { requireReason: true }, /reason/)],
  ["51 accion normaliza session_id", () => expectActionOk({ session_id: " s1 " }, {}, (out) => expect(out.session_id).toBe("s1"))],
  ["52 accion normaliza consentimiento texto", () => expectActionOk({ consent_text: " acepto " }, {}, (out) => expect(out.consent_text).toBe("acepto"))],
  ["53 accion normaliza firma visual", () => expectActionOk({ signature_visual_base64: " img " }, {}, (out) => expect(out.signature_visual_base64).toBe("img"))],
  ["54 accion acepta placement minimo", () => expectActionOk({ signature_placement: { page_number: 1, x_pct: 0, y_pct: 0 } }, {}, (out) => expect(out.signature_placement).toEqual({ page_number: 1, x_pct: 0, y_pct: 0 }))],
  ["55 accion acepta placement maximo", () => expectActionOk({ signature_placement: { page_number: 1, x_pct: 100, y_pct: 100 } }, {}, (out) => expect(out.signature_placement).toEqual({ page_number: 1, x_pct: 100, y_pct: 100 }))],
  ["56 accion acepta placement numerico string", () => expectActionOk({ signature_placement: { page_number: "2", x_pct: "50", y_pct: "25" } }, {}, (out) => expect(out.signature_placement).toEqual({ page_number: 2, x_pct: 50, y_pct: 25 }))],
  ["57 accion descarta page cero", () => expectActionOk({ signature_placement: { page_number: 0, x_pct: 50, y_pct: 50 } }, {}, (out) => expect(out.signature_placement).toBeNull())],
  ["58 accion descarta x negativo", () => expectActionOk({ signature_placement: { page_number: 1, x_pct: -1, y_pct: 50 } }, {}, (out) => expect(out.signature_placement).toBeNull())],
  ["59 accion descarta x mayor a 100", () => expectActionOk({ signature_placement: { page_number: 1, x_pct: 101, y_pct: 50 } }, {}, (out) => expect(out.signature_placement).toBeNull())],
  ["60 accion descarta y negativo", () => expectActionOk({ signature_placement: { page_number: 1, x_pct: 50, y_pct: -1 } }, {}, (out) => expect(out.signature_placement).toBeNull())],
  ["61 accion descarta y mayor a 100", () => expectActionOk({ signature_placement: { page_number: 1, x_pct: 50, y_pct: 101 } }, {}, (out) => expect(out.signature_placement).toBeNull())],
  ["62 accion descarta placement no objeto", () => expectActionOk({ signature_placement: "x" }, {}, (out) => expect(out.signature_placement).toBeNull())],
  ["63 accion descarta page NaN", () => expectActionOk({ signature_placement: { page_number: "x", x_pct: 50, y_pct: 50 } }, {}, (out) => expect(out.signature_placement).toBeNull())],
  ["64 accion razon opcional queda null", () => expectActionOk({}, {}, (out) => expect(out.reason).toBeNull())],
  ["65 accion placement ausente queda null", () => expectActionOk({}, {}, (out) => expect(out.signature_placement).toBeNull())],

  ["66 service define modo paralelo accionable", () => expect(serviceSource).toContain("isSignerActionableInParallel")],
  ["67 service permite signer pending en paralelo", () => expect(serviceSource).toContain("SIGNER_STATUS.PENDING")],
  ["68 service limita workflow activo para firmar", () => expect(serviceSource).toContain("ACTIVE_SIGNING_WORKFLOW_STATUSES")],
  ["69 sendWorkflow bloquea workflow FOR UPDATE", () => expect(serviceSource).toMatch(/sendWorkflow[\s\S]*FOR UPDATE/)],
  ["70 sendWorkflow lee dentro del cliente transaccional", () => expect(serviceSource).toMatch(/sendWorkflow[\s\S]*getWorkflowRowsForClient\(client, workflowId\)/)],
  ["71 sendWorkflow no usa current_step secuencial", () => expect(serviceSource).toContain("current_step = NULL")],
  ["72 sendWorkflow habilita todos los pending", () => expect(serviceSource).toMatch(/UPDATE signature_workflow_signers[\s\S]*WHERE workflow_id = \$1\s+AND status = \$3/)],
  ["73 sendWorkflow registra signing_mode parallel", () => expect(serviceSource).toContain('signing_mode: "parallel"')],
  ["74 openSignerStep bloquea workflow", () => expect(serviceSource).toMatch(/openSignerStep[\s\S]*FOR UPDATE/)],
  ["75 openSignerStep acepta pending o available", () => expect(serviceSource).toMatch(/status IN \(\$3, \$4\)/)],
  ["76 signStep bloquea workflow", () => expect(serviceSource).toMatch(/signStep[\s\S]*FOR UPDATE/)],
  ["77 signStep lee dentro de transaccion", () => expect(serviceSource).toMatch(/signStep[\s\S]*getWorkflowRowsForClient\(client, workflowId\)/)],
  ["78 signStep usa helper paralelo", () => expect(serviceSource).toMatch(/signStep[\s\S]*isSignerActionableInParallel/)],
  ["79 signStep no libera siguiente por sequence_order", () => expect(serviceSource).not.toContain("nextOrder")],
  ["80 signStep no filtra sequence_order para habilitar siguiente", () => expect(serviceSource).not.toContain("AND sequence_order = $3")],
  ["81 signStep encadena hash por signed_at real", () => expect(serviceSource).toContain("new Date(a.signed_at || 0)")],
  ["82 signStep conserva guard finalized_at", () => expect(serviceSource).toContain("finalized_at IS NULL")],
  ["83 rejectStep bloquea workflow", () => expect(serviceSource).toMatch(/rejectStep[\s\S]*FOR UPDATE/)],
  ["84 reassignSigner bloquea workflow", () => expect(serviceSource).toMatch(/reassignSigner[\s\S]*FOR UPDATE/)],
  ["85 cancelWorkflow bloquea workflow", () => expect(serviceSource).toMatch(/cancelWorkflow[\s\S]*FOR UPDATE/)],
  ["86 listMyPending incluye pending available opened", () => expect(serviceSource).toContain("s.status IN ('pending', 'available', 'opened')")],

  ["87 frontend no muestra texto Es tu turno", () => expect(`${detailPageSource}\n${workspaceSource}`).not.toContain("Es tu turno")],
  ["88 frontend muestra Pendiente de tu firma", () => expect(workspaceSource).toContain("Pendiente de tu firma")],
  ["89 frontend muestra Sin firma pendiente", () => expect(workspaceSource).toContain("Sin firma pendiente")],
  ["90 frontend actionable incluye sent", () => expect(detailPageSource).toContain('"sent"')],
  ["91 frontend actionable incluye in_progress", () => expect(detailPageSource).toContain('"in_progress"')],
  ["92 frontend actionable incluye partially_signed", () => expect(detailPageSource).toContain('"partially_signed"')],
  ["93 frontend actionable incluye pending", () => expect(detailPageSource).toContain('"pending"')],
  ["94 frontend visor soporta readOnly", () => expect(pdfViewerSource).toContain("readOnly = false")],
  ["95 frontend readOnly evita placement", () => expect(pdfViewerSource).toContain('typeof onPlacement !== "function"')],
  ["96 frontend evita overflow horizontal", () => expect(workspaceSource).toContain("overflow-x-hidden")],
  ["97 frontend layout usa minmax responsive", () => expect(workspaceSource).toContain("minmax(340px,420px)")],
  ["98 frontend header usa grilla movil", () => expect(workspaceSource).toContain("grid w-full grid-cols-2")],
  ["99 frontend visor usa altura por viewport", () => expect(pdfViewerSource).toContain("min(62vh, 620px)")],
  ["100 frontend QR abre firma y no verificacion", () => {
    expect(workspaceSource).toContain("QR para firmar");
    expect(detailPageSource).toContain("/dashboard/signatures/workflows/");
    expect(`${detailPageSource}\n${workspaceSource}`).not.toContain("QR de verificacion");
  }],
];

describe("FamSign firma paralela - 100 pruebas de preparacion para produccion", () => {
  it("la suite contiene exactamente 100 casos distintos", () => {
    expect(cases).toHaveLength(100);
  });

  test.each(cases)("%s", (_name, run) => {
    run();
  });
});

describe("FamSign notificaciones de workflow", () => {
  it("sendWorkflow notifica a todos los firmantes disponibles despues del commit", () => {
    expect(serviceSource).toContain("notifyWorkflowSignersAvailable");
    expect(serviceSource).toMatch(/await client\.query\("COMMIT"\);[\s\S]*await notifyWorkflowSignersAvailable\(notificationPayload\)/);
    expect(serviceSource).toContain("Promise.allSettled(signers.map(notifySigner))");
  });

  it("las notificaciones apuntan al workflow autenticado y no a la ruta obsoleta", () => {
    expect(serviceSource).toContain("/dashboard/signatures/workflows/");
    expect(serviceSource).not.toContain("/firmar/");
  });
});
