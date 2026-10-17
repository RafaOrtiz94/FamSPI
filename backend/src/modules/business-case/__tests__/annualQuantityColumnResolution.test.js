// Root cause real (confirmado con el negocio y con datos reales de hojas
// en produccion): la cantidad anual tiene DOS columnas con DUEÑO distinto,
// nunca se resuelven por "cual esta mas cerca":
//   - "DET/AÑO PROCESO": la llena acp_comercial. Aplica a item_type=reactivo.
//   - "PRODUCTO CALCULADO": columna calculada por formula (nunca aparece en
//     fillable_headers, solo en el volcado completo de celdas) que llena
//     jefe_servicio. Aplica a controles/calibradores/materiales.
// Confirmado que ambos headers pueden coexistir en el MISMO bloque/fila
// (ej. equipo "c303 c503", fila 147: C=DET/AÑO/PROCESO Y G=PRODUCTO
// CALCULADO a la vez) -- por eso deben resolverse por SEPARADO, nunca
// mezclados en un solo pool con "gana el mas cercano".

const { findColumnForRowByTargetHeader } = require("../businessCaseSheetSyncLocal.service");

// Forma real de mapping_auto.json combinando fillable_headers (columnas de
// llenado manual) y cells (volcado completo, incluye columnas calculadas).
const mappingSheet = {
  fillable_headers: [
    { row: 8, column: 5, target_header: "DET/AÑO PROCESO" },
  ],
  cells: [
    { row: 8, column_index: 6, value: "PRODUCTO CALCULADO", data_type: "s" },
  ],
};

describe("findColumnForRowByTargetHeader — DET/AÑO PROCESO y PRODUCTO CALCULADO se resuelven por separado", () => {
  it("DET/AÑO PROCESO resuelve a su propia columna (5), ignorando PRODUCTO CALCULADO", () => {
    expect(findColumnForRowByTargetHeader(mappingSheet, "DET/AÑO PROCESO", 10)).toBe(5);
  });

  it("PRODUCTO CALCULADO resuelve a su propia columna (6), aunque solo exista en 'cells' (no en fillable_headers)", () => {
    expect(findColumnForRowByTargetHeader(mappingSheet, "PRODUCTO CALCULADO", 10)).toBe(6);
  });

  it("cada bloque de la pestaña tiene su propio header mas cercano hacia arriba", () => {
    const twoBlockSheet = {
      fillable_headers: [],
      cells: [
        { row: 8, column_index: 6, value: "DET/AÑO/PROCESO", data_type: "s" },
        { row: 84, column_index: 7, value: "PRODUCTO CALCULADO", data_type: "s" },
      ],
    };
    // Fila del bloque de reactivos (cerca del header de la fila 8).
    expect(findColumnForRowByTargetHeader(twoBlockSheet, "DET/AÑO PROCESO", 20)).toBe(6);
    // Fila del bloque de controles/calibradores (cerca del header de la fila 84, no el de la fila 8).
    expect(findColumnForRowByTargetHeader(twoBlockSheet, "PRODUCTO CALCULADO", 85)).toBe(7);
  });

  it("sin ningun header declarado antes de la fila, usa el fallback explicito", () => {
    expect(findColumnForRowByTargetHeader(mappingSheet, "DET/AÑO PROCESO", 3, 99)).toBe(99);
  });

  // Confirmado en pestañas reales (c303/c503): "PRODUCTO CALCULADO" no
  // siempre existe -- ahi controles/calibradores/materiales registran su
  // cantidad anual directamente en "PRODUCTO A ENTREGAR"/"PRODUCTO A ENVIAR".
  // El llamador (parseEquipmentSheetDefinitionWithMapping) debe buscar ambos
  // como needles alternativos, o la cantidad anual queda en 0.
  it("cuando PRODUCTO CALCULADO no existe, cae a PRODUCTO A ENVIAR/ENTREGAR", () => {
    const sheetSinProductoCalculado = {
      fillable_headers: [
        { row: 8, column: 5, target_header: "DET/AÑO PROCESO" },
        { row: 8, column: 8, target_header: "PRODUCTO A ENVIAR" },
      ],
      cells: [],
    };
    expect(
      findColumnForRowByTargetHeader(
        sheetSinProductoCalculado,
        ["PRODUCTO CALCULADO", "PRODUCTO A ENTREGAR", "PRODUCTO A ENVIAR"],
        10,
      ),
    ).toBe(8);
  });
});
