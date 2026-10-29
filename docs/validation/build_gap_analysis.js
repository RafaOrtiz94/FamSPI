#!/usr/bin/env node
/**
 * Inserta/actualiza la seccion "11. Analisis de riesgo y brechas de
 * cobertura de pruebas (WHO TRS 1019 Annex 3 Appendix 5, §12.6-12.10)" en
 * 01_primeros_pasos_y_dq.md, generada desde traceability_map.json (evidencia
 * real de git + cobertura de tests), no prosa manual.
 *
 * Idempotente: reemplaza el contenido entre los marcadores si ya existen.
 *
 * Uso: node docs/validation/build_gap_analysis.js
 * (requiere haber corrido antes build_traceability_map.js)
 */
const fs = require("fs");
const path = require("path");

const DQ_FILE = path.join(__dirname, "01_primeros_pasos_y_dq.md");
const MAP_FILE = path.join(__dirname, "traceability_map.json");
const START = "<!-- SECCION_11_ANALISIS_RIESGO_START -->";
const END = "<!-- SECCION_11_ANALISIS_RIESGO_END -->";

function formatFecha(isoString) {
  if (!isoString) return "sin fecha registrada";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "sin fecha registrada";
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
}

function buildSection(map) {
  const modules = map.modules;
  const withTests = Object.entries(modules).filter(([, m]) => m.has_automated_tests);
  const withoutTests = Object.entries(modules).filter(([, m]) => !m.has_automated_tests);
  const highRisk = withoutTests.filter(([name]) => map.high_risk_modules_without_tests.includes(name));
  const otherGaps = withoutTests.filter(([name]) => !map.high_risk_modules_without_tests.includes(name));

  const lines = [];
  lines.push(START);
  lines.push("");
  lines.push("## 11. Analisis de riesgo y cobertura de pruebas");
  lines.push("");
  lines.push(
    `El Departamento de Tecnologias de la Informacion y Comunicacion (TICS) releva la cobertura de pruebas de verificacion y el historial de mantenimiento de cada modulo del sistema, conforme al enfoque de validacion retrospectiva para sistemas existentes de WHO TRS 1019 Annex 3 Appendix 5, §12.6-12.10. Corte de la evaluacion: ${formatFecha(map.generated_at)}.`
  );
  lines.push("");
  lines.push(
    `De los ${map.module_count} modulos que componen el backend de FamSPI, TICS confirma que **${map.modules_with_tests} cuentan con suite de pruebas de verificacion** (${map.total_test_cases} casos de prueba en total) y **${map.modules_without_tests} se sustentan con evidencia por historial de control**. Conforme a WHO §12.6-12.10, esta condicion no bloquea la validacion siempre que quede documentada con evidencia de riesgo y de mantenimiento activo del modulo.`
  );
  lines.push("");
  lines.push(
    "**Naturaleza retrospectiva y estado sujeto a cambios:** esta evaluacion es una fotografia del sistema a la fecha de corte. Aunque los modulos esten en produccion, NO se consideran congelados: siguen siendo susceptibles a cambios funcionales y de configuracion. Todo cambio posterior debe gestionarse mediante control de cambios con ticket TI (WHO §29) y re-dispara la revalidacion del alcance afectado (DQ/IQ/OQ/PQ). Por tanto, la cobertura y las conclusiones aqui declaradas aplican a la version/configuracion vigente en la fecha de corte y deben re-confirmarse tras cada cambio material."
  );
  lines.push("");
  lines.push("### 11.1 Modulos con cobertura de pruebas de verificacion");
  lines.push("");
  lines.push("| Modulo | Riesgo | Casos de prueba | Archivos |");
  lines.push("|---|---|---|---|");
  for (const [name, m] of withTests) {
    lines.push(`| ${name} | ${m.risk_level} | ${m.requirements.length} | ${m.test_files.map((f) => `\`${f}\``).join(", ")} |`);
  }
  lines.push("");
  lines.push("### 11.2 Brechas de alto riesgo (requieren revision prioritaria)");
  lines.push("");
  if (highRisk.length === 0) {
    lines.push("Ninguna.");
  } else {
    lines.push("| Modulo | Ultimo cambio registrado | Cambios (12 meses) | Justificacion de TICS |");
    lines.push("|---|---|---|---|");
    for (const [name, m] of highRisk) {
      lines.push(
        `| ${name} | ${formatFecha(m.git_evidence.last_commit_at)} | ${m.git_evidence.commits_last_12_months} | ${m.gap_justification} |`
      );
    }
  }
  lines.push("");
  lines.push("### 11.3 Otras brechas (riesgo medio-bajo)");
  lines.push("");
  if (otherGaps.length === 0) {
    lines.push("Ninguna.");
  } else {
    lines.push("| Modulo | Ultimo cambio registrado | Cambios (12 meses) |");
    lines.push("|---|---|---|");
    for (const [name, m] of otherGaps) {
      lines.push(`| ${name} | ${formatFecha(m.git_evidence.last_commit_at)} | ${m.git_evidence.commits_last_12_months} |`);
    }
  }
  lines.push("");
  lines.push(
    "**Regla de aceptacion de brecha (WHO §12.8):** un modulo de riesgo alto sin prueba de verificacion directa solo se considera brecha aceptada si TICS documenta evidencia de mantenimiento activo (cambios recientes revisados por par) y no existen incidentes abiertos conocidos. Los modulos de la seccion 11.2 se priorizan para cobertura futura antes que los de la seccion 11.3."
  );
  lines.push("");
  lines.push("### 11.4 Exclusiones de alcance (no son brechas)");
  lines.push("");
  const outOfScope = map.out_of_scope_modules || [];
  const excludedEmpty = map.excluded_empty_modules || [];
  const deadModules = map.dead_modules || [];
  lines.push(
    `TICS reviso el inventario y determino que ${outOfScope.length + excludedEmpty.length + deadModules.length} directorios de \`backend/src/modules/\` no constituyen una brecha de validacion y quedan fuera del alcance, por lo que no se cuentan entre los ${map.module_count} modulos evaluados.`
  );
  lines.push("");
  if (deadModules.length) {
    lines.push("**Ruteadores huerfanos / codigo muerto (no montado, dependencias inexistentes):**");
    lines.push("");
    lines.push("| Modulo | Motivo de exclusion |");
    lines.push("|---|---|");
    for (const item of deadModules) {
      lines.push(`| ${item.module} | ${item.reason} |`);
    }
    lines.push("");
  }
  if (excludedEmpty.length) {
    lines.push("**Directorios sin codigo backend (no son modulos reales; no ruteados):**");
    lines.push("");
    lines.push("| Directorio | Motivo de exclusion |");
    lines.push("|---|---|");
    for (const name of excludedEmpty) {
      lines.push(`| ${name} | Carpeta sin controlador/servicio/rutas: no hay funcionalidad que validar. |`);
    }
    lines.push("");
  }
  if (outOfScope.length) {
    lines.push("**Modulos reales fuera del alcance general (WHO/DQ §7):**");
    lines.push("");
    lines.push("| Modulo | Justificacion de exclusion |");
    lines.push("|---|---|");
    for (const item of outOfScope) {
      lines.push(`| ${item.module} | ${item.reason} |`);
    }
    lines.push("");
    lines.push(
      "Si cualquiera de estos portales pasara a manejar datos regulados, autorizaciones o trazabilidad central, debe reincorporarse al alcance y evaluarse su cobertura."
    );
    lines.push("");
  }
  const inDevelopment = map.in_development_modules || [];
  if (inDevelopment.length) {
    lines.push("### 11.5 Modulos en desarrollo (validacion provisional)");
    lines.push("");
    lines.push(
      "Los siguientes modulos se encuentran en desarrollo activo: permanecen dentro del inventario y pueden contar con cobertura de pruebas, pero su validacion es PROVISIONAL y se re-evalua al estabilizarse su funcionalidad y alcance. No deben interpretarse como validados en estado final."
    );
    lines.push("");
    lines.push("| Modulo | Estado |");
    lines.push("|---|---|");
    for (const item of inDevelopment) {
      lines.push(`| ${item.module} | ${item.note} |`);
    }
    lines.push("");
  }
  lines.push(END);
  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error("Falta traceability_map.json. Correr primero: node docs/validation/build_traceability_map.js");
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
  const section = buildSection(map);
  let content = fs.readFileSync(DQ_FILE, "utf8");

  if (content.includes(START) && content.includes(END)) {
    const before = content.slice(0, content.indexOf(START));
    const after = content.slice(content.indexOf(END) + END.length);
    content = `${before}${section}${after}`;
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(DQ_FILE, content, "utf8");
  console.log("01_primeros_pasos_y_dq.md actualizado con seccion 11 (gap analysis real).");
}

main();
