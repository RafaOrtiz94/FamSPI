jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("../signatureAutoPlacement.service", () => ({ detectPlacementsForDocument: jest.fn() }));

const { detectPlacementsForDocument } = require("../signatureAutoPlacement.service");
const { autoDetectAndFillPlacements } = require("../signatureWorkflows.service");

describe("autoDetectAndFillPlacements", () => {
  beforeEach(() => jest.clearAllMocks());

  test("prellena solo a los firmantes detectados con confianza, deja el resto para firma manual", async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const document = { source_pdf_base64: Buffer.from("fake-pdf").toString("base64") };
    const signers = [
      { id: 1, name_snapshot: "Ana Torres", signature_placement: null },
      { id: 2, name_snapshot: "Bryan Chicaiza", signature_placement: null },
      { id: 3, name_snapshot: "Ya Tiene Posicion", signature_placement: { page_number: 1, x_pct: 0.5, y_pct: 0.5 } },
    ];

    detectPlacementsForDocument.mockResolvedValue(new Map([[1, { page_number: 1, x_pct: 0.83, y_pct: 0.2 }]]));

    const placed = await autoDetectAndFillPlacements(client, { workflowId: 66, document, signers });

    expect(placed).toBe(1);
    // el firmante 3 ya tenia placement: no se le pide deteccion (parsea el PDF una sola vez, solo con los pendientes)
    expect(detectPlacementsForDocument).toHaveBeenCalledTimes(1);
    expect(detectPlacementsForDocument.mock.calls[0][1].map((s) => s.id)).toEqual([1, 2]);
    expect(client.query).toHaveBeenCalledTimes(1); // solo un UPDATE, para Ana
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain("UPDATE signature_workflow_signers");
    expect(sql).toContain("auto_placement");
    expect(params[0]).toBe(1);
    expect(JSON.parse(params[1])).toEqual({ page_number: 1, x_pct: 0.83, y_pct: 0.2 });
  });

  test("sin documento fuente, no intenta nada", async () => {
    const client = { query: jest.fn() };
    const placed = await autoDetectAndFillPlacements(client, { workflowId: 1, document: null, signers: [{ id: 1 }] });
    expect(placed).toBe(0);
    expect(detectPlacementsForDocument).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  test("si todos los firmantes ya tienen posicion, no llama a la deteccion", async () => {
    const client = { query: jest.fn() };
    const document = { source_pdf_base64: Buffer.from("fake-pdf").toString("base64") };
    const signers = [{ id: 1, signature_placement: { page_number: 1, x_pct: 0.5, y_pct: 0.5 } }];
    const placed = await autoDetectAndFillPlacements(client, { workflowId: 1, document, signers });
    expect(placed).toBe(0);
    expect(detectPlacementsForDocument).not.toHaveBeenCalled();
  });
});
