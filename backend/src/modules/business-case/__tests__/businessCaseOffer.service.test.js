jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../../config/google", () => ({
  drive: {
    files: {
      export: jest.fn(),
      create: jest.fn(),
    },
  },
  sheets: {
    spreadsheets: {
      get: jest.fn(),
      values: {
        batchGet: jest.fn(),
        get: jest.fn(),
        batchUpdate: jest.fn(),
      },
    },
  },
}));
jest.mock("../businessCaseDriveFolder.service", () => ({
  ensureBusinessCaseDriveFolderById: jest.fn(),
}));
jest.mock("../businessCaseSheetGeneration.service", () => ({
  recordDocumentVersion: jest.fn(),
}));
jest.mock("../../notifications/notificationManager", () => ({
  sendNotification: jest.fn(),
}));

const db = require("../../../config/db");
const { drive, sheets } = require("../../../config/google");
const notificationManager = require("../../notifications/notificationManager");

const service = require("../businessCaseOffer.service");

describe("businessCaseOffer.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("parseOfferPricingRows marca filas con precio y conserva cero explícito", () => {
    const rows = service.__testables.parseOfferPricingRows(
      [
        ["Reactivo A", "COD-1", "", "", "12", "", "34.5", ""],
        ["Control B", "COD-2", "", "", "8", "", "0", ""],
        ["Calibrador C", "COD-3", "", "", "5", "", "", ""],
      ],
      [
        { product: "Reactivo A", code: "COD-1", detPerKit: 12 },
        { product: "Control B", code: "COD-2", detPerKit: 8 },
        { product: "Calibrador C", code: "COD-3", detPerKit: 5 },
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        product: "Reactivo A",
        code: "COD-1",
        detPerKit: 12,
        kitPrice: 34.5,
        determinationPrice: null,
        isPresentInSheet: true,
        hasAnyPrice: true,
      }),
      expect.objectContaining({
        product: "Control B",
        code: "COD-2",
        kitPrice: 0,
        hasAnyPrice: true,
      }),
      expect.objectContaining({
        product: "Calibrador C",
        code: "COD-3",
        isPresentInSheet: true,
        hasAnyPrice: false,
      }),
    ]);
  });

  test("parseOfferPricingRows reporta una fila borrada del Sheet sin sustituirla con la plantilla", () => {
    const rows = service.__testables.parseOfferPricingRows(
      [[]],
      [{ itemKey: "cons:9:577", product: "Inmunoglobulina G (Ig G)", code: "8057915190", detPerKit: 300 }],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        itemKey: "cons:9:577",
        product: "",
        code: "",
        detPerKit: null,
        isPresentInSheet: false,
        hasAnyPrice: false,
      }),
    ]);
  });

  test("parseOfferPricingRows conserva el tipo de item para preservar precios al separar secciones", () => {
    const [row] = service.__testables.parseOfferPricingRows(
      [["Control E411", "CTR-1", "", "", "2", "", "", "4.25"]],
      [{ product: "Control E411", code: "CTR-1", itemType: "control", detPerKit: 2 }],
    );

    expect(row).toEqual(expect.objectContaining({ itemType: "control", determinationPrice: 4.25 }));
  });

  test("parseOfferPricingRows interpreta montos devueltos por Google Sheets con moneda y miles", () => {
    const [row] = service.__testables.parseOfferPricingRows(
      [["Reactivo", "R-1", "", "", "300", "", "$1,245.46", "$4.15"]],
      [{ product: "Reactivo", code: "R-1", detPerKit: 300 }],
    );

    expect(row).toEqual(expect.objectContaining({ kitPrice: 1245.46, determinationPrice: 4.15, hasAnyPrice: true }));
  });

  test("extractOfferSectionsFromSheetRows usa filas manuales y respeta secciones eliminadas", () => {
    const payload = service.__testables.extractOfferSectionsFromSheetRows([
      ["Reactivo "],
      ["Glucosa", "8057800190", "", "", "3300", "", "$1,036.94", "$0.31"],
      ["Consumibles"],
      ["Consumible manual", "MAN-001", "", "", "1", "", "$12.50", "$12.50"],
      ["* PRECIOS NO INCLUYE IVA"],
      ["Electrolitos"],
    ]);

    expect(payload.sections.reactivo).toEqual([expect.objectContaining({ product: "Glucosa", kitPrice: 1036.94 })]);
    expect(payload.sections.consumible).toEqual([expect.objectContaining({ product: "Consumible manual", code: "MAN-001" })]);
    expect(payload.sections.electrolito).toEqual([]);
    expect(payload.summary).toEqual(expect.objectContaining({ total_rows: 2, is_complete: true }));
  });

  test("publishOfferVersion bloquea publicación cuando faltan precios en la hoja", async () => {
    db.query.mockImplementation((sql, params) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("CREATE TABLE IF NOT EXISTS public.bc_offer_versions")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_status_idx")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM v_business_cases_complete vc")) {
        return Promise.resolve({
          rows: [{
            id: "bc-1",
            client_name: "Cliente Demo",
            created_by: 15,
            created_by_email: "comercial@demo.com",
            canonical_state: "VIABLE",
            bc_stage: "factible",
            modern_bc_metadata: { feasibility: { decision: { decided_at: "2026-08-12T10:00:00.000Z", is_feasible: true } } },
          }],
        });
      }
      if (text.includes("FROM bc_offer_versions") && text.includes("AND id = $2")) {
        return Promise.resolve({
          rows: [{
            id: 21,
            business_case_id: "bc-1",
            version_number: 3,
            status: "draft",
            sheet_file_id: "sheet-123",
            template_payload: {
              sections: {
                reactivo: [{ product: "Reactivo A", code: "RA-1", detPerKit: 12 }],
                calibrador: [],
                control: [],
                consumible: [],
                electrolito: [],
              },
            },
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    sheets.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { title: "Hoja1" } }] },
    });
    sheets.spreadsheets.values.batchGet.mockResolvedValue({
      data: {
        valueRanges: [
          { values: [["Reactivo A", "RA-1", "", "", "12", "", "", ""]] },
          { values: [] },
          { values: [] },
          { values: [] },
          { values: [] },
        ],
      },
    });

    await expect(
      service.publishOfferVersion("bc-1", 21, { id: 9, role: "jefe_comercial", email: "jefe@demo.com" }),
    ).rejects.toMatchObject({
      code: "BC_OFFER_PRICING_INCOMPLETE",
      status: 409,
    });

    expect(drive.files.export).not.toHaveBeenCalled();
  });

  test("decideOfferVersion exige motivo cuando la oferta es rechazada", async () => {
    db.query.mockImplementation((sql) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("CREATE TABLE IF NOT EXISTS public.bc_offer_versions")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_status_idx")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM v_business_cases_complete vc")) {
        return Promise.resolve({
          rows: [{
            id: "bc-2",
            client_name: "Cliente Factible",
            created_by: 99,
            created_by_email: "creador@demo.com",
            canonical_state: "VIABLE",
            bc_stage: "factible",
            modern_bc_metadata: { feasibility: { decision: { decided_at: "2026-08-12T12:00:00.000Z", is_feasible: true } } },
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      service.decideOfferVersion("bc-2", 7, { decision: "rejected", reason: "" }, { id: 99, role: "comercial", email: "creador@demo.com" }),
    ).rejects.toMatchObject({
      code: "BC_OFFER_REJECTION_REASON_REQUIRED",
      status: 400,
    });
  });

  test("createOfferDraft notifica nueva versión tras rechazo previo", async () => {
    db.query.mockImplementation((sql, params) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("CREATE TABLE IF NOT EXISTS public.bc_offer_versions")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_status_idx")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM v_business_cases_complete vc")) {
        return Promise.resolve({
          rows: [{
            id: "bc-3",
            client_name: "Cliente Demo",
            created_by: 8,
            created_by_email: "creador@demo.com",
            canonical_state: "VIABLE",
            bc_stage: "factible",
            modern_bc_metadata: { feasibility: { decision: { decided_at: "2026-08-12T10:00:00.000Z", is_feasible: true } } },
          }],
        });
      }
      if (text.includes("FROM bc_offer_versions") && text.includes("ORDER BY version_number DESC")) {
        return Promise.resolve({
          rows: [{
            id: 30,
            business_case_id: "bc-3",
            version_number: 2,
            status: "rejected",
          }],
        });
      }
      if (text.includes("FROM bc_consumption_items")) {
        return Promise.resolve({
          rows: [{
            item_key: "cons:1",
            item_id: "ABC-1",
            name: "Reactivo A",
            item_type: "reactivo",
            annual_qty: 120,
            reference_qty: 12,
            equipment_name: "cobas Pure <303 + 402>",
          }],
        });
      }
      if (text.includes("INSERT INTO bc_offer_versions")) {
        return Promise.resolve({
          rows: [{
            id: 31,
            version_number: 3,
            status: "draft",
            sheet_file_id: "sheet-new",
            sheet_url: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
            pricing_payload: {},
            template_payload: {},
            created_at: "2026-08-12T15:00:00.000Z",
            updated_at: "2026-08-12T15:00:00.000Z",
          }],
        });
      }
      if (text.includes("SELECT id") && text.includes("FROM users")) {
        return Promise.resolve({ rows: [{ id: 50 }, { id: 51 }] });
      }
      if (text.includes("SELECT modern_bc_metadata")) {
        return Promise.resolve({ rows: [{ modern_bc_metadata: {} }] });
      }
      if (text.includes("UPDATE equipment_purchase_requests")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    drive.files.create.mockResolvedValue({
      data: {
        id: "sheet-new",
        webViewLink: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
      },
    });

    const driveFolder = require("../businessCaseDriveFolder.service");
    driveFolder.ensureBusinessCaseDriveFolderById.mockResolvedValue({ folderId: "folder-1" });

    await service.createOfferDraft("bc-3", {
      id: 15,
      role: "acp_comercial",
      email: "acp@demo.com",
      fullname: "ACP Demo",
    });

    expect(notificationManager.sendNotification).toHaveBeenCalledTimes(2);
    expect(notificationManager.sendNotification.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        source: "business_case.offer.new_version_after_rejection",
      }),
    );
  });

  test("createOfferDraft genera una oferta separada (sheet propio) por cada equipo real de una integracion", async () => {
    let insertCount = 0;
    db.query.mockImplementation((sql, params) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("CREATE TABLE IF NOT EXISTS public.bc_offer_versions")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_status_idx")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM v_business_cases_complete vc")) {
        return Promise.resolve({
          rows: [{
            id: "bc-integracion",
            client_name: "Hospital Integracion",
            created_by: 8,
            created_by_email: "creador@demo.com",
            canonical_state: "VIABLE",
            bc_stage: "factible",
            modern_bc_metadata: { feasibility: { decision: { decided_at: "2026-08-12T10:00:00.000Z", is_feasible: true } } },
          }],
        });
      }
      // getLatestOfferVersion por offer_key -- sin oferta previa para ninguno de los dos equipos
      if (text.includes("FROM bc_offer_versions") && text.includes("ORDER BY version_number DESC")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM bc_consumption_items")) {
        return Promise.resolve({
          rows: [
            {
              item_key: "cons:9:1",
              item_id: "COD-PURE",
              name: "Reactivo Pure",
              item_type: "reactivo",
              annual_qty: 100,
              reference_qty: 10,
              equipment_id: 9,
              equipment_name: "cobas Pure <303>",
            },
            {
              item_key: "cons:12:1",
              item_id: "COD-E411",
              name: "Reactivo e411",
              item_type: "reactivo",
              annual_qty: 200,
              reference_qty: 20,
              equipment_id: 12,
              equipment_name: "cobas e411 disk",
            },
          ],
        });
      }
      if (text.includes("INSERT INTO bc_offer_versions")) {
        insertCount += 1;
        return Promise.resolve({
          rows: [{
            id: 100 + insertCount,
            offer_key: params[2],
            offer_label: params[3],
            target_equipment_id: params[4],
            target_equipment_name: params[5],
            version_number: 1,
            status: "draft",
            sheet_file_id: `sheet-${insertCount}`,
            sheet_url: `https://docs.google.com/spreadsheets/d/sheet-${insertCount}/edit`,
            pricing_payload: {},
            template_payload: JSON.parse(params[10]),
            created_at: "2026-08-26T10:00:00.000Z",
            updated_at: "2026-08-26T10:00:00.000Z",
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    let createCount = 0;
    drive.files.create.mockImplementation(() => {
      createCount += 1;
      return Promise.resolve({
        data: {
          id: `sheet-${createCount}`,
          webViewLink: `https://docs.google.com/spreadsheets/d/sheet-${createCount}/edit`,
        },
      });
    });

    const driveFolder = require("../businessCaseDriveFolder.service");
    driveFolder.ensureBusinessCaseDriveFolderById.mockResolvedValue({ folderId: "folder-integracion" });

    const result = await service.createOfferDraft("bc-integracion", {
      id: 15,
      role: "acp_comercial",
      email: "acp@demo.com",
      fullname: "ACP Demo",
    });

    expect(result.is_multi_equipment_offer).toBe(true);
    expect(result.created).toHaveLength(2);
    expect(drive.files.create).toHaveBeenCalledTimes(2);

    const offerKeys = result.created.map((offer) => offer.offer_key).sort();
    expect(offerKeys).toEqual(["equipment:12", "equipment:9"]);

    const pureOffer = result.created.find((offer) => offer.target_equipment_id === 9);
    const e411Offer = result.created.find((offer) => offer.target_equipment_id === 12);
    expect(pureOffer.template_payload.sections.reactivo).toEqual([
      expect.objectContaining({ product: "Reactivo Pure" }),
    ]);
    expect(e411Offer.template_payload.sections.reactivo).toEqual([
      expect.objectContaining({ product: "Reactivo e411" }),
    ]);
  });

  test("createOfferDraft separa un equipo combo de catalogo unico (cobas Pure <303 + 402>) en una oferta por submodelo real", async () => {
    let insertCount = 0;
    db.query.mockImplementation((sql, params) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("CREATE TABLE IF NOT EXISTS public.bc_offer_versions")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_status_idx")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM v_business_cases_complete vc")) {
        return Promise.resolve({
          rows: [{
            id: "bc-combo",
            client_name: "Hospital Combo",
            created_by: 8,
            created_by_email: "creador@demo.com",
            canonical_state: "VIABLE",
            bc_stage: "factible",
            modern_bc_metadata: { feasibility: { decision: { decided_at: "2026-08-12T10:00:00.000Z", is_feasible: true } } },
          }],
        });
      }
      if (text.includes("FROM bc_offer_versions") && text.includes("ORDER BY version_number DESC")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM bc_consumption_items")) {
        return Promise.resolve({
          rows: [
            {
              // Real: pestana "c303 c503" de TABLA BASE BC.xlsx (quimica).
              item_key: "cons:15:1",
              item_id: "8057800190",
              name: "GLUCOSA",
              item_type: "reactivo",
              annual_qty: 100,
              reference_qty: 10,
              equipment_id: 15,
              equipment_name: "cobas Pure <303 + 402>",
            },
            {
              // Real: pestana " e402 e801" de TABLA BASE BC.xlsx (inmunologia).
              item_key: "cons:15:2",
              item_id: "8443432190",
              name: "TSH Elecsys E2G 300 V2",
              item_type: "reactivo",
              annual_qty: 200,
              reference_qty: 20,
              equipment_id: 15,
              equipment_name: "cobas Pure <303 + 402>",
            },
          ],
        });
      }
      if (text.includes("INSERT INTO bc_offer_versions")) {
        insertCount += 1;
        return Promise.resolve({
          rows: [{
            id: 200 + insertCount,
            offer_key: params[2],
            offer_label: params[3],
            target_equipment_id: params[4],
            target_equipment_name: params[5],
            version_number: 1,
            status: "draft",
            sheet_file_id: `sheet-combo-${insertCount}`,
            sheet_url: `https://docs.google.com/spreadsheets/d/sheet-combo-${insertCount}/edit`,
            pricing_payload: {},
            template_payload: JSON.parse(params[10]),
            created_at: "2026-08-26T10:00:00.000Z",
            updated_at: "2026-08-26T10:00:00.000Z",
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    let createCount = 0;
    drive.files.create.mockImplementation(() => {
      createCount += 1;
      return Promise.resolve({
        data: {
          id: `sheet-combo-${createCount}`,
          webViewLink: `https://docs.google.com/spreadsheets/d/sheet-combo-${createCount}/edit`,
        },
      });
    });

    const driveFolder = require("../businessCaseDriveFolder.service");
    driveFolder.ensureBusinessCaseDriveFolderById.mockResolvedValue({ folderId: "folder-combo" });

    const result = await service.createOfferDraft("bc-combo", {
      id: 15,
      role: "acp_comercial",
      email: "acp@demo.com",
      fullname: "ACP Demo",
    });

    expect(result.is_multi_equipment_offer).toBe(true);
    expect(result.created).toHaveLength(2);
    expect(drive.files.create).toHaveBeenCalledTimes(2);

    const labels = result.created.map((offer) => offer.target_equipment_name).sort();
    expect(labels).toEqual(["COBAS PURE c303", "COBAS PURE e402"]);

    const pureOffer = result.created.find((offer) => offer.template_payload.sections.reactivo.some((row) => row.product === "GLUCOSA"));
    const immunoOffer = result.created.find((offer) => offer.template_payload.sections.reactivo.some((row) => row.product === "TSH Elecsys E2G 300 V2"));
    expect(pureOffer.template_payload.sections.reactivo).toHaveLength(1);
    expect(immunoOffer.template_payload.sections.reactivo).toHaveLength(1);
  });

  test("loadConsumptionItemsForOffer conserva el orden original del BC y no reordena alfabeticamente", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          item_key: "cons:2:104",
          item_id: "4657608190",
          name: "Acido Úrico",
          item_type: "reactivo",
          annual_qty: 10,
          reference_qty: 5,
          equipment_name: "Equipo Demo",
        },
        {
          item_key: "cons:2:114",
          item_id: "4718569190",
          name: "ALT - TGP",
          item_type: "reactivo",
          annual_qty: 20,
          reference_qty: 8,
          equipment_name: "Equipo Demo",
        },
        {
          item_key: "cons:2:12",
          item_id: "4657543190",
          name: "AST - TGO",
          item_type: "reactivo",
          annual_qty: 30,
          reference_qty: 12,
          equipment_name: "Equipo Demo",
        },
      ],
    });

    const items = await service.__testables.loadConsumptionItemsForOffer("bc-order-1");

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM bc_consumption_items"),
      ["bc-order-1"],
    );
    expect(items.map((item) => item.name)).toEqual([
      "Acido Úrico",
      "ALT - TGP",
      "AST - TGO",
    ]);
  });

  test("orderOfferItemsByBusinessCaseTemplate respeta la fila del sheet del BC", () => {
    const ordered = service.__testables.orderOfferItemsByBusinessCaseTemplate([
      {
        item_key: "cons:2:113",
        item_id: "5401674190",
        name: "LDH",
        item_type: "reactivo",
        equipment_id: 2,
        equipment_name: "cobas c111",
      },
      {
        item_key: "cons:2:104",
        item_id: "4657608190",
        name: "Acido Úrico",
        item_type: "reactivo",
        equipment_id: 2,
        equipment_name: "cobas c111",
      },
      {
        item_key: "cons:2:35",
        item_id: "4657527190",
        name: "Glucosa",
        item_type: "reactivo",
        equipment_id: 2,
        equipment_name: "cobas c111",
      },
    ]);

    expect(ordered.map((item) => item.name)).toEqual([
      "Glucosa",
      "Acido Úrico",
      "LDH",
    ]);
    // DET/KIT es un valor fijo de catalogo tomado del sheet real del BC (no
    // una cantidad) -- Glucosa y Acido Urico rinden 400 determinaciones/kit
    // en la pestaña real "c111" de TABLA BASE BC.xlsx.
    expect(ordered.find((item) => item.name === "Glucosa").det_kit).toBe(400);
    expect(ordered.find((item) => item.name === "Acido Úrico").det_kit).toBe(400);
  });

  test("loadConsumptionItemsForOffer conserva el origen y la oferta se ordena por la hoja", async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          item_key: "cons:2:113",
          item_id: "5401674190",
          name: "LDH",
          item_type: "reactivo",
          source: "catalog",
          annual_qty: 10,
          reference_qty: 5,
          equipment_id: 2,
          equipment_name: "cobas c111",
          source_order: 0,
        },
        {
          item_key: "cons:2:104",
          item_id: "4657608190",
          name: "Acido Urico",
          item_type: "reactivo",
          source: "catalog",
          annual_qty: 20,
          reference_qty: 8,
          equipment_id: 2,
          equipment_name: "cobas c111",
          source_order: 1,
        },
        {
          item_key: "cons:2:35",
          item_id: "4657527190",
          name: "Glucosa",
          item_type: "reactivo",
          source: "catalog",
          annual_qty: 30,
          reference_qty: 12,
          equipment_id: 2,
          equipment_name: "cobas c111",
          source_order: 2,
        },
      ],
    });

    const items = await service.__testables.loadConsumptionItemsForOffer("bc-order-template-1");

    expect(items.map((item) => item.name)).toEqual([
      "LDH",
      "Acido Urico",
      "Glucosa",
    ]);
    expect(items.find((item) => item.name === "Glucosa").det_kit).toBe(400);
    expect(items.map((item) => item.source)).toEqual(["catalog", "catalog", "catalog"]);
    expect(items.map((item) => item.source_order)).toEqual([0, 1, 2]);
  });

  test("orderOfferItemsByBusinessCaseTemplate prioriza el codigo de la hoja y elimina el SKU duplicado", () => {
    const ordered = service.__testables.orderOfferItemsByBusinessCaseTemplate([
      {
        item_key: "cons:9:35",
        item_id: "4657527190",
        name: "Glucosa",
        item_type: "reactivo",
        equipment_id: 9,
        equipment_name: "cobas Pure <303>",
      },
      {
        item_key: "cons:9:790",
        item_id: "8057800190",
        name: "GLUCOSA",
        item_type: "reactivo",
        equipment_id: 9,
        equipment_name: "cobas Pure <303>",
      },
    ]);

    expect(ordered).toHaveLength(1);
    expect(ordered[0]).toMatchObject({
      item_key: "cons:9:790",
      item_id: "8057800190",
      name: "GLUCOSA",
      det_kit: 3300,
    });
  });

  test("ignora fallbacks de otra pestana sin ocultar productos validos del catalogo", () => {
    const ordered = service.__testables.orderOfferItemsByBusinessCaseTemplate([
      {
        item_key: "sheet:12:7103352190:reactivo",
        item_id: "7103352190",
        name: "pt screen cobas t411 10x10ml",
        item_type: "reactivo",
        source: "sheet_template",
        equipment_id: 12,
        equipment_name: "cobas e411 disk",
      },
      {
        item_key: "cons:12:372",
        item_id: "7559992190",
        name: "FOLATE G3 ELECSYS COBAS E 100 V2",
        item_type: "reactivo",
        source: "catalog",
        equipment_id: 12,
        equipment_name: "cobas e411 disk",
      },
    ]);

    expect(ordered).toHaveLength(1);
    expect(ordered[0]).toMatchObject({
      item_key: "cons:12:372",
      name: "FOLATE G3 ELECSYS COBAS E 100 V2",
    });
  });

  test("usa la etiqueta V3 de la tabla base y oculta la version historica V2 sin fila", () => {
    const ordered = service.__testables.orderOfferItemsByBusinessCaseTemplate([
      {
        item_key: "sheet:12:8324131190:reactivo",
        item_id: "8324131190",
        name: "acido folico",
        item_type: "reactivo",
        source: "sheet_template",
        equipment_id: 12,
        equipment_name: "cobas e411 disk",
      },
      {
        item_key: "cons:12:372",
        item_id: "7559992190",
        name: "FOLATE G3 ELECSYS COBAS E 100 V2",
        item_type: "reactivo",
        source: "catalog",
        equipment_id: 12,
        equipment_name: "cobas e411 disk",
      },
    ]);

    expect(ordered).toEqual([
      expect.objectContaining({
        item_key: "sheet:12:8324131190:reactivo",
        item_id: "8324131190",
        name: "FOLATE G3 ELECSYS COBAS E 100 V3",
      }),
    ]);
  });

  test("mergePricingIntoSections no transfiere precios por posicion a un producto distinto", () => {
    const sections = service.__testables.mergePricingIntoSections(
      {
        reactivo: [
          { itemKey: "e411-folate", code: "7559992190", product: "FOLATE G3 ELECSYS COBAS E 100 V2", equipmentName: "cobas e411 disk" },
        ],
      },
      {
        reactivo: [
          { itemKey: "t411-pt", code: "7103352190", product: "pt screen cobas t411 10x10ml", equipmentName: "cobas e411 disk", kitPrice: 99 },
        ],
      },
    );

    expect(sections.reactivo[0]).toMatchObject({
      product: "FOLATE G3 ELECSYS COBAS E 100 V2",
      kitPrice: null,
      determinationPrice: null,
    });
  });

  test("buildOfferTargetsForContext no descarta productos sin equipo en una integracion", () => {
    const targets = service.__testables.buildOfferTargetsForContext(
      { id: "bc-targets" },
      [
        { item_key: "cons:9:1", name: "Reactivo Pure", equipment_id: 9, equipment_name: "cobas Pure <303>" },
        { item_key: "cons:12:1", name: "Reactivo e411", equipment_id: 12, equipment_name: "cobas e411 disk" },
        { item_key: "manual:1", name: "Item manual comun", equipment_id: null, equipment_name: null },
      ],
    );

    expect(targets.map((target) => target.offerKey).sort()).toEqual([
      "equipment:12",
      "equipment:9",
      "sin-equipo",
    ]);
    expect(targets.find((target) => target.offerKey === "sin-equipo").items).toHaveLength(1);
  });

  test("expandComboOfferTarget conserva productos sin mapeo en un target separado", () => {
    const targets = service.__testables.expandComboOfferTarget({
      offerKey: "equipment:15",
      offerLabel: "cobas Pure <303 + 402>",
      targetEquipmentId: 15,
      targetEquipmentName: "cobas Pure <303 + 402>",
      items: [
        {
          item_key: "cons:15:1",
          item_id: "8057800190",
          name: "GLUCOSA",
          item_type: "reactivo",
          equipment_id: 15,
          equipment_name: "cobas Pure <303 + 402>",
        },
        {
          item_key: "cons:15:2",
          item_id: "8443432190",
          name: "TSH Elecsys E2G 300 V2",
          item_type: "reactivo",
          equipment_id: 15,
          equipment_name: "cobas Pure <303 + 402>",
        },
        {
          item_key: "manual:15:x",
          item_id: "MANUAL-1",
          name: "Producto manual sin mapeo",
          item_type: "material",
          equipment_id: 15,
          equipment_name: "cobas Pure <303 + 402>",
        },
      ],
    });

    expect(targets.some((target) => target.offerKey === "equipment:15:sin-mapeo")).toBe(true);
    expect(targets.find((target) => target.offerKey === "equipment:15:sin-mapeo").items).toEqual([
      expect.objectContaining({ name: "Producto manual sin mapeo" }),
    ]);
  });

  test("buildOfferTemplatePayload usa det_kit (catalogo) en vez de la cantidad anual/calculada para DET/KIT", async () => {
    const templatePayload = await service.__testables.buildOfferTemplatePayload(
      { client_name: "Cliente Demo", bc_purchase_type: "public" },
      [
        {
          name: "Glucosa",
          code: "4657527190",
          item_type: "reactivo",
          equipment_name: "cobas c111",
          det_kit: 400,
          annual_qty: 9999, // cantidad anual real -- NO debe aparecer en detPerKit
          reference_qty: 8888, // producto calculado -- NO debe aparecer en detPerKit
        },
      ],
      { email: "test@demo.com" },
    );
    expect(templatePayload.sections.reactivo[0].detPerKit).toBe(400);
  });

  test("mantiene controles y calibradores unidos exclusivamente para cobas Pure <303>", async () => {
    const templatePayload = await service.__testables.buildOfferTemplatePayload(
      { client_name: "Cliente Demo", bc_purchase_type: "public" },
      [
        { item_key: "cal-1", name: "Calibrador 1", code: "CAL-1", item_type: "calibrador", equipment_id: 9, equipment_name: "cobas Pure <303>", source_order: 32 },
        { item_key: "ctrl-1", name: "Control 1", code: "CTR-1", item_type: "control", equipment_id: 9, equipment_name: "cobas Pure <303>", source_order: 33 },
        { item_key: "cal-2", name: "Calibrador 2", code: "CAL-2", item_type: "calibrador", equipment_id: 9, equipment_name: "cobas Pure <303>", source_order: 34 },
      ],
      { email: "test@demo.com" },
    );

    expect(templatePayload.sections.control_calibrador.map((row) => row.product)).toEqual([
      "Calibrador 1",
      "Control 1",
      "Calibrador 2",
    ]);
    expect(templatePayload.sections.calibrador).toBeUndefined();
    expect(templatePayload.sections.control).toBeUndefined();
  });

  test("separa calibradores y controles para cobas e411 disk", async () => {
    const templatePayload = await service.__testables.buildOfferTemplatePayload(
      { client_name: "Cliente Demo", bc_purchase_type: "public" },
      [
        { item_key: "cal-1", name: "Calibrador E411", code: "CAL-1", item_type: "calibrador", equipment_id: 12, equipment_name: "cobas e411 disk", source_order: 32 },
        { item_key: "ctrl-1", name: "Control E411", code: "CTR-1", item_type: "control", equipment_id: 12, equipment_name: "cobas e411 disk", source_order: 33 },
      ],
      { email: "test@demo.com" },
    );

    expect(templatePayload.sections.calibrador.map((row) => row.product)).toEqual(["Calibrador E411"]);
    expect(templatePayload.sections.control.map((row) => row.product)).toEqual(["Control E411"]);
    expect(templatePayload.sections.control_calibrador).toBeUndefined();
  });

  test("buildOfferWorkbookBuffer compacta secciones y mueve el footer hacia arriba", () => {
    const buffer = service.__testables.buildOfferWorkbookBuffer({
      clientName: "Cliente Compacto",
      equipmentName: "cobas Pure <303 + 402>",
      advisorName: "Asesor Demo",
      validUntil: "",
      sections: {
        reactivo: [
          { product: "Reactivo 1", code: "R1", detPerKit: 10 },
          { product: "Reactivo 2", code: "R2", detPerKit: 20 },
        ],
        calibrador: [
          { product: "Calibrador 1", code: "C1", detPerKit: 5 },
        ],
        control: [],
        consumible: [
          { product: "Consumible 1", code: "M1", detPerKit: 8 },
        ],
        electrolito: [],
      },
      layout_positions: service.__testables.computeCompactLayoutPositions({
        reactivo: [
          { product: "Reactivo 1", code: "R1", detPerKit: 10 },
          { product: "Reactivo 2", code: "R2", detPerKit: 20 },
        ],
        calibrador: [
          { product: "Calibrador 1", code: "C1", detPerKit: 5 },
        ],
        control: [],
        consumible: [
          { product: "Consumible 1", code: "M1", detPerKit: 8 },
        ],
        electrolito: [],
      }),
    });

    const XLSX = require("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    expect(ws["B12"]?.v).toBe("Reactivo ");
    expect(ws["B13"]?.v).toBe("Reactivo 1");
    expect(ws["B14"]?.v).toBe("Reactivo 2");
    expect(ws["B16"]?.v).toBe("Calibradores");
    expect(ws["B17"]?.v).toBe("Calibrador 1");
    expect(ws["B19"]?.v).toBe("Consumibles");
    expect(ws["B20"]?.v).toBe("Consumible 1");
    expect(ws["B23"]?.v).toBe("* PRECIOS NO INCLUYE IVA");
    expect(ws["B26"]?.v).toBe("FAMPROJECT. CIA. LTDA");
    expect(ws["!ref"]).toBe("B2:I35");
    // US$ DET APROX* (I) debe ser una formula real (=H/F), no un valor fijo,
    // para que Sheets la recalcule sola cuando Comercial cambie el precio.
    expect(ws["F13"]?.v).toBe(10);
    expect(ws["I13"]?.f).toBe('IF(F13>0,ROUND(H13/F13,4),"")');
  });

  test("buildOfferWorkbookBuffer conserva precio manual por determinacion sin valor de kit", () => {
    const buffer = service.__testables.buildOfferWorkbookBuffer({
      clientName: "Cliente Demo",
      equipmentName: "cobas e411 disk",
      sections: {
        reactivo: [{ product: "Reactivo manual", code: "R-1", detPerKit: 100, determinationPrice: 2.75 }],
        calibrador: [],
        control: [],
        consumible: [],
        electrolito: [],
      },
    });
    const XLSX = require("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    expect(ws["H13"]).toBeUndefined();
    expect(ws["I13"]?.v).toBe(2.75);
    expect(ws["I13"]?.f).toBeUndefined();
  });

  test("computeSectionEquipmentGroups agrupa filas consecutivas del mismo equipo sin reordenar", () => {
    const groups = service.__testables.computeSectionEquipmentGroups([
      { product: "R1", equipmentName: "cobas e411 disk" },
      { product: "R2", equipmentName: "cobas e411 disk" },
      { product: "R3", equipmentName: "cobas Pure <303>" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].equipmentName).toBe("cobas e411 disk");
    expect(groups[0].items.map((i) => i.product)).toEqual(["R1", "R2"]);
    expect(groups[1].equipmentName).toBe("cobas Pure <303>");
    expect(groups[1].items.map((i) => i.product)).toEqual(["R3"]);
  });

  test("equipos integrados (2+ equipment_name en una seccion) quedan separados por sub-encabezado en la oferta", () => {
    const sections = {
      reactivo: [
        { product: "Reactivo E411-1", code: "E1", detPerKit: 10, equipmentName: "cobas e411 disk" },
        { product: "Reactivo E411-2", code: "E2", detPerKit: 20, equipmentName: "cobas e411 disk" },
        { product: "Reactivo Pure-1", code: "P1", detPerKit: 5, equipmentName: "cobas Pure <303>" },
      ],
      calibrador: [],
      control: [],
      consumible: [],
      electrolito: [],
    };
    const layoutPositions = service.__testables.computeCompactLayoutPositions(sections);

    // header de seccion (12) -> sub-encabezado equipo 1 (13) -> 2 items (14,15)
    // -> sub-encabezado equipo 2 (16) -> 1 item (17)
    expect(layoutPositions.reactivo.equipment_groups).toEqual([
      expect.objectContaining({ equipment_name: "cobas e411 disk", header_row: 13, start_row: 14, end_row: 15, count: 2 }),
      expect.objectContaining({ equipment_name: "cobas Pure <303>", header_row: 16, start_row: 17, end_row: 17, count: 1 }),
    ]);

    const buffer = service.__testables.buildOfferWorkbookBuffer({
      clientName: "Cliente Combo",
      equipmentName: "cobas e411 disk + cobas Pure <303>",
      advisorName: "Asesor Demo",
      validUntil: "",
      sections,
      layout_positions: layoutPositions,
    });
    const XLSX = require("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    expect(ws["B13"]?.v).toBe("cobas e411 disk");
    expect(ws["B14"]?.v).toBe("Reactivo E411-1");
    expect(ws["B15"]?.v).toBe("Reactivo E411-2");
    expect(ws["B16"]?.v).toBe("cobas Pure <303>");
    expect(ws["B17"]?.v).toBe("Reactivo Pure-1");

    // Los rangos de lectura de precios deben venir separados por grupo, no
    // como un bloque unico de start_row a end_row de la seccion completa.
    const ranges = service.__testables.buildSectionReadRanges({ sections, layout_positions: layoutPositions }, "Hoja1");
    const reactivoRanges = ranges.filter((r) => r.key === "reactivo");
    expect(reactivoRanges).toEqual([
      expect.objectContaining({ key: "reactivo", groupIndex: 0, groupCount: 2, range: "Hoja1!B14:I15" }),
      expect.objectContaining({ key: "reactivo", groupIndex: 1, groupCount: 1, range: "Hoja1!B17:I17" }),
    ]);
  });

  test("readPricingPayloadFromSheet reensambla precios de secciones multi-equipo en el orden original", async () => {
    const templatePayload = {
      sections: {
        reactivo: [
          { product: "Reactivo E411-1", code: "E1", detPerKit: 10, equipmentName: "cobas e411 disk" },
          { product: "Reactivo Pure-1", code: "P1", detPerKit: 5, equipmentName: "cobas Pure <303>" },
        ],
        calibrador: [],
        control: [],
        consumible: [],
        electrolito: [],
      },
    };
    templatePayload.layout_positions = service.__testables.computeCompactLayoutPositions(templatePayload.sections);

    sheets.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { title: "Hoja1" } }] },
    });
    // Dos rangos separados (uno por equipo): el mock debe devolver los
    // valores en el mismo orden en que buildSectionReadRanges los pide.
    sheets.spreadsheets.values.batchGet.mockResolvedValue({
      data: {
        valueRanges: [
          { values: [["Reactivo E411-1", "E1", "", "", "10", "", "100", ""]] },
          { values: [["Reactivo Pure-1", "P1", "", "", "5", "", "50", ""]] },
        ],
      },
    });

    const result = await service.__testables.readPricingPayloadFromSheet({
      sheet_file_id: "sheet-combo",
      template_payload: templatePayload,
    });

    expect(result.sections.reactivo.map((row) => row.product)).toEqual([
      "Reactivo E411-1",
      "Reactivo Pure-1",
    ]);
    expect(result.sections.reactivo[0].kitPrice).toBe(100);
    expect(result.sections.reactivo[1].kitPrice).toBe(50);
    expect(result.summary).toMatchObject({ total_rows: 2, priced_rows: 2, is_complete: true });
  });

  test("normalizeOfferBucket no clasifica limpieza del modulo ISE como electrolito en ningun equipo", () => {
    const { normalizeOfferBucket } = service.__testables;
    // Bug real: "ISE CLEANING SOLUTION" aparece en el catalogo de c111, c311,
    // Pure, Pro y 8000 -- debe ir a "consumible" en TODOS, tengan o no modulo
    // real de electrolitos, porque es un producto de limpieza, no un reactivo.
    ["cobas c111", "cobas 4000 c311", "cobas Pure <303>", "cobas Pro <503> ISE", "cobas 8000 <801>"].forEach((equipmentName) => {
      expect(normalizeOfferBucket({
        item_type: "material",
        name: "ISE CLEANING SOLUTION 5x100ml",
        equipment_name: equipmentName,
      })).toBe("consumible");
    });
  });

  test("normalizeOfferBucket si clasifica reactivos reales de electrolitos en equipos con modulo ISE", () => {
    const { normalizeOfferBucket } = service.__testables;
    expect(normalizeOfferBucket({
      item_type: "material",
      name: "ISE Reference Electrolyte (5 x 300 mL)",
      equipment_name: "cobas Pure <303>",
    })).toBe("electrolito");
  });

  test("normalizeOfferBucket nunca clasifica nada como electrolito para c111 (sin modulo ISE real)", () => {
    const { normalizeOfferBucket } = service.__testables;
    expect(normalizeOfferBucket({
      item_type: "material",
      name: "NaCL 9% cobas c 111",
      equipment_name: "cobas c111",
    })).toBe("consumible");
  });

  test("normalizeOfferBucket respeta el bloque de la tabla base para materiales", () => {
    const { normalizeOfferBucket } = service.__testables;
    expect(normalizeOfferBucket({
      item_type: "material",
      name: "ECO-D, cobas c pack green",
      offer_bucket: "consumible",
    })).toBe("consumible");
    expect(normalizeOfferBucket({
      item_type: "material",
      name: "ISE Standard low",
      offer_bucket: "electrolito",
    })).toBe("electrolito");
  });

  test("la columna de determinacion siempre se muestra en reactivos y solo en hematologia para las demas secciones", () => {
    const { shouldShowDeterminationPriceColumn } = service.__testables;
    expect(shouldShowDeterminationPriceColumn("reactivo", false)).toBe(true);
    expect(shouldShowDeterminationPriceColumn("consumible", false)).toBe(false);
    expect(shouldShowDeterminationPriceColumn("calibrador", false)).toBe(false);
    expect(shouldShowDeterminationPriceColumn("control", true)).toBe(true);
    expect(shouldShowDeterminationPriceColumn("consumible", true)).toBe(true);
  });

  test("normaliza mojibake UTF-8 sin modificar texto Unicode valido", () => {
    const { normalizePdfText } = service.__testables;
    const mojibakeName = String.fromCharCode(74, 111, 115, 195, 169);
    const expectedName = String.fromCodePoint(74, 111, 115, 233);
    const greekProduct = String.fromCodePoint(946, 45, 72, 105, 100, 114, 111, 120, 105);

    expect(normalizePdfText(mojibakeName)).toBe(expectedName);
    expect(normalizePdfText(greekProduct)).toBe(greekProduct);
  });

  test("buildFormalOfferPdfBuffer renderiza el PDF con equipos integrados sin lanzar error", async () => {
    const sections = {
      reactivo: [
        { product: "Reactivo E411-1", code: "E1", detPerKit: 10, kitPrice: 5, equipmentName: "cobas e411 disk" },
        { product: "Reactivo Pure-1", code: "P1", detPerKit: 5, kitPrice: 3, equipmentName: "cobas Pure <303>" },
      ],
      calibrador: [],
      control: [],
      consumible: [],
      electrolito: [],
    };
    const buffer = await service.__testables.buildFormalOfferPdfBuffer({
      context: { client_name: "Cliente Combo" },
      offer: { acta_code: "OFERTA-1" },
      templatePayload: {
        clientName: "Cliente Combo",
        equipmentName: "cobas e411 disk + cobas Pure <303>",
        advisorName: "Asesor Demo",
        title: "OFERTA COMERCIAL",
        sections,
      },
      pricingPayload: { sections: {} },
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // Firma de archivo PDF real, no un buffer vacio/corrupto.
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  test("readOfferPlazoFromSheet lee el texto libre que Comercial escribio en H9", async () => {
    sheets.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { title: "Hoja1" } }] },
    });
    sheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [["30 dias"]] },
    });
    const plazo = await service.__testables.readOfferPlazoFromSheet("sheet-123");
    expect(plazo).toBe("30 dias");
    expect(sheets.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({ spreadsheetId: "sheet-123", range: "Hoja1!H9" }),
    );
  });

  test("readOfferPlazoFromSheet devuelve null sin lanzar si la celda esta vacia o falla la lectura", async () => {
    sheets.spreadsheets.get.mockResolvedValue({
      data: { sheets: [{ properties: { title: "Hoja1" } }] },
    });
    sheets.spreadsheets.values.get.mockResolvedValue({ data: {} });
    expect(await service.__testables.readOfferPlazoFromSheet("sheet-123")).toBeNull();

    sheets.spreadsheets.get.mockRejectedValue(new Error("boom"));
    expect(await service.__testables.readOfferPlazoFromSheet("sheet-456")).toBeNull();

    expect(await service.__testables.readOfferPlazoFromSheet(null)).toBeNull();
  });
});
