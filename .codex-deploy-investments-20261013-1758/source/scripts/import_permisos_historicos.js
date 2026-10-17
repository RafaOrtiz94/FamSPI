#!/usr/bin/env node
/**
 * Importador de historial de permisos/vacaciones.
 *
 * Uso:
 *   node scripts/import_permisos_historicos.js --file scripts/data/permisos_historicos.example.json --dry-run
 *   node scripts/import_permisos_historicos.js --file scripts/data/permisos_historicos.example.json
 */

const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");
const { ensureTable } = require("../src/modules/permisos/permisos.service");

const VALID_TIPO_SOLICITUD = new Set(["permiso", "vacaciones"]);
const VALID_TIPO_PERMISO = new Set(["estudios", "personal", "salud", "calamidad"]);
const VALID_STATUS = new Set(["pending", "partially_approved", "pending_final", "approved", "rejected"]);

const getArgValue = (args, key) => {
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const hasFlag = (args, flag) => args.includes(flag);

const normalizeArray = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

const normalizeBool = (value, fallback = false) => {
  if (value === null || value === undefined || value === "") return fallback;
  const text = String(value).trim().toLowerCase();
  return ["true", "1", "si", "sí", "yes"].includes(text);
};

const normalizeDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const normalizeDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const getUsersByEmail = async (client, emails) => {
  if (!emails.length) return new Map();
  const { rows } = await client.query(
    `SELECT id, LOWER(email) AS email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS fullname
     FROM users
     WHERE LOWER(email) = ANY($1::text[])`,
    [emails]
  );
  const map = new Map();
  rows.forEach((row) => map.set(row.email, row));
  return map;
};

const validateRow = (row, index) => {
  const errors = [];
  const tipoSolicitud = String(row.tipo_solicitud || "permiso").toLowerCase();
  const tipoPermiso = row.tipo_permiso ? String(row.tipo_permiso).toLowerCase() : null;
  const status = String(row.status || "approved").toLowerCase();

  if (!row.user_email) errors.push("user_email requerido");
  if (!VALID_TIPO_SOLICITUD.has(tipoSolicitud)) errors.push(`tipo_solicitud invalido: ${tipoSolicitud}`);
  if (tipoSolicitud === "permiso" && !VALID_TIPO_PERMISO.has(tipoPermiso)) {
    errors.push(`tipo_permiso invalido para permiso: ${tipoPermiso || "(vacio)"}`);
  }
  if (!VALID_STATUS.has(status)) errors.push(`status invalido: ${status}`);
  if (!row.fecha_inicio) errors.push("fecha_inicio requerida");
  if (!row.fecha_fin) errors.push("fecha_fin requerida");

  if (errors.length) {
    const message = `Fila ${index + 1}: ${errors.join(" | ")}`;
    const err = new Error(message);
    err.row = row;
    throw err;
  }
};

const buildPayload = (raw, usersMap) => {
  const userEmail = String(raw.user_email).trim().toLowerCase();
  const approverEmail = raw.approver_email ? String(raw.approver_email).trim().toLowerCase() : null;
  const userRef = usersMap.get(userEmail);
  const approverRef = approverEmail ? usersMap.get(approverEmail) : null;
  const tipoSolicitud = String(raw.tipo_solicitud || "permiso").toLowerCase();
  const status = String(raw.status || "approved").toLowerCase();

  return {
    user_email: userEmail,
    user_fullname: raw.user_fullname || userRef?.fullname || userEmail,
    user_id: raw.user_id || userRef?.id || null,
    department_id: raw.department_id || null,
    approver_role: raw.approver_role || null,
    approver_user_id: raw.approver_user_id || approverRef?.id || null,
    approver_email: approverEmail || null,
    tipo_solicitud: tipoSolicitud,
    tipo_permiso: tipoSolicitud === "permiso" ? String(raw.tipo_permiso || "").toLowerCase() : null,
    subtipo_calamidad: raw.subtipo_calamidad || null,
    duracion_horas: raw.duracion_horas !== undefined ? Number(raw.duracion_horas || 0) : null,
    duracion_dias: raw.duracion_dias !== undefined ? Number(raw.duracion_dias || 0) : null,
    fecha_inicio: normalizeDate(raw.fecha_inicio),
    fecha_fin: normalizeDate(raw.fecha_fin),
    fecha_regreso: normalizeDate(raw.fecha_regreso),
    es_recuperable: normalizeBool(raw.es_recuperable, false),
    periodo_vacaciones: raw.periodo_vacaciones || null,
    justificacion_requerida: normalizeArray(raw.justificacion_requerida),
    justificantes_urls: normalizeArray(raw.justificantes_urls),
    aprobacion_parcial_at: normalizeDateTime(raw.aprobacion_parcial_at),
    aprobacion_parcial_por: raw.aprobacion_parcial_por || null,
    aprobacion_final_at: normalizeDateTime(raw.aprobacion_final_at),
    aprobacion_final_por: raw.aprobacion_final_por || null,
    pdf_generado_url: raw.pdf_generado_url || null,
    observaciones: normalizeArray(raw.observaciones),
    status,
    created_at: normalizeDateTime(raw.created_at) || new Date().toISOString(),
    updated_at: normalizeDateTime(raw.updated_at) || new Date().toISOString(),
  };
};

const main = async () => {
  const args = process.argv.slice(2);
  const fileArg = getArgValue(args, "--file");
  const dryRun = hasFlag(args, "--dry-run");

  if (!fileArg) {
    console.error("Falta --file <ruta_json>");
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Archivo no encontrado: ${absolutePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  let rows;
  try {
    rows = JSON.parse(content);
  } catch (error) {
    console.error(`JSON inválido en ${absolutePath}: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("El archivo debe contener un array JSON con al menos 1 registro.");
    process.exit(1);
  }

  await ensureTable();
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    rows.forEach((row, index) => validateRow(row, index));

    const allEmails = [...new Set(
      rows
        .flatMap((r) => [r.user_email, r.approver_email])
        .filter(Boolean)
        .map((e) => String(e).trim().toLowerCase())
    )];
    const usersMap = await getUsersByEmail(client, allEmails);

    let inserted = 0;
    const sample = [];
    for (const row of rows) {
      const payload = buildPayload(row, usersMap);
      sample.push({
        user_email: payload.user_email,
        tipo_solicitud: payload.tipo_solicitud,
        status: payload.status,
        fecha_inicio: payload.fecha_inicio,
        fecha_fin: payload.fecha_fin,
      });

      if (!dryRun) {
        await client.query(
          `INSERT INTO permisos_vacaciones (
             user_email, user_fullname, user_id, department_id,
             approver_role, approver_user_id, approver_email,
             tipo_solicitud, tipo_permiso, subtipo_calamidad,
             duracion_horas, duracion_dias, fecha_inicio, fecha_fin, fecha_regreso,
             es_recuperable, periodo_vacaciones, justificacion_requerida, justificantes_urls,
             aprobacion_parcial_at, aprobacion_parcial_por, aprobacion_final_at, aprobacion_final_por,
             pdf_generado_url, observaciones, status, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,
             $5,$6,$7,
             $8,$9,$10,
             $11,$12,$13,$14,$15,
             $16,$17,$18,$19,
             $20,$21,$22,$23,
             $24,$25,$26,$27,$28
           )`,
          [
            payload.user_email,
            payload.user_fullname,
            payload.user_id,
            payload.department_id,
            payload.approver_role,
            payload.approver_user_id,
            payload.approver_email,
            payload.tipo_solicitud,
            payload.tipo_permiso,
            payload.subtipo_calamidad,
            payload.duracion_horas,
            payload.duracion_dias,
            payload.fecha_inicio,
            payload.fecha_fin,
            payload.fecha_regreso,
            payload.es_recuperable,
            payload.periodo_vacaciones,
            payload.justificacion_requerida,
            payload.justificantes_urls,
            payload.aprobacion_parcial_at,
            payload.aprobacion_parcial_por,
            payload.aprobacion_final_at,
            payload.aprobacion_final_por,
            payload.pdf_generado_url,
            payload.observaciones,
            payload.status,
            payload.created_at,
            payload.updated_at,
          ]
        );
      }
      inserted += 1;
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log(`DRY RUN OK: ${inserted} registros validados (sin insertar).`);
    } else {
      await client.query("COMMIT");
      console.log(`IMPORT OK: ${inserted} registros insertados.`);
    }
    console.table(sample.slice(0, 10));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`IMPORT ERROR: ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
  }
};

main().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  process.exit(1);
});

