jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const { SOURCE_CONFIG } = require("../technicalSchedule.service");

// Bug relacionado (mismo dia que el de Controles/BC): "Abrir origen" en el
// cronograma tecnico llevaba a /inspecciones, un redirect fijo en
// AppRoutes.jsx que descarta el query string -- el asignado siempre
// aterrizaba en la sub-pestaña "Business Case" en vez de la suya. Ahora los
// source_path de inspeccion apuntan directo a Solicitudes.jsx con
// tab=inspeccion&subtab=<correcto>. Este test evita que alguien reintroduzca
// el path roto por error de copiar/pegar.
describe("technicalSchedule SOURCE_CONFIG — deep links de inspeccion", () => {
  const INSPECTION_SOURCE_TYPES = [
    ["inspeccion_compra_publica", "compras"],
    ["inspeccion_compra_privada", "compras"],
    ["public_purchase_reinspection", "compras"],
    ["private_purchase_reinspection", "compras"],
    ["solicitud_inspeccion", "independientes"],
    ["inspeccion_bc", "bc"],
  ];

  it.each(INSPECTION_SOURCE_TYPES)("%s apunta directo a Solicitudes con subtab=%s", (sourceType, expectedSubtab) => {
    const path = SOURCE_CONFIG[sourceType].path;
    expect(path).not.toContain("/inspecciones");
    expect(path).toBe(`/dashboard/servicio-tecnico/solicitudes?tab=inspeccion&subtab=${expectedSubtab}`);
  });
});

// El feed unificado (getTechnicalScheduleFeed) no traia retiro (F.ST-21) ni
// casos correctivos -- "Mis pendientes" mentia por omision para esos dos
// tipos. SOURCE_CONFIG debe declarar su categoria y su deep-link real.
describe("technicalSchedule SOURCE_CONFIG — retiro y correctivo", () => {
  it("retiro apunta a la pestaña de retiro en Solicitudes", () => {
    expect(SOURCE_CONFIG.retiro).toEqual({
      label: "Retiro de equipo",
      category: "withdrawal",
      path: "/dashboard/servicio-tecnico/solicitudes?tab=retiro&subtab=compras",
    });
  });

  it("correctivo apunta a la pestaña correctivo de Mantenimientos", () => {
    expect(SOURCE_CONFIG.correctivo).toEqual({
      label: "Caso correctivo",
      category: "corrective",
      path: "/dashboard/servicio-tecnico/mantenimientos?tab=corrective",
    });
  });
});
