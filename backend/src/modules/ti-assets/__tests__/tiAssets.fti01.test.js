jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../signature-workflows/signatureWorkflows.service", () => ({}));
const { buildFti01Rows } = require("../tiAssets.fti01");

describe("F.TI-01: filas del formato", () => {
  const assets = [
    { id: 5, asset_code: "TI-1", name: "Laptop", brand: "Lenovo", model: "V14 G2", serial_number: "PF4", custody_type: "collaborator", assigned_to_name: "ROMERO LILIANA" },
    { id: 9, asset_code: "TI-2", name: "CPU", brand: "HP", model: "RP 5800", serial_number: "CZC", custody_type: "warehouse" },
    { id: 11, asset_code: "TI-3", name: "Monitor", custody_type: "client", client_name: "Hospital X" },
  ];

  test("separa colaboradores de bodega/clientes y numera cada seccion desde 1", () => {
    const { collaborators, warehouse } = buildFti01Rows({ assets, schedules: [], year: 2026 });
    expect(collaborators.map((row) => row.slice(0, 7))).toEqual([[1, "Laptop", "ROMERO LILIANA", "TI-1", "Lenovo", "V14 G2", "PF4"]]);
    expect(warehouse.map((row) => row.slice(0, 3))).toEqual([[1, "CPU", "Bodega"], [2, "Monitor", "Hospital X"]]);
    expect(collaborators[0]).toHaveLength(19);
  });

  test("cada mantenimiento va en su mes con fecha y estado; otros años no entran", () => {
    const schedules = [
      { asset_id: 5, planned_date: "2026-10-12T05:00:00.000Z", status: "pending" },
      { asset_id: 5, planned_date: "2026-03-02T05:00:00.000Z", status: "completed" },
      { asset_id: 5, planned_date: "2026-03-20T05:00:00.000Z", status: "overdue" },
      { asset_id: 5, planned_date: "2027-01-05T05:00:00.000Z", status: "pending" },
    ];
    const [row] = buildFti01Rows({ assets, schedules, year: 2026 }).collaborators;
    const months = row.slice(7);
    expect(months[9]).toBe("12/10\nP");
    expect(months[2]).toBe("02/03\nE\n20/03\nV");
    expect(months[0]).toBe("");
  });
});
