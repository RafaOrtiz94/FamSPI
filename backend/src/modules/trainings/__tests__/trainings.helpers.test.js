jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/drive", () => ({
  downloadFileBuffer: jest.fn(),
}));
jest.mock("../trainings.drive", () => ({
  generateActaPdf: jest.fn(),
  generateAbsentActaPdf: jest.fn(),
  uploadExternalSignedPdf: jest.fn(),
  uploadManualSignedActaPdf: jest.fn(),
}));
jest.mock("../../signature-workflows/signatureWorkflows.service", () => ({
  createWorkflow: jest.fn(),
  sendWorkflow: jest.fn(),
}));

const db = require("../../../config/db");
const { downloadFileBuffer } = require("../../../utils/drive");
const signatureWorkflowsService = require("../../signature-workflows/signatureWorkflows.service");
const { buildFullName, normalizeTrainerName, sendActaToFamSign } = require("../trainings.service");

describe("trainings – buildFullName", () => {
  it("compone apellidos + nombres en mayusculas", () => {
    expect(buildFullName("juan", "perez")).toBe("PEREZ JUAN");
    expect(buildFullName("", "perez")).toBe("PEREZ");
  });
  it("usa el fallback cuando no hay nombres ni apellidos", () => {
    expect(buildFullName("", "", "sin nombre")).toBe("SIN NOMBRE");
    expect(buildFullName("", "", "")).toBeNull();
  });
});

describe("trainings - instructor externo FamSign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("envia a FamSign el PDF firmado fisicamente por el instructor externo", async () => {
    const signedPdfBuffer = Buffer.from("pdf firmado fisicamente");
    const trainingRow = {
      id: 77,
      code: "CAP-2026-077",
      title: "Capacitacion externa",
      type: "externa_instructor",
      event_type: "capacitacion",
      area: "Calidad",
      created_by: 12,
      signature_workflow_id: null,
      acta_drive_doc_id: "generated-draft-drive-id",
      external_signed_drive_id: "physical-signed-drive-id",
    };
    const attendeeRows = [
      {
        id: 101,
        user_id: 33,
        attendance_status: "attended",
        is_external: false,
      },
    ];

    db.query
      .mockResolvedValueOnce({ rows: [trainingRow] })
      .mockResolvedValueOnce({ rows: attendeeRows })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [trainingRow] })
      .mockResolvedValueOnce({ rows: attendeeRows });
    downloadFileBuffer.mockResolvedValue(signedPdfBuffer);
    signatureWorkflowsService.createWorkflow.mockResolvedValue({ workflow: { id: 909 } });
    signatureWorkflowsService.sendWorkflow.mockResolvedValue({});

    await sendActaToFamSign(77, { id: 12, email: "organizador@fam-project.com" });

    expect(downloadFileBuffer).toHaveBeenCalledTimes(1);
    expect(downloadFileBuffer).toHaveBeenCalledWith("physical-signed-drive-id");
    expect(downloadFileBuffer).not.toHaveBeenCalledWith("generated-draft-drive-id");

    const workflowPayload = signatureWorkflowsService.createWorkflow.mock.calls[0][0].payload;
    expect(workflowPayload.document.filename).toBe("Acta Firmada Externo CAP-2026-077.pdf");
    expect(workflowPayload.document.pdf_base64).toBe(signedPdfBuffer.toString("base64"));
    expect(workflowPayload.meta).toMatchObject({
      training_type: "externa_instructor",
      document_source: "external_physically_signed_pdf",
      source_drive_file_id: "physical-signed-drive-id",
      external_instructor_signed: true,
    });
  });
});

describe("trainings - guard de workflow FamSign duplicado", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza crear un workflow nuevo mientras el anterior sigue activo (sent)", async () => {
    const trainingRow = {
      id: 78,
      code: "CAP-2026-078",
      title: "Capacitacion con workflow activo",
      type: "externa_instructor",
      event_type: "capacitacion",
      area: "Calidad",
      created_by: 12,
      signature_workflow_id: "50",
      signature_workflow_status: "sent",
      external_signed_drive_id: "physical-signed-drive-id",
    };
    db.query
      .mockResolvedValueOnce({ rows: [trainingRow] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(sendActaToFamSign(78, { id: 12, email: "organizador@fam-project.com" }))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining("Ya existe un workflow FamSign") });
    expect(downloadFileBuffer).not.toHaveBeenCalled();
  });

  it("permite crear un workflow nuevo cuando el anterior fue cancelado", async () => {
    // Regresion: el guard antes solo miraba si signature_workflow_id no era
    // null -- un workflow cancelado (ej. porque le faltaba un firmante
    // requerido) dejaba la capacitacion bloqueada para siempre, sin forma de
    // generar uno nuevo correcto.
    const signedPdfBuffer = Buffer.from("pdf firmado fisicamente");
    const trainingRow = {
      id: 79,
      code: "CAP-2026-079",
      title: "Capacitacion con workflow cancelado",
      type: "externa_instructor",
      event_type: "capacitacion",
      area: "Calidad",
      created_by: 12,
      signature_workflow_id: "50",
      signature_workflow_status: "cancelled",
      acta_drive_doc_id: "generated-draft-drive-id",
      external_signed_drive_id: "physical-signed-drive-id",
    };
    const attendeeRows = [
      { id: 101, user_id: 33, attendance_status: "attended", is_external: false },
    ];

    db.query
      .mockResolvedValueOnce({ rows: [trainingRow] })
      .mockResolvedValueOnce({ rows: attendeeRows })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [trainingRow] })
      .mockResolvedValueOnce({ rows: attendeeRows });
    downloadFileBuffer.mockResolvedValue(signedPdfBuffer);
    signatureWorkflowsService.createWorkflow.mockResolvedValue({ workflow: { id: 910 } });
    signatureWorkflowsService.sendWorkflow.mockResolvedValue({});

    await sendActaToFamSign(79, { id: 12, email: "organizador@fam-project.com" });

    expect(signatureWorkflowsService.createWorkflow).toHaveBeenCalledTimes(1);
  });
});

describe("trainings – normalizeTrainerName", () => {
  it("recorta, pone en mayusculas y devuelve null si queda vacio", () => {
    expect(normalizeTrainerName("  ana  ")).toBe("ANA");
    expect(normalizeTrainerName("   ")).toBeNull();
  });
});
