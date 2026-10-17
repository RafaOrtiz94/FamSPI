#!/usr/bin/env node
/**
 * Backfill de firmas avanzadas para permisos/vacaciones.
 *
 * Uso:
 *   node scripts/backfill_permisos_firmas.js --dry-run
 *   node scripts/backfill_permisos_firmas.js
 */

const crypto = require("crypto");
const db = require("../src/config/db");
const { ensureTable } = require("../src/modules/permisos/permisos.service");

const hasFlag = (args, flag) => args.includes(flag);

function stableStringify(input) {
  if (input === null || input === undefined) return "";
  if (Array.isArray(input)) return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  if (input instanceof Date) return input.toISOString();
  if (typeof input === "object") {
    return `{${Object.keys(input)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(input);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildSnapshot(row = {}) {
  return {
    id: row.id,
    tipo_solicitud: row.tipo_solicitud,
    tipo_permiso: row.tipo_permiso,
    status: row.status,
    user_id: row.user_id,
    user_email: row.user_email,
    approver_user_id: row.approver_user_id,
    approver_email: row.approver_email,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    fecha_regreso: row.fecha_regreso,
    duracion_horas: row.duracion_horas,
    duracion_dias: row.duracion_dias,
    periodo_vacaciones: row.periodo_vacaciones,
    justificantes_urls: row.justificantes_urls || [],
    observaciones: row.observaciones || [],
    aprobacion_parcial_at: row.aprobacion_parcial_at,
    aprobacion_final_at: row.aprobacion_final_at,
    updated_at: row.updated_at,
  };
}

function getDesiredStages(row) {
  const desired = ["solicitud"];
  const status = String(row?.status || "").toLowerCase();
  if (status === "partially_approved" || status === "pending_final") {
    desired.push("aprobacion_parcial");
  }
  if (status === "approved") {
    desired.push("aprobacion_final");
  }
  if (status === "rejected") {
    desired.push("rechazo");
  }
  return desired;
}

function buildStageSignedAt(row, stage) {
  if (stage === "solicitud") return normalizeDate(row.created_at) || new Date().toISOString();
  if (stage === "aprobacion_parcial") {
    return normalizeDate(row.aprobacion_parcial_at) || normalizeDate(row.updated_at) || new Date().toISOString();
  }
  if (stage === "aprobacion_final") {
    return normalizeDate(row.aprobacion_final_at) || normalizeDate(row.updated_at) || new Date().toISOString();
  }
  if (stage === "rechazo") {
    return normalizeDate(row.aprobacion_final_at) || normalizeDate(row.updated_at) || new Date().toISOString();
  }
  return new Date().toISOString();
}

async function loadUserByEmailMap(client, emails) {
  const normalized = Array.from(
    new Set(
      (emails || [])
        .filter(Boolean)
        .map((item) => String(item).trim().toLowerCase())
    )
  );
  if (normalized.length === 0) return new Map();

  const { rows } = await client.query(
    `SELECT id, LOWER(email) AS email,
            COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS fullname,
            LOWER(COALESCE(NULLIF(role, ''), 'usuario')) AS role
       FROM users
      WHERE LOWER(email) = ANY($1::text[])`,
    [normalized]
  );
  const map = new Map();
  rows.forEach((row) => map.set(row.email, row));
  return map;
}

function resolveActorForStage(row, stage, usersByEmail) {
  if (stage === "solicitud") {
    const email = row.user_email ? String(row.user_email).trim().toLowerCase() : null;
    const byEmail = email ? usersByEmail.get(email) : null;
    return {
      id: row.user_id || byEmail?.id || null,
      email: row.user_email || byEmail?.email || null,
      name: row.user_fullname || byEmail?.fullname || row.user_email || "Solicitante",
      role: "solicitante",
    };
  }

  const approverEmail = row.approver_email ? String(row.approver_email).trim().toLowerCase() : null;
  const approverByEmail = approverEmail ? usersByEmail.get(approverEmail) : null;
  return {
    id: row.approver_user_id || approverByEmail?.id || null,
    email: row.approver_email || approverByEmail?.email || null,
    name: row.aprobacion_final_por || row.aprobacion_parcial_por || approverByEmail?.fullname || row.approver_email || "Aprobador",
    role: row.approver_role || approverByEmail?.role || "aprobador",
  };
}

function buildConsentText(stage) {
  if (stage === "solicitud") return "Firma de solicitante reconstruida por backfill";
  if (stage === "aprobacion_parcial") return "Firma de aprobacion parcial reconstruida por backfill";
  if (stage === "aprobacion_final") return "Firma de aprobacion final reconstruida por backfill";
  if (stage === "rechazo") return "Firma de rechazo reconstruida por backfill";
  return "Firma reconstruida por backfill";
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = hasFlag(args, "--dry-run");

  await ensureTable();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: permisos } = await client.query(
      `SELECT *
         FROM permisos_vacaciones
        WHERE status IN ('pending','partially_approved','pending_final','approved','rejected')
        ORDER BY id ASC`
    );

    if (!permisos.length) {
      await client.query(dryRun ? "ROLLBACK" : "COMMIT");
      console.log("No hay solicitudes para procesar.");
      return;
    }

    const emailPool = permisos.flatMap((row) => [row.user_email, row.approver_email]);
    const usersByEmail = await loadUserByEmailMap(client, emailPool);

    const solicitudIds = permisos.map((row) => row.id);
    const { rows: existingSignatures } = await client.query(
      `SELECT id, solicitud_id, stage, signature_hash_sha256, signed_at
         FROM permisos_vacaciones_firmas
        WHERE solicitud_id = ANY($1::int[])
        ORDER BY solicitud_id ASC, signed_at ASC, id ASC`,
      [solicitudIds]
    );

    const existingBySolicitud = new Map();
    existingSignatures.forEach((item) => {
      if (!existingBySolicitud.has(item.solicitud_id)) {
        existingBySolicitud.set(item.solicitud_id, []);
      }
      existingBySolicitud.get(item.solicitud_id).push(item);
    });

    let inserted = 0;
    let skippedNoActor = 0;
    let alreadyComplete = 0;
    const samples = [];

    for (const row of permisos) {
      const chain = existingBySolicitud.get(row.id) || [];
      const existingStages = new Set(chain.map((item) => item.stage));
      const desiredStages = getDesiredStages(row);
      const missingStages = desiredStages.filter((stage) => !existingStages.has(stage));

      if (missingStages.length === 0) {
        alreadyComplete += 1;
        continue;
      }

      let previousSignatureHash = chain.length ? chain[chain.length - 1].signature_hash_sha256 : null;
      const payloadHash = sha256Hex(stableStringify(buildSnapshot(row)));

      for (const stage of missingStages) {
        const actor = resolveActorForStage(row, stage, usersByEmail);
        if (!actor.id) {
          skippedNoActor += 1;
          samples.push({
            solicitud_id: row.id,
            stage,
            result: "skip_no_actor",
            status: row.status,
          });
          continue;
        }

        const signedAt = buildStageSignedAt(row, stage);
        const signatureHash = sha256Hex(
          stableStringify({
            solicitud_id: row.id,
            stage,
            signer_user_id: actor.id,
            signer_email: actor.email || null,
            signed_at: signedAt,
            payload_hash_sha256: payloadHash,
            previous_signature_hash_sha256: previousSignatureHash,
          })
        );

        if (!dryRun) {
          await client.query(
            `INSERT INTO permisos_vacaciones_firmas (
              solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
              signature_type, auth_method, consent_text, ip_address, user_agent, session_id,
              payload_hash_sha256, previous_signature_hash_sha256, signature_hash_sha256, signed_at
            ) VALUES ($1,$2,$3,$4,$5,$6,'advanced_electronic','oauth_corporate',$7,NULL,'backfill-script',NULL,$8,$9,$10,$11)
            ON CONFLICT (solicitud_id, stage) DO NOTHING`,
            [
              row.id,
              stage,
              actor.id,
              actor.email,
              actor.name,
              actor.role,
              buildConsentText(stage),
              payloadHash,
              previousSignatureHash,
              signatureHash,
              signedAt,
            ]
          );
        }

        previousSignatureHash = signatureHash;
        inserted += 1;
        samples.push({
          solicitud_id: row.id,
          stage,
          result: dryRun ? "dry_run" : "inserted",
          status: row.status,
        });
      }
    }

    await client.query(dryRun ? "ROLLBACK" : "COMMIT");

    console.log(dryRun ? "BACKFILL DRY RUN" : "BACKFILL OK");
    console.log(`Solicitudes evaluadas: ${permisos.length}`);
    console.log(`Solicitudes ya completas: ${alreadyComplete}`);
    console.log(`Firmas faltantes procesadas: ${inserted}`);
    console.log(`Firmas omitidas por actor no resoluble: ${skippedNoActor}`);
    if (samples.length) {
      console.table(samples.slice(0, 20));
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("BACKFILL ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error("FATAL:", error.message);
  process.exit(1);
});

