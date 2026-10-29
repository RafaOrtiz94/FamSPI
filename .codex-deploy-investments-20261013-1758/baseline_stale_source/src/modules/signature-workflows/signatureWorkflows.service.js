const crypto = require("crypto");
const { PDFDocument } = require("pdf-lib");
const db = require("../../config/db");
const { appendSignatureBlock } = require("./signatureWorkflows.pdf");
const { uploadBase64File, ensureFolder } = require("../../utils/drive");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");
const { sendMail } = require("../../utils/mailer");

const FRONTEND_BASE_URL =
  process.env.APP_FRONTEND_URL ||
  process.env.FRONTEND_URL ||
  process.env.APP_BASE_URL ||
  "https://fam-spi-front.web.app";
const FAMSIGN_DRIVE_ROOT = process.env.DRIVE_FAMSIGN_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID || null;

const WORKFLOW_STATUS = {
  PREPARED: "prepared",
  SENT: "sent",
  IN_PROGRESS: "in_progress",
  PARTIALLY_SIGNED: "partially_signed",
  COMPLETED: "completed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
};

const SIGNER_STATUS = {
  PENDING: "pending",
  AVAILABLE: "available",
  OPENED: "opened",
  SIGNED: "signed",
  REJECTED: "rejected",
};

const ACTIVE_SIGNING_WORKFLOW_STATUSES = new Set([
  WORKFLOW_STATUS.SENT,
  WORKFLOW_STATUS.IN_PROGRESS,
  WORKFLOW_STATUS.PARTIALLY_SIGNED,
]);

function isSignerActionableInParallel({ workflow, signer }) {
  const signerStatus = String(signer?.status || "").toLowerCase();
  const workflowStatus = String(workflow?.status || "").toLowerCase();
  return (
    [SIGNER_STATUS.PENDING, SIGNER_STATUS.AVAILABLE, SIGNER_STATUS.OPENED].includes(signerStatus) &&
    ACTIVE_SIGNING_WORKFLOW_STATUSES.has(workflowStatus)
  );
}

const normalizeRoleName = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const collectUserRoles = (user = {}) => {
  const roles = new Set();
  const pushRole = (value) => {
    const normalized = normalizeRoleName(value);
    if (normalized) roles.add(normalized);
  };
  pushRole(user.role);
  pushRole(user.scope);
  pushRole(user.role_name);
  if (Array.isArray(user.roles)) user.roles.forEach(pushRole);
  if (Array.isArray(user.scopes)) user.scopes.forEach(pushRole);
  return roles;
};

const isAdminLike = (user = {}) => {
  const roles = collectUserRoles(user);
  return roles.has("admin") || roles.has("administrador");
};

const buildWorkflowCode = () =>
  `FSW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

const buildToken = () => crypto.randomBytes(24).toString("hex");

function getWorkflowSigningPath(workflowId) {
  return `/dashboard/signatures/workflows/${workflowId}`;
}

function getWorkflowSigningUrl(workflowId) {
  return `${String(FRONTEND_BASE_URL || "").replace(/\/$/, "")}${getWorkflowSigningPath(workflowId)}`;
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function summarizeWorkflowDocuments(documents = []) {
  const filenames = documents
    .map((document) => String(document?.filename || "").trim())
    .filter(Boolean);
  if (!filenames.length) return "Documento de firma";
  if (filenames.length <= 3) return filenames.join(", ");
  return `${filenames.slice(0, 3).join(", ")} y ${filenames.length - 3} mas`;
}

async function notifyWorkflowSignersAvailable({ workflow, signers = [], documents = [], actorUser = {} } = {}) {
  if (!workflow?.id || !Array.isArray(signers) || !signers.length) return;

  const signingPath = getWorkflowSigningPath(workflow.id);
  const signingUrl = getWorkflowSigningUrl(workflow.id);
  const workflowTitle = String(workflow.title || workflow.workflow_code || "Workflow de firma").trim();
  const documentSummary = summarizeWorkflowDocuments(documents);
  const actorLabel = actorUser?.fullname || actorUser?.name || actorUser?.email || "FamSign";
  const subject = `Firma requerida: ${workflowTitle}`;
  const message =
    `${actorLabel} solicito tu firma en FamSign para "${workflowTitle}". ` +
    `Documentos: ${documentSummary}. Ingresa al workflow para revisar y firmar.`;
  const processKey = `signature_workflow:${workflow.id}`;

  const notifySigner = async (signer) => {
    const email = String(signer?.email_snapshot || "").trim().toLowerCase();
    const signerName = signer?.name_snapshot || "Firmante";
    const userId = Number(signer?.user_id || 0);
    if (userId > 0) {
      return notificationManager.sendNotificationSafe({
        userId,
        template: "custom_signature_workflow_requested",
        customTitle: subject,
        customMessage: message,
        type: "task",
        priority: 2,
        email: true,
        chat: false,
        source: "signature_workflows",
        meta: {
          process_key: processKey,
          workflow_id: workflow.id,
          workflow_code: workflow.workflow_code || null,
          target_path: signingPath,
          cta_label: "Abrir workflow de firma",
          email_subject: subject,
          signer_id: signer.id || null,
        },
        data: {
          process_key: processKey,
          workflow_id: workflow.id,
          workflow_code: workflow.workflow_code || null,
          target_path: signingPath,
          cta_label: "Abrir workflow de firma",
          email_subject: subject,
          document_summary: documentSummary,
        },
      });
    }

    if (!email) return null;

    const schedule = typeof notificationManager.getEmailScheduleState === "function"
      ? notificationManager.getEmailScheduleState()
      : { allowed: true };
    if (!schedule.allowed) {
      logger.info(
        {
          workflowId: workflow.id,
          signerEmail: email,
          nextAllowedAt: schedule.nextAllowedAt?.toISOString?.() || null,
        },
        "[FAMSIGN] No se genera correo a firmante externo fuera de horario laborable",
      );
      return null;
    }

    return sendMail({
      to: email,
      subject,
      html: `
        <p>Hola ${escapeHtml(signerName)},</p>
        <p>${escapeHtml(message)}</p>
        <p><a href="${escapeHtml(signingUrl)}">${escapeHtml(signingUrl)}</a></p>
        <p>Este mensaje fue generado automaticamente por Famproject Cia. Ltda.</p>
      `,
      source: "signature_workflows",
    });
  };

  const results = await Promise.allSettled(signers.map(notifySigner));
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    logger.warn(
      {
        workflowId: workflow.id,
        failedNotifications: rejected.length,
        totalSigners: signers.length,
        errors: rejected.map((result) => result.reason?.message || String(result.reason)).slice(0, 5),
      },
      "[FAMSIGN] Algunos firmantes no pudieron ser notificados",
    );
  }
}

/**
 * Resuelve los datos de un firmante desde collaborator_profiles (ficha TH).
 * Fallback a users.fullname / users.role si no hay ficha.
 * Fuente de verdad: personal.nombres + apellidos, laboral.cargo, personal.cedula
 */
async function resolveSignerSnapshot(userId, dbOrClient = db) {
  if (!userId) return null;
  const { rows } = await dbOrClient.query(
    `SELECT u.email, u.fullname, u.role,
            NULLIF(TRIM(cp.profile->'personal'->>'nombres'),   '') AS nombres,
            NULLIF(TRIM(cp.profile->'personal'->>'apellidos'), '') AS apellidos,
            NULLIF(TRIM(cp.profile->'personal'->>'cedula'),    '') AS cedula,
            NULLIF(TRIM(cp.profile->'laboral'->>'cargo'),      '') AS cargo
       FROM users u
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [userId]
  );
  const u = rows[0];
  if (!u) return null;
  const fullName = (u.nombres && u.apellidos)
    ? `${u.nombres} ${u.apellidos}`
    : (u.nombres || u.apellidos || u.fullname || u.email);
  return {
    email:   u.email,
    name:    fullName,
    role:    u.cargo || u.role || "colaborador",
    cedula:  u.cedula || null,
  };
}

/**
 * Resolves nombre, cedula, cargo from ficha TH.
 * Throws 422 if the collaborator_profiles record is missing any required field.
 * Use this before generating any acta — ficha is the single source of truth.
 */
async function resolveRecipientOrThrow(userId, dbOrClient = db) {
  if (!userId) {
    const err = new Error("ID de usuario requerido para generar el acta");
    err.status = 400;
    throw err;
  }
  const { rows } = await dbOrClient.query(
    `SELECT u.email,
            NULLIF(TRIM(cp.profile->'personal'->>'nombres'),   '') AS nombres,
            NULLIF(TRIM(cp.profile->'personal'->>'apellidos'), '') AS apellidos,
            NULLIF(TRIM(cp.profile->'personal'->>'cedula'),    '') AS cedula,
            NULLIF(TRIM(cp.profile->'laboral'->>'cargo'),      '') AS cargo
       FROM users u
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [userId],
  );
  if (!rows.length) {
    const err = new Error("Colaborador no encontrado");
    err.status = 404;
    throw err;
  }
  const u = rows[0];
  const missing = [];
  if (!u.nombres)   missing.push("Nombres");
  if (!u.apellidos) missing.push("Apellidos");
  if (!u.cedula)    missing.push("Cedula");
  if (!u.cargo)     missing.push("Cargo");
  if (missing.length) {
    const err = new Error(
      `La ficha de Talento Humano del colaborador (${u.email || `ID:${userId}`}) esta incompleta. ` +
      `Campos faltantes: ${missing.join(", ")}. Solicite a TH completar la ficha antes de generar el acta.`
    );
    err.status = 422;
    err.missingFields = missing;
    throw err;
  }
  return {
    nombre: `${u.nombres} ${u.apellidos}`.trim(),
    cedula: u.cedula,
    cargo:  u.cargo,
  };
}

async function appendEvent(client, { workflowId, documentId = null, signerId = null, eventType, eventDescription = null, eventData = {}, createdBy = null }) {
  const { rows: previousRows } = await client.query(
    `SELECT event_hash
       FROM signature_workflow_events
      WHERE workflow_id = $1
      ORDER BY id DESC
      LIMIT 1`,
    [workflowId]
  );
  const previousEventHash = previousRows[0]?.event_hash || null;
  const payloadString = JSON.stringify({
    workflow_id: workflowId,
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
      workflow_id, document_id, signer_id, event_type, event_description, event_data,
      event_hash, previous_event_hash, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
    [
      workflowId,
      documentId,
      signerId,
      eventType,
      eventDescription,
      JSON.stringify(eventData || {}),
      eventHash,
      previousEventHash,
      createdBy,
    ]
  );
}

async function syncSourceRecord(client, workflow, currentDocument = null, signers = []) {
  if (!workflow?.source_module || !workflow?.source_entity_id) return;

  const workflowStatus = String(workflow.status || "").toLowerCase();
  const isCompleted = workflowStatus === WORKFLOW_STATUS.COMPLETED;
  const lastSigner = [...signers]
    .filter((item) => item.signed_at)
    .sort((a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime())[0] || null;

  if (workflow.source_module === "collab-deliveries" && workflow.source_entity === "acta") {
    const { rowCount } = await client.query(
      `UPDATE collab_delivery_actas
          SET signature_workflow_status = $2,
              final_verification_token = $3,
              final_pdf_generated_at = CASE WHEN $4 THEN NOW() ELSE final_pdf_generated_at END,
              is_complete = CASE WHEN $4 THEN true ELSE is_complete END,
              signed_at = CASE WHEN $4 THEN COALESCE(signed_at, NOW()) ELSE signed_at END,
              signed_by = CASE WHEN $4 THEN COALESCE(signed_by, $5) ELSE signed_by END,
              signed_pdf_filename = CASE WHEN $4 THEN COALESCE(signed_pdf_filename, $6) ELSE signed_pdf_filename END,
              signed_pdf_sha256 = CASE WHEN $4 THEN COALESCE(signed_pdf_sha256, $7) ELSE signed_pdf_sha256 END
        WHERE id = $1`,
      [
        workflow.source_entity_id,
        workflowStatus,
        workflow.verification_token || null,
        isCompleted,
        lastSigner?.user_id || null,
        currentDocument?.filename ? `signed-${currentDocument.filename}` : null,
        currentDocument?.final_sha256 || currentDocument?.source_sha256 || null,
      ]
    );
    if (!rowCount) {
      console.warn(`[syncSourceRecord] collab-deliveries: no acta updated for source_entity_id=${workflow.source_entity_id}, workflowId=${workflow.id}`);
    }
    return;
  }

  if (workflow.source_module === "ti-assets" && workflow.source_entity === "acta") {
    const { rowCount } = await client.query(
      `UPDATE ti_asset_actas
          SET signature_workflow_status = $2,
              final_verification_token = $3,
              final_pdf_generated_at = CASE WHEN $4 THEN NOW() ELSE final_pdf_generated_at END,
              is_complete = CASE WHEN $4 THEN true ELSE is_complete END,
              signed_at = CASE WHEN $4 THEN COALESCE(signed_at, NOW()) ELSE signed_at END,
              signed_by = CASE WHEN $4 THEN COALESCE(signed_by, $5) ELSE signed_by END,
              signed_pdf_filename = CASE WHEN $4 THEN COALESCE(signed_pdf_filename, $6) ELSE signed_pdf_filename END,
              signed_pdf_sha256 = CASE WHEN $4 THEN COALESCE(signed_pdf_sha256, $7) ELSE signed_pdf_sha256 END
        WHERE id = $1`,
      [
        workflow.source_entity_id,
        workflowStatus,
        workflow.verification_token || null,
        isCompleted,
        lastSigner?.user_id || null,
        currentDocument?.filename ? `signed-${currentDocument.filename}` : null,
        currentDocument?.final_sha256 || currentDocument?.source_sha256 || null,
      ]
    );
    if (!rowCount) {
      console.warn(`[syncSourceRecord] ti-assets: no acta updated for source_entity_id=${workflow.source_entity_id}, workflowId=${workflow.id}`);
    }
    return;
  }

  // ── Trainings: workflow principal de asistentes ──────────────────────────
  if (workflow.source_module === "trainings" && workflow.source_entity === "acta") {
    const { rowCount } = await client.query(
      `UPDATE trainings
          SET signature_workflow_id     = $2,
              signature_workflow_status = $3,
              final_verification_token  = $4,
              final_pdf_generated_at    = CASE WHEN $5 THEN NOW() ELSE final_pdf_generated_at END,
              updated_at                = NOW()
        WHERE id = $1`,
      [
        workflow.source_entity_id,
        workflow.id,
        workflowStatus,
        workflow.verification_token || null,
        isCompleted,
      ]
    );
    if (!rowCount) {
      console.warn(`[syncSourceRecord] trainings/acta: no training updated for id=${workflow.source_entity_id}`);
    }
    // Sync estado de firma por asistente
    for (const s of signers.filter((x) => x.signed_at || x.status === "rejected")) {
      if (s.user_id) {
        await client.query(
          `UPDATE training_attendees
              SET signature_status = $1, signed_at = $2
            WHERE training_id = $3 AND user_id = $4`,
          [s.status, s.signed_at || null, workflow.source_entity_id, s.user_id]
        );
      } else {
        await client.query(
          `UPDATE training_attendees
              SET signature_status = $1, signed_at = $2
            WHERE training_id = $3 AND email_snapshot = $4`,
          [s.status, s.signed_at || null, workflow.source_entity_id, s.email_snapshot]
        );
      }
    }
    return;
  }

  // ── Trainings: workflow de inasistentes ───────────────────────────────────
  if (workflow.source_module === "trainings" && workflow.source_entity === "acta_inasistentes") {
    const { rowCount } = await client.query(
      `UPDATE trainings
          SET absent_workflow_id            = $2,
              absent_workflow_status        = $3,
              absent_verification_token     = $4,
              absent_final_pdf_generated_at = CASE WHEN $5 THEN NOW() ELSE absent_final_pdf_generated_at END,
              updated_at                    = NOW()
        WHERE id = $1`,
      [
        workflow.source_entity_id,
        workflow.id,
        workflowStatus,
        workflow.verification_token || null,
        isCompleted,
      ]
    );
    if (!rowCount) {
      console.warn(`[syncSourceRecord] trainings/acta_inasistentes: no training updated for id=${workflow.source_entity_id}`);
    }
    for (const s of signers.filter((x) => x.signed_at || x.status === "rejected")) {
      if (s.user_id) {
        await client.query(
          `UPDATE training_attendees
              SET absent_signature_status = $1, absent_signed_at = $2
            WHERE training_id = $3 AND user_id = $4`,
          [s.status, s.signed_at || null, workflow.source_entity_id, s.user_id]
        );
      } else {
        await client.query(
          `UPDATE training_attendees
              SET absent_signature_status = $1, absent_signed_at = $2
            WHERE training_id = $3 AND email_snapshot = $4`,
          [s.status, s.signed_at || null, workflow.source_entity_id, s.email_snapshot]
        );
      }
    }
    return;
  }

  console.warn(`[syncSourceRecord] Unknown source_module="${workflow.source_module}" or source_entity="${workflow.source_entity}" for workflowId=${workflow.id} — source record not updated`);
}

async function getWorkflowRows(workflowId) {
  const workflowPromise = db.query(
    `SELECT *
       FROM signature_workflows
      WHERE id = $1
      LIMIT 1`,
    [workflowId]
  );
  const documentsPromise = db.query(
    `SELECT *
       FROM signature_workflow_documents
      WHERE workflow_id = $1
      ORDER BY version_num DESC, id DESC`,
    [workflowId]
  );
  const signersPromise = db.query(
    `SELECT *
       FROM signature_workflow_signers
      WHERE workflow_id = $1
      ORDER BY sequence_order ASC, id ASC`,
    [workflowId]
  );
  const eventsPromise = db.query(
    `SELECT *
       FROM signature_workflow_events
      WHERE workflow_id = $1
      ORDER BY id ASC`,
    [workflowId]
  );

  const [workflowResult, documentsResult, signersResult, eventsResult] = await Promise.all([
    workflowPromise,
    documentsPromise,
    signersPromise,
    eventsPromise,
  ]);

  return {
    workflow: workflowResult.rows[0] || null,
    documents: documentsResult.rows,
    signers: signersResult.rows,
    events: eventsResult.rows,
  };
}

async function getWorkflowRowsForClient(client, workflowId) {
  const workflowResult = await client.query(
    `SELECT *
       FROM signature_workflows
      WHERE id = $1
      LIMIT 1`,
    [workflowId]
  );
  const documentsResult = await client.query(
    `SELECT *
       FROM signature_workflow_documents
      WHERE workflow_id = $1
      ORDER BY version_num DESC, id DESC`,
    [workflowId]
  );
  const signersResult = await client.query(
    `SELECT *
       FROM signature_workflow_signers
      WHERE workflow_id = $1
      ORDER BY sequence_order ASC, id ASC`,
    [workflowId]
  );
  const eventsResult = await client.query(
    `SELECT *
       FROM signature_workflow_events
      WHERE workflow_id = $1
      ORDER BY id ASC`,
    [workflowId]
  );

  return {
    workflow: workflowResult.rows[0] || null,
    documents: documentsResult.rows,
    signers: signersResult.rows,
    events: eventsResult.rows,
  };
}

function ensureCanViewWorkflow(workflowData, user) {
  if (!workflowData.workflow) {
    const error = new Error("Workflow no encontrado");
    error.status = 404;
    throw error;
  }
  if (isAdminLike(user)) return;

  const userId = Number(user?.id || 0);
  const email = String(user?.email || "").trim().toLowerCase();
  const isCreator = workflowData.workflow.created_by && Number(workflowData.workflow.created_by) === userId;
  const isSigner = workflowData.signers.some(
    (signer) =>
      (signer.user_id && Number(signer.user_id) === userId) ||
      (email && String(signer.email_snapshot || "").trim().toLowerCase() === email)
  );

  if (!isCreator && !isSigner) {
    const error = new Error("No autorizado para ver este workflow");
    error.status = 403;
    throw error;
  }
}

function ensureCanManageWorkflow(workflowData, user) {
  if (isAdminLike(user)) return;
  if (Number(workflowData.workflow.created_by || 0) === Number(user?.id || 0)) return;
  const error = new Error("No autorizado para gestionar este workflow");
  error.status = 403;
  throw error;
}

function ensureSignerOwnership(signer, user) {
  const userId = Number(user?.id || 0);
  const email = String(user?.email || "").trim().toLowerCase();
  const matchesById = signer.user_id && Number(signer.user_id) === userId;
  const matchesByEmail = email && String(signer.email_snapshot || "").trim().toLowerCase() === email;
  if (!matchesById && !matchesByEmail && !isAdminLike(user)) {
    const error = new Error("No autorizado para actuar sobre este paso de firma");
    error.status = 403;
    throw error;
  }
}

function stripHeavyDocumentPayload(documents = []) {
  return documents.map(({ source_pdf_base64, final_pdf_base64, ...rest }) => rest);
}

async function hydrateWorkflow(workflowId, user) {
  const workflowData = await getWorkflowRows(workflowId);
  ensureCanViewWorkflow(workflowData, user);
  return {
    workflow: workflowData.workflow,
    documents: stripHeavyDocumentPayload(workflowData.documents),
    signers: workflowData.signers,
    events: workflowData.events,
  };
}

async function createWorkflow({ payload, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const workflowCode = buildWorkflowCode();
    const verificationToken = buildToken();
    const { rows: workflowRows } = await client.query(
      `INSERT INTO signature_workflows (
        workflow_code, source_module, source_entity, source_entity_id, document_type,
        title, description, status, created_by, prepared_at, verification_token, meta
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11::jsonb)
      RETURNING *`,
      [
        workflowCode,
        payload.sourceModule,
        payload.sourceEntity,
        payload.sourceEntityId,
        payload.documentType,
        payload.title,
        payload.description,
        WORKFLOW_STATUS.PREPARED,
        user.id,
        verificationToken,
        JSON.stringify(payload.meta || {}),
      ]
    );
    const workflow = workflowRows[0];

    const qrToken = buildToken();
    // Calculate SHA256 from pdf_base64 if source_sha256 is not provided
    let sourceSha256 = payload.document.source_sha256;
    if (!sourceSha256 && payload.document.pdf_base64) {
      const pdfBuffer = Buffer.from(payload.document.pdf_base64, 'base64');
      sourceSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    }
    const { rows: documentRows } = await client.query(
      `INSERT INTO signature_workflow_documents (
        workflow_id, version_num, filename, mime_type, source_sha256,
        source_storage_ref, source_pdf_base64, qr_token, is_current, is_frozen
      ) VALUES ($1,1,$2,'application/pdf',$3,'db_inline',$4,$5,true,true)
      RETURNING *`,
      [
        workflow.id,
        payload.document.filename,
        sourceSha256,
        payload.document.pdf_base64,
        qrToken,
      ]
    );
    const document = documentRows[0];

    const signers = [];
    for (const signer of payload.signers) {
      // Enriquecer con datos de la ficha TH (fuente de verdad)
      const profileSnap = signer.user_id
        ? await resolveSignerSnapshot(signer.user_id, client)
        : null;
      
      // Determine signer kind and get email
      const isExternal = !signer.user_id;
      let emailSnapshot = isExternal ? signer.email : (profileSnap?.email || signer.email);
      let signerKind = isExternal ? 'external_user' : 'internal_user';
      
      // Ensure email snapshot is not null
      if (!emailSnapshot) {
        throw new Error('Email is required for all signers');
      }
      
      const resolvedName = profileSnap?.name || signer.name || 'Invitado';
      const resolvedRole = profileSnap?.role || signer.role || 'invitado';
      const resolvedCedula = profileSnap?.cedula || signer.cedula || null;

      const { rows } = await client.query(
        `INSERT INTO signature_workflow_signers (
          workflow_id, document_id, user_id, email_snapshot, name_snapshot, role_snapshot,
          cedula_snapshot, sequence_order, is_required, status, access_token, signer_kind
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *`,
        [
          workflow.id,
          document.id,
          signer.user_id || null,
          emailSnapshot,
          resolvedName,
          resolvedRole,
          resolvedCedula,
          signer.sequence_order,
          signer.is_required,
          SIGNER_STATUS.PENDING,
          buildToken(),
          signerKind,
        ]
      );
      signers.push(rows[0]);
    }

    await appendEvent(client, {
      workflowId: workflow.id,
      documentId: document.id,
      eventType: "workflow_created",
      eventDescription: "Workflow de firma creado",
      eventData: {
        source_module: payload.sourceModule,
        source_entity: payload.sourceEntity,
        source_entity_id: payload.sourceEntityId,
        signers_count: signers.length,
      },
      createdBy: user.id,
    });

    await syncSourceRecord(client, workflow, document, signers);

    await client.query("COMMIT");
    return hydrateWorkflow(workflow.id, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listWorkflows({ user, filters = {} }) {
  const params = [];
  const clauses = [];

  if (!isAdminLike(user)) {
    params.push(Number(user.id || 0));
    params.push(String(user.email || "").trim().toLowerCase());
    clauses.push(`(
      sw.created_by = $${params.length - 1}
      OR EXISTS (
        SELECT 1
          FROM signature_workflow_signers s
         WHERE s.workflow_id = sw.id
           AND (
             s.user_id = $${params.length - 1}
             OR LOWER(COALESCE(s.email_snapshot, '')) = $${params.length}
           )
      )
    )`);
  }

  if (filters.status) {
    params.push(String(filters.status).trim().toLowerCase());
    clauses.push(`LOWER(sw.status) = $${params.length}`);
  }

  if (filters.source_module) {
    params.push(String(filters.source_module).trim().toLowerCase());
    clauses.push(`LOWER(sw.source_module) = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT
       sw.*,
       (SELECT COUNT(*) FROM signature_workflow_signers s WHERE s.workflow_id = sw.id) AS signers_count,
       (SELECT COUNT(*) FROM signature_workflow_signers s WHERE s.workflow_id = sw.id AND s.status = 'signed') AS signed_count
     FROM signature_workflows sw
     ${where}
     ORDER BY sw.created_at DESC
     LIMIT 100`,
    params
  );

  return rows;
}

async function getWorkflow(workflowId, user) {
  return hydrateWorkflow(workflowId, user);
}

async function sendWorkflow(workflowId, user) {
  const client = await db.getClient();
  let notificationPayload = null;
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM signature_workflows WHERE id = $1 FOR UPDATE`, [workflowId]);
    const data = await getWorkflowRowsForClient(client, workflowId);
    ensureCanManageWorkflow(data, user);

    if (![WORKFLOW_STATUS.PREPARED].includes(String(data.workflow.status || "").toLowerCase())) {
      const error = new Error("Solo se puede enviar un workflow en estado prepared");
      error.status = 400;
      throw error;
    }

    await client.query(
      `UPDATE signature_workflows
          SET status = $2,
              sent_at = NOW(),
              current_step = NULL
        WHERE id = $1`,
      [workflowId, WORKFLOW_STATUS.SENT]
    );
    await client.query(
      `UPDATE signature_workflow_signers
          SET status = $2,
              available_at = NOW()
        WHERE workflow_id = $1
          AND status = $3`,
      [workflowId, SIGNER_STATUS.AVAILABLE, SIGNER_STATUS.PENDING]
    );

    await appendEvent(client, {
      workflowId,
      documentId: data.documents[0]?.id || null,
      eventType: "workflow_sent",
      eventDescription: "Workflow enviado a firma",
      eventData: { signing_mode: "parallel", signers_available: data.signers.length },
      createdBy: user.id,
    });

    const refreshed = await getWorkflowRowsForClient(client, workflowId);
    await syncSourceRecord(client, refreshed.workflow, refreshed.documents[0] || null, refreshed.signers);
    notificationPayload = {
      workflow: refreshed.workflow,
      documents: refreshed.documents,
      signers: refreshed.signers.filter((signer) => String(signer.status || "").toLowerCase() === SIGNER_STATUS.AVAILABLE),
      actorUser: user,
    };

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await notifyWorkflowSignersAvailable(notificationPayload);
  return hydrateWorkflow(workflowId, user);
}

async function openSignerStep({ workflowId, signerId, user }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM signature_workflows WHERE id = $1 FOR UPDATE`, [workflowId]);
    const data = await getWorkflowRowsForClient(client, workflowId);
    ensureCanViewWorkflow(data, user);
    const signer = data.signers.find((item) => Number(item.id) === Number(signerId));
    if (!signer) {
      const error = new Error("Firmante no encontrado");
      error.status = 404;
      throw error;
    }
    ensureSignerOwnership(signer, user);

    if (!isSignerActionableInParallel({ workflow: data.workflow, signer })) {
      const error = new Error("Este paso de firma no esta disponible para apertura");
      error.status = 400;
      throw error;
    }

    await client.query(
      `UPDATE signature_workflow_signers
          SET status = CASE WHEN status IN ($3, $4) THEN $5 ELSE status END,
              opened_at = COALESCE(opened_at, NOW())
        WHERE id = $1
          AND workflow_id = $2`,
      [signerId, workflowId, SIGNER_STATUS.PENDING, SIGNER_STATUS.AVAILABLE, SIGNER_STATUS.OPENED]
    );
    await client.query(
      `UPDATE signature_workflows
          SET status = CASE WHEN status = $2 THEN $3 ELSE status END
        WHERE id = $1`,
      [workflowId, WORKFLOW_STATUS.SENT, WORKFLOW_STATUS.IN_PROGRESS]
    );

    await appendEvent(client, {
      workflowId,
      documentId: signer.document_id,
      signerId: signer.id,
      eventType: "signer_opened",
      eventDescription: "El firmante abrio el documento",
      eventData: { signer_id: signer.id },
      createdBy: user.id,
    });

    await client.query("COMMIT");
    return hydrateWorkflow(workflowId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function signStep({ workflowId, signerId, user, action }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM signature_workflows WHERE id = $1 FOR UPDATE`, [workflowId]);
    const data = await getWorkflowRowsForClient(client, workflowId);
    ensureCanViewWorkflow(data, user);
    const signer = data.signers.find((item) => Number(item.id) === Number(signerId));
    if (!signer) {
      const error = new Error("Firmante no encontrado");
      error.status = 404;
      throw error;
    }
    ensureSignerOwnership(signer, user);
    if (!isSignerActionableInParallel({ workflow: data.workflow, signer })) {
      const error = new Error("Este paso de firma no esta disponible para firmar");
      error.status = 400;
      throw error;
    }

    const document = data.documents.find((item) => Number(item.id) === Number(signer.document_id));

    // El frontend puede reportar un page_number fuera de rango (ej. contó una
    // pagina de evidencia que solo existe en el preview, no en el documento
    // fuente): si no se recorta aqui, appendSignatureBlock lo descarta en
    // silencio (pageIndex >= pdfPages.length) y la firma nunca aparece en
    // ningun render, ni parcial ni final.
    if (action.signature_placement?.page_number && document?.source_pdf_base64) {
      try {
        const sourcePdf = await PDFDocument.load(Buffer.from(document.source_pdf_base64, "base64"));
        const pageCount = sourcePdf.getPageCount();
        if (action.signature_placement.page_number > pageCount) {
          action.signature_placement = { ...action.signature_placement, page_number: pageCount };
        }
      } catch {
        // si no se puede leer el PDF fuente, se deja el placement tal cual
      }
    }

    const signedAt = new Date().toISOString();
    const previousSignatureHash = data.signers
      .filter((item) => item.signature_hash_sha256)
      .sort((a, b) => {
        const bySignedAt = new Date(a.signed_at || 0).getTime() - new Date(b.signed_at || 0).getTime();
        if (bySignedAt !== 0) return bySignedAt;
        return Number(a.id || 0) - Number(b.id || 0);
      })
      .slice(-1)[0]?.signature_hash_sha256 || null;
    const payloadHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          workflow_id: workflowId,
          signer_id: signerId,
          user_id: user.id,
          source_sha256: document?.source_sha256 || null,
          consent_text: action.consent_text,
          signed_at: signedAt,
        })
      )
      .digest("hex");
    const signatureHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          payload_hash_sha256: payloadHash,
          previous_signature_hash_sha256: previousSignatureHash,
          signer_id: signerId,
        })
      )
      .digest("hex");

    await client.query(
      `UPDATE signature_workflow_signers
          SET status = $2,
              signed_at = NOW(),
              opened_at = COALESCE(opened_at, NOW()),
              session_id = COALESCE($3, session_id),
              ip_address = COALESCE($4, ip_address),
              user_agent = COALESCE($5, user_agent),
              consent_text = COALESCE($6, consent_text),
              payload_hash_sha256 = $7,
              previous_signature_hash_sha256 = $8,
              signature_hash_sha256 = $9,
              signature_visual_ref = CASE WHEN $10::text IS NOT NULL THEN 'inline_base64' ELSE signature_visual_ref END,
              signature_visual_base64 = COALESCE($10::text, signature_visual_base64),
              signature_placement = COALESCE($11::jsonb, signature_placement)
        WHERE id = $1`,
      [
        signerId,
        SIGNER_STATUS.SIGNED,
        action.session_id,
        action.ip_address,
        action.user_agent,
        action.consent_text,
        payloadHash,
        previousSignatureHash,
        signatureHash,
        action.signature_visual_base64,
        action.signature_placement ? JSON.stringify(action.signature_placement) : null,
      ]
    );

    await appendEvent(client, {
      workflowId,
      documentId: signer.document_id,
      signerId: signer.id,
      eventType: "signer_signed",
      eventDescription: "El firmante completo su firma",
      eventData: {
        signer_id: signer.id,
        payload_hash_sha256: payloadHash,
        signature_hash_sha256: signatureHash,
      },
      createdBy: user.id,
    });

    // all non-final signers (used for next-step advancement)
    const remainingPending = data.signers
      .filter((item) => Number(item.id) !== Number(signerId))
      .filter((item) => ![SIGNER_STATUS.SIGNED, SIGNER_STATUS.REJECTED].includes(String(item.status || "").toLowerCase()));

    // only REQUIRED signers block completion — optional ones are skipped
    const remainingRequired = remainingPending.filter((item) => item.is_required !== false);

    if (!remainingRequired.length) {
      await client.query(
        `UPDATE signature_workflows
            SET status = $2,
                completed_at = NOW()
          WHERE id = $1`,
        [workflowId, WORKFLOW_STATUS.COMPLETED]
      );

      // Fetch the updated workflow row (now has completed_at set) and all signers
      const { rows: completedWorkflowRows } = await client.query(
        `SELECT * FROM signature_workflows WHERE id = $1 LIMIT 1`,
        [workflowId]
      );
      const completedWorkflow = completedWorkflowRows[0] || data.workflow;

      const { rows: allSigners } = await client.query(
        `SELECT * FROM signature_workflow_signers WHERE workflow_id = $1 ORDER BY sequence_order ASC`,
        [workflowId]
      );

      const sourceDoc = data.documents.find((d) => d.is_current);

      // Guard: si el documento ya fue sellado no lo regenerar — el PDF es inmutable
      const alreadySealed = sourceDoc?.finalized_at != null;
      if (!alreadySealed) {
        let finalPdfBase64 = sourceDoc?.source_pdf_base64 || null;
        try {
          finalPdfBase64 = await appendSignatureBlock({
            sourcePdfBase64: sourceDoc?.source_pdf_base64,
            workflow: completedWorkflow,
            signers: allSigners,
            document: sourceDoc,
            verificationBaseUrl: FRONTEND_BASE_URL,
          });
        } catch (pdfErr) {
          console.error("[signStep] appendSignatureBlock threw, falling back to source PDF:", pdfErr?.message || pdfErr);
          finalPdfBase64 = sourceDoc?.source_pdf_base64 || null;
        }

        // SHA-256 del PDF FINAL generado (no del fuente)
        const finalSha256 = finalPdfBase64
          ? crypto.createHash("sha256").update(Buffer.from(finalPdfBase64, "base64")).digest("hex")
          : (sourceDoc?.source_sha256 || null);

        // Subir PDF final sellado al Drive (no el borrador)
        let finalDriveFileId = null;
        let finalDriveUrl = null;
        if (finalPdfBase64 && FAMSIGN_DRIVE_ROOT) {
          try {
            const famsignFolder = await ensureFolder("FamSign", FAMSIGN_DRIVE_ROOT);
            const wfCode = completedWorkflow.workflow_code || `WF-${workflowId}`;
            const wfFolder = await ensureFolder(wfCode, famsignFolder.id);
            const filename = sourceDoc?.filename
              ? sourceDoc.filename.replace(/\.pdf$/i, "") + "_FIRMADO.pdf"
              : `${wfCode}_FIRMADO.pdf`;
            const driveResult = await uploadBase64File(filename, finalPdfBase64, "application/pdf", wfFolder.id);
            finalDriveFileId = driveResult.id || null;
            finalDriveUrl = driveResult.webViewLink || null;
            logger.info({ workflowId, finalDriveFileId, finalDriveUrl }, "[signStep] PDF final subido a Drive");
          } catch (driveErr) {
            logger.error({ err: driveErr, workflowId }, "[signStep] Error subiendo PDF final a Drive — se guarda solo en DB");
          }
        }

        await client.query(
          `UPDATE signature_workflow_documents
              SET final_sha256       = $2,
                  final_pdf_base64   = $3,
                  final_drive_file_id = $4,
                  final_drive_url    = $5,
                  finalized_at       = NOW()
            WHERE workflow_id = $1
              AND is_current  = true
              AND finalized_at IS NULL`,
          [workflowId, finalSha256, finalPdfBase64, finalDriveFileId, finalDriveUrl]
        );
      }
      await appendEvent(client, {
        workflowId,
        documentId: signer.document_id,
        eventType: "workflow_completed",
        eventDescription: "Workflow completado",
        eventData: {},
        createdBy: user.id,
      });
    } else {
      await client.query(
        `UPDATE signature_workflows
            SET status = $2,
                current_step = NULL
          WHERE id = $1`,
        [workflowId, WORKFLOW_STATUS.PARTIALLY_SIGNED]
      );
    }

    const refreshed = await getWorkflowRowsForClient(client, workflowId);
    await syncSourceRecord(client, refreshed.workflow, refreshed.documents[0] || null, refreshed.signers);

    await client.query("COMMIT");
    return hydrateWorkflow(workflowId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rejectStep({ workflowId, signerId, user, action }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM signature_workflows WHERE id = $1 FOR UPDATE`, [workflowId]);
    const data = await getWorkflowRowsForClient(client, workflowId);
    ensureCanViewWorkflow(data, user);
    const signer = data.signers.find((item) => Number(item.id) === Number(signerId));
    if (!signer) {
      const error = new Error("Firmante no encontrado");
      error.status = 404;
      throw error;
    }
    ensureSignerOwnership(signer, user);
    if (!isSignerActionableInParallel({ workflow: data.workflow, signer })) {
      const error = new Error("Este paso de firma no esta disponible para rechazo");
      error.status = 400;
      throw error;
    }

    await client.query(
      `UPDATE signature_workflow_signers
          SET status = $2,
              rejected_at = NOW(),
              rejection_reason = $3,
              opened_at = COALESCE(opened_at, NOW())
        WHERE id = $1`,
      [signerId, SIGNER_STATUS.REJECTED, action.reason]
    );
    await client.query(
      `UPDATE signature_workflows
          SET status = $2,
              rejected_at = NOW()
        WHERE id = $1`,
      [workflowId, WORKFLOW_STATUS.REJECTED]
    );

    await appendEvent(client, {
      workflowId,
      documentId: signer.document_id,
      signerId: signer.id,
      eventType: "signer_rejected",
      eventDescription: "El firmante rechazo el documento",
      eventData: { reason: action.reason },
      createdBy: user.id,
    });

    const refreshed = await getWorkflowRowsForClient(client, workflowId);
    await syncSourceRecord(client, refreshed.workflow, refreshed.documents[0] || null, refreshed.signers);

    await client.query("COMMIT");
    return hydrateWorkflow(workflowId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listMyPending(user) {
  const { rows } = await db.query(
    `SELECT
       sw.*,
       s.id AS signer_id,
       s.sequence_order,
       s.status AS signer_status
     FROM signature_workflow_signers s
     JOIN signature_workflows sw ON sw.id = s.workflow_id
     WHERE s.user_id = $1
       AND s.status IN ('pending', 'available', 'opened')
       AND sw.status IN ('sent', 'in_progress', 'partially_signed')
       AND sw.active = true
     ORDER BY sw.created_at DESC`,
    [user.id]
  );
  return rows;
}

async function listMyCompleted(user) {
  const { rows } = await db.query(
    `SELECT
       sw.*,
       s.id AS signer_id,
       s.sequence_order,
       s.status AS signer_status,
       s.signed_at
     FROM signature_workflow_signers s
     JOIN signature_workflows sw ON sw.id = s.workflow_id
     WHERE s.user_id = $1
       AND s.status = 'signed'
       AND sw.active = true
     ORDER BY s.signed_at DESC NULLS LAST, sw.created_at DESC`,
    [user.id]
  );
  return rows;
}

async function listSignerCandidates() {
  const passiveStatuses = ["pasivo", "desvinculado", "inactivo", "en_desvinculacion"];
  const { rows } = await db.query(
    `SELECT
        u.id,
        u.email,
        COALESCE(NULLIF(u.fullname, ''), CONCAT('Usuario #', u.id)) AS fullname,
        u.role,
        d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      LEFT JOIN offboarding_processes op ON op.user_id = u.id
     WHERE COALESCE(u.active, true) = true
        AND COALESCE(op.is_closed, false) = false
        AND LOWER(TRIM(COALESCE(cp.profile->'onboarding'->>'offboarding_requested', 'false'))) NOT IN ('true', '1', 'yes', 'si', 'sí')
        AND LOWER(TRIM(COALESCE(cp.profile->'laboral'->>'estatus_empleado', 'activo'))) <> ALL($1::text[])
      ORDER BY fullname ASC`,
    [passiveStatuses]
  );
  return rows;
}

async function getDocumentPayload({ workflowId, documentId, final = false, user = null }) {
  const data = await getWorkflowRows(workflowId);
  if (user) ensureCanViewWorkflow(data, user);
  const document = data.documents.find((item) => Number(item.id) === Number(documentId));
  if (!document) {
    const error = new Error("Documento no encontrado");
    error.status = 404;
    throw error;
  }

  if (final && !document.final_pdf_base64 && document.source_pdf_base64) {
    // Workflow aun no completado (el sellado definitivo solo pasa en signStep):
    // se genera un PDF con las firmas que YA existen bajo demanda, sin
    // persistirlo como final_pdf_base64 -- appendSignatureBlock ya deja en
    // blanco el espacio de quienes no tienen signature_visual_base64/placement.
    try {
      const partialPdfBase64 = await appendSignatureBlock({
        sourcePdfBase64: document.source_pdf_base64,
        workflow: data.workflow,
        signers: data.signers,
        document,
        verificationBaseUrl: FRONTEND_BASE_URL,
      });
      return { filename: `parcial-${document.filename}`, base64: partialPdfBase64 };
    } catch (pdfErr) {
      logger.warn({ err: pdfErr, workflowId, documentId }, "[getDocumentPayload] No se pudo generar PDF parcial, se sirve el original");
    }
  }

  const base64Value = final ? document.final_pdf_base64 || document.source_pdf_base64 : document.source_pdf_base64;
  if (!base64Value) {
    const error = new Error("El documento aun no tiene payload disponible");
    error.status = 404;
    throw error;
  }
  return {
    filename: final ? `final-${document.filename}` : document.filename,
    base64: base64Value,
  };
}

async function verifyByToken(token) {
  const { rows: workflowRows } = await db.query(
    `SELECT *
       FROM signature_workflows
      WHERE verification_token = $1
        AND active = true
      LIMIT 1`,
    [token]
  );
  const workflow = workflowRows[0] || null;
  if (!workflow) return null;
  const data = await getWorkflowRows(workflow.id);
  return {
    workflow,
    documents: stripHeavyDocumentPayload(data.documents),
    signers: data.signers,
    events: data.events,
  };
}

async function reassignSigner(workflowId, signerId, newUserData, user) {
  const client = await db.getClient();
  let signerSnapshot = null;
  let newToken = null;
  let workflowCode = null;
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM signature_workflows WHERE id = $1 FOR UPDATE`, [workflowId]);
    const data = await getWorkflowRowsForClient(client, workflowId);
    if (!data.workflow) {
      const error = new Error("Workflow no encontrado");
      error.status = 404;
      throw error;
    }
    ensureCanManageWorkflow(data, user);

    const currentStatus = String(data.workflow.status || "").toLowerCase();
    if ([WORKFLOW_STATUS.COMPLETED, WORKFLOW_STATUS.CANCELLED, "expired"].includes(currentStatus)) {
      const error = new Error(`No se puede reasignar un firmante en un workflow con estado ${currentStatus}`);
      error.status = 400;
      throw error;
    }

    const signer = data.signers.find((item) => Number(item.id) === Number(signerId));
    if (!signer) {
      const error = new Error("Firmante no encontrado");
      error.status = 404;
      throw error;
    }

    const signerStatus = String(signer.status || "").toLowerCase();
    if (![SIGNER_STATUS.PENDING, SIGNER_STATUS.AVAILABLE].includes(signerStatus)) {
      const error = new Error(`No se puede reasignar un firmante en estado ${signerStatus}`);
      error.status = 400;
      throw error;
    }

    signerSnapshot = signer;
    workflowCode = data.workflow.workflow_code || String(workflowId);
    newToken = buildToken();
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await client.query(
      `UPDATE signature_workflow_signers
          SET user_id = $2,
              email_snapshot = $3,
              name_snapshot = $4,
              status = $5,
              access_token = $6,
              access_token_expires_at = $7,
              signed_at = NULL,
              rejected_at = NULL,
              rejection_reason = NULL
        WHERE id = $1`,
      [
        signerId,
        newUserData.userId || null,
        newUserData.email,
        newUserData.name,
        SIGNER_STATUS.PENDING,
        newToken,
        tokenExpiresAt,
      ]
    );

    await appendEvent(client, {
      workflowId,
      documentId: signer.document_id,
      signerId: signer.id,
      eventType: "signer_reassigned",
      eventDescription: "Firmante reasignado",
      eventData: {
        signer_id: signerId,
        old_user_id: signer.user_id || null,
        new_user_id: newUserData.userId || null,
        old_email: signer.email_snapshot,
        new_email: newUserData.email,
        reason: newUserData.reason || null,
      },
      createdBy: user.id,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // Send email notification to the new signer after COMMIT (best effort)
  if (newToken && newUserData.email) {
    try {
      const signLink = getWorkflowSigningUrl(workflowId);
      await sendMail({
        to: newUserData.email,
        subject: "Has sido asignado como firmante en FamSign",
        html: `<p>Hola ${newUserData.name || ""},</p>
<p>Has sido asignado como firmante en el flujo <strong>${workflowCode}</strong>.</p>
<p>Por favor, accede al siguiente enlace para revisar y firmar el documento:</p>
<p><a href="${signLink}">${signLink}</a></p>
<p>Este enlace expirara en 30 dias.</p>`,
        source: "signature_workflows",
      });
    } catch (mailErr) {
      console.error("[reassignSigner] Error al enviar email al nuevo firmante:", mailErr?.message || mailErr);
    }
  }

  return hydrateWorkflow(workflowId, user);
}

async function cancelWorkflow(workflowId, user) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM signature_workflows WHERE id = $1 FOR UPDATE`, [workflowId]);
    const data = await getWorkflowRowsForClient(client, workflowId);
    if (!data.workflow) {
      const error = new Error("Workflow no encontrado");
      error.status = 404;
      throw error;
    }
    ensureCanManageWorkflow(data, user);

    const currentStatus = String(data.workflow.status || "").toLowerCase();
    if ([WORKFLOW_STATUS.COMPLETED, WORKFLOW_STATUS.CANCELLED].includes(currentStatus)) {
      const error = new Error(`No se puede cancelar un workflow en estado ${currentStatus}`);
      error.status = 400;
      throw error;
    }

    await client.query(
      `UPDATE signature_workflows
          SET status = $2,
              active = false,
              cancelled_at = NOW()
        WHERE id = $1`,
      [workflowId, WORKFLOW_STATUS.CANCELLED]
    );

    await appendEvent(client, {
      workflowId,
      documentId: data.documents[0]?.id || null,
      eventType: "workflow_cancelled",
      eventDescription: "Workflow cancelado",
      eventData: { cancelled_by: user.id },
      createdBy: user.id,
    });

    const refreshed = await getWorkflowRowsForClient(client, workflowId);
    await syncSourceRecord(client, refreshed.workflow, refreshed.documents[0] || null, refreshed.signers);

    await client.query("COMMIT");
    return hydrateWorkflow(workflowId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Valida que los user_ids tengan la ficha TH completa (nombres, apellidos, cedula, cargo).
 * Devuelve array de { user_id, email, fullname, missing: [...campos] }
 */
async function validateSignerProfiles(userIds = []) {
  if (!userIds.length) return [];
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.fullname,
            NULLIF(TRIM(cp.profile->'personal'->>'nombres'),   '') AS nombres,
            NULLIF(TRIM(cp.profile->'personal'->>'apellidos'), '') AS apellidos,
            NULLIF(TRIM(cp.profile->'personal'->>'cedula'),    '') AS cedula,
            NULLIF(TRIM(cp.profile->'laboral'->>'cargo'),      '') AS cargo
       FROM users u
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = ANY($1::bigint[])`,
    [userIds]
  );
  return rows.map((u) => {
    const missing = [];
    if (!u.nombres)   missing.push("Nombres");
    if (!u.apellidos) missing.push("Apellidos");
    if (!u.cedula)    missing.push("Cédula");
    if (!u.cargo)     missing.push("Cargo");
    return { user_id: u.id, email: u.email, fullname: u.fullname, missing };
  }).filter((u) => u.missing.length > 0);
}

module.exports = {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  sendWorkflow,
  openSignerStep,
  signStep,
  rejectStep,
  listMyPending,
  listMyCompleted,
  listSignerCandidates,
  getDocumentPayload,
  verifyByToken,
  cancelWorkflow,
  reassignSigner,
  resolveSignerSnapshot,
  resolveRecipientOrThrow,
  validateSignerProfiles,
};
