const crypto = require("crypto");
const db = require("../src/config/db");
const { generateFRH10 } = require("../src/modules/permisos/permisos.pdf");

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

const WORKFLOW_SIGNATURE_STAGES = {
  SOLICITUD: "solicitud",
  APROBACION_FINAL: "aprobacion_final",
  RECHAZO: "rechazo",
  APROBACION_PARCIAL: "aprobacion_parcial",
};

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

function generateLegalVerificationToken() {
  return crypto.randomBytes(24).toString("hex");
}

function buildLegalVerificationUrl(token) {
  if (!token) return null;
  return `${String(LEGAL_VERIFICATION_BASE_URL).replace(/\/+$/, "")}/api/v1/permisos/legal-verification/${token}`;
}

function buildPdfSignatureText(signature, fallbackName = "") {
  const signerName = String(signature?.signer_name || fallbackName || "").trim();
  if (!signerName) return "";
  return `/s/ ${signerName}`;
}

function buildWorkflowSignatureSummary(signatures = []) {
  const byStage = signatures.reduce((acc, signature) => {
    acc[signature.stage] = signature;
    return acc;
  }, {});
  const solicitud = byStage[WORKFLOW_SIGNATURE_STAGES.SOLICITUD] || null;
  const aprobacion =
    byStage[WORKFLOW_SIGNATURE_STAGES.APROBACION_FINAL] ||
    byStage[WORKFLOW_SIGNATURE_STAGES.RECHAZO] ||
    byStage[WORKFLOW_SIGNATURE_STAGES.APROBACION_PARCIAL] ||
    null;
  const signedStages = Object.keys(byStage).length;

  return {
    estado: signedStages >= 2 ? "completa" : signedStages === 1 ? "parcial" : "pendiente",
    signed_stages: signedStages,
    solicitud_firmada: Boolean(solicitud),
    aprobacion_firmada: Boolean(aprobacion),
    solicitud,
    aprobacion,
    timeline: signatures,
  };
}

async function getUserIdentity(userId) {
  if (!userId) return null;
  try {
    const { rows } = await db.query(
      `SELECT
          u.id,
          u.email,
          COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS fullname,
          cp.profile->'personal'->>'cedula' AS cedula
        FROM users u
        LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
        WHERE u.id = $1
        LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  } catch (error) {
    const { rows } = await db.query(
      `SELECT
          u.id,
          u.email,
          COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS fullname,
          NULL::text AS cedula
        FROM users u
        WHERE u.id = $1
        LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }
}

async function getSignaturesBySolicitudId(solicitudId) {
  const { rows } = await db.query(
    `SELECT id, solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
            signature_type, auth_method, consent_text, ip_address::text AS ip_address,
            user_agent, session_id, payload_hash_sha256, previous_signature_hash_sha256,
            signature_hash_sha256, is_current, signed_at, created_at
       FROM permisos_vacaciones_firmas
      WHERE solicitud_id = $1
      ORDER BY signed_at ASC, id ASC`,
    [solicitudId]
  );
  return rows;
}

async function ensureSolicitudSignature(solicitud) {
  const signatures = await getSignaturesBySolicitudId(solicitud.id);
  const hasSolicitud = signatures.some((s) => s.stage === WORKFLOW_SIGNATURE_STAGES.SOLICITUD);
  if (hasSolicitud || !solicitud.user_id) return signatures;

  const signedAt = solicitud.created_at || new Date().toISOString();
  const payloadHash = sha256Hex(
    stableStringify({
      id: solicitud.id,
      status: solicitud.status,
      tipo_solicitud: solicitud.tipo_solicitud,
      tipo_permiso: solicitud.tipo_permiso,
      fecha_inicio: solicitud.fecha_inicio,
      fecha_fin: solicitud.fecha_fin,
      updated_at: solicitud.updated_at,
    })
  );

  const { rows: previousRows } = await db.query(
    `SELECT signature_hash_sha256
       FROM permisos_vacaciones_firmas
      WHERE solicitud_id = $1
      ORDER BY signed_at DESC, id DESC
      LIMIT 1`,
    [solicitud.id]
  );
  const previousHash = previousRows[0]?.signature_hash_sha256 || null;

  const requester = await getUserIdentity(solicitud.user_id);
  const signatureHash = sha256Hex(
    stableStringify({
      solicitud_id: solicitud.id,
      stage: WORKFLOW_SIGNATURE_STAGES.SOLICITUD,
      signer_user_id: solicitud.user_id,
      signer_email: solicitud.user_email || requester?.email || null,
      signed_at: signedAt,
      payload_hash_sha256: payloadHash,
      previous_signature_hash_sha256: previousHash,
    })
  );

  await db.query(
    `INSERT INTO permisos_vacaciones_firmas (
      solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
      signature_type, auth_method, consent_text, ip_address, user_agent, session_id,
      payload_hash_sha256, previous_signature_hash_sha256, signature_hash_sha256, is_current, signed_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'advanced_electronic','oauth_corporate',$7,$8,$9,$10,$11,$12,$13,true,$14)`,
    [
      solicitud.id,
      WORKFLOW_SIGNATURE_STAGES.SOLICITUD,
      solicitud.user_id,
      solicitud.user_email || requester?.email || null,
      requester?.fullname || solicitud.user_fullname || solicitud.user_email || `Usuario #${solicitud.user_id}`,
      "solicitante",
      "Firma de solicitante reconstruida por regeneracion de F.RH-10",
      null,
      "regenerate-frh10-signed-block/1.0",
      "regenerate-frh10-signed-block",
      payloadHash,
      previousHash,
      signatureHash,
      signedAt,
    ]
  );

  return getSignaturesBySolicitudId(solicitud.id);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const onlyMissing = process.argv.includes("--only-missing");
  const emailArg = process.argv.find((arg) => arg.startsWith("--user-email="));
  const userEmailFilter = emailArg ? String(emailArg.split("=")[1] || "").trim().toLowerCase() : null;

  const stats = {
    totalApproved: 0,
    toProcess: 0,
    regenerated: 0,
    skipped: 0,
    tokensCreated: 0,
    requesterSignaturesCreated: 0,
    failed: 0,
  };

  const query = `
    SELECT *
      FROM permisos_vacaciones
     WHERE status = 'approved'
       ${userEmailFilter ? "AND LOWER(user_email) = LOWER($1)" : ""}
     ORDER BY id ASC
  `;
  const { rows } = await db.query(query, userEmailFilter ? [userEmailFilter] : []);
  stats.totalApproved = rows.length;

  const candidates = onlyMissing
    ? rows.filter((row) => !row.pdf_generado_url)
    : rows;
  stats.toProcess = candidates.length;

  console.log(
    `[FRH10_REGEN] approved=${stats.totalApproved} to_process=${stats.toProcess} dry_run=${dryRun} force=${force} only_missing=${onlyMissing} user_email=${userEmailFilter || "ALL"}`
  );

  for (const row of candidates) {
    try {
      if (!force && row.pdf_generado_url && !onlyMissing) {
        stats.skipped += 1;
        continue;
      }

      let token = row.legal_verification_token;
      if (!token) {
        token = generateLegalVerificationToken();
        if (!dryRun) {
          await db.query(
            `UPDATE permisos_vacaciones
                SET legal_verification_token = $2,
                    legal_verification_created_at = COALESCE(legal_verification_created_at, NOW()),
                    updated_at = NOW()
              WHERE id = $1`,
            [row.id, token]
          );
        }
        stats.tokensCreated += 1;
      }

      const signaturesBefore = await getSignaturesBySolicitudId(row.id);
      const hasRequesterBefore = signaturesBefore.some((s) => s.stage === WORKFLOW_SIGNATURE_STAGES.SOLICITUD);
      let signatures = signaturesBefore;

      if (!hasRequesterBefore && row.user_id && !dryRun) {
        signatures = await ensureSolicitudSignature(row);
        stats.requesterSignaturesCreated += 1;
      }

      const workflowSummary = buildWorkflowSignatureSummary(signatures);
      const solicitudSignature = workflowSummary.solicitud || null;
      const finalSignature = workflowSummary.aprobacion || null;

      const requesterIdentity = await getUserIdentity(row.user_id).catch(() => null);
      const approverIdentity = await getUserIdentity(row.approver_user_id).catch(() => null);
      const approverName =
        approverIdentity?.fullname ||
        row.aprobacion_final_por ||
        row.approver_email ||
        row.approver_role ||
        "Aprobador";

      const payload = {
        ...row,
        user_fullname: requesterIdentity?.fullname || row.user_fullname || row.user_email,
        user_document_id: requesterIdentity?.cedula || "",
        approver_fullname: approverName,
        approver_document_id: approverIdentity?.cedula || "",
        aprobacion_final_por: approverName,
        firma_solicitante_texto: buildPdfSignatureText(
          solicitudSignature,
          requesterIdentity?.fullname || row.user_fullname || row.user_email
        ),
        firma_aprobador_texto: buildPdfSignatureText(finalSignature, approverName),
        firma_workflow_estado: workflowSummary?.estado || "pendiente",
        firma_solicitante_at: solicitudSignature?.signed_at || null,
        firma_aprobador_at: finalSignature?.signed_at || null,
        firma_solicitante_hash: solicitudSignature?.signature_hash_sha256 || null,
        firma_aprobador_hash: finalSignature?.signature_hash_sha256 || null,
        firma_aprobador_prev_hash: finalSignature?.previous_signature_hash_sha256 || null,
        legal_verification_token: token,
        legal_verification_url: buildLegalVerificationUrl(token),
        workflow_signature_summary: workflowSummary,
      };

      if (dryRun) {
        stats.regenerated += 1;
        continue;
      }

      const pdfUrl = await generateFRH10(payload);
      if (!pdfUrl) {
        stats.failed += 1;
        console.error(`[FRH10_REGEN][${row.id}] no se pudo generar PDF`);
        continue;
      }

      await db.query(
        `UPDATE permisos_vacaciones
            SET pdf_generado_url = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, pdfUrl]
      );
      stats.regenerated += 1;
      console.log(`[FRH10_REGEN][${row.id}] regenerado`);
    } catch (error) {
      stats.failed += 1;
      console.error(`[FRH10_REGEN][${row.id}] error:`, error.message);
    }
  }

  console.log("[FRH10_REGEN] resumen", stats);
}

main()
  .catch((error) => {
    console.error("[FRH10_REGEN] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch (_) {
      // noop
    }
  });
