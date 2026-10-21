/**
 * run_expedientes.js — Crear expedientes normalizados desde aspirantes
 * Ejecutar: DB_PASS=$(gcloud ...) node backend/scripts/run_expedientes.js [--dry-run]
 */
const { Client } = require("../node_modules/pg");
const DRY = process.argv.includes("--dry-run");

const MAPPING = {
  // ── ASESOR COMERCIAL GENERAL ──────────────────────────────────────────────
  "ASESOR COMERCIAL":                 "ASESOR COMERCIAL",
  "ASESORA COMERCIAL":                "ASESOR COMERCIAL",
  "ASESOR COMERCIAL Y CIENTIFICO":    "ASESOR COMERCIAL",
  "ASESOR COMERCIAL/KAM":             "ASESOR COMERCIAL",

  // ── ASESOR COMERCIAL QUITO ───────────────────────────────────────────────
  "ASESOR COMERCIAL QUITO":           "ASESOR COMERCIAL QUITO",
  "ASESOR COMERCIAL - QUITO":         "ASESOR COMERCIAL QUITO",
  "ASESOR COMERCIAL EN QUITO":        "ASESOR COMERCIAL QUITO",

  // ── ASESOR COMERCIAL GUAYAQUIL ───────────────────────────────────────────
  "ASESOR COMERCIAL GUAYAQUIL":       "ASESOR COMERCIAL GUAYAQUIL",
  "ASESORA COMERCIAL GUAYAQUIL":      "ASESOR COMERCIAL GUAYAQUIL",

  // ── ASESOR COMERCIAL DISPOSITIVOS MEDICOS (sin ciudad) ───────────────────
  "ASESOR COMERCIAL - DISPOSITIVOS MÉDICOS":         "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL - DISPOSITIVOS MEDICOS":         "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL -  DISPOSITIVOS MEDICOS":        "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL DISPOSITIVOS MEDICOS":           "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL DISPOSITIVOS MÉDICOS":           "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL DE DISPOSITIVOS MEDICOS":        "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL- DISPOSITIVOS MEDICOS":          "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL- DISPOSITIVOS MÉDICOS":          "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL – DISPOSITIVOS MÉDICOS":         "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL/ DISPOSITIVOS BIOMEDICOS":       "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL EQUIPOS MEDICOS":                "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL- DISPOSITIVOS MEDICOS O INGENIERO DE SERVICIO TECNICO":
                                                     "ASESOR COMERCIAL DISPOSITIVOS MEDICOS",
  "ASESOR COMERCIAL E INGENIERO DE SERVICIO TECNICO":"ASESOR COMERCIAL DISPOSITIVOS MEDICOS",

  // ── ASESOR COMERCIAL DISPOSITIVOS MEDICOS QUITO ──────────────────────────
  "ASESOR COMERCIAL - DISPOSITIVOS MÉDICOS RESIDENCIA QUITO":
                                                     "ASESOR COMERCIAL DISPOSITIVOS MEDICOS QUITO",
  "ASESOR COMERCIAL-DISPOSITIVOS MÉDICOS \"QUITO\"": "ASESOR COMERCIAL DISPOSITIVOS MEDICOS QUITO",
  "ASESOR COMERCIAL-DISPOSITIVOS MÉDICOS RESIDENCIA QUITO":
                                                     "ASESOR COMERCIAL DISPOSITIVOS MEDICOS QUITO",
  "ASESOR COMERCIAL DE EQUIPOS MÉDICOS QUITO":       "ASESOR COMERCIAL DISPOSITIVOS MEDICOS QUITO",
  "ASESOR COMERCIAL - DISPOSITIVOS MEDICOS  EN QUITO/ INGENIERO DE SERVICIO TÉCNICO EN CUENCA":
                                                     "ASESOR COMERCIAL DISPOSITIVOS MEDICOS QUITO",
  "RESIDENCIA QUITO":                                "ASESOR COMERCIAL DISPOSITIVOS MEDICOS QUITO",

  // ── INGENIERO DE SERVICIO TÉCNICO ────────────────────────────────────────
  "INGENIERO DE SERVICIO TÉCNICO":    "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERO DE SERVICIO TECNICO":    "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERO EN SERVICIO TECNICO":    "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERO EN SERVICIO TÉCNICO":    "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERA DE SERVICIO TÉCNICO":    "INGENIERO DE SERVICIO TÉCNICO",
  "ING SERVICIO TECNICO":             "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERIA DE SERVICIOS":          "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERO DE SERVICIO":            "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERO TÉCNICO":                "INGENIERO DE SERVICIO TÉCNICO",
  "INGENIERO EN SERVICIO MÉDICO":     "INGENIERO DE SERVICIO TÉCNICO",

  // ── INGENIERO DE SERVICIO DE CAMPO ───────────────────────────────────────
  "INGENIERO DE CAMPO":                           "INGENIERO DE SERVICIO DE CAMPO",
  "INGENIERO EN SERVICIO DE CAMPO":               "INGENIERO DE SERVICIO DE CAMPO",
  "INGENIERO EN SERVICIO TÉCNICO DE CAMPO":       "INGENIERO DE SERVICIO DE CAMPO",
  "INGENIERO EN SERVICIO TÉCNICO DE CAMPO":       "INGENIERO DE SERVICIO DE CAMPO",
  "INGENIERIO EN SERVICIO TÉCNICO DE CAMPO":      "INGENIERO DE SERVICIO DE CAMPO",
  "TECNICO DE CAMPO":                             "INGENIERO DE SERVICIO DE CAMPO",
  "INGENIERO BIOMEDICO":                          "INGENIERO DE SERVICIO DE CAMPO",
  "ING. BIOMEDICO":                               "INGENIERO DE SERVICIO DE CAMPO",
  "TECNICO DE EQUIPOS BIOMEDICOS":                "INGENIERO DE SERVICIO DE CAMPO",
  "INGENIERO EN ELECTRÓNICA Y AUTOMATIZACIÓN":    "INGENIERO DE SERVICIO DE CAMPO",

  // ── IST por ciudad (ya normalizados) ─────────────────────────────────────
  "INGENIERO DE SERVICIO DE CAMPO AMBATO":  "INGENIERO DE SERVICIO DE CAMPO AMBATO",
  "INGENIERO DE SERVICIO DE CAMPO CUENCA":  "INGENIERO DE SERVICIO DE CAMPO CUENCA",

  // ── ESPECIALISTA DE APLICACIONES ─────────────────────────────────────────
  "ESPECIALISTA DE APLICACIONES":           "ESPECIALISTA DE APLICACIONES",
  "ESPECIALISTA EN APLICACIONES":           "ESPECIALISTA DE APLICACIONES",
  "APLICACIONES":                           "ESPECIALISTA DE APLICACIONES",
  "APLICACIONISTA":                         "ESPECIALISTA DE APLICACIONES",
  "ESPECIALISTA":                           "ESPECIALISTA DE APLICACIONES",
  "APLICACIONES CLÍNICAS":                  "ESPECIALISTA DE APLICACIONES",
  "APLICACIONES EQUIPOS DE LABORATORIO":    "ESPECIALISTA DE APLICACIONES",

  "ESPECIALISTA DE APLICACIONES CUENCA":    "ESPECIALISTA DE APLICACIONES CUENCA",
  "ESPECIALISTA DE APLICACIONES AMBATO":    "ESPECIALISTA DE APLICACIONES AMBATO",

  // ── CONTABILIDAD ─────────────────────────────────────────────────────────
  "ASISTENTE CONTABLE":                     "ASISTENTE CONTABLE",
  "ASISTENTE CONTABLE /GESTOR DE COBRANZAS":"ASISTENTE CONTABLE",
  "AUXILIAR CONTABLE":                      "AUXILIAR CONTABLE",
  "AUXILIAR CONTABLES":                     "AUXILIAR CONTABLE",
  "AUXILIAR DE CONTABILIDAD":               "AUXILIAR CONTABLE",

  // ── CRÉDITO Y COBRANZA ───────────────────────────────────────────────────
  "ESPECIALISTA CREDITO Y COBRANZA":        "ESPECIALISTA CREDITO Y COBRANZA",
  "ESPECIALISTA CRÉDITO Y COBRANZA":        "ESPECIALISTA CREDITO Y COBRANZA",
  "ESPECIALISTA DE CRÉDITO Y COBRANZA":     "ESPECIALISTA CREDITO Y COBRANZA",
  "ANALISTA DE CRÉDITO":                    "ESPECIALISTA CREDITO Y COBRANZA",
  "ANALISTA DEE CARTERA":                   "ESPECIALISTA CREDITO Y COBRANZA",
  "ASISTENTE DE CREDITO Y CARTERA":         "ESPECIALISTA CREDITO Y COBRANZA",
  "ASISTENTE DE CRÉDITO Y COBRANZA":        "ESPECIALISTA CREDITO Y COBRANZA",
  "COBRANZAS":                              "ESPECIALISTA CREDITO Y COBRANZA",
  "CREDITO Y COBRANZA":                     "ESPECIALISTA CREDITO Y COBRANZA",

  // ── BACK OFFICE ──────────────────────────────────────────────────────────
  "BACK OFFICE COMERCIAL":    "BACK OFFICE COMERCIAL",
  "BACK OFFICE":              "BACK OFFICE COMERCIAL",

  // ── CHOFER ───────────────────────────────────────────────────────────────
  "CHOFER":                   "CHOFER",
  "CHOFER LICENCIA TIPO B":   "CHOFER",
  "CHOFER TIPO B":            "CHOFER",

  // ── TALENTO HUMANO ───────────────────────────────────────────────────────
  "JEFE DE TALENTO HUMANO":               "JEFE DE TALENTO HUMANO",
  "JEFE TALENTO HUMANO":                  "JEFE DE TALENTO HUMANO",
  "ASISTENTE DEL AREA DE RECURSOS HUMANOS":"ASISTENTE DE RECURSOS HUMANOS",

  // ── INGENIERO TICS ───────────────────────────────────────────────────────
  "INGENIERO TCI":                "INGENIERO TICS",
  "INGENIERO TCIs":               "INGENIERO TICS",
  "INGENIERO TICS":               "INGENIERO TICS",

  // ── COORDINACIÓN Y ADMINISTRACIÓN ────────────────────────────────────────
  "COORDINADOR DE TALENTO HUMANO":  "COORDINADOR DE TALENTO HUMANO",
  "COORDINADOR DE LOGÍSTICA":       "COORDINADOR DE LOGISTICA",
  "COORDINADOR DE LOGISTICA":       "COORDINADOR DE LOGISTICA",
  "RESPONSABLE DE BODEGA":          "RESPONSABLE DE BODEGA",

  // ── FACTURACIÓN ──────────────────────────────────────────────────────────
  "ASISTENTE DE FACTURACIÓN":       "ASISTENTE DE FACTURACION",
  "ASISTENTE DE FACTURACION":       "ASISTENTE DE FACTURACION",

  // ── OTROS (sin cambio) ───────────────────────────────────────────────────
  "SUB GERENTE":                  "SUB GERENTE",
  "JEFE DE SERVICIO TECNICO":     "JEFE DE SERVICIO TECNICO",
  "JEFE DE VENTAS":               "JEFE DE VENTAS",
  "GERENCIA DE PRODUCTO/COMERCIAL":"GERENCIA DE PRODUCTO COMERCIAL",
  "LOGÍSTICA Y OPERACIONES":      "LOGISTICA Y OPERACIONES",
  "MÉDICO":                       "MÉDICO",
  "DE ARROLLADOR SENIOR":         "DESARROLLADOR SENIOR",
  "SERVICIO TÉCNICO":             "INGENIERO DE SERVICIO TÉCNICO",

  // ── DESCARTAR ─────────────────────────────────────────────────────────────
  "VENDER EL SERVICIO COMO MOTORIZADO CON5 AÑOS DE EXPERIENCIA": null,
};

async function main() {
  const client = new Client({
    host: "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password: process.env.DB_PASS,
    database: "FamSPI",
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log(DRY ? "=== DRY RUN ===" : "=== MODO REAL ===");
  console.log("");

  // Admin user
  const adminRes = await client.query(
    "SELECT id FROM users WHERE email = 'administrador@fam-project.com' LIMIT 1"
  );
  const requesterId = adminRes.rows[0]?.id;
  if (!requesterId) throw new Error("Admin user not found");

  // Leer todos los aspirantes con su puesto raw
  const appRes = await client.query(`
    SELECT id, profile->'laboral'->>'cargo' AS cargo_raw
    FROM applicants
    WHERE profile->'laboral'->>'cargo' IS NOT NULL
      AND TRIM(profile->'laboral'->>'cargo') != ''
  `);

  // Agrupar por canonical
  const groups = new Map(); // canonical → [id, ...]
  const skipped = [];

  for (const row of appRes.rows) {
    const raw = (row.cargo_raw || "").trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip accents for lookup
      .toUpperCase()
      .replace(/\s+/g, " ");

    // Buscar en el mapa (con acentos y sin)
    let canonical = MAPPING[row.cargo_raw?.trim()];
    if (canonical === undefined) {
      // intentar con la versión sin acentos
      const rawKey = Object.keys(MAPPING).find(k => {
        const kn = k.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ");
        return kn === raw;
      });
      canonical = rawKey !== undefined ? MAPPING[rawKey] : undefined;
    }

    if (canonical === undefined) {
      // No está en el mapa — usar el valor raw normalizado
      canonical = row.cargo_raw.trim().toUpperCase().replace(/\s+/g, " ");
    }

    if (canonical === null) {
      skipped.push(row.id);
      continue;
    }

    if (!groups.has(canonical)) groups.set(canonical, []);
    groups.get(canonical).push(row.id);
  }

  console.log(`Puestos canónicos: ${groups.size}  |  Aspirantes descartados: ${skipped.length}`);
  console.log("");

  let creados = 0, existentes = 0, vinculados = 0;

  for (const [canonical, ids] of [...groups.entries()].sort()) {
    // ¿ya existe?
    const exRes = await client.query(
      `SELECT id, request_number FROM personnel_requests
       WHERE UPPER(TRIM(position_title)) = $1 LIMIT 1`,
      [canonical.toUpperCase()]
    );

    let requestId;
    let label;

    if (exRes.rows.length > 0) {
      requestId = exRes.rows[0].id;
      label = `${exRes.rows[0].request_number} (existente)`;
      existentes++;
    } else {
      if (!DRY) {
        const ins = await client.query(
          `INSERT INTO personnel_requests
             (requester_id, position_title, position_type, education_level,
              main_responsibilities, justification, status, urgency_level, priority)
           VALUES ($1,$2,'permanente','Bachillerato o Superior',
              'Por definir',
              'Expediente generado automáticamente desde postulaciones recibidas.',
              'en_proceso','normal',3)
           RETURNING id, request_number`,
          [requesterId, canonical]
        );
        requestId = ins.rows[0].id;
        label = `${ins.rows[0].request_number} (NUEVO)`;
      } else {
        label = "NUEVO (dry-run)";
      }
      creados++;
    }

    let linked = 0;
    if (!DRY && requestId) {
      const upd = await client.query(
        `UPDATE applicants SET personnel_request_id = $1, updated_at = NOW()
         WHERE id = ANY($2)
           AND (personnel_request_id IS NULL OR personnel_request_id = $1)`,
        [requestId, ids]
      );
      linked = upd.rowCount;
      vinculados += linked;
    }

    console.log(
      `[${String(ids.length).padStart(3)} asp]  ${label.padEnd(30)}  →  ${canonical}` +
      (!DRY && linked ? `  (${linked} vinculados)` : "")
    );
  }

  console.log("");
  console.log("══════════════════════════════════════════");
  console.log(`  Expedientes creados   : ${creados}`);
  console.log(`  Expedientes existentes: ${existentes}`);
  console.log(`  Aspirantes vinculados : ${vinculados}`);
  console.log(`  Aspirantes descartados: ${skipped.length}`);
  console.log("══════════════════════════════════════════");

  await client.end();
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
