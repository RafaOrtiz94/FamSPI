// Root cause: en la plantilla real (Mapeador_Sheets/mapping_auto.json), el
// bloque de reactivos de una pestana de equipo declara la columna de cantidad
// anual como "DET/AÑO PROCESO", pero el bloque de calibradores/controles/
// materiales (mas abajo, misma pestana) NUNCA declara ese header -- ahi
// jefe_servicio/ing_servicio llena "PRODUCTO CALCULADO". findColumnForRowByTargetHeader
// debe resolver la columna correcta por fila buscando ambos headers a la vez.

const { findColumnForRowByTargetHeader, ANNUAL_QUANTITY_HEADERS } = require("../businessCaseSheetSyncLocal.service");

// Forma real de mapping_auto.json: fillable_headers es una lista plana de
// {row, column, target_header} -- una entrada por bloque que declara su
// propio encabezado de "cantidad anual".
const mappingSheet = {
  fillable_headers: [
    { row: 8, column: 6, target_header: "DET/AÑO PROCESO" },     // bloque reactivos
    { row: 75, column: 5, target_header: "PRODUCTO CALCULADO" }, // bloque calibradores
    { row: 95, column: 5, target_header: "PRODUCTO CALCULADO" }, // bloque controles
    { row: 113, column: 5, target_header: "PRODUCTO CALCULADO" }, // bloque materiales
  ],
};

describe("findColumnForRowByTargetHeader — resolucion de cantidad anual por bloque", () => {
  it("una fila de reactivos (bloque en fila 8) resuelve a la columna de DET/AÑO PROCESO", () => {
    const column = findColumnForRowByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS, 20);
    expect(column).toBe(6);
  });

  it("una fila de calibradores (bloque en fila 75) resuelve a PRODUCTO CALCULADO, no al header de reactivos", () => {
    const column = findColumnForRowByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS, 80);
    expect(column).toBe(5);
  });

  it("una fila de materiales (bloque en fila 113, el mas profundo) tambien resuelve a PRODUCTO CALCULADO", () => {
    const column = findColumnForRowByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS, 120);
    expect(column).toBe(5);
  });

  it("sin ningun bloque declarado antes de la fila, usa el fallback explicito", () => {
    const column = findColumnForRowByTargetHeader(mappingSheet, ANNUAL_QUANTITY_HEADERS, 3, 99);
    expect(column).toBe(99);
  });
});
