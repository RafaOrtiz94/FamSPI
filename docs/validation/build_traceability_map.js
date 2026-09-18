#!/usr/bin/env node
/**
 * Genera docs/validation/traceability_map.json a partir de los archivos
 * __tests__/*.test.js reales del backend (unica fuente de verdad de "que
 * test cubre que requisito"). No inventa cobertura: los modulos sin
 * __tests__/ quedan con test_file=null y deben justificarse en el DQ
 * (WHO TRS 1019 Annex 3 Appendix 5, §12.6-12.10).
 *
 * Uso: node docs/validation/build_traceability_map.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const MODULES_DIR = path.join(ROOT, "backend", "src", "modules");
const OUT_FILE = path.join(__dirname, "traceability_map.json");

// Criticidad declarada una sola vez (no por-modulo en prosa): usada solo
// para priorizar que brechas revisar primero, segun WHO §12.8 (gap analysis
// debe partir de la criticidad del sistema/proceso soportado).
const HIGH_RISK_MODULES = new Set([
  "auth",
  "security",
  "module-access",
  "signature",
  "signature-workflows",
  "permisos",
  "vacaciones",
  "finanzas",
  "viaticos",
  "auditoria",
  "documents",
]);

// Directorios que NO son modulos backend reales (vacios o sin codigo/rutas):
// se excluyen del inventario y del analisis de brechas (no hay nada que validar).
// (Los directorios vacios previos —checklist, contracts, talent-search,
// comercial— fueron eliminados del repositorio; el mecanismo se conserva por
// si reaparece scaffolding vacio.)
const EXCLUDED_EMPTY = new Set([]);

// Modulos reales pero fuera del alcance general de validacion (WHO/DQ §7):
// portales publicos temporales o auxiliares de bajo riesgo, sin impacto en
// datos regulados ni autorizaciones centrales. Se documentan como exclusion
// justificada, no como brecha.
const OUT_OF_SCOPE = new Map([
  ["world-cup-2026", "Portal promocional temporal (predicciones 2026), sin impacto en datos regulados ni autorizaciones (DQ §7)."],
  ["famdays", "Iniciativa interna auxiliar de bajo riesgo, sin impacto en cumplimiento ni datos criticos (DQ §7)."],
  ["kickoff", "Portal auxiliar de arranque, sin datos regulados centrales (DQ §7)."],
  ["public-delivery-plans", "Portal publico de consulta, sin autorizaciones ni datos criticos GxP (DQ §7)."],
]);

// Modulos en desarrollo activo: permanecen en el inventario y pueden tener
// pruebas, pero su validacion es PROVISIONAL y se re-evalua al estabilizarse
// (funcionalidad y alcance aun cambian). Se indican explicitamente para que un
// auditor no los interprete como validados en estado final.
// Ruteadores huerfanos / codigo muerto: dependen de modulos inexistentes
// (p.ej. `auth/auth.middleware` que no existe) y NO estan montados en
// registerRoutes. No son modulos funcionales; se excluyen del alcance.
const DEAD_MODULES = new Map([
  ["logistica", "Ruteador huerfano: depende de `auth/auth.middleware` (inexistente) y no esta montado en registerRoutes. Codigo muerto."],
  ["operaciones", "Ruteador huerfano: depende de `auth/auth.middleware` (inexistente) y no esta montado en registerRoutes. Codigo muerto."],
  ["tecnico", "Ruteador huerfano: depende de `auth/auth.middleware` (inexistente) y no esta montado en registerRoutes. Codigo muerto."],
]);

const IN_DEVELOPMENT = new Map([
  ["calidad", "Modulo en desarrollo activo (lineas CA0101-CA0117); funcionalidad y alcance en evolucion. Validacion provisional, sujeta a re-evaluacion al estabilizarse."],
]);

// Evidencia real de uso/mantenimiento (WHO §12.9): ultimo commit y numero
// de commits en los ultimos 12 meses que tocaron el directorio del modulo.
function gitEvidence(moduleName) {
  const relDir = path.join("backend", "src", "modules", moduleName).replace(/\\/g, "/");
  try {
    const lastDate = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", relDir],
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
    const commitCount = execFileSync(
      "git",
      ["log", "--since=12.months", "--format=%H", "--", relDir],
      { cwd: ROOT, encoding: "utf8" }
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean).length;
    return { last_commit_at: lastDate || null, commits_last_12_months: commitCount };
  } catch (err) {
    return { last_commit_at: null, commits_last_12_months: 0 };
  }
}

function listModuleDirs() {
  return fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function findTestFiles(moduleName) {
  const testsDir = path.join(MODULES_DIR, moduleName, "__tests__");
  if (!fs.existsSync(testsDir)) return [];
  return fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.js"))
    .map((f) => path.join("backend", "src", "modules", moduleName, "__tests__", f));
}

// Extrae bloques describe()/it()/test() con su jerarquia (describe padre)
// via un parseo lineal simple: el formato de este repo es consistente
// (un describe/it/test por linea, con string literal como primer arg).
function extractCases(absPath) {
  const text = fs.readFileSync(absPath, "utf8");
  const lines = text.split(/\r?\n/);
  const cases = [];
  let currentDescribe = null;
  const reDescribe = /^\s*describe(?:\.\w+)?\(\s*["'`](.+?)["'`]/;
  const reIt = /^\s*(?:it|test)(?:\.\w+)?\(\s*["'`](.+?)["'`]/;
  lines.forEach((line, idx) => {
    const dMatch = line.match(reDescribe);
    if (dMatch) {
      currentDescribe = dMatch[1];
      return;
    }
    const iMatch = line.match(reIt);
    if (iMatch) {
      cases.push({
        describe: currentDescribe,
        name: iMatch[1],
        line: idx + 1,
      });
    }
  });
  return cases;
}

function buildReqId(moduleName, seq) {
  const slug = moduleName.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  return `REQ-${slug}-${String(seq).padStart(3, "0")}`;
}

function main() {
  const modules = listModuleDirs();
  const map = {};
  const excludedEmpty = [];
  const deadModules = [];
  const outOfScope = [];
  let totalTests = 0;

  for (const moduleName of modules) {
    if (EXCLUDED_EMPTY.has(moduleName)) {
      excludedEmpty.push(moduleName);
      continue;
    }
    if (DEAD_MODULES.has(moduleName)) {
      deadModules.push({ module: moduleName, reason: DEAD_MODULES.get(moduleName) });
      continue;
    }
    if (OUT_OF_SCOPE.has(moduleName)) {
      outOfScope.push({ module: moduleName, reason: OUT_OF_SCOPE.get(moduleName) });
      continue;
    }
    const testFiles = findTestFiles(moduleName);
    if (testFiles.length === 0) {
      const evidence = gitEvidence(moduleName);
      const risk = HIGH_RISK_MODULES.has(moduleName) ? "alto" : "medio-bajo";
      const fechaLegible = evidence.last_commit_at
        ? new Date(evidence.last_commit_at).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" })
        : null;
      const justification = fechaLegible
        ? `Sin prueba de verificacion directa. Riesgo declarado por TICS: ${risk}. Evidencia de mantenimiento activo: ultimo cambio registrado el ${fechaLegible}, con ${evidence.commits_last_12_months} cambio(s) en los ultimos 12 meses. Brecha aceptada bajo riesgo declarado; queda priorizada para cobertura futura.`
        : `Sin prueba de verificacion directa y sin historial de cambios recientes detectado. Riesgo declarado por TICS: ${risk}. Requiere revision manual antes de aceptar la brecha.`;
      map[moduleName] = {
        has_automated_tests: false,
        test_files: [],
        requirements: [],
        risk_level: risk,
        git_evidence: evidence,
        gap_justification: justification,
      };
      continue;
    }

    const requirements = [];
    let seq = 1;
    for (const relPath of testFiles) {
      const absPath = path.join(ROOT, relPath);
      const cases = extractCases(absPath);
      for (const c of cases) {
        requirements.push({
          req_id: buildReqId(moduleName, seq++),
          description: c.describe ? `${c.describe} — ${c.name}` : c.name,
          test_file: relPath.replace(/\\/g, "/"),
          test_line: c.line,
        });
        totalTests += 1;
      }
    }

    map[moduleName] = {
      has_automated_tests: true,
      test_files: testFiles.map((p) => p.replace(/\\/g, "/")),
      requirements,
      risk_level: HIGH_RISK_MODULES.has(moduleName) ? "alto" : "medio-bajo",
      gap_justification: "",
    };
  }

  // Marca los modulos en desarrollo activo (validacion provisional).
  const inDevelopment = [];
  for (const [name, note] of IN_DEVELOPMENT) {
    if (map[name]) {
      map[name].in_development = true;
      map[name].dev_note = note;
      inDevelopment.push({ module: name, note });
    }
  }

  const inScopeCount = Object.keys(map).length;
  const withTests = Object.values(map).filter((m) => m.has_automated_tests).length;
  const highRiskGaps = Object.entries(map).filter(
    ([name, m]) => !m.has_automated_tests && HIGH_RISK_MODULES.has(name)
  ).map(([name]) => name);
  const output = {
    generated_at: new Date().toISOString(),
    source: "backend/src/modules/*/__tests__/*.test.js (extraccion automatica, no manual)",
    module_count: inScopeCount,
    total_module_dirs: modules.length,
    modules_with_tests: withTests,
    modules_without_tests: inScopeCount - withTests,
    total_test_cases: totalTests,
    high_risk_modules_without_tests: highRiskGaps,
    excluded_empty_modules: excludedEmpty,
    dead_modules: deadModules,
    out_of_scope_modules: outOfScope,
    in_development_modules: inDevelopment,
    modules: map,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(
    `traceability_map.json generado: ${inScopeCount} modulos en alcance (de ${modules.length} dirs), ${withTests} con tests, ${totalTests} casos, ${highRiskGaps.length} alto riesgo sin tests; excluidos ${excludedEmpty.length} vacios y ${outOfScope.length} fuera de alcance.`
  );
}

main();
