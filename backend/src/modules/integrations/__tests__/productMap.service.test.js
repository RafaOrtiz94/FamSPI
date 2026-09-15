jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

const db = require("../../../config/db");
const service = require("../productMap.service");

describe("productMap.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lista filas paginadas del libro de correspondencia", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          legacy_code: "LEG-001",
          spi_sku: "SPI-001",
          spi_equipment_model_id: 10,
          spi_equipment_model_name: "Cobas 411",
          spi_equipment_model_code: "CB411",
          spi_equipment_model_sku: "SPI-001",
          odoo_product_id: 345,
          business_category: "equipment",
          active: true,
          notes: "map inicial",
          created_at: "2026-04-11T00:00:00.000Z",
          updated_at: "2026-04-11T00:00:00.000Z",
          total_count: 1,
        },
      ],
    });

    const result = await service.listProductMap({
      page: 1,
      limit: 20,
      active: true,
      q: "Cobas",
      business_category: "equipment",
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: 1,
      business_category: "equipment",
      odoo_product_id: 345,
      spi_equipment_model_id: 10,
    });
    expect(result.rows[0]).not.toHaveProperty("total_count");
  });

  it("crea fila cuando no existe match activo para upsert", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // findActiveMapByReferences
      .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // insert
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            legacy_code: "LEG-009",
            spi_sku: "SPI-009",
            spi_equipment_model_id: 90,
            spi_equipment_model_name: "Equipo 9",
            spi_equipment_model_code: "EQ9",
            spi_equipment_model_sku: "SPI-009",
            odoo_product_id: 9009,
            business_category: "equipment",
            active: true,
            notes: null,
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      }); // findById

    const result = await service.upsertProductMap({
      legacy_code: "LEG-009",
      spi_sku: "SPI-009",
      spi_equipment_model_id: 90,
      odoo_product_id: 9009,
      business_category: "equipment",
      active: true,
    });

    expect(result.action).toBe("created");
    expect(result.row).toMatchObject({
      id: 9,
      odoo_product_id: 9009,
      business_category: "equipment",
    });
  });

  it("genera reporte de cobertura con estructura estable", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ total_spi_items: 3, total_mapped: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            spi_equipment_model_id: 11,
            legacy_code: "LEG-011",
            spi_sku: "SPI-011",
            spi_item_name: "Equipo sin map 1",
            spi_item_status: "operativo",
          },
          {
            spi_equipment_model_id: 12,
            legacy_code: "LEG-012",
            spi_sku: "SPI-012",
            spi_item_name: "Equipo sin map 2",
            spi_item_status: "operativo",
          },
        ],
      });

    const result = await service.getCoverageReport({
      missing_limit: 100,
      missing_offset: 0,
      include_inactive: false,
    });

    expect(result.totalSpiItems).toBe(3);
    expect(result.totalMapped).toBe(1);
    expect(result.missingInMap).toHaveLength(2);
    expect(result).toHaveProperty("missingInMap");
    expect(result).toHaveProperty("missingCount");
  });
});
