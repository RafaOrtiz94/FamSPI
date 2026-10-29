const crypto = require("crypto");
const db = require("../src/config/db");
const { generateFirmaLegalValidationPdf } = require("../src/modules/permisos/permisos.pdf");
const { jwtClient } = require("../src/config/google");

const resolveLegalVerificationBaseUrl = () => {
  if (process.env.LEGAL_VERIFICATION_BASE_URL) return process.env.LEGAL_VERIFICATION_BASE_URL;
  if (process.env.BACKEND_BASE_URL) return process.env.BACKEND_BASE_URL;
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (process.env.GOOGLE_REDIRECT_URI) {
    try {
      return new URL(process.env.GOOGLE_REDIRECT_URI).origin;
    } catch (_) {
      // ignore invalid URL
    }
  }
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  return "https://spi-backend-983537733948.us-central1.run.app";
};
const LEGAL_VERIFICATION_BASE_URL = resolveLegalVerificationBaseUrl();
const canUseDrive = Boolean(jwtClient) && String(process.env.BACKFILL_SKIP_DRIVE || "false") !== "true";

const nowIso = () => new Date().toISOString();

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

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function buildPermisosVerificationUrl(token) {
  return `${String(LEGAL_VERIFICATION_BASE_URL).replace(/\/+$/, "")}/api/v1/permisos/legal-verification/${token}`;
}

function buildVacacionesVerificationUrl(token) {
  return `${String(LEGAL_VERIFICATION_BASE_URL).replace(/\/+$/, "")}/api/v1/vacaciones/legal-verification/${token}`;
}

async function getUserById(id) {
  if (!id) return null;
  const { rows } = await db.query(
    `SELECT id, email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS fullname, role
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getUserByEmail(email) {
  if (!email) return null;
  const raw = String(email || "").trim().toLowerCase();
  const variants = new Set([raw]);
  variants.add(raw.replace("@famproject.com.ec", "@fam-project.com"));
  variants.add(raw.replace("@famproject.com", "@fam-project.com"));
  variants.add(raw.replace("@fam-project.com", "@famproject.com"));
  if (raw.endsWith(".ec")) variants.add(raw.replace(/\.ec$/, ""));
  variants.add(raw.replace(/\./g, "").replace(/-/g, ""));

  const variantList = Array.from(variants).filter(Boolean);
  const { rows } = await db.query(
    `SELECT id, email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS fullname, role
       FROM users
      WHERE LOWER(email) = ANY($1)
         OR REPLACE(REPLACE(LOWER(email), '.', ''), '-', '') = ANY($2)
      ORDER BY id
      LIMIT 1`,
    [variantList, variantList]
  );
  return rows[0] || null;
}

async function getUserByRole(role) {
  if (!role) return null;
  const { rows } = await db.query(
    `SELECT id, email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS fullname, role
       FROM users
      WHERE active = true
        AND LOWER(role) = LOWER($1)
      ORDER BY id
      LIMIT 1`,
    [role]
  );
  return rows[0] || null;
}

async function resolveActorFromText(text, fallbackRole = null) {
  if (!text) return null;
  const value = String(text).trim();
  if (value.includes("@")) {
    const byEmail = await getUserByEmail(value);
    if (byEmail) return byEmail;
  }

  const normalized = value.toLowerCase();
  const { rows } = await db.query(
    `SELECT id, email, COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email) AS fullname, role
       FROM users
      WHERE LOWER(COALESCE(fullname, '')) = $1
         OR LOWER(COALESCE(name, '')) = $1
      ORDER BY id
      LIMIT 1`,
    [normalized]
  );
  if (rows[0]) return rows[0];
  if (fallbackRole) return getUserByRole(fallbackRole);
  return null;
}

async function getLatestSignatureHash(tableName, solicitudId) {
  const { rows } = await db.query(
    `SELECT signature_hash_sha256
       FROM ${tableName}
      WHERE solicitud_id = $1
      ORDER BY signed_at DESC, id DESC
      LIMIT 1`,
    [solicitudId]
  );
  return rows[0]?.signature_hash_sha256 || null;
}

async function stageExists(tableName, solicitudId, stage) {
  const { rows } = await db.query(
    `SELECT id
       FROM ${tableName}
      WHERE solicitud_id = $1
        AND stage = $2
      ORDER BY signed_at DESC, id DESC
      LIMIT 1`,
    [solicitudId, stage]
  );
  return Boolean(rows[0]);
}

async function markCurrentFalse(tableName, solicitudId, stage) {
  await db.query(
    `UPDATE ${tableName}
        SET is_current = false, updated_at = NOW()
      WHERE solicitud_id = $1
        AND stage = $2
        AND is_current = true`,
    [solicitudId, stage]
  );
}

async function insertSignature({
  tableName,
  solicitudId,
  stage,
  actor,
  consentText,
  payloadSnapshot,
  signedAt,
}) {
  const previousHash = await getLatestSignatureHash(tableName, solicitudId);
  const payloadHash = sha256Hex(stableStringify(payloadSnapshot));
  const signatureHash = sha256Hex(
    stableStringify({
      solicitud_id: solicitudId,
      stage,
      signer_user_id: actor.id,
      signer_email: actor.email || null,
      signed_at: signedAt || nowIso(),
      payload_hash_sha256: payloadHash,
      previous_signature_hash_sha256: previousHash,
    })
  );

  await markCurrentFalse(tableName, solicitudId, stage);

  await db.query(
    `INSERT INTO ${tableName} (
      solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
      signature_type, auth_method, consent_text, ip_address, user_agent, session_id,
      payload_hash_sha256, previous_signature_hash_sha256, signature_hash_sha256, is_current, signed_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'advanced_electronic','oauth_corporate',$7,$8,$9,$10,$11,$12,$13,true,$14)`,
    [
      solicitudId,
      stage,
      actor.id,
      actor.email || null,
      actor.fullname || actor.email || `Usuario #${actor.id}`,
      String(actor.role || "").toLowerCase() || null,
      consentText,
      null,
      "backfill-timeoff-audit-harden/1.0",
      "backfill-timeoff-audit-harden",
      payloadHash,
      previousHash,
      signatureHash,
      signedAt || nowIso(),
    ]
  );
}

async function listPermisosSignatures(solicitudId) {
  const { rows } = await db.query(
    `SELECT id, solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
            payload_hash_sha256, previous_signature_hash_sha256, signature_hash_sha256, signed_at, is_current
       FROM permisos_vacaciones_firmas
      WHERE solicitud_id = $1
      ORDER BY signed_at ASC, id ASC`,
    [solicitudId]
  );
  return rows;
}

async function listVacacionesSignatures(solicitudId) {
  const { rows } = await db.query(
    `SELECT id, solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
            payload_hash_sha256, previous_signature_hash_sha256, signature_hash_sha256, signed_at, is_current
       FROM vacaciones_solicitudes_firmas
      WHERE solicitud_id = $1
      ORDER BY signed_at ASC, id ASC`,
    [solicitudId]
  );
  return rows;
}

async function backfillPermisos() {
  const stats = {
    totalClosed: 0,
    tokensAdded: 0,
    solicitudSignaturesAdded: 0,
    decisionSignaturesAdded: 0,
    legalPdfsAdded: 0,
    skippedNoRequester: 0,
    skippedNoApprover: 0,
  };

  const { rows } = await db.query(
    `SELECT *
       FROM permisos_vacaciones
      WHERE status IN ('approved', 'rejected')
      ORDER BY id ASC`
  );
  stats.totalClosed = rows.length;

  for (const row of rows) {
    let token = row.legal_verification_token;
    if (!token) {
      token = generateToken();
      await db.query(
        `UPDATE permisos_vacaciones
            SET legal_verification_token = $2,
                legal_verification_created_at = COALESCE(legal_verification_created_at, NOW()),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, token]
      );
      stats.tokensAdded += 1;
    }

    let requester = row.user_id ? await getUserById(row.user_id) : null;
    if (!requester && row.user_email) requester = await getUserByEmail(row.user_email);
    if (!requester) {
      stats.skippedNoRequester += 1;
    } else {
      const hasSolicitud = await stageExists("permisos_vacaciones_firmas", row.id, "solicitud");
      if (!hasSolicitud) {
        await insertSignature({
          tableName: "permisos_vacaciones_firmas",
          solicitudId: row.id,
          stage: "solicitud",
          actor: requester,
          consentText: "Firma de solicitante reconstruida por backfill de trazabilidad legal",
          payloadSnapshot: {
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
            justificacion_requerida: row.justificacion_requerida,
            justificantes_urls: row.justificantes_urls || [],
            observaciones: row.observaciones || [],
            aprobacion_parcial_at: row.aprobacion_parcial_at,
            aprobacion_final_at: row.aprobacion_final_at,
            updated_at: row.updated_at,
          },
          signedAt: row.created_at || nowIso(),
        });
        stats.solicitudSignaturesAdded += 1;
      }
    }

    const decisionStage = row.status === "approved" ? "aprobacion_final" : "rechazo";
    const hasDecision = await stageExists("permisos_vacaciones_firmas", row.id, decisionStage);
    if (!hasDecision) {
      let approver = row.approver_user_id ? await getUserById(row.approver_user_id) : null;
      if (!approver && row.approver_email) approver = await getUserByEmail(row.approver_email);
      if (!approver && row.approver_role) approver = await getUserByRole(row.approver_role);
      if (!approver && row.aprobacion_final_por) {
        approver = await resolveActorFromText(row.aprobacion_final_por, row.approver_role || null);
      }
      if (!approver) {
        stats.skippedNoApprover += 1;
      } else {
        await insertSignature({
          tableName: "permisos_vacaciones_firmas",
          solicitudId: row.id,
          stage: decisionStage,
          actor: approver,
          consentText:
            decisionStage === "aprobacion_final"
              ? "Aprobación final reconstruida por backfill de trazabilidad legal"
              : "Rechazo reconstruido por backfill de trazabilidad legal",
          payloadSnapshot: {
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
            justificacion_requerida: row.justificacion_requerida,
            justificantes_urls: row.justificantes_urls || [],
            observaciones: row.observaciones || [],
            aprobacion_parcial_at: row.aprobacion_parcial_at,
            aprobacion_final_at: row.aprobacion_final_at,
            updated_at: row.updated_at,
          },
          signedAt: row.aprobacion_final_at || row.updated_at || nowIso(),
        });
        stats.decisionSignaturesAdded += 1;
      }
    }

    if (canUseDrive && !row.pdf_validacion_legal_url) {
      const signatures = await listPermisosSignatures(row.id);
      if (signatures.length > 0) {
        const legalPdfUrl = await generateFirmaLegalValidationPdf({
          solicitud: {
            ...row,
            user_fullname: row.user_fullname,
            approver_fullname: row.aprobacion_final_por || null,
          },
          signatures,
          verification: {
            token,
            url: buildPermisosVerificationUrl(token),
          },
        });
        if (legalPdfUrl) {
          await db.query(
            `UPDATE permisos_vacaciones
                SET pdf_validacion_legal_url = $2,
                    updated_at = NOW()
              WHERE id = $1`,
            [row.id, legalPdfUrl]
          );
          stats.legalPdfsAdded += 1;
        }
      }
    }
  }

  return stats;
}

async function backfillVacaciones() {
  const stats = {
    totalClosed: 0,
    tokensAdded: 0,
    solicitudSignaturesAdded: 0,
    decisionSignaturesAdded: 0,
    legalPdfsAdded: 0,
    skippedNoApprover: 0,
  };

  const { rows } = await db.query(
    `SELECT v.*, u.email AS requester_email, COALESCE(NULLIF(u.fullname,''), NULLIF(u.name,''), u.email) AS requester_name
       FROM vacaciones_solicitudes v
       LEFT JOIN users u ON u.id = v.requester_id
      WHERE LOWER(COALESCE(v.status, '')) IN ('aprobado', 'approved', 'rechazado', 'rejected')
      ORDER BY v.id ASC`
  );
  stats.totalClosed = rows.length;

  for (const row of rows) {
    let token = row.legal_verification_token;
    if (!token) {
      token = generateToken();
      await db.query(
        `UPDATE vacaciones_solicitudes
            SET legal_verification_token = $2,
                legal_verification_created_at = COALESCE(legal_verification_created_at, NOW()),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, token]
      );
      stats.tokensAdded += 1;
    }

    const requester = row.requester_id ? await getUserById(row.requester_id) : null;
    const hasSolicitud = await stageExists("vacaciones_solicitudes_firmas", row.id, "solicitud");
    if (!hasSolicitud && requester) {
      await insertSignature({
        tableName: "vacaciones_solicitudes_firmas",
        solicitudId: row.id,
        stage: "solicitud",
        actor: requester,
        consentText: "Firma de solicitud de vacaciones reconstruida por backfill legal",
        payloadSnapshot: {
          id: row.id,
          requester_id: row.requester_id,
          approver_id: row.approver_id,
          approver_role: row.approver_role,
          start_date: row.start_date,
          end_date: row.end_date,
          return_date: row.return_date,
          days: row.days,
          status: row.status,
          updated_at: row.updated_at,
        },
        signedAt: row.created_at || nowIso(),
      });
      stats.solicitudSignaturesAdded += 1;
    }

    const isApproved = ["aprobado", "approved"].includes(String(row.status || "").toLowerCase());
    const decisionStage = isApproved ? "aprobacion_final" : "rechazo";
    const hasDecision = await stageExists("vacaciones_solicitudes_firmas", row.id, decisionStage);
    if (!hasDecision) {
      let approver = row.approver_id ? await getUserById(row.approver_id) : null;
      if (!approver && row.approver_role) approver = await getUserByRole(row.approver_role);
      if (!approver) {
        stats.skippedNoApprover += 1;
      } else {
        await insertSignature({
          tableName: "vacaciones_solicitudes_firmas",
          solicitudId: row.id,
          stage: decisionStage,
          actor: approver,
          consentText: isApproved
            ? "Aprobación de vacaciones reconstruida por backfill legal"
            : "Rechazo de vacaciones reconstruido por backfill legal",
          payloadSnapshot: {
            id: row.id,
            requester_id: row.requester_id,
            approver_id: row.approver_id,
            approver_role: row.approver_role,
            start_date: row.start_date,
            end_date: row.end_date,
            return_date: row.return_date,
            days: row.days,
            status: row.status,
            updated_at: row.updated_at,
          },
          signedAt: row.updated_at || nowIso(),
        });
        stats.decisionSignaturesAdded += 1;
      }
    }

    if (canUseDrive && !row.pdf_validacion_legal_url) {
      const signatures = await listVacacionesSignatures(row.id);
      if (signatures.length > 0) {
        const legalPdfUrl = await generateFirmaLegalValidationPdf({
          solicitud: {
            id: row.id,
            tipo_solicitud: "vacaciones",
            status: row.status,
            user_id: row.requester_id,
            user_email: row.requester_email || null,
            user_fullname: row.requester_name || null,
            approver_fullname: row.approver_role || null,
            approver_email: null,
            pdf_generado_url: row.drive_pdf_link || row.drive_doc_link || null,
            drive_folder_id: row.drive_folder_id || null,
          },
          signatures,
          verification: {
            token,
            url: buildVacacionesVerificationUrl(token),
          },
        });
        if (legalPdfUrl) {
          await db.query(
            `UPDATE vacaciones_solicitudes
                SET pdf_validacion_legal_url = $2,
                    updated_at = NOW()
              WHERE id = $1`,
            [row.id, legalPdfUrl]
          );
          stats.legalPdfsAdded += 1;
        }
      }
    }
  }

  return stats;
}

async function main() {
  console.log("[BACKFILL] Iniciando hardening legal de permisos/vacaciones");
  const permisos = await backfillPermisos();
  const vacaciones = await backfillVacaciones();
  console.log("[BACKFILL] Resultado permisos:", permisos);
  console.log("[BACKFILL] Resultado vacaciones:", vacaciones);
}

main()
  .catch((error) => {
    console.error("[BACKFILL] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch (e) {
      // noop
    }
  });
