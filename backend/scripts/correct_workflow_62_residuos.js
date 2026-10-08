"use strict";

require("dotenv").config();

const crypto = require("crypto");
const { Client } = require("pg");
const { getDbConfig } = require("./dbConnection");

const APPLY = process.argv.includes("--apply");

const EXPECTED = Object.freeze({
  workflowId: 62,
  workflowCode: "FSW-20260916-74A1C1",
  documentId: 62,
  documentVersion: 1,
  documentFinalSha256: "1d5e8a02fb716c1df6715b053b8aa46bff64fb444c8171b90034830037733390",
  leslySignerId: 307,
  leslyUserId: 59,
  danielUserId: 42,
  signerCount: 24,
});

const DANIEL_PLACEMENT = Object.freeze({
  page_number: 4,
  x_pct: 0.8151264806994264,
  y_pct: 0.25270714353192736,
});

function assertCondition(condition, message) {
  if (!condition) throw new Error(`Precondicion fallida: ${message}`);
}

async function appendEvent(client, {
  documentId = null,
  signerId = null,
  eventType,
  eventDescription,
  eventData = {},
}) {
  const { rows } = await client.query(
    `SELECT event_hash
       FROM signature_workflow_events
      WHERE workflow_id = $1
      ORDER BY id DESC
      LIMIT 1`,
    [EXPECTED.workflowId],
  );
  const previousEventHash = rows[0]?.event_hash || null;
  const payloadString = JSON.stringify({
    workflow_id: EXPECTED.workflowId,
    document_id: documentId,
    signer_id: signerId,
    event_type: eventType,
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
      EXPECTED.workflowId,
      documentId,
      signerId,
      eventType,
      eventDescription,
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
    [EXPECTED.workflowId],
  );
  const { rows: documentRows } = await client.query(
    `SELECT * FROM signature_workflow_documents
      WHERE workflow_id = $1 AND is_current = true${lockClause}`,
    [EXPECTED.workflowId],
  );
  const { rows: signerRows } = await client.query(
    `SELECT * FROM signature_workflow_signers
      WHERE workflow_id = $1
      ORDER BY sequence_order, id${lockClause}`,
    [EXPECTED.workflowId],
  );
  const { rows: danielRows } = await client.query(
    `SELECT u.id, u.email, u.fullname, u.role, u.active,
            NULLIF(TRIM(cp.profile->'personal'->>'nombres'), '') AS nombres,
            NULLIF(TRIM(cp.profile->'personal'->>'apellidos'), '') AS apellidos,
            NULLIF(TRIM(cp.profile->'personal'->>'cedula'), '') AS cedula,
            NULLIF(TRIM(cp.profile->'laboral'->>'cargo'), '') AS cargo
       FROM users u
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1`,
    [EXPECTED.danielUserId],
  );

  const workflow = workflowRows[0];
  const document = documentRows[0];
  const lesly = signerRows.find((item) => Number(item.id) === EXPECTED.leslySignerId);
  const daniel = danielRows[0];

  assertCondition(workflowRows.length === 1, "workflow 62 no es unico");
  assertCondition(workflow.workflow_code === EXPECTED.workflowCode, "workflow_code inesperado");
  assertCondition(workflow.status === "completed", `estado esperado completed, actual ${workflow.status}`);
  assertCondition(documentRows.length === 1, "debe existir exactamente un documento actual");
  assertCondition(Number(document.id) === EXPECTED.documentId, "documento actual distinto del diagnosticado");
  assertCondition(Number(document.version_num) === EXPECTED.documentVersion, "version actual distinta de 1");
  assertCondition(document.final_sha256 === EXPECTED.documentFinalSha256, "hash final v1 inesperado");
  assertCondition(signerRows.length === EXPECTED.signerCount, "cantidad de firmantes cambio");
  assertCondition(lesly, "firmante Lesly 307 no existe");
  assertCondition(Number(lesly.user_id) === EXPECTED.leslyUserId, "firmante 307 ya no corresponde a Lesly");
  assertCondition(lesly.status === "signed", `estado de Lesly inesperado: ${lesly.status}`);
  assertCondition(!signerRows.some((item) => Number(item.user_id) === EXPECTED.danielUserId), "Daniel ya fue agregado");
  assertCondition(daniel && daniel.active === true, "Daniel no existe o no esta activo");
  assertCondition(daniel.email === "daniel.fiallos@fam-project.com", "email de Daniel inesperado");
  assertCondition(daniel.cedula === "1722696554", "cedula de Daniel no coincide con la fila 20");
  assertCondition(daniel.nombres && daniel.apellidos && daniel.cargo, "ficha TH de Daniel incompleta");

  return { workflow, document, signerRows, lesly, daniel };
}

async function applyCorrection(client, state) {
  const correctionReason = "Asignacion erronea detectada: Lesly Ruiz pertenece al documento v1 del workflow 61; la fila 20 de la pagina 4 corresponde a Daniel Fiallos.";
  const correctionMeta = {
    correction_type: "replace_wrong_signer_after_completion",
    reason: correctionReason,
    previous_document_id: Number(state.document.id),
    previous_final_sha256: state.document.final_sha256,
    replaced_signer_id: EXPECTED.leslySignerId,
    replacement_user_id: EXPECTED.danielUserId,
    created_at: new Date().toISOString(),
  };

  await client.query(
    `UPDATE signature_workflow_documents
        SET is_current = false
      WHERE id = $1`,
    [state.document.id],
  );

  const { rows: newDocumentRows } = await client.query(
    `INSERT INTO signature_workflow_documents (
       workflow_id, version_num, filename, mime_type, source_sha256,
       source_storage_ref, source_drive_url, source_drive_file_id,
       source_pdf_base64, qr_token, qr_drive_url, is_current, is_frozen, meta
     )
     SELECT workflow_id,
            version_num + 1,
            regexp_replace(filename, '\\.pdf$', '', 'i') || '_CORREGIDO_V2.pdf',
            mime_type, source_sha256, source_storage_ref, source_drive_url,
            source_drive_file_id, source_pdf_base64, qr_token, qr_drive_url,
            true, false, $2::jsonb
       FROM signature_workflow_documents
      WHERE id = $1
     RETURNING *`,
    [state.document.id, JSON.stringify(correctionMeta)],
  );
  const newDocument = newDocumentRows[0];
  assertCondition(newDocument, "no se creo la version 2 del documento");

  await client.query(
    `UPDATE signature_workflow_signers
        SET status = 'replaced',
            is_required = false,
            replaced_at = NOW(),
            meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
      WHERE id = $1`,
    [
      EXPECTED.leslySignerId,
      JSON.stringify({
        exclude_from_document: true,
        replacement_reason: correctionReason,
        replaced_by_user_id: EXPECTED.danielUserId,
        original_status: state.lesly.status,
        original_document_id: Number(state.lesly.document_id),
        original_signature_placement: state.lesly.signature_placement,
      }),
    ],
  );

  const accessToken = crypto.randomBytes(24).toString("hex");
  const danielName = `${state.daniel.nombres} ${state.daniel.apellidos}`.replace(/\s+/g, " ").trim();
  const { rows: danielSignerRows } = await client.query(
    `INSERT INTO signature_workflow_signers (
       workflow_id, document_id, user_id, email_snapshot, name_snapshot,
       role_snapshot, cedula_snapshot, sequence_order, is_required, status,
       access_token, access_token_expires_at, available_at, signer_kind,
       signature_placement, meta
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,23,true,'available',$8,NOW() + INTERVAL '30 days',
       NOW(),'internal_user',$9::jsonb,$10::jsonb
     ) RETURNING *`,
    [
      EXPECTED.workflowId,
      newDocument.id,
      EXPECTED.danielUserId,
      state.daniel.email,
      danielName,
      state.daniel.cargo,
      state.daniel.cedula,
      accessToken,
      JSON.stringify(DANIEL_PLACEMENT),
      JSON.stringify({
        added_by_correction: true,
        corrected_from_signer_id: EXPECTED.leslySignerId,
        auto_placement: true,
        line_preview: "Fiallos Tayupanta Daniel Field Service",
      }),
    ],
  );
  const danielSigner = danielSignerRows[0];

  await client.query(
    `UPDATE signature_workflows
        SET status = 'partially_signed',
            completed_at = NULL,
            current_step = NULL,
            active = true,
            meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
              'correction_history',
              COALESCE(meta->'correction_history', '[]'::jsonb) || jsonb_build_array($2::jsonb)
            )
      WHERE id = $1`,
    [
      EXPECTED.workflowId,
      JSON.stringify({
        ...correctionMeta,
        new_document_id: Number(newDocument.id),
        new_signer_id: Number(danielSigner.id),
        previous_completed_at: state.workflow.completed_at,
      }),
    ],
  );

  await appendEvent(client, {
    documentId: Number(state.document.id),
    signerId: EXPECTED.leslySignerId,
    eventType: "signer_assignment_replaced",
    eventDescription: "Asignacion erronea preservada y excluida de la version corregida",
    eventData: {
      old_user_id: EXPECTED.leslyUserId,
      replacement_user_id: EXPECTED.danielUserId,
      replacement_signer_id: Number(danielSigner.id),
      reason: correctionReason,
    },
  });
  await appendEvent(client, {
    documentId: Number(newDocument.id),
    eventType: "document_correction_version_created",
    eventDescription: "Se creo la version 2 sin sobrescribir el PDF final anterior",
    eventData: {
      previous_document_id: Number(state.document.id),
      new_document_id: Number(newDocument.id),
      previous_final_sha256: state.document.final_sha256,
    },
  });
  await appendEvent(client, {
    documentId: Number(newDocument.id),
    signerId: Number(danielSigner.id),
    eventType: "signer_added_by_correction",
    eventDescription: "Daniel Fiallos fue agregado como firmante de la fila 20",
    eventData: {
      user_id: EXPECTED.danielUserId,
      placement: DANIEL_PLACEMENT,
      replaced_signer_id: EXPECTED.leslySignerId,
    },
  });
  await appendEvent(client, {
    documentId: Number(newDocument.id),
    eventType: "workflow_reopened_for_correction",
    eventDescription: "Workflow reabierto exclusivamente para la firma faltante de Daniel Fiallos",
    eventData: {
      previous_status: state.workflow.status,
      new_status: "partially_signed",
      pending_signer_id: Number(danielSigner.id),
    },
  });

  const notificationMeta = {
    template: "custom_signature_workflow_requested",
    workflow_id: String(EXPECTED.workflowId),
    workflow_code: EXPECTED.workflowCode,
    signer_id: String(danielSigner.id),
    target_path: `/dashboard/signatures/workflows/${EXPECTED.workflowId}`,
    cta_label: "Abrir workflow de firma",
    correction: true,
    document_summary: newDocument.filename,
  };
  const { rows: notificationRows } = await client.query(
    `INSERT INTO notifications (
       user_id, title, message, type, source, status, priority, meta
     ) VALUES ($1,$2,$3,'task','signature_workflows','unread',2,$4::jsonb)
     RETURNING id`,
    [
      EXPECTED.danielUserId,
      "Firma requerida: Capacitación manejo de residuos",
      "Se corrigio la lista de firmantes. Tu firma esta pendiente en la fila 20 de la pagina 4.",
      JSON.stringify(notificationMeta),
    ],
  );

  return {
    workflow_id: EXPECTED.workflowId,
    workflow_status: "partially_signed",
    previous_document_id: Number(state.document.id),
    new_document_id: Number(newDocument.id),
    previous_final_sha256: state.document.final_sha256,
    replaced_signer_id: EXPECTED.leslySignerId,
    daniel_signer_id: Number(danielSigner.id),
    daniel_user_id: EXPECTED.danielUserId,
    daniel_status: danielSigner.status,
    daniel_placement: danielSigner.signature_placement,
    notification_id: notificationRows[0]?.id || null,
  };
}

async function main() {
  // Este script corrige produccion despues de la migracion 2026-09-28. No usa
  // DATABASE_URL porque algunos entornos locales conservan una URL historica.
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
        workflow_id: Number(state.workflow.id),
        current_document_id: Number(state.document.id),
        current_final_sha256: state.document.final_sha256,
        signer_count: state.signerRows.length,
        lesly_signer_id: Number(state.lesly.id),
        daniel_user_id: Number(state.daniel.id),
        planned_placement: DANIEL_PLACEMENT,
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
