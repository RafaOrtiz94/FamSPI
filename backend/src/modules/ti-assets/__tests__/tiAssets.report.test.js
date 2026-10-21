jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn() }));
jest.mock("../../../config/google", () => ({ drive: { files: {} } }));
jest.mock("../../../utils/drive", () => ({ uploadBase64File: jest.fn(), ensureFolder: jest.fn() }));

const { PDFDocument } = require("pdf-lib");
const path = require("path");
const pdfJsLoadLog = jest.spyOn(console, "log").mockImplementation(() => {});
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
pdfJsLoadLog.mockRestore();
const db = require("../../../config/db");
const { __testables } = require("../tiAssets.report");

const standardFontDataUrl = `${path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts")}${path.sep}`;

async function readPdfPages(buffer) {
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    standardFontDataUrl,
  }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages;
}

describe("informe de cronograma TI", () => {
  beforeEach(() => db.query.mockReset());

  test("separa equipos de colaboradores, clientes y custodia interna", () => {
    expect(__testables.getAssetAudience({ custody_type: "collaborator", assigned_to_name: "Ana" }))
      .toEqual(expect.objectContaining({ key: "collaborators", owner: "Ana" }));
    expect(__testables.getAssetAudience({ custody_type: "client", client_name: "Hospital Central" }))
      .toEqual(expect.objectContaining({ key: "clients", owner: "Hospital Central" }));
    expect(__testables.getAssetAudience({ custody_type: "warehouse" }))
      .toEqual(expect.objectContaining({ key: "other" }));
  });

  test("genera solo resumen y secciones con datos, sin una hoja de integridad vacía", async () => {
    const assets = [
      { id: 1, name: "Laptop interna", custody_type: "collaborator", assigned_to_name: "Ana", serial_number: "COL-1" },
      { id: 2, name: "Router cliente", custody_type: "client", client_name: "Hospital Central", serial_number: "CLI-1" },
    ];
    const buffer = await __testables.buildPdf({
      assets,
      schedulesByAsset: {
        1: [{ planned_date: "2026-04-10", max_due_date: "2026-04-25", status: "pending" }],
        2: [{ planned_date: "2026-08-14", max_due_date: "2026-08-29", status: "completed" }],
      },
      stats: { total: 2, pending: 1, completed: 1, overdue: 0 },
      periodLabel: "Año 2026",
      generatedAt: new Date("2026-10-13T12:00:00Z"),
      generatedByName: "TI",
    });

    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBe(3);
    expect(buffer.length).toBeGreaterThan(3000);

    const pages = await readPdfPages(buffer);
    expect(pages.every((page) => page.trim().length > 0)).toBe(true);
    expect(pages.join(" ")).toEqual(expect.stringContaining("Equipos de colaboradores"));
    expect(pages.join(" ")).toEqual(expect.stringContaining("Equipos de uso de clientes"));
    expect(pages.join(" ")).toEqual(expect.stringContaining("2026-04-10"));
    expect(pages.join(" ")).toEqual(expect.stringContaining("2026-04-25"));
    expect(pages.join(" ")).toEqual(expect.stringContaining("2026-08-14"));
    expect(pages.join(" ")).toEqual(expect.stringContaining("2026-08-29"));
  });

  test("muestra activos sin cronograma como pendientes en su grupo sin crear páginas extra", async () => {
    const buffer = await __testables.buildPdf({
      assets: [{ id: 9, name: "Equipo sin fecha", custody_type: "collaborator", assigned_to_name: "Luis" }],
      schedulesByAsset: {},
      stats: { total: 0, pending: 0, completed: 0, overdue: 0 },
      periodLabel: "Año 2026",
      generatedAt: new Date("2026-10-13T12:00:00Z"),
      generatedByName: "TI",
    });

    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBe(2);

    const pages = await readPdfPages(buffer);
    expect(pages.join(" ")).toEqual(expect.stringContaining("Sin programación"));
    expect(pages.join(" ")).toEqual(expect.stringContaining("Pendiente"));
  });

  test("pagina filas extensas con encabezados de continuación y sin hojas vacías", async () => {
    const assets = Array.from({ length: 31 }, (_, index) => ({
      id: index + 1,
      name: `Laptop ${index + 1}`,
      custody_type: "collaborator",
      assigned_to_name: `Colaborador ${index + 1}`,
      serial_number: `COL-${index + 1}`,
    }));
    const schedulesByAsset = Object.fromEntries(assets.map((asset) => [
      asset.id,
      [{
        planned_date: "2026-04-10",
        max_due_date: "2026-04-25",
        coordinated_withdrawal_date: "2026-04-08",
        status: "pending",
      }],
    ]));

    const buffer = await __testables.buildPdf({
      assets,
      schedulesByAsset,
      stats: { total: 31, pending: 31, completed: 0, overdue: 0 },
      periodLabel: "Año 2026",
      generatedAt: new Date("2026-10-13T12:00:00Z"),
      generatedByName: "TI",
    });

    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBe(4);

    const pages = await readPdfPages(buffer);
    expect(pages.every((page) => page.trim().length > 0)).toBe(true);
    expect(pages.filter((page) => page.includes("(continuación)"))).toHaveLength(2);
    expect(pages.join(" ")).toEqual(expect.stringContaining("2026-04-08"));
  });

  test("resuelve el cliente desde la tabla referenciada por ti_assets.client_id", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await __testables.fetchReportData({ year: 2026, periodType: "annual" });

    const assetsSql = db.query.mock.calls[0][0];
    expect(assetsSql).toContain("LEFT JOIN public.clients c ON c.id = a.client_id");
    expect(assetsSql).toContain("LEFT JOIN public.client_requests cr ON cr.id = c.client_request_id");
  });
});
