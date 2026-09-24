// Bug reportado 2026-09-24: el nombre/estado del equipo backup no llegaban al
// Sheet, y las celdas de texto sin dato quedaban vacias en vez de "N/A".

jest.mock("../../../config/db", () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../businessCaseIdempotency.service", () => ({}));
jest.mock("../investments.service", () => ({ getCatalogWithSelections: jest.fn().mockResolvedValue([]) }));
jest.mock("../bcLabEnvironment.service", () => ({ getLabEnvironment: jest.fn().mockResolvedValue(null) }));
jest.mock("../bcLisIntegration.service", () => ({
  getLisIntegration: jest.fn().mockResolvedValue(null),
  getEquipmentInterfaces: jest.fn().mockResolvedValue([]),
}));
jest.mock("../bcRequirements.service", () => ({ getRequirements: jest.fn().mockResolvedValue(null) }));
jest.mock("../bcDeliveries.service", () => ({ getDeliveries: jest.fn().mockResolvedValue(null) }));
jest.mock("../businessCaseDriveFolder.service", () => ({ ensureBusinessCaseDriveFolderById: jest.fn() }));
jest.mock("../businessCaseSheetSyncLocal.service", () => ({
  loadTemplateDefinition: jest.fn().mockReturnValue({}),
  buildSheetPayloads: jest.fn().mockReturnValue([]),
  syncBusinessCaseToGoogleSheet: jest.fn(),
}));

const db = require("../../../config/db");
const { buildAutoGenerationInput } = require("../businessCaseSheetGeneration.service");

// getEquipmentNamesMapByIds hace un SELECT id,name FROM equipment_catalog (u similar);
// devolvemos filas coherentes con los ids que pida cada test via un mock dinamico.
function mockEquipmentNames(namesById) {
  db.query.mockImplementation((sql, params) => {
    if (/SELECT.*name/i.test(sql) && Array.isArray(params?.[0])) {
      const ids = params[0];
      return Promise.resolve({
        rows: ids.filter((id) => namesById[id]).map((id) => ({ id, name: namesById[id] })),
      });
    }
    return Promise.resolve({ rows: [] });
  });
}

const baseBcRow = (extra) => ({
  id: "bc-1",
  client_name: "Cliente X",
  modern_bc_metadata: {},
  extra,
});

describe("buildAutoGenerationInput: equipo backup", () => {
  it("incluye nombre y estado del backup aunque no se instale simultaneo con el principal", async () => {
    mockEquipmentNames({ 10: "Cobas 6000", 20: "Cobas 4000 Backup" });
    const bcRow = baseBcRow({
      equipment_details: [{
        primary_id: 10,
        backup_id: 20,
        backup_status: "Nuevo",
        backup_install_simultaneous: false, // el caso que fallaba
      }],
    });

    const { fields } = await buildAutoGenerationInput({ businessCaseId: "bc-1", bcRow });

    expect(fields.NombreEquipoBackUp).toBe("Cobas 4000 Backup");
    expect(fields.EstadoEquipoBackUp).toBe("Nuevo");
    expect(fields.InstalarJuntoPrincipal).toBe("No");
  });

  it("tambien lo incluye cuando si se instala simultaneo (caso que ya funcionaba)", async () => {
    mockEquipmentNames({ 10: "Cobas 6000", 20: "Cobas 4000 Backup" });
    const bcRow = baseBcRow({
      equipment_details: [{ primary_id: 10, backup_id: 20, backup_status: "Nuevo", backup_install_simultaneous: true }],
    });

    const { fields } = await buildAutoGenerationInput({ businessCaseId: "bc-1", bcRow });

    expect(fields.NombreEquipoBackUp).toBe("Cobas 4000 Backup");
    expect(fields.InstalarJuntoPrincipal).toBe("Si");
  });

  it("cuando no hay backup seleccionado, los campos quedan en N/A (no vacios ni omitidos)", async () => {
    mockEquipmentNames({ 10: "Cobas 6000" });
    const bcRow = baseBcRow({ equipment_details: [{ primary_id: 10, backup_id: null }] });

    const { fields } = await buildAutoGenerationInput({ businessCaseId: "bc-1", bcRow });

    expect(fields.NombreEquipoBackUp).toBe("N/A");
    expect(fields.EstadoEquipoBackUp).toBe("N/A");
    expect(fields.InstalarJuntoPrincipal).toBe("N/A");
  });
});

describe("buildAutoGenerationInput: celdas vacias quedan en N/A", () => {
  it("un campo de texto/etiqueta sin dato se escribe como N/A, no se omite", async () => {
    mockEquipmentNames({});
    const bcRow = baseBcRow({ equipment_details: [] });

    const { fields } = await buildAutoGenerationInput({ businessCaseId: "bc-1", bcRow });

    expect(fields.ProvinciaCiudad).toBe("N/A");
    expect(fields.ObjetoContratacion).toBe("N/A");
    expect(fields.ProveedorSistemaTrabajar).toBe("N/A");
    expect(fields.ModeloProveedor1).toBe("N/A");
    // InterfazSistemaActual no aplica aqui: es un booleano calculado (requiresInterface)
    // que siempre tiene una respuesta determinada ("No" cuando no hay LIS ni sistema
    // actual registrado), no un dato ausente -- por eso no cae en N/A.
    expect(fields.InterfazSistemaActual).toBe("No");
  });

  it("un campo numerico que alimenta formulas se sigue omitiendo (no N/A) para no romper calculos", async () => {
    mockEquipmentNames({});
    const bcRow = baseBcRow({ equipment_details: [] });

    const { fields } = await buildAutoGenerationInput({ businessCaseId: "bc-1", bcRow });

    expect(fields).not.toHaveProperty("DiasLaboratorio");
    expect(fields).not.toHaveProperty("PresupuestoReferencial");
    expect(fields).not.toHaveProperty("Plazo");
  });

  it("un campo de texto con dato real sigue mostrando ese dato, no N/A", async () => {
    mockEquipmentNames({});
    const bcRow = baseBcRow({ equipment_details: [] });
    bcRow.contract_object = "Comodato";

    const { fields } = await buildAutoGenerationInput({ businessCaseId: "bc-1", bcRow });

    expect(fields.ObjetoContratacion).toBe("Comodato");
  });
});
