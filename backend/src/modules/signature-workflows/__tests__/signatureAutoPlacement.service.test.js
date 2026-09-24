const { PDFDocument, StandardFonts } = require("pdf-lib");
const { detectSignerPlacement, detectPlacementsForDocument, normalizeTokens } = require("../signatureAutoPlacement.service");

// Construye un PDF sintetico de 1 pagina con una tabla de 3 columnas
// (nombre | cedula | [espacio de firma vacio]) -- misma forma que F.RH-02.
async function buildRosterPdf(rows) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const rowHeight = 40;
  let y = 780;
  for (const row of rows) {
    page.drawText(row.name, { x: 60, y, size: 11, font });
    page.drawText(row.cedula || "0000000000", { x: 300, y, size: 11, font });
    // columna de firma (col 4) queda deliberadamente en blanco, como en el documento real
    y -= rowHeight;
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe("normalizeTokens", () => {
  test("ignora acentos, mayusculas/minusculas y orden", () => {
    expect(normalizeTokens("Loaiza Vasquez Lorena Elizabeth")).toEqual(
      expect.arrayContaining(["LOAIZA", "VASQUEZ", "LORENA", "ELIZABETH"]),
    );
    expect(normalizeTokens("LORENA ELIZABETH LOAIZA VÁSQUEZ").sort()).toEqual(
      normalizeTokens("Loaiza Vasquez Lorena Elizabeth").sort(),
    );
  });
});

describe("detectSignerPlacement", () => {
  test("encuentra la fila del firmante aunque el PDF imprima Apellidos Nombres y la BD tenga Nombres Apellidos", async () => {
    const pdf = await buildRosterPdf([
      { name: "Gonzalez Perez Ana Maria" },
      { name: "Loaiza Vasquez Lorena Elizabeth" },
      { name: "Chicaiza Morales Bryan Joan" },
    ]);

    const placement = await detectSignerPlacement(pdf, "LORENA ELIZABETH LOAIZA VÁSQUEZ");
    expect(placement).not.toBeNull();
    expect(placement.page_number).toBe(1);
    // Debe caer en la fila del medio (Lorena), no en la de arriba ni la de abajo:
    // fila1 y=780 -> y_pct=1-780/842=0.0736; fila2 y=740 -> 0.1212; fila3 y=700 -> 0.1687
    expect(placement.y_pct).toBeGreaterThan(0.09);
    expect(placement.y_pct).toBeLessThan(0.15);
    // Debe quedar a la derecha del texto (columna de firma), no encima del nombre/cedula.
    expect(placement.x_pct).toBeGreaterThan(0.55);
  });

  test("no detecta nada si el nombre no aparece en el documento (evita ubicar mal)", async () => {
    const pdf = await buildRosterPdf([{ name: "Gonzalez Perez Ana Maria" }]);
    const placement = await detectSignerPlacement(pdf, "Alguien Que No Esta En La Lista");
    expect(placement).toBeNull();
  });

  test("no detecta nada si hay dos filas con el mismo nombre (evita ambiguedad)", async () => {
    const pdf = await buildRosterPdf([
      { name: "Ana Maria Torres Vega" },
      { name: "Ana Maria Torres Vega" },
    ]);
    const placement = await detectSignerPlacement(pdf, "Ana Maria Torres Vega");
    expect(placement).toBeNull();
  });

  test("distingue entre dos filas con nombres parecidos (coincidencia parcial no basta)", async () => {
    const pdf = await buildRosterPdf([
      { name: "Ana Maria Torres Vega" },
      { name: "Ana Maria Torres Rojas" },
    ]);
    const placement = await detectSignerPlacement(pdf, "Ana Maria Torres Rojas");
    expect(placement).not.toBeNull();
    // Fila 2 (Rojas), no fila 1 (Vega): y_pct de fila2 > y_pct de fila1 (mas abajo en la pagina)
    const placementVega = await detectSignerPlacement(pdf, "Ana Maria Torres Vega");
    expect(placement.y_pct).toBeGreaterThan(placementVega.y_pct);
  });

  test("nombre muy corto (una sola palabra) no intenta matchear -- demasiado riesgo de falso positivo", async () => {
    const pdf = await buildRosterPdf([{ name: "Ana Maria Torres Vega" }]);
    const placement = await detectSignerPlacement(pdf, "Ana");
    expect(placement).toBeNull();
  });
});

describe("detectPlacementsForDocument (version por lote, un solo parseo del PDF)", () => {
  test("devuelve un placement por cada firmante que se pudo detectar, y omite los que no", async () => {
    const pdf = await buildRosterPdf([
      { name: "Gonzalez Perez Ana Maria" },
      { name: "Loaiza Vasquez Lorena Elizabeth" },
    ]);

    const results = await detectPlacementsForDocument(pdf, [
      { id: 10, name_snapshot: "ANA MARIA GONZALEZ PEREZ" },
      { id: 20, name_snapshot: "Alguien Que No Esta En La Lista" },
      { id: 30, name_snapshot: "LORENA ELIZABETH LOAIZA VÁSQUEZ" },
    ]);

    expect(results.size).toBe(2);
    expect(results.has(10)).toBe(true);
    expect(results.has(20)).toBe(false);
    expect(results.has(30)).toBe(true);
    expect(results.get(10).y_pct).toBeLessThan(results.get(30).y_pct);
  });

  test("si el PDF no se puede leer, devuelve un mapa vacio en vez de lanzar", async () => {
    const results = await detectPlacementsForDocument(Buffer.from("no es un pdf"), [
      { id: 1, name_snapshot: "Cualquiera" },
    ]);
    expect(results.size).toBe(0);
  });
});
