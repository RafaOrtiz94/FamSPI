const {
  normalizeDocumentText,
  packFor,
  parseStability,
  parseCalibration,
  parseQualityControl,
  linkedCodes,
  extractFromDocument,
  toSpecRow,
} = require("../consumableSpecsExtractor");

// Fragmentos reales de Method Sheets Roche (texto de pdftotext -raw, con la
// perdida de guion y simbolo de grado que produce la conversion).
const CFAS = [
  "10759350190 10759350500 12 x 3 mL Calibrator",
  "English",
  "Storage and stability",
  "Store at 28 �C.",
  "Stability of the lyophilized calibrator at 28 �C:",
  "Up to the stated expiration date.",
  "Stability of the components in the reconstituted calibrator*:",
  "at 1525 �C 8 hours",
  "at 28 �C 2 days",
  "at -20 �C (� 5 �C) 28 days (when frozen once)",
].join("\n");

const ELECSYS_CALSET = [
  "Storage and stability",
  "Stability of the reconstituted calibrators:",
  "either at -20 �C (� 5 �C) 3 months (freeze only once)",
  "or at 28 �C 1 week",
  "on cobas e 411 analyzer at",
  "2025 �C",
  "up to 5 hours",
  "on all other analyzers at 2025 �C use only once",
].join("\n");

describe("consumableSpecsExtractor", () => {
  test("normaliza temperaturas que pdftotext aplana", () => {
    const text = normalizeDocumentText("at 28 �C 2 days / at 1525 �C 8 hours");
    expect(text).toBe("at 2-8 °C 2 days / at 15-25 °C 8 hours");
  });

  test("toma la estabilidad a 2-8 °C de la fila correcta en tablas aplanadas", () => {
    const text = normalizeDocumentText(CFAS);
    expect(parseStability(text)).toMatchObject({ open_days: 2, frozen_once_days: 28 });
    expect(packFor(text, "10759350190", "calibrador")).toMatchObject({ containers: 12, volume_ml: 3 });
  });

  test("estabilidad en prosa tras abrir", () => {
    const block = normalizeDocumentText("After opening: 24 hours at 1525 �C or 30 days at 28 �C, provided that");
    expect(parseStability(block).open_days).toBe(30);
  });

  test("Elecsys: la alicuota a bordo es de un uso, el frasco no", () => {
    const r = parseStability(normalizeDocumentText(ELECSYS_CALSET));
    expect(r).toMatchObject({ open_days: 7, onboard_aliquot_single_use: true });
    expect(r.single_use).toBeUndefined();
  });

  test("ampollas ISE: envase de un solo uso", () => {
    const r = parseStability("Opened ampules should be used immediately. Remaining content must not be stored");
    expect(r.single_use).toBe(true);
  });

  test("estabilidad a bordo en formato cobas c pack y Elecsys", () => {
    expect(parseStability("Onboard in use and refrigerated on the\nanalyzer:\n26 weeks").onboard_days).toBe(182);
    expect(parseStability(normalizeDocumentText("after opening at 28 �C 12 weeks\non the analyzers 6 weeks")))
      .toMatchObject({ onboard_days: 42, open_days: 84 });
  });

  test("calibracion: formato cobas c nuevo y Elecsys", () => {
    expect(parseCalibration([
      "Calibration frequency Automatic full calibration",
      "- after reagent lot change",
      "Full calibration",
      "- after 4 weeks onboard",
    ].join("\n"))).toMatchObject({ events: ["reagent_lot_change"], onboard_pack_interval_days: 28 });

    expect(parseCalibration([
      "Renewed calibration is recommended as follows:",
      "after 8 weeks when using the same reagent lot",
      "after 7 days (when using the same reagent kit on the analyzer)",
      "Calibration must be performed once per reagent lot",
    ].join("\n"))).toMatchObject({ events: ["reagent_lot_change"], same_lot_interval_days: 56, onboard_kit_interval_days: 7 });
  });

  test("control de calidad: intervalo en horas o semanas", () => {
    expect(parseQualityControl("Control interval 24 hours recommended")).toMatchObject({ interval_hours: 24 });
    expect(parseQualityControl("perform quality control always after lot calibration and subsequently at least every 26 weeks"))
      .toMatchObject({ interval_hours: 4368, after_calibration: true });
    expect(parseQualityControl("once every 24 hours when the test is in use, once per reagent kit"))
      .toMatchObject({ interval_hours: 24, per_kit: true });
  });

  test("Elecsys: pruebas por kit desde la columna de la tabla de pedido", () => {
    const text = "11776223190*\n11776223214*\n11776223500 100\ncobas e 411\nEnglish";
    expect(packFor(text, "11776223190", "reactivo")).toMatchObject({ tests: 100, tests_from_column: true });
  });

  test("vincula calibradores y controles listados en el documento", () => {
    const typeByCode = new Map([["10759350190", "calibrador"], ["5117003190", "control"], ["4460715190", "reactivo"]]);
    const text = "04460715190 ...\n10759350190 Calibrator f.a.s.\n05117003190 PreciControl ClinChem Multi 1";
    expect(linkedCodes(text, "4460715190", typeByCode)).toEqual({
      calibradores: ["10759350190"], controles: ["5117003190"], materiales: [],
    });
  });

  test("fila de ficha: 'extracted' solo si hay presentacion, estabilidad y calibracion", () => {
    const text = normalizeDocumentText([
      "08056692190 08056692500 ALB2 (750 tests) cobas c 303",
      "English",
      "Storage and stability",
      "Onboard in use and refrigerated on the analyzer: 26 weeks",
      "Calibration",
      "Calibration frequency Automatic full calibration",
      "- after reagent lot change",
      "Quality control",
      "at least every 26 weeks",
    ].join("\n"));
    const extraction = extractFromDocument({ text, code: "8056692190", itemType: "reactivo", typeByCode: new Map() });
    const doc = { id: "doc-1", title: "ALB2", type: "Method Sheet", version: "4", date: "2025-01-01", systems: ["cobas c 303"], url: "https://x" };
    const row = toSpecRow({ code: "8056692190", itemType: "reactivo", name: "ALB2", doc, extraction, retrievedAt: "2026-09-29" });
    expect(row).toMatchObject({
      verification_status: "extracted",
      tests_per_pack: 750,
      stability_onboard_days: 182,
      consumption_basis: "per_test",
      valid_from: "2025-01-01",
    });
    expect(row.system_specs.todos).toMatchObject({ calibration: { events: ["reagent_lot_change"] }, qc: { interval_hours: 4368 } });

    const noDoc = toSpecRow({ code: "1", itemType: "material", name: "Filtro", doc: null, extraction: {}, retrievedAt: "2026-09-29" });
    expect(noDoc).toMatchObject({ verification_status: "pending", source_type: "none", valid_from: "2026-09-29" });
  });
});
