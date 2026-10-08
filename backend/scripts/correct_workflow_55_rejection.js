"use strict";

require("dotenv").config();

const crypto = require("crypto");
const { Client } = require("pg");
const { getDbConfig } = require("./dbConnection");

const APPLY = process.argv.includes("--apply");
const WORKFLOW_ID = 55;
const WORKFLOW_CODE = "FSW-20260903-941455";
const EVELYN_SIGNER_ID = 241;
const SOURCE_SHA256 = "434bb20424fe4085cf0d2b2c096c74f042887d1fee5d92595d19f215678051af";

function assertCondition(condition, message) {
  if (!condition) throw new Error(`Precondicion fallida: ${message}`);
}

async function appendCorrectionEvent(client, documentId, pendingSignerIds) {
  const { rows } = await client.query(
    `SELECT event_hash
       FROM signature_workflow_events
      WHERE workflow_id = $1
      ORDER BY id DESC
      LIMIT 1`,
    [WORKFLOW_ID],
  );
  const previousEventHash = rows[0]?.event_hash || null;
  const eventData = {
    rejected_signer_id: EVELYN_SIGNER_ID,
    pending_signer_ids: pendingSignerIds,
    previous_workflow_status: "rejected",
    new_workflow_status: "partially_signed",
    reason: "En firma paralela el rechazo individual de Evelyn Rojas no debe bloquear a los demas firmantes.",
  };
  const payloadString = JSON.stringify({
    workflow_id: WORKFLOW_ID,
    document_id: documentId,
    signer_id: EVELYN_SIGNER_ID,
    event_type: "workflow_reopened_after_individual_rejection",
    event_data: eventData,
    previous_event_hash: previousEventHash,
  });
  const eventHash = crypto
    .createHash("sha256")
    .update(`${previousEventHash || ""}:${payloadString}`)
    .digest("hex");

  await client.query(
    `INSERT INTO signature_workflow_events (
       workflow_id, document_id, signer_id, event_type, event_description,
       event_data, event_hash, previous_event_hash, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NULL)`,
    [
      WORKFLOW_ID,
      documentId,
      EVELYN_SIGNER_ID,
      "workflow_reopened_after_individual_rejection",
      "Workflow paralelo reactivado; se conserva exclusivamente el rechazo de Evelyn Rojas",
      JSON.stringify(eventData),
      eventHash,
      previousEventHash,
    ],
  );
}

async function loadAndValidate(client, { lock = false } = {}) {
  const lockClause = lock ? " FOR UPDATE" : "";
  const { rows: workflowRows } = await client.query(
    `SELECT * FROM signature_workflows WHERE id = $1${lockClause}`,
    [WORKFLOW_ID],
  );
  const { rows: documentRows } = await client.query(
    `SELECT * FROM signature_workflow_documents
      WHERE workflow_id = $1 AND is_current = true${lockClause}`,
    [WORKFLOW_ID],
  );
  const { rows: signers } = await client.query(
    `SELECT * FROM signature_workflow_signers
      WHERE workflow_id = $1
      ORDER BY sequence_order,id${lockClause}`,
    [WORKFLOW_ID],
  );

  const workflow = workflowRows[0];
  const document = documentRows[0];
  const evelyn = signers.find((item) => Number(item.id) === EVELYN_SIGNER_ID);
  const signed = signers.filter((item) => item.status === "signed");
  const rejected = signers.filter((item) => item.status === "rejected");
  const available = signers.filter((item) => item.status === "available");

  assertCondition(workflowRows.length === 1, "workflow 55 no es unico");
  assertCondition(workflow.workflow_code === WORKFLOW_CODE, "workflow_code inesperado");
  assertCondition(workflow.status === "rejected", `estado esperado rejected, actual ${workflow.status}`);
  assertCondition(workflow.completed_at === null, "workflow ya tiene completed_at");
  assertCondition(documentRows.length === 1, "documento actual inesperado");
  assertCondition(document.source_sha256 === SOURCE_SHA256, "hash del documento inesperado");
  assertCondition(document.finalized_at === null && !document.final_pdf_base64, "documento ya finalizado");
  assertCondition(signers.length === 25, "cantidad de firmantes distinta de 25");
  assertCondition(signed.length === 20, "cantidad firmada distinta de 20");
  assertCondition(rejected.length === 1, "debe existir exactamente un rechazo");
  assertCondition(available.length === 4, "cantidad disponible distinta de 4");
  assertCondition(evelyn && Number(evelyn.user_id) === 13, "el unico rechazo no corresponde a Evelyn Rojas");
  assertCondition(evelyn.status === "rejected", "Evelyn no conserva estado rejected");
  assertCondition(Boolean(evelyn.rejection_reason), "falta el motivo original del rechazo");

  return { workflow, document, evelyn, signed, rejected, available };
}

async function applyCorrection(client, state) {
  const correctedAt = new Date().toISOString();
  const pendingSignerIds = state.available.map((item) => Number(item.id));
  const correction = {
    correction_type: "parallel_rejection_reopened",
    corrected_at: correctedAt,
    rejected_signer_id: EVELYN_SIGNER_ID,
    preserved_rejection_reason: state.evelyn.rejection_reason,
    pending_signer_ids: pendingSignerIds,
    previous_rejected_at: state.workflow.rejected_at,
  };

  await client.query(
    `UPDATE signature_workflows
        SET status = 'partially_signed',
            rejected_at = NULL,
            current_step = NULL,
            active = true,
            meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
              'correction_history',
              COALESCE(meta->'correction_history', '[]'::jsonb) || jsonb_build_array($2::jsonb)
            )
      WHERE id = $1`,
    [WORKFLOW_ID, JSON.stringify(correction)],
  );

  await appendCorrectionEvent(client, Number(state.document.id), pendingSignerIds);

  const notifications = [];
  for (const signer of state.available) {
    const meta = {
      template: "custom_signature_workflow_requested",
      workflow_id: String(WORKFLOW_ID),
      workflow_code: WORKFLOW_CODE,
      signer_id: String(signer.id),
      target_path: `/dashboard/signatures/workflows/${WORKFLOW_ID}`,
      cta_label: "Continuar firma",
      correction: true,
      rejected_signer_id: String(EVELYN_SIGNER_ID),
    };
    const { rows } = await client.query(
      `INSERT INTO notifications (
         user_id, title, message, type, source, status, priority, meta
       ) VALUES ($1,$2,$3,'task','signature_workflows','unread',2,$4::jsonb)
       RETURNING id`,
      [
        signer.user_id,
        "Firma nuevamente disponible: Gestión del Tiempo y Organización",
        "El rechazo de otra persona ya no bloquea el workflow. Puedes continuar con tu firma pendiente.",
        JSON.stringify(meta),
      ],
    );
    notifications.push({ user_id: Number(signer.user_id), signer_id: Number(signer.id), notification_id: rows[0].id });
  }

  return {
    workflow_id: WORKFLOW_ID,
    status: "partially_signed",
    signed_unchanged: state.signed.length,
    rejected_signer_id: EVELYN_SIGNER_ID,
    rejected_status: state.evelyn.status,
    available_signer_ids: pendingSignerIds,
    notifications,
  };
}

async function main() {
  delete process.env.DATABASE_URL;
  process.env.DB_HOST = "ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech";
  process.env.DB_NAME = "FamSPI";
  const client = new Client(getDbConfig());
  await client.connect();
  try {
    if (!APPLY) {
      const state = await loadAndValidate(client);
      console.log(JSON.stringify({
        dry_run: true,
        preconditions: "ok",
        workflow_id: WORKFLOW_ID,
        current_status: state.workflow.status,
        signed: state.signed.length,
        rejected: state.rejected.map((item) => ({ id: Number(item.id), name: item.name_snapshot })),
        available: state.available.map((item) => ({ id: Number(item.id), name: item.name_snapshot })),
      }, null, 2));
      return;
    }

    await client.query("BEGIN");
    const state = await loadAndValidate(client, { lock: true });
    const result = await applyCorrection(client, state);
    await client.query("COMMIT");
    console.log(JSON.stringify({ applied: true, ...result }, null, 2));
  } catch (error) {
    if (APPLY) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
