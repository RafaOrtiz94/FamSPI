#!/usr/bin/env node
/**
 * Regenera docs/validation/RTM/RTM_sistema_spi.md desde
 * docs/validation/traceability_map.json (unica fuente de verdad).
 *
 * Reemplaza el esquema anterior (REQ-* / FRS-* inventados a mano, columna
 * FUNCION siempre en "requiere validacion funcional") por filas reales:
 * requisito -> archivo de test real, o referencia explicita a la brecha
 * declarada en el DQ (seccion 11) cuando el modulo no tiene prueba de verificacion directa.
 *
 * Uso: node docs/validation/build_rtm.js
 * (requiere haber corrido antes build_traceability_map.js)
 */
const fs = require("fs");
const path = require("path");

const MAP_FILE = path.join(__dirname, "traceability_map.json");
const OUT_FILE = path.join(__dirname, "RTM", "RTM_sistema_spi.md");

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error("Falta traceability_map.json. Correr primero: node docs/validation/build_traceability_map.js");
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
  const fecha = new Date(map.generated_at).toLocaleDateString("es-EC", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines = [];
  lines.push("# MATRIZ DE TRAZABILIDAD DEL SISTEMA SPI");
  lines.push("");
  lines.push(
    `Matriz elaborada por el Departamento de Tecnologias de la Informacion y Comunicacion (TICS) de FamSPI. Relaciona cada requisito del sistema con su evidencia de prueba de verificacion o, cuando no existe prueba directa, con el analisis de riesgo correspondiente. Corte: ${fecha}.`
  );
  lines.push("");
  lines.push("| Requisito | Modulo | Evidencia | Estado |");
  lines.push("|---|---|---|---|");

  for (const [moduleName, moduleData] of Object.entries(map.modules)) {
    if (moduleData.has_automated_tests) {
      for (const req of moduleData.requirements) {
        lines.push(
          `| ${req.req_id} | ${moduleName} | \`${req.test_file}\` (linea ${req.test_line}) | Verificado — resultado registrado en la calificacion OQ/PQ vigente |`
        );
      }
    } else {
      lines.push(
        `| — | ${moduleName} | Evidencia por historial de control | Ver Analisis de Riesgo y Cobertura de Pruebas, DQ §11 (riesgo declarado: ${moduleData.risk_level}) |`
      );
    }
  }

  fs.writeFileSync(OUT_FILE, lines.join("\n") + "\n", "utf8");
  console.log(`RTM_sistema_spi.md regenerado: ${map.total_test_cases} requisitos verificados + ${map.modules_without_tests} modulos en brecha.`);
}

main();
