const db = require("../../config/db");
const crypto = require("crypto");
const { logAction } = require("../../utils/audit");
const { validatePermisoRequest } = require("./permisos.validation");
const { generateFRH10, generateFirmaLegalValidationPdf } = require("./permisos.pdf");
const notificationManager = require("../notifications/notificationManager");
const logger = require("../../config/logger");
const { createTimeOffEvent } = require("../../utils/calendar");
const { sendMail } = require("../../utils/mailer");
const { uploadStudyEnrollmentDocument } = require("./permisos.drive");

const ANNUAL_ALLOWANCE = 15;
const MAX_ANNUAL_ALLOWANCE = 30;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const HOURS_PER_VACATION_DAY = 8;
const RECOVERY_COORDINATION_TIMEOUT_DAYS = 3;
const WORKFLOW_SIGNATURE_STAGES = {
  SOLICITUD: "solicitud",
  APROBACION_PARCIAL: "aprobacion_parcial",
  APROBACION_FINAL: "aprobacion_final",
  RECHAZO: "rechazo",
};
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

const ROLE_APPROVER = {
  comercial: "jefe_comercial",
  asesor_comercial: "jefe_comercial",
  acp_comercial: "jefe_comercial",
  marketing: "jefe_comercial",
  backoffice_comercial: "jefe_comercial",
  analista_comercial: "jefe_comercial",
  financiero: "jefe_financiero",
  finanzas: "jefe_financiero",
  contador: "jefe_financiero",
  tecnico: "jefe_tecnico",
  servicio_tecnico: "jefe_tecnico",
  tecnico_servicio: "jefe_tecnico",
  operaciones: "jefe_operaciones",
  analista_operaciones: "jefe_operaciones",
  calidad: "jefe_calidad",
  logistica: "jefe_logistica",
  ti: "jefe_ti",
  admin_ti: "jefe_ti",
  desarrollador: "jefe_ti",
  soporte: "jefe_ti",
  talento_humano: "jefe_talento_humano",
  rrhh: "jefe_talento_humano",
  rh: "jefe_talento_humano",
};

const ROLE_CANONICAL_ALIASES = {
  jefe_de_ti: "jefe_ti",
  jefe_finanzas: "jefe_financiero",
  jefe_de_finanzas: "jefe_financiero",
  jefe_servicio_tecnico: "jefe_tecnico",
  jefe_de_servicio_tecnico: "jefe_tecnico",
  jefe_de_tecnico: "jefe_tecnico",
  jefe_de_operaciones: "jefe_operaciones",
  jefe_de_comercial: "jefe_comercial",
  jefe_de_calidad: "jefe_calidad",
  jefe_de_talento_humano: "jefe_talento_humano",
  finanzas: "financiero",
  tecnico_servicio: "servicio_tecnico",
};

const APPROVER_ROLE_ALIASES = {
  gerencia_general: ["gerencia_general", "gerente_general", "gerencia", "gerente", "director"],
  jefe_ti: ["jefe_ti", "jefe_de_ti"],
  jefe_tecnico: ["jefe_tecnico", "jefe_de_tecnico", "jefe_servicio_tecnico", "jefe_de_servicio_tecnico"],
  jefe_operaciones: ["jefe_operaciones", "jefe_de_operaciones"],
  jefe_calidad: ["jefe_calidad", "jefe_de_calidad"],
  jefe_financiero: ["jefe_financiero", "jefe_finanzas", "jefe_de_finanzas"],
  jefe_comercial: ["jefe_comercial", "jefe_de_comercial"],
  jefe_talento_humano: ["jefe_talento_humano", "jefe_de_talento_humano"],
};

const GERENCIA_GENERAL_ROLES = new Set(["gerencia_general", "gerente_general", "gerencia", "gerente", "director"]);
const AUTO_FINAL_PERMISO_TYPES = new Set(["estudios", "personal"]);
const GENERAL_UNAVAILABILITY_EMAILS = String(
  process.env.TIMEOFF_GENERAL_NOTIFY_EMAILS || "general@fam-project.com"
)
  .split(",")
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);
const PREFERRED_APPROVER_EMAILS = String(process.env.PREFERRED_APPROVER_EMAILS || "")
  .split(",")
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);
const PASSIVE_EMPLOYMENT_STATUSES = new Set(["pasivo", "desvinculado", "inactivo"]);
const PASSIVE_EMPLOYMENT_STATUS_VALUES = Array.from(PASSIVE_EMPLOYMENT_STATUSES);

function normalizeRoleName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function canonicalizeRole(value = "") {
  const normalized = normalizeRoleName(value);
  if (!normalized) return "";
  return ROLE_CANONICAL_ALIASES[normalized] || normalized;
}

function resolveApproverRole(requesterRole = "") {
  const normalized = canonicalizeRole(requesterRole);
  if (!normalized) return "gerencia_general";
  if (GERENCIA_GENERAL_ROLES.has(normalized)) return "gerencia_general";

  const isJefe = normalized.startsWith("jefe_") || normalized.startsWith("jefe");
  if (isJefe) return "gerencia_general";

  const mapped = ROLE_APPROVER[normalized];
  if (mapped) return canonicalizeRole(mapped);

  // Fallback genérico por jerarquía: rol base -> jefe_<rol>.
  return `jefe_${normalized}`;
}

function getActorRoleCandidates(actor = {}) {
  const roles = new Set();
  [actor?.role, actor?.scope, actor?.role_name, actor?.rol, actor?.department]
    .map(canonicalizeRole)
    .filter(Boolean)
    .forEach((role) => roles.add(role));
  return Array.from(roles);
}

function buildPreferredApproverRoles(actor = {}) {
  const preferred = [];
  const requesterRoles = getActorRoleCandidates(actor);
  requesterRoles.forEach((role) => {
    const approverRole = resolveApproverRole(role);
    if (approverRole) preferred.push(canonicalizeRole(approverRole));
  });
  if (!preferred.length) preferred.push("gerencia_general");
  if (!preferred.some((role) => GERENCIA_GENERAL_ROLES.has(role))) {
    preferred.push("gerencia_general");
  }
  return Array.from(new Set(preferred.filter(Boolean)));
}

function getApproverRoleCandidates(approver = {}) {
  const candidates = new Set();
  getActorRoleCandidates(approver).forEach((role) => {
    expandApproverLookupRoles(role).forEach((candidateRole) => candidates.add(candidateRole));
  });
  return Array.from(candidates);
}

function expandApproverLookupRoles(role) {
  const normalized = canonicalizeRole(role);
  if (!normalized) return [];

  const roles = new Set([normalized]);
  const aliases = APPROVER_ROLE_ALIASES[normalized] || [];
  aliases.forEach((alias) => roles.add(normalizeRoleName(alias)));

  if (normalized.startsWith("jefe_")) {
    roles.add(normalized.replace(/^jefe_/, "jefe_de_"));
  } else if (normalized.startsWith("jefe_de_")) {
    roles.add(normalized.replace(/^jefe_de_/, "jefe_"));
  }

  if (GERENCIA_GENERAL_ROLES.has(normalized)) {
    APPROVER_ROLE_ALIASES.gerencia_general.forEach((alias) => roles.add(normalizeRoleName(alias)));
  }

  return Array.from(roles).filter(Boolean);
}

async function findApproverByRole(role) {
  if (!role) return null;
  const roleCandidates = expandApproverLookupRoles(role);
  if (!roleCandidates.length) return null;
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.fullname
       FROM users u
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE LOWER(COALESCE(u.role, '')) = ANY($1::text[])
        AND u.active = true
        AND NOT (
          LOWER(COALESCE(cp.profile->'laboral'->>'estatus_empleado', '')) = ANY($3::text[])
        )
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(u.email, '')) = ANY($2) THEN 0
          WHEN LOWER(COALESCE(u.email, '')) LIKE 'administrador@%' THEN 2
          ELSE 1
        END,
        u.id ASC
      LIMIT 1`,
    [roleCandidates, PREFERRED_APPROVER_EMAILS, PASSIVE_EMPLOYMENT_STATUS_VALUES]
  );
  return rows[0] || null;
}

async function resolveApproverWithFallback(preferredRoles) {
  const preferredList = Array.isArray(preferredRoles) ? preferredRoles : [preferredRoles];
  const normalizedPreferredRoles = Array.from(
    new Set(preferredList.map(canonicalizeRole).filter(Boolean))
  );

  const orderedRoles = normalizedPreferredRoles.length
    ? normalizedPreferredRoles
    : ["gerencia_general"];

  for (let idx = 0; idx < orderedRoles.length; idx += 1) {
    const role = orderedRoles[idx];
    const user = await findApproverByRole(role);
    if (user?.id) {
      return {
        approverRole: role,
        approverUser: user,
        fallbackApplied: idx > 0,
      };
    }
  }

  const fallbackRole = "gerencia_general";
  const fallbackUser = await findApproverByRole(fallbackRole);
  if (!fallbackUser?.id) {
    return {
      approverRole: fallbackRole,
      approverUser: null,
      fallbackApplied: true,
    };
  }

  return {
    approverRole: fallbackRole,
    approverUser: fallbackUser,
    fallbackApplied: true,
  };
}

function getDisplayName(user = {}) {
  return user?.fullname || user?.name || user?.email || "";
}

function resolveActorId(user = {}) {
  const candidate = user?.id ?? user?.user_id ?? user?.sub ?? null;
  const numeric = Number(candidate);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return null;
}

async function getUserIdentity(userId) {
  if (!userId) return null;
  try {
    const { rows } = await db.query(
      `SELECT
          u.id,
          u.email,
          COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email) AS fullname,
          cp.profile->'personal'->>'cedula' AS cedula,
          cp.profile->'laboral'->>'sueldo' AS salary
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
          NULL::text AS cedula,
          NULL::text AS salary
        FROM users u
        WHERE u.id = $1
        LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }
}

async function attachCancellationActors(row) {
  if (!row) return row;
  const [requestedBy, reviewedBy, cancelledBy] = await Promise.all([
    getUserIdentity(row.cancellation_requested_by_user_id).catch(() => null),
    getUserIdentity(row.cancellation_reviewed_by_user_id).catch(() => null),
    getUserIdentity(row.cancelled_by_user_id).catch(() => null),
  ]);

  return {
    ...row,
    cancellation_requested_by_name:
      requestedBy?.fullname || row.cancellation_requested_by_email || null,
    cancellation_reviewed_by_name:
      reviewedBy?.fullname || row.cancellation_reviewed_by_email || null,
    cancelled_by_name: cancelledBy?.fullname || row.cancelled_by_email || null,
  };
}

function buildCancellationVerification(row) {
  const normalizedStatus = normalizeStatusText(row?.status);
  if (!["cancelled", "cancelado"].includes(normalizedStatus)) return null;

  const directCancellation = !row?.cancellation_requested_at;
  return {
    mode: directCancellation ? "direct_cancel" : "approved_request",
    mode_label: directCancellation ? "Cancelación directa" : "Solicitud de cancelación aprobada",
    requested_at: row?.cancellation_requested_at || null,
    requested_at_label: directCancellation ? "No aplica (cancelación directa)" : "No disponible",
    requested_by:
      row?.cancellation_requested_by_name ||
      row?.cancellation_requested_by_email ||
      (directCancellation ? "No aplica (cancelación directa)" : "No disponible"),
    request_reason:
      row?.cancellation_request_reason || row?.cancellation_reason || null,
    resolved_at: row?.cancelled_at || row?.cancellation_reviewed_at || null,
    resolved_by_label: directCancellation ? "Cancelado por" : "Cancelación aprobada por",
    resolved_by:
      (directCancellation
        ? row?.cancelled_by_name || row?.cancelled_by_email
        : row?.cancellation_reviewed_by_name ||
        row?.cancellation_reviewed_by_email ||
        row?.cancelled_by_name ||
        row?.cancelled_by_email) || "No disponible",
    final_reason:
      row?.cancellation_reason ||
      row?.cancellation_review_reason ||
      row?.cancellation_request_reason ||
      null,
    review_reason: row?.cancellation_review_reason || null,
  };
}

async function refreshLegalArtifactsForSolicitud(row) {
  if (!row?.id) return row;

  const hydratedRow = await attachCancellationActors(row);
  let verificationToken = hydratedRow.legal_verification_token || null;
  if (!verificationToken) {
    verificationToken = generateLegalVerificationToken();
    await db.query(
      `UPDATE permisos_vacaciones
          SET legal_verification_token = $2,
              legal_verification_created_at = COALESCE(legal_verification_created_at, NOW()),
              updated_at = NOW()
        WHERE id = $1`,
      [hydratedRow.id, verificationToken]
    );
  }

  const requesterIdentity = await getUserIdentity(hydratedRow.user_id).catch(() => null);
  const approverIdentity = await getUserIdentity(hydratedRow.approver_user_id).catch(() => null);
  const approverName =
    hydratedRow.aprobacion_final_por ||
    approverIdentity?.fullname ||
    hydratedRow.approver_email ||
    hydratedRow.approver_role ||
    "No disponible";

  const signaturesBySolicitud = await getSignaturesBySolicitudIds([hydratedRow.id]);
  const signatures = signaturesBySolicitud.get(String(hydratedRow.id)) || [];
  const solicitudSignature =
    signatures.find((item) => item.stage === WORKFLOW_SIGNATURE_STAGES.SOLICITUD) || null;
  const finalSignature =
    signatures.find((item) => item.stage === WORKFLOW_SIGNATURE_STAGES.APROBACION_FINAL) || null;
  const workflowSummary = buildWorkflowSignatureSummary(signatures);
  const legalVerificationUrl = buildLegalVerificationUrl(verificationToken);

  const pdfPayload = {
    ...hydratedRow,
    user_fullname:
      requesterIdentity?.fullname || hydratedRow.user_fullname || hydratedRow.user_email,
    user_document_id: requesterIdentity?.cedula || "",
    approver_fullname: approverName,
    approver_document_id: approverIdentity?.cedula || "",
    aprobacion_final_por: approverName,
    firma_solicitante_texto: buildPdfSignatureText(
      solicitudSignature,
      requesterIdentity?.fullname || hydratedRow.user_fullname || hydratedRow.user_email
    ),
    firma_aprobador_texto: buildPdfSignatureText(finalSignature, approverName),
    firma_workflow_estado: workflowSummary?.estado || "pendiente",
    firma_solicitante_at: solicitudSignature?.signed_at || null,
    firma_aprobador_at: finalSignature?.signed_at || null,
    firma_solicitante_hash: solicitudSignature?.signature_hash_sha256 || null,
    firma_aprobador_hash: finalSignature?.signature_hash_sha256 || null,
    firma_aprobador_prev_hash: finalSignature?.previous_signature_hash_sha256 || null,
    legal_verification_token: verificationToken,
    legal_verification_url: legalVerificationUrl,
    workflow_signature_summary: workflowSummary,
  };

  const pdfUrl = await generateFRH10(pdfPayload);
  const legalPdfUrl = await generateFirmaLegalValidationPdf({
    solicitud: {
      ...pdfPayload,
      approver_fullname: approverName,
    },
    signatures,
    verification: {
      token: verificationToken,
      url: legalVerificationUrl,
    },
  });

  if (pdfUrl || legalPdfUrl) {
    await db.query(
      `UPDATE permisos_vacaciones
          SET pdf_generado_url = COALESCE($2, pdf_generado_url),
              pdf_validacion_legal_url = COALESCE($3, pdf_validacion_legal_url),
              updated_at = NOW()
        WHERE id = $1`,
      [hydratedRow.id, pdfUrl, legalPdfUrl]
    );
  }

  return {
    ...pdfPayload,
    pdf_generado_url: pdfUrl || hydratedRow.pdf_generado_url || null,
    pdf_validacion_legal_url: legalPdfUrl || hydratedRow.pdf_validacion_legal_url || null,
    firmas_workflow: signatures,
    firma_avanzada_resumen: workflowSummary,
  };
}

async function getHireDate(userId) {
  if (!userId) return null;
  const { rows } = await db.query(
    `SELECT cp.profile->'laboral'->>'fecha_ingreso' AS fecha_ingreso
       FROM collaborator_profiles cp
      WHERE cp.user_id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0]?.fecha_ingreso || null;
}

async function getVacationConsumption({ userId, userEmail, year }) {
  const yearValue = Number(year);
  if (!Number.isFinite(yearValue)) return { approved: 0, pending: 0 };

  let query = `
    SELECT
      tipo_solicitud,
      status,
      duracion_dias,
      duracion_horas,
      fecha_inicio,
      fecha_fin,
      charged_to_vacation,
      charged_vacation_days,
      charged_vacation_hours
    FROM permisos_vacaciones
    WHERE EXTRACT(YEAR FROM fecha_inicio) = $1
  `;
  const values = [yearValue];
  if (userId) {
    query += " AND user_id = $2";
    values.push(userId);
  } else if (userEmail) {
    query += " AND user_email = $2";
    values.push(userEmail);
  } else {
    return { approved: 0, pending: 0 };
  }

  const { rows } = await db.query(query, values);
  let approved = 0;
  let pending = 0;

  rows.forEach((row) => {
    const status = normalizeStatusText(row?.status);
    const isApproved = ["approved", "aprobado"].includes(status);
    const isPending = ["pending", "pendiente", "pending_final", "partially_approved"].includes(status);

    if (row?.tipo_solicitud === "vacaciones") {
      const days = calculateVacationDays(row);
      if (isApproved) approved += days;
      if (isPending) pending += days;
      return;
    }

    if (row?.charged_to_vacation && isApproved) {
      approved += getChargedVacationDays(row);
    }
  });

  return {
    approved: roundToTwo(approved),
    pending: roundToTwo(pending),
  };
}

async function getHistoricVacationBalance({ userId, userEmail, year }) {
  const yearValue = Number(year);
  if (!Number.isFinite(yearValue)) return 0;
  try {
    if (userId) {
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(dias), 0) AS total
           FROM vacaciones_saldos_historicos
          WHERE anio = $1
            AND (user_id = $2 OR LOWER(user_email) = LOWER($3))`,
        [yearValue, userId, userEmail || ""]
      );
      return Number(rows[0]?.total || 0);
    }
    if (userEmail) {
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(dias), 0) AS total
           FROM vacaciones_saldos_historicos
          WHERE anio = $1
            AND LOWER(user_email) = LOWER($2)`,
        [yearValue, userEmail]
      );
      return Number(rows[0]?.total || 0);
    }
  } catch (error) {
    if (error?.code !== "42P01") throw error;
  }
  return 0;
}

function getRequestMeta(meta = {}) {
  return {
    ipAddress: meta?.ipAddress || null,
    userAgent: meta?.userAgent || null,
    sessionId: meta?.sessionId || null,
  };
}

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

function normalizeDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const direct = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];

    // Formatos legacy/locales: dd/MM/yyyy o dd-MM-yyyy (Ecuador/LATAM)
    const dmy = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\D|$)/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      if (
        Number.isFinite(day) &&
        Number.isFinite(month) &&
        Number.isFinite(year) &&
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12
      ) {
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // Formato yyyy/MM/dd
    const ymdSlash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\D|$)/);
    if (ymdSlash) {
      const year = Number(ymdSlash[1]);
      const month = Number(ymdSlash[2]);
      const day = Number(ymdSlash[3]);
      if (
        Number.isFinite(day) &&
        Number.isFinite(month) &&
        Number.isFinite(year) &&
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12
      ) {
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getCurrentDateInAppTimezone() {
  const timeZone = process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return normalizeDateOnly(new Date());
  return `${year}-${month}-${day}`;
}

function canCancelByDateRule(solicitud = {}) {
  const dateCandidates = [
    solicitud?.fecha_inicio,
    solicitud?.fecha_inicio_hora,
    solicitud?.fecha_fin,
    solicitud?.fecha_fin_hora,
    solicitud?.periodo_vacaciones,
  ];
  const startDate = dateCandidates.map(normalizeDateOnly).find(Boolean);
  if (!startDate) {
    logger.warn(
      {
        solicitudId: solicitud?.id || null,
        fecha_inicio: solicitud?.fecha_inicio || null,
        fecha_inicio_hora: solicitud?.fecha_inicio_hora || null,
        periodo_vacaciones: solicitud?.periodo_vacaciones || null,
      },
      "No se pudo resolver fecha de inicio para regla de cancelacion; se permite continuar para evitar bloqueo operativo"
    );
    return true;
  }
  const today = getCurrentDateInAppTimezone();
  return today <= startDate;
}

function normalizeDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function calculateDurationHours(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  const hours = (end - start) / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

function roundToTwo(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function computeVacationNegativeProjection({
  remaining = 0,
  requestedDays = 0,
  allowancePerYear = ANNUAL_ALLOWANCE,
  startDate = null,
}) {
  const remainingValue = roundToTwo(remaining);
  const requestedValue = roundToTwo(requestedDays);
  const projectedRemaining = roundToTwo(remainingValue - requestedValue);
  const exceedsBalance = projectedRemaining < 0;

  let deficitDays = 0;
  let deficitHours = 0;
  if (exceedsBalance) {
    deficitDays = roundToTwo(Math.abs(projectedRemaining));
    deficitHours = roundToTwo(deficitDays * HOURS_PER_VACATION_DAY);
  }

  return {
    remaining: remainingValue,
    requested_days: requestedValue,
    projected_remaining: projectedRemaining,
    exceeds_balance: exceedsBalance,
    recovery_date: null,
    deficit_days: deficitDays,
    deficit_hours: deficitHours,
  };
}

function addDaysToDateOnly(value, days = 0) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function addHoursToDateTime(startValue, hoursValue) {
  const start = new Date(startValue);
  const hours = Number(hoursValue || 0);
  if (Number.isNaN(start.getTime()) || !Number.isFinite(hours) || hours <= 0) return null;
  return new Date(start.getTime() + hours * 60 * 60 * 1000).toISOString();
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

function buildTimeOffCalendarSummary({ tipoSolicitud, tipoPermiso, userFullname }) {
  if (tipoSolicitud === "vacaciones") {
    return `Vacaciones - ${userFullname || "Colaborador"}`;
  }
  const permisoLabel = tipoPermiso ? `Permiso (${tipoPermiso})` : "Permiso";
  return `${permisoLabel} - ${userFullname || "Colaborador"}`;
}

function buildTimeOffCalendarDescription({ solicitudId, tipoSolicitud, tipoPermiso, status }) {
  const lines = [
    "Solicitud registrada en SPI.",
    `ID: ${solicitudId}`,
    `Tipo: ${tipoSolicitud || "permiso"}`,
    `Estado: ${status || "pending"}`,
  ];
  if (tipoPermiso) lines.push(`Subtipo: ${tipoPermiso}`);
  return lines.join("\n");
}

function buildWorkdayDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  let dateOnly = null;
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    dateOnly = dateValue.toISOString().slice(0, 10);
  } else {
    const raw = String(dateValue).trim();
    dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  }
  if (!dateOnly) return null;
  return `${dateOnly}T${timeValue}:00`;
}

function formatDateForGeneralNotice(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil",
  });
}

function formatDateTimeForGeneralNotice(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil",
  });
}

function buildGeneralUnavailabilityPeriodLabel(solicitud = {}) {
  const startDateTime = formatDateTimeForGeneralNotice(solicitud?.fecha_inicio_hora);
  const endDateTime = formatDateTimeForGeneralNotice(solicitud?.fecha_fin_hora);
  if (startDateTime && endDateTime) return `${startDateTime} - ${endDateTime}`;

  const startDate = formatDateForGeneralNotice(solicitud?.fecha_inicio);
  const endDate = formatDateForGeneralNotice(solicitud?.fecha_fin);
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  return startDate || endDate || "No especificado";
}

function buildGeneralUnavailabilityMailContent(solicitud = {}) {
  const collaborator = solicitud?.user_fullname || solicitud?.user_email || "Colaborador";
  const typeLabel = solicitud?.tipo_solicitud === "vacaciones" ? "Vacaciones" : "Permiso";
  const periodLabel = buildGeneralUnavailabilityPeriodLabel(solicitud);
  const subject = `[SPI] Aviso general de no disponibilidad: ${collaborator}`;
  const text = [
    "Aviso general para planificacion operativa",
    `El colaborador ${collaborator} no estara disponible por ${typeLabel.toLowerCase()}.`,
    `Periodo: ${periodLabel}.`,
    "Esta notificacion se envia al grupo general para que cada area lo tenga en cuenta.",
  ].join("\n");
  const html = `
    <p><strong>Aviso general para planificacion operativa.</strong></p>
    <p>El colaborador <strong>${collaborator}</strong> no estara disponible por <strong>${typeLabel.toLowerCase()}</strong>.</p>
    <p>Periodo: <strong>${periodLabel}</strong>.</p>
    <p>Esta notificacion se envia al grupo general para que cada area lo tenga en cuenta.</p>
  `;
  return { subject, text, html };
}

async function sendGeneralUnavailabilityNotification(solicitud = {}) {
  if (!GENERAL_UNAVAILABILITY_EMAILS.length) return;
  if (isEmergencySolicitud(solicitud)) {
    logger.info(
      { solicitudId: solicitud?.id, userEmail: solicitud?.user_email },
      "Se omite aviso general de no disponibilidad por tratarse de una solicitud de emergencia"
    );
    return;
  }
  const { subject, text, html } = buildGeneralUnavailabilityMailContent(solicitud);
  await sendMail({
    to: GENERAL_UNAVAILABILITY_EMAILS,
    subject,
    text,
    html,
    source: "permisos_vacaciones",
  });
}

function buildSolicitudCalendarEventInput(solicitud = {}) {
  const isVacation = solicitud?.tipo_solicitud === "vacaciones";
  const startDateTime = isVacation
    ? solicitud?.fecha_inicio_hora || buildWorkdayDateTime(solicitud?.fecha_inicio, "09:00") || null
    : solicitud?.fecha_inicio_hora || null;
  const endDateTime = isVacation
    ? solicitud?.fecha_fin_hora || buildWorkdayDateTime(solicitud?.fecha_fin, "18:00") || null
    : solicitud?.fecha_fin_hora || null;

  return {
    userEmail: solicitud?.user_email,
    summary: buildTimeOffCalendarSummary({
      tipoSolicitud: solicitud?.tipo_solicitud,
      tipoPermiso: solicitud?.tipo_permiso,
      userFullname: solicitud?.user_fullname,
    }),
    description: buildTimeOffCalendarDescription({
      solicitudId: solicitud?.id,
      tipoSolicitud: solicitud?.tipo_solicitud,
      tipoPermiso: solicitud?.tipo_permiso,
      status: solicitud?.status,
    }),
    startDate: solicitud?.fecha_inicio,
    endDate: solicitud?.fecha_fin,
    startDateTime,
    endDateTime,
    reminderMinutesBefore: isVacation ? 1440 : 30,
  };
}

async function createSolicitudCalendarEvent(solicitud, warningMessage) {
  try {
    await createTimeOffEvent(buildSolicitudCalendarEventInput(solicitud));
    try {
      await sendGeneralUnavailabilityNotification(solicitud);
    } catch (mailError) {
      logger.warn(
        { mailError, solicitudId: solicitud?.id, userEmail: solicitud?.user_email },
        "No se pudo enviar aviso general de no disponibilidad por correo"
      );
    }
  } catch (calendarError) {
    logger.warn(
      { calendarError, solicitudId: solicitud?.id, userEmail: solicitud?.user_email },
      warningMessage
    );
  }
}

async function assertRequesterCanCreateTimeOff(userId) {
  const targetUserId = Number(userId);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    const err = new Error("No se pudo resolver el solicitante de la solicitud.");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT
        u.id,
        u.active,
        cp.profile->'laboral'->>'estatus_empleado' AS estatus_empleado
      FROM users u
      LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [targetUserId]
  );
  const row = rows[0];
  if (!row) {
    const err = new Error("No se encontró información del solicitante.");
    err.status = 404;
    throw err;
  }

  const employmentStatus = String(row.estatus_empleado || "").trim().toLowerCase();
  const inactive =
    row.active === false ||
    PASSIVE_EMPLOYMENT_STATUSES.has(employmentStatus);

  if (inactive) {
    const err = new Error(
      "Tu usuario se encuentra en estado pasivo/inactivo y no puede crear solicitudes de permisos o vacaciones."
    );
    err.status = 403;
    err.code = "COLLABORATOR_INACTIVE";
    throw err;
  }
}

async function recreateCalendarEventForSolicitud({ solicitudId, includeGeneralNotice = true } = {}) {
  await ensureTable();
  const id = Number(solicitudId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("solicitudId invalido");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = rows[0];
  if (!solicitud) {
    const err = new Error("Solicitud no encontrada");
    err.status = 404;
    throw err;
  }

  const status = normalizeStatusText(solicitud?.status);
  if (!["approved", "aprobado"].includes(status)) {
    const err = new Error("Solo se pueden re-agendar solicitudes con estado aprobado");
    err.status = 409;
    throw err;
  }

  const calendarEvent = await createTimeOffEvent(buildSolicitudCalendarEventInput(solicitud));

  let generalNotice = { attempted: false, sent: false, skipped: false };
  if (includeGeneralNotice) {
    generalNotice.attempted = true;
    try {
      await sendGeneralUnavailabilityNotification(solicitud);
      generalNotice.sent = true;
      generalNotice.skipped = false;
    } catch (mailError) {
      generalNotice.sent = false;
      generalNotice.error = String(mailError?.message || mailError);
      logger.warn(
        { mailError, solicitudId: solicitud.id },
        "No se pudo enviar aviso general durante re-agendado manual de calendario"
      );
    }
  }

  try {
    await logAction({
      usuario_id: null,
      usuario_email: "system_calendar_recreate",
      modulo: "permisos",
      accion: "recrear_evento_calendario",
      descripcion: "Evento de calendario recreado manualmente para solicitud aprobada.",
      datos_nuevos: {
        solicitud_id: solicitud.id,
        status: solicitud.status,
        calendar_event_id: calendarEvent?.id || null,
      },
      contexto: { auto: true },
    });
  } catch (auditError) {
    logger.warn(
      { auditError, solicitudId: solicitud.id },
      "No se pudo registrar auditoria de re-agendado manual de calendario"
    );
  }

  return {
    solicitud_id: solicitud.id,
    user_email: solicitud.user_email,
    status: solicitud.status,
    calendar_event: {
      id: calendarEvent?.id || null,
      html_link: calendarEvent?.htmlLink || null,
      calendar_id: calendarEvent?.calendarId || null,
      delegated_user: calendarEvent?.delegatedUser || null,
    },
    general_notice: generalNotice,
  };
}

function isAutoFinalPermisoType(tipoPermiso) {
  return AUTO_FINAL_PERMISO_TYPES.has(String(tipoPermiso || "").trim().toLowerCase());
}

function normalizeStatusText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "si", "sí", "yes", "on"].includes(normalized);
}

function isHealthPermiso(row = {}) {
  return String(row?.tipo_permiso || "").trim().toLowerCase() === "salud";
}

function isEmergencySolicitud(row = {}) {
  return normalizeBooleanFlag(row?.es_emergencia);
}

function isAutoCancellationExempt(row = {}) {
  return isHealthPermiso(row) || isEmergencySolicitud(row);
}

function buildTimeRangeLabel(startValue, endValue) {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const opts = { hour: "2-digit", minute: "2-digit", hour12: false };
  return `${start.toLocaleTimeString("es-EC", opts)} - ${end.toLocaleTimeString("es-EC", opts)}`;
}

function normalizeTimeText(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeTextToMinutes(value) {
  const normalized = normalizeTimeText(value);
  if (!normalized) return null;
  const [hh, mm] = normalized.split(":").map(Number);
  return hh * 60 + mm;
}

function normalizeRecoveryPlan(input) {
  if (!Array.isArray(input)) return { plan: [], totalHours: 0 };
  const sanitized = [];
  for (let idx = 0; idx < input.length; idx += 1) {
    const row = input[idx] || {};
    const date = normalizeDateOnly(row.date);
    const startTime = normalizeTimeText(row.start_time);
    const endTime = normalizeTimeText(row.end_time);
    const notes = String(row.notes || "").trim() || null;
    if (!date || !startTime || !endTime) {
      const err = new Error(`Tramo de recuperación inválido en posición ${idx + 1}`);
      err.status = 400;
      throw err;
    }
    const startMinutes = timeTextToMinutes(startTime);
    const endMinutes = timeTextToMinutes(endTime);
    if (endMinutes <= startMinutes) {
      const err = new Error(`La hora fin debe ser mayor a la hora inicio en el tramo ${idx + 1}`);
      err.status = 400;
      throw err;
    }
    const computedHours = Math.round((((endMinutes - startMinutes) / 60) + Number.EPSILON) * 100) / 100;
    sanitized.push({
      date,
      start_time: startTime,
      end_time: endTime,
      hours: computedHours,
      notes,
    });
  }
  sanitized.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.start_time.localeCompare(b.start_time);
  });
  const totalHours = Math.round(
    (sanitized.reduce((acc, row) => acc + Number(row.hours || 0), 0) + Number.EPSILON) * 100
  ) / 100;
  return { plan: sanitized, totalHours };
}

function estimateRequestedHours(solicitud = {}) {
  const hours = Number(solicitud?.duracion_horas || 0);
  if (Number.isFinite(hours) && hours > 0) return roundToTwo(hours);
  const days = Number(solicitud?.duracion_dias || 0);
  if (Number.isFinite(days) && days > 0) {
    return roundToTwo(days * HOURS_PER_VACATION_DAY);
  }
  return 0;
}

function getChargedVacationDays(row = {}) {
  if (!row?.charged_to_vacation) return 0;
  const explicitDays = Number(row?.charged_vacation_days || 0);
  if (Number.isFinite(explicitDays) && explicitDays > 0) return roundToTwo(explicitDays);
  const explicitHours = Number(row?.charged_vacation_hours || 0);
  if (Number.isFinite(explicitHours) && explicitHours > 0) {
    return roundToTwo(explicitHours / HOURS_PER_VACATION_DAY);
  }
  return roundToTwo(estimateRequestedHours(row) / HOURS_PER_VACATION_DAY);
}

function buildVacationCharge(row = {}) {
  const hours = estimateRequestedHours(row);
  return {
    hours,
    days: roundToTwo(hours / HOURS_PER_VACATION_DAY),
  };
}

function getRecoveryCoordinationDeadlineDate(row = {}) {
  const startDate = normalizeDateOnly(row?.fecha_inicio || row?.fecha_inicio_hora);
  if (!startDate) return null;
  return addDaysToDateOnly(startDate, RECOVERY_COORDINATION_TIMEOUT_DAYS);
}

function isRecoveryCoordinationPending(status) {
  return ["pending_approver_proposal", "pending_requester_acceptance"].includes(
    normalizeRecoveryCoordinationStatus(status)
  );
}

function isPendingApprovalStatus(status) {
  return ["pending", "pendiente"].includes(normalizeStatusText(status));
}

function hasApprovalTimestamps(row = {}) {
  return Boolean(row?.aprobacion_parcial_at || row?.aprobacion_final_at);
}

function getSolicitudExpiryValues(row = {}) {
  return {
    dateOnly: normalizeDateOnly(row?.fecha_inicio || row?.fecha_inicio_hora),
    dateTime: normalizeDateTime(row?.fecha_inicio_hora),
  };
}

function isExpiredWithoutApproval(row = {}) {
  if (!isPendingApprovalStatus(row?.status)) return false;
  if (hasApprovalTimestamps(row)) return false;
  if (isAutoCancellationExempt(row)) return false;

  const { dateOnly, dateTime } = getSolicitudExpiryValues(row);
  if (dateTime) return new Date().toISOString() >= dateTime;
  if (!dateOnly) return false;

  const today = getCurrentDateInAppTimezone();
  return Boolean(today && today >= dateOnly);
}

async function settleExpiredPendingSolicitud(row = {}) {
  if (!row?.id) return row;
  if (!isExpiredWithoutApproval(row)) return row;

  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'cancelled',
            cancelled_at = COALESCE(cancelled_at, NOW()),
            cancelled_by_email = COALESCE(cancelled_by_email, 'system_auto_expiry'),
            cancellation_reason = COALESCE(cancellation_reason, 'auto_expired_without_approval'),
            cancellation_status = 'approved',
            cancellation_reviewed_at = COALESCE(cancellation_reviewed_at, NOW()),
            cancellation_reviewed_by_email = COALESCE(cancellation_reviewed_by_email, 'system_auto_expiry'),
            cancellation_review_reason = COALESCE(cancellation_review_reason, 'auto_expired_without_approval'),
            auto_cancelled_justification_deadline = COALESCE(auto_cancelled_justification_deadline, NOW() + INTERVAL '30 days'),
            auto_cancelled_justification_warning_sent = COALESCE(auto_cancelled_justification_warning_sent, false),
            updated_at = NOW()
      WHERE id = $1
        AND LOWER(COALESCE(status, '')) IN ('pending', 'pendiente')
        AND COALESCE(es_emergencia, false) = false
        AND LOWER(COALESCE(tipo_permiso, '')) <> 'salud'
        AND aprobacion_parcial_at IS NULL
        AND aprobacion_final_at IS NULL
      RETURNING *`,
    [row.id]
  );
  const settled = rows[0] || row;
  if (rows[0]) {
    try {
      await logAction({
        usuario_id: null,
        usuario_email: "system_auto_expiry",
        modulo: "permisos",
        accion: "cancelacion_automatica_vencimiento",
        descripcion: "Solicitud cancelada automáticamente por vencimiento sin aprobación.",
        datos_nuevos: {
          solicitud_id: settled.id,
          status: settled.status,
          cancellation_reason: settled.cancellation_reason,
          auto_cancelled_justification_deadline: settled.auto_cancelled_justification_deadline,
        },
        contexto: { auto: true },
      });
    } catch (auditError) {
      logger.warn(
        { auditError, solicitudId: settled.id },
        "No se pudo registrar auditoría de cancelación automática por vencimiento"
      );
    }

    // Notify requester
    try {
      if (settled?.user_id) {
        await notificationManager.sendNotification({
          userId: settled.user_id,
          customTitle: "Solicitud cancelada automaticamente",
          customMessage: `Tu solicitud #${settled.id} fue cancelada automaticamente porque no tuvo aprobacion del jefe inmediato antes del inicio del permiso. Si asististe sin aprobacion previa, tienes 30 dias para subir los justificantes correspondientes.`,
          type: "warning",
          source: "permisos_vacaciones",
          priority: 1,
          email: true,
          meta: {
            solicitud_id: settled.id,
            tipo_solicitud: settled.tipo_solicitud || null,
            tipo_permiso: settled.tipo_permiso || null,
            status: "cancelled",
            cancellation_reason: settled.cancellation_reason || "auto_expired_without_approval",
            auto_cancelled_justification_deadline: settled.auto_cancelled_justification_deadline,
            target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${settled.id}`,
          },
        });
      }
    } catch (notifyError) {
      logger.warn(
        { notifyError, solicitudId: settled.id },
        "No se pudo notificar cancelacion automatica por vencimiento al solicitante"
      );
    }

    // Notify approver (jefe inmediato)
    try {
      if (settled?.approver_user_id) {
        await notificationManager.sendNotification({
          userId: settled.approver_user_id,
          customTitle: "Solicitud cancelada automaticamente",
          customMessage: `La solicitud #${settled.id} de ${settled.user_fullname || settled.user_email} fue cancelada automaticamente por vencimiento sin aprobacion. El colaborador tiene 30 dias para justificar si asistio sin autorizacion previa.`,
          type: "warning",
          source: "permisos_vacaciones",
          priority: 1,
          email: true,
          meta: {
            solicitud_id: settled.id,
            tipo_solicitud: settled.tipo_solicitud || null,
            tipo_permiso: settled.tipo_permiso || null,
            status: "cancelled",
            cancellation_reason: settled.cancellation_reason || "auto_expired_without_approval",
            auto_cancelled_justification_deadline: settled.auto_cancelled_justification_deadline,
            target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${settled.id}`,
          },
        });
      } else if (settled?.approver_email) {
        // Fallback: send email directly if no user_id for approver
        await notificationManager.sendNotification({
          userId: settled.user_id,
          customTitle: "Solicitud cancelada automaticamente",
          customMessage: `La solicitud #${settled.id} de ${settled.user_fullname || settled.user_email} fue cancelada automaticamente por vencimiento sin aprobacion.`,
          type: "warning",
          source: "permisos_vacaciones",
          priority: 1,
          email: true,
          meta: {
            solicitud_id: settled.id,
            email_to: settled.approver_email,
            status: "cancelled",
          },
        });
      }
    } catch (notifyError) {
      logger.warn(
        { notifyError, solicitudId: settled.id },
        "No se pudo notificar cancelacion automatica por vencimiento al aprobador"
      );
    }
  }
  return settled;
}

async function settleExpiredPendingSolicitudRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const settled = [];
  for (const row of rows) {
    settled.push(await settleExpiredPendingSolicitud(row));
  }
  return settled;
}

async function processExpiredPendingSolicitudes({ solicitudIds = null } = {}) {
  await ensureTable();

  const ids = Array.isArray(solicitudIds)
    ? solicitudIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  let query = `SELECT *
                 FROM permisos_vacaciones
                WHERE LOWER(COALESCE(status, '')) IN ('pending', 'pendiente')
                  AND COALESCE(es_emergencia, false) = false
                  AND LOWER(COALESCE(tipo_permiso, '')) <> 'salud'
                  AND aprobacion_parcial_at IS NULL
                  AND aprobacion_final_at IS NULL`;
  const values = [];
  if (ids.length > 0) {
    query += " AND id = ANY($1::int[])";
    values.push(ids);
  }

  const { rows } = await db.query(query, values);
  if (!rows.length) {
    return { scanned: 0, cancelled: 0 };
  }

  const settledRows = await settleExpiredPendingSolicitudRows(rows);
  const cancelled = settledRows.reduce(
    (acc, row) => acc + (normalizeStatusText(row?.status) === "cancelled" ? 1 : 0),
    0
  );

  return {
    scanned: rows.length,
    cancelled,
  };
}

async function settleExpiredRecoveryCoordination(row = {}) {
  if (!row?.id) return row;
  if (!row?.es_recuperable) return row;
  const normalizedSolicitudStatus = normalizeStatusText(row?.status);
  if (!["approved", "aprobado"].includes(normalizedSolicitudStatus)) return row;
  if (!isRecoveryCoordinationPending(row?.recovery_coordination_status)) return row;

  const deadlineDate = getRecoveryCoordinationDeadlineDate(row);
  const today = getCurrentDateInAppTimezone();
  if (!deadlineDate || !today || today <= deadlineDate) return row;

  const vacationCharge = buildVacationCharge(row);
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET recovery_coordination_status = 'finalized_by_approver',
            charged_to_vacation = true,
            charged_vacation_hours = COALESCE(charged_vacation_hours, $2),
            charged_vacation_days = COALESCE(charged_vacation_days, $3),
            charged_to_vacation_at = COALESCE(charged_to_vacation_at, NOW()),
            charged_to_vacation_reason = COALESCE(charged_to_vacation_reason, 'no_recovery_agreement'),
            updated_at = NOW()
      WHERE id = $1
        AND COALESCE(es_recuperable, false) = true
        AND LOWER(COALESCE(status, '')) IN ('approved', 'aprobado')
        AND LOWER(COALESCE(recovery_coordination_status, '')) IN ('pending_approver_proposal', 'pending_requester_acceptance')
      RETURNING *`,
    [row.id, vacationCharge.hours, vacationCharge.days]
  );
  const settled = rows[0] || row;
  if (rows[0]) {
    try {
      await logAction({
        usuario_id: row?.approver_user_id || null,
        usuario_email: row?.approver_email || "system",
        modulo: "permisos",
        accion: "descuento_vacaciones_sin_coordinacion",
        descripcion: "Se cerró coordinación de recuperación por vencimiento y se aplicó descuento a vacaciones.",
        datos_nuevos: {
          solicitud_id: settled.id,
          recovery_coordination_status: settled.recovery_coordination_status,
          charged_to_vacation: Boolean(settled.charged_to_vacation),
          charged_vacation_hours: settled.charged_vacation_hours,
          charged_vacation_days: settled.charged_vacation_days,
          charged_to_vacation_reason: settled.charged_to_vacation_reason || "no_recovery_agreement",
        },
        contexto: { auto: true },
      });
    } catch (auditError) {
      logger.warn({ auditError, solicitudId: settled.id }, "No se pudo registrar auditoría de cierre automático de coordinación");
    }
  }
  return settled;
}

async function settleExpiredRecoveryCoordinationRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const settled = [];
  for (const row of rows) {
    settled.push(await settleExpiredRecoveryCoordination(row));
  }
  return settled;
}

async function processExpiredRecoveryCoordinations() {
  const { rows } = await db.query(
    `SELECT *
       FROM permisos_vacaciones
      WHERE COALESCE(es_recuperable, false) = true
        AND LOWER(COALESCE(status, '')) IN ('approved', 'aprobado')
        AND LOWER(COALESCE(recovery_coordination_status, '')) IN ('pending_approver_proposal', 'pending_requester_acceptance')`
  );

  if (!rows.length) {
    return { scanned: 0, settled: 0 };
  }

  const settledRows = await settleExpiredRecoveryCoordinationRows(rows);
  const settledCount = settledRows.reduce((acc, row) => {
    return acc + (normalizeRecoveryCoordinationStatus(row?.recovery_coordination_status) === "finalized_by_approver" && row?.charged_to_vacation ? 1 : 0);
  }, 0);

  return {
    scanned: rows.length,
    settled: settledCount,
  };
}

function buildSignatureSnapshot(solicitud = {}) {
  return {
    id: solicitud.id,
    tipo_solicitud: solicitud.tipo_solicitud,
    tipo_permiso: solicitud.tipo_permiso,
    subtipo_salud: solicitud.subtipo_salud,
    status: solicitud.status,
    user_id: solicitud.user_id,
    user_email: solicitud.user_email,
    approver_user_id: solicitud.approver_user_id,
    approver_email: solicitud.approver_email,
    fecha_inicio: solicitud.fecha_inicio,
    fecha_fin: solicitud.fecha_fin,
    fecha_inicio_hora: solicitud.fecha_inicio_hora,
    fecha_fin_hora: solicitud.fecha_fin_hora,
    fecha_regreso: solicitud.fecha_regreso,
    duracion_horas: solicitud.duracion_horas,
    duracion_dias: solicitud.duracion_dias,
    periodo_vacaciones: solicitud.periodo_vacaciones,
    justificantes_urls: solicitud.justificantes_urls || [],
    observaciones: solicitud.observaciones || [],
    aprobacion_parcial_at: solicitud.aprobacion_parcial_at,
    aprobacion_final_at: solicitud.aprobacion_final_at,
    updated_at: solicitud.updated_at,
  };
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

function buildPdfSignatureText(signature, fallbackName = "") {
  const signerName = String(signature?.signer_name || fallbackName || "").trim();
  if (!signerName) return "";
  return `/s/ ${signerName}`;
}

async function getSignaturesBySolicitudIds(solicitudIds = []) {
  if (!Array.isArray(solicitudIds) || solicitudIds.length === 0) return new Map();
  const { rows } = await db.query(
    `SELECT id, solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
            signature_type, auth_method, consent_text, ip_address::text AS ip_address,
            user_agent, session_id, payload_hash_sha256, previous_signature_hash_sha256,
            signature_hash_sha256, is_current, signed_at, created_at
       FROM permisos_vacaciones_firmas
      WHERE solicitud_id = ANY($1)
      ORDER BY signed_at ASC, id ASC`,
    [solicitudIds]
  );

  const grouped = new Map();
  rows.forEach((row) => {
    const key = String(row.solicitud_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  return grouped;
}

async function attachWorkflowSignatures(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (ids.length === 0) return rows;

  const signaturesBySolicitud = await getSignaturesBySolicitudIds(ids);
  return rows.map((row) => {
    const normalizedStatus = String(row?.status || "").toLowerCase();
    if (["rejected", "rechazado"].includes(normalizedStatus)) {
      return {
        ...row,
        firmas_workflow: [],
        firma_avanzada_resumen: null,
        pdf_validacion_legal_url: null,
        legal_verification_token: null,
        legal_verification_url: null,
      };
    }

    const signatures = signaturesBySolicitud.get(String(row.id)) || [];
    return {
      ...row,
      firmas_workflow: signatures,
      firma_avanzada_resumen: buildWorkflowSignatureSummary(signatures),
      legal_verification_url: buildLegalVerificationUrl(row.legal_verification_token || null),
    };
  });
}

async function recordWorkflowSignature({
  solicitud,
  stage,
  actor,
  meta = {},
  consentText,
}) {
  const actorId = resolveActorId(actor);
  if (!solicitud?.id || !actorId || !stage) return null;

  const { rows: previousRows } = await db.query(
    `SELECT signature_hash_sha256
       FROM permisos_vacaciones_firmas
      WHERE solicitud_id = $1
      ORDER BY signed_at DESC, id DESC
      LIMIT 1`,
    [solicitud.id]
  );

  const previousSignatureHash = previousRows[0]?.signature_hash_sha256 || null;
  const signedAtIso = new Date().toISOString();
  const payloadHash = sha256Hex(stableStringify(buildSignatureSnapshot(solicitud)));
  const signatureHash = sha256Hex(
    stableStringify({
      solicitud_id: solicitud.id,
      stage,
      signer_user_id: actorId,
      signer_email: actor.email || null,
      signed_at: signedAtIso,
      payload_hash_sha256: payloadHash,
      previous_signature_hash_sha256: previousSignatureHash,
    })
  );

  const actorName = getDisplayName(actor);
  const actorRole = String(actor?.role || actor?.scope || actor?.rol || "").toLowerCase() || null;
  const requestMeta = getRequestMeta(meta);

  await db.query(
    `UPDATE permisos_vacaciones_firmas
        SET is_current = false, updated_at = NOW()
      WHERE solicitud_id = $1
        AND stage = $2
        AND is_current = true`,
    [solicitud.id, stage]
  );

  const { rows } = await db.query(
    `INSERT INTO permisos_vacaciones_firmas (
      solicitud_id, stage, signer_user_id, signer_email, signer_name, signer_role,
      signature_type, auth_method, consent_text, ip_address, user_agent, session_id,
      payload_hash_sha256, previous_signature_hash_sha256, signature_hash_sha256, is_current, signed_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'advanced_electronic','oauth_corporate',$7,$8,$9,$10,$11,$12,$13,true,$14)
    RETURNING *`,
    [
      solicitud.id,
      stage,
      actorId,
      actor.email || null,
      actorName,
      actorRole,
      consentText || `FamSign ${stage} en permisos/vacaciones SPI`,
      requestMeta.ipAddress,
      requestMeta.userAgent,
      requestMeta.sessionId,
      payloadHash,
      previousSignatureHash,
      signatureHash,
      signedAtIso,
    ]
  );

  return rows[0] || null;
}

let tableReady = false;
let tablePromise = null;

async function ensureTable() {
  if (tableReady) return;
  if (tablePromise) return tablePromise;

  tablePromise = (async () => {
    await db.query(`
    CREATE TABLE IF NOT EXISTS permisos_vacaciones (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_fullname TEXT,
      approver_role TEXT,
      tipo_solicitud TEXT NOT NULL DEFAULT 'vacaciones',
      tipo_permiso TEXT,
      subtipo_calamidad TEXT,
      subtipo_salud TEXT,
      duracion_horas DECIMAL(4,2),
      duracion_dias DECIMAL(5,2),
      fecha_inicio DATE,
      fecha_fin DATE,
      fecha_inicio_hora TIMESTAMPTZ,
      fecha_fin_hora TIMESTAMPTZ,
      es_recuperable BOOLEAN DEFAULT false,
      es_emergencia BOOLEAN NOT NULL DEFAULT false,
      periodo_vacaciones TEXT,
      justificacion_requerida TEXT[],
      recovery_plan JSONB,
      recovery_plan_total_hours DECIMAL(8,2),
      recovery_plan_updated_at TIMESTAMPTZ,
      recovery_plan_updated_by_user_id INTEGER,
      justificantes_urls TEXT[],
      aprobacion_parcial_at TIMESTAMPTZ,
      aprobacion_parcial_por TEXT,
      aprobacion_final_at TIMESTAMPTZ,
      aprobacion_final_por TEXT,
      pdf_generado_url TEXT,
      pdf_validacion_legal_url TEXT,
      observaciones TEXT[],
      allow_negative BOOLEAN NOT NULL DEFAULT false,
      projected_remaining_days DECIMAL(8,2),
      recovery_date DATE,
      monetary_debt NUMERIC(12,2),
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CHECK (tipo_solicitud IN ('permiso','vacaciones')),
      CHECK ((tipo_solicitud = 'permiso' AND tipo_permiso IN ('estudios','personal','salud','calamidad')) OR tipo_solicitud = 'vacaciones'),
      CHECK (status IN ('pending','partially_approved','pending_final','approved','rejected','cancelled'))
    );
  `);
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS approver_role TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS user_fullname TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS tipo_solicitud TEXT DEFAULT 'vacaciones'");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS tipo_permiso TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS subtipo_salud TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS duracion_horas DECIMAL(4,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS duracion_dias DECIMAL(5,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS fecha_inicio DATE");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS fecha_fin DATE");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS fecha_inicio_hora TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS fecha_fin_hora TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS es_emergencia BOOLEAN NOT NULL DEFAULT false");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS justificacion_requerida TEXT[]");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS recovery_plan JSONB");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS recovery_plan_total_hours DECIMAL(8,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS recovery_plan_updated_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS recovery_plan_updated_by_user_id INTEGER");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS recovery_coordination_status TEXT NOT NULL DEFAULT 'not_required'");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS recovery_coordination_round INTEGER NOT NULL DEFAULT 0");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_recovery_coordination_status_check");
    await db.query(
      "ALTER TABLE permisos_vacaciones ADD CONSTRAINT permisos_vacaciones_recovery_coordination_status_check CHECK (recovery_coordination_status IN ('not_required','pending_approver_proposal','pending_requester_acceptance','agreed','finalized_by_approver'))"
    );
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS justificantes_urls TEXT[]");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS aprobacion_parcial_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS aprobacion_final_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS approver_user_id INTEGER");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS approver_email TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS charged_to_vacation BOOLEAN NOT NULL DEFAULT false");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS charged_vacation_hours DECIMAL(8,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS charged_vacation_days DECIMAL(8,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS charged_to_vacation_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS charged_to_vacation_reason TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS pdf_validacion_legal_url TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS allow_negative BOOLEAN NOT NULL DEFAULT false");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS projected_remaining_days DECIMAL(8,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS recovery_date DATE");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS monetary_debt NUMERIC(12,2)");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS legal_verification_token TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS legal_verification_created_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancelled_by_user_id INTEGER");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancelled_by_email TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_reason TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'none'");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_requested_by_user_id INTEGER");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_requested_by_email TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_request_reason TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_user_id INTEGER");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_email TEXT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS cancellation_review_reason TEXT");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_cancellation_status_check");
    await db.query(
      "ALTER TABLE permisos_vacaciones ADD CONSTRAINT permisos_vacaciones_cancellation_status_check CHECK (cancellation_status IN ('none','pending','approved','rejected'))"
    );
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS study_enrollment_id BIGINT");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS auto_cancelled_justification_deadline TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS auto_cancelled_justification_warning_sent BOOLEAN NOT NULL DEFAULT false");
    await db.query("ALTER TABLE permisos_vacaciones ADD COLUMN IF NOT EXISTS auto_cancelled_justification_submitted_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_check1");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_subtipo_calamidad_check");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_subtipo_salud_check");
    await db.query("ALTER TABLE permisos_vacaciones DROP CONSTRAINT IF EXISTS permisos_vacaciones_status_check");
    await db.query(
      "UPDATE permisos_vacaciones SET subtipo_salud = 'enfermedad_certificada' WHERE tipo_permiso = 'salud' AND (subtipo_salud IS NULL OR length(trim(subtipo_salud)) = 0)"
    );
    await db.query(
      "ALTER TABLE permisos_vacaciones ADD CONSTRAINT permisos_vacaciones_subtipo_calamidad_check CHECK ((tipo_permiso = 'calamidad' AND subtipo_calamidad IS NOT NULL AND length(trim(subtipo_calamidad)) > 0) OR tipo_permiso != 'calamidad')"
    );
    await db.query(
      "ALTER TABLE permisos_vacaciones ADD CONSTRAINT permisos_vacaciones_subtipo_salud_check CHECK ((tipo_permiso = 'salud' AND subtipo_salud IS NOT NULL AND length(trim(subtipo_salud)) > 0) OR tipo_permiso != 'salud')"
    );
    await db.query(
      "ALTER TABLE permisos_vacaciones ADD CONSTRAINT permisos_vacaciones_status_check CHECK (status IN ('pending','partially_approved','pending_final','approved','rejected','cancelled'))"
    );
    await db.query(`
      CREATE TABLE IF NOT EXISTS permisos_estudios_matriculas (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_email TEXT NOT NULL,
        institution_name TEXT NOT NULL,
        program_name TEXT,
        valid_from DATE NOT NULL,
        valid_until DATE NOT NULL,
        drive_file_id TEXT,
        drive_file_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending_validation',
        created_by_user_id INTEGER REFERENCES users(id),
        approver_role TEXT,
        approver_user_id INTEGER REFERENCES users(id),
        approver_email TEXT,
        reviewed_at TIMESTAMPTZ,
        reviewed_by_user_id INTEGER REFERENCES users(id),
        reviewed_by_email TEXT,
        review_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT permisos_estudios_matriculas_status_check CHECK (status IN ('pending_validation', 'active', 'rejected', 'expired', 'cancelled')),
        CONSTRAINT permisos_estudios_matriculas_range_check CHECK (valid_until >= valid_from)
      );
    `);
    await db.query("ALTER TABLE permisos_estudios_matriculas ADD COLUMN IF NOT EXISTS approver_role TEXT");
    await db.query("ALTER TABLE permisos_estudios_matriculas ADD COLUMN IF NOT EXISTS approver_user_id INTEGER");
    await db.query("ALTER TABLE permisos_estudios_matriculas ADD COLUMN IF NOT EXISTS approver_email TEXT");
    await db.query("ALTER TABLE permisos_estudios_matriculas ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ");
    await db.query("ALTER TABLE permisos_estudios_matriculas ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER");
    await db.query("ALTER TABLE permisos_estudios_matriculas ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT");
    await db.query("ALTER TABLE permisos_estudios_matriculas ADD COLUMN IF NOT EXISTS review_reason TEXT");
    await db.query("ALTER TABLE permisos_estudios_matriculas DROP CONSTRAINT IF EXISTS permisos_estudios_matriculas_status_check");
    await db.query(
      "ALTER TABLE permisos_estudios_matriculas ADD CONSTRAINT permisos_estudios_matriculas_status_check CHECK (status IN ('pending_validation','active','rejected','expired','cancelled'))"
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_permisos_matriculas_user_status
       ON permisos_estudios_matriculas (user_id, status, valid_until DESC)`
    );
    await db.query(`DROP INDEX IF EXISTS ux_permisos_matriculas_active_user`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS permisos_vacaciones_firmas (
        id BIGSERIAL PRIMARY KEY,
        solicitud_id BIGINT NOT NULL REFERENCES permisos_vacaciones(id) ON DELETE CASCADE,
        stage TEXT NOT NULL,
        signer_user_id INTEGER NOT NULL REFERENCES users(id),
        signer_email TEXT,
        signer_name TEXT NOT NULL,
        signer_role TEXT,
        signature_type TEXT NOT NULL DEFAULT 'advanced_electronic',
        auth_method TEXT NOT NULL DEFAULT 'oauth_corporate',
        consent_text TEXT,
        ip_address INET,
        user_agent TEXT,
        session_id TEXT,
        payload_hash_sha256 VARCHAR(64) NOT NULL,
        previous_signature_hash_sha256 VARCHAR(64),
        signature_hash_sha256 VARCHAR(64) NOT NULL,
        is_current BOOLEAN NOT NULL DEFAULT true,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT permisos_vacaciones_firmas_stage_check
          CHECK (stage IN ('solicitud', 'aprobacion_parcial', 'aprobacion_final', 'rechazo')),
        CONSTRAINT permisos_vacaciones_firmas_payload_hash_check
          CHECK (payload_hash_sha256 ~ '^[a-f0-9]{64}$'),
        CONSTRAINT permisos_vacaciones_firmas_signature_hash_check
          CHECK (signature_hash_sha256 ~ '^[a-f0-9]{64}$'),
        CONSTRAINT permisos_vacaciones_firmas_prev_hash_check
          CHECK (previous_signature_hash_sha256 IS NULL OR previous_signature_hash_sha256 ~ '^[a-f0-9]{64}$')
      );
    `);
    await db.query("ALTER TABLE permisos_vacaciones_firmas ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true");
    await db.query("ALTER TABLE permisos_vacaciones_firmas DROP CONSTRAINT IF EXISTS permisos_vacaciones_firmas_unique_stage");
    await db.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY solicitud_id, stage
                 ORDER BY signed_at DESC, id DESC
               ) AS rn
          FROM permisos_vacaciones_firmas
      )
      UPDATE permisos_vacaciones_firmas f
         SET is_current = (ranked.rn = 1)
        FROM ranked
       WHERE ranked.id = f.id
    `);
    await db.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_permisos_firmas_current_stage
       ON permisos_vacaciones_firmas (solicitud_id, stage)
       WHERE is_current = true`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_permisos_firmas_solicitud_signed_at
       ON permisos_vacaciones_firmas (solicitud_id, signed_at DESC, id DESC)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_permisos_firmas_signer_user
       ON permisos_vacaciones_firmas (signer_user_id, signed_at DESC)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_permisos_firmas_stage
       ON permisos_vacaciones_firmas (stage, signed_at DESC)`
    );
    await db.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_permisos_legal_verification_token
       ON permisos_vacaciones (legal_verification_token)
       WHERE legal_verification_token IS NOT NULL`
    );

    tableReady = true;
  })();

  try {
    await tablePromise;
  } finally {
    tablePromise = null;
  }
}

async function getActiveStudyEnrollment({ userId, date = null }) {
  if (!userId) return null;
  await ensureTable();
  await expireStudyEnrollmentsIfNeeded({ userId });
  const normalizedDate = normalizeDateOnly(date || new Date());
  const { rows } = await db.query(
    `SELECT *
       FROM permisos_estudios_matriculas
      WHERE user_id = $1
        AND status = 'active'
        AND valid_from <= $2::date
        AND valid_until >= $2::date
      ORDER BY valid_until DESC, id DESC
      LIMIT 1`,
    [userId, normalizedDate]
  );
  return rows[0] || null;
}

async function expireStudyEnrollmentsIfNeeded({ userId = null } = {}) {
  await db.query(
    `UPDATE permisos_estudios_matriculas
        SET status = 'expired',
            updated_at = NOW()
      WHERE status = 'active'
        AND valid_until < CURRENT_DATE
        AND ($1::int IS NULL OR user_id = $1)`,
    [userId]
  );
}

async function listMyStudyEnrollments({ userId }) {
  if (!userId) return [];
  await ensureTable();
  await expireStudyEnrollmentsIfNeeded({ userId });
  const { rows } = await db.query(
    `SELECT *
       FROM permisos_estudios_matriculas
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return rows;
}

async function listPendingStudyEnrollments({ approver }) {
  await ensureTable();
  const roleCandidates = getApproverRoleCandidates(approver);
  const { rows } = await db.query(
    `SELECT
        m.*,
        COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), m.user_email) AS user_fullname
       FROM permisos_estudios_matriculas m
       LEFT JOIN users u ON u.id = m.user_id
      WHERE m.status = 'pending_validation'
        AND (
          (m.approver_user_id IS NOT NULL AND m.approver_user_id = $1)
          OR LOWER(COALESCE(m.approver_role, '')) = ANY($2)
        )
      ORDER BY m.created_at DESC, m.id DESC`,
    [resolveActorId(approver), roleCandidates]
  );
  return rows;
}

async function registerStudyEnrollment({ actor, payload, file }) {
  await ensureTable();
  const actorId = resolveActorId(actor);
  if (!actorId) {
    const err = new Error("Usuario inválido para registrar matrícula");
    err.status = 400;
    throw err;
  }

  const identity = await getUserIdentity(actorId);
  const institutionName = String(payload?.institution_name || "").trim();
  if (!institutionName) {
    const err = new Error("El nombre de la institución es obligatorio");
    err.status = 400;
    throw err;
  }

  const validFrom = normalizeDateOnly(payload?.valid_from || new Date());
  const validUntil = normalizeDateOnly(payload?.valid_until);
  if (!validUntil) {
    const err = new Error("La fecha de caducidad de la matrícula es obligatoria");
    err.status = 400;
    throw err;
  }
  if (new Date(validUntil) < new Date(validFrom)) {
    const err = new Error("La fecha de caducidad debe ser mayor o igual a la fecha de inicio");
    err.status = 400;
    throw err;
  }
  if (!file?.buffer) {
    const err = new Error("Debes adjuntar el archivo de matrícula");
    err.status = 400;
    throw err;
  }

  const preferredApproverRoles = buildPreferredApproverRoles(actor);
  const approverResolution = await resolveApproverWithFallback(preferredApproverRoles);
  const approverRole = approverResolution.approverRole;
  const approverUser = approverResolution.approverUser;
  logger.info(
    {
      actorRoles: getActorRoleCandidates(actor),
      preferredApproverRoles,
      resolvedApproverRole: approverRole,
      resolvedApproverEmail: approverUser?.email || null,
      fallbackApplied: approverResolution.fallbackApplied,
    },
    "Resolucion de aprobador para matricula de estudios"
  );
  if (!approverUser?.id) {
    const err = new Error(
      "No se encontró un aprobador activo (jefe inmediato o gerencia general) para validar la matrícula"
    );
    err.status = 400;
    throw err;
  }

  const upload = await uploadStudyEnrollmentDocument({
    user: {
      id: actorId,
      email: identity?.email || actor?.email,
      fullname: identity?.fullname || getDisplayName(actor),
    },
    fileBuffer: file.buffer,
    fileName: file.originalname,
    mimeType: file.mimetype,
  });

  const { rows } = await db.query(
    `INSERT INTO permisos_estudios_matriculas (
      user_id, user_email, institution_name, program_name, valid_from, valid_until,
      drive_file_id, drive_file_url, status, created_by_user_id,
      approver_role, approver_user_id, approver_email
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_validation',$9,$10,$11,$12)
    RETURNING *`,
    [
      actorId,
      identity?.email || actor?.email || null,
      institutionName,
      payload?.program_name || null,
      validFrom,
      validUntil,
      upload?.fileId || null,
      upload?.webViewLink || null,
      actorId,
      approverRole,
      approverUser.id,
      approverUser.email || null,
    ]
  );

  try {
    await notificationManager.sendNotification({
      userId: approverUser.id,
      customTitle: "Matrícula de estudios pendiente",
      customMessage: `${identity?.fullname || actor?.email} subió una matrícula para validación.`,
      type: "task",
      source: "permisos_vacaciones",
      priority: 1,
      email: true,
      meta: {
        enrollment_id: rows[0]?.id,
        user_id: actorId,
        status: "pending_validation",
        target_path: `/dashboard/talento-humano/permisos?tab=study_enrollments&enrollmentId=${rows[0]?.id}`,
      },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, enrollmentId: rows[0]?.id }, "No se pudo notificar matrícula pendiente");
  }

  return rows[0] || null;
}

async function reviewStudyEnrollment({ id, approver, decision, reason }) {
  await ensureTable();
  const actorId = resolveActorId(approver);
  if (!actorId) {
    const err = new Error("Usuario inválido para revisar matrícula");
    err.status = 400;
    throw err;
  }
  const normalizedDecision = String(decision || "").trim().toLowerCase();
  if (!["approve", "reject"].includes(normalizedDecision)) {
    const err = new Error("Decisión inválida, usa approve o reject");
    err.status = 400;
    throw err;
  }
  const reviewReason = String(reason || "").trim() || null;
  if (normalizedDecision === "reject" && !reviewReason) {
    const err = new Error("Debes registrar el motivo del rechazo");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT * FROM permisos_estudios_matriculas WHERE id = $1 LIMIT 1`,
    [id]
  );
  const enrollment = rows[0];
  if (!enrollment) {
    const err = new Error("Matrícula no encontrada");
    err.status = 404;
    throw err;
  }
  if (String(enrollment.status || "").toLowerCase() !== "pending_validation") {
    const err = new Error("La matrícula ya fue revisada");
    err.status = 409;
    throw err;
  }
  const canReview =
    Number(enrollment.approver_user_id) === Number(actorId) ||
    canApprove({
      approverRole: enrollment.approver_role,
      approverUserId: enrollment.approver_user_id,
      approver,
    });
  if (!canReview) {
    const err = new Error("No autorizado para revisar esta matrícula");
    err.status = 403;
    throw err;
  }

  let updated = null;
  if (normalizedDecision === "approve") {
    const { rows: approvedRows } = await db.query(
      `UPDATE permisos_estudios_matriculas
          SET status = 'active',
              reviewed_at = NOW(),
              reviewed_by_user_id = $2,
              reviewed_by_email = $3,
              review_reason = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId, approver?.email || null, reviewReason]
    );
    updated = approvedRows[0];
  } else {
    const { rows: rejectedRows } = await db.query(
      `UPDATE permisos_estudios_matriculas
          SET status = 'rejected',
              reviewed_at = NOW(),
              reviewed_by_user_id = $2,
              reviewed_by_email = $3,
              review_reason = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId, approver?.email || null, reviewReason]
    );
    updated = rejectedRows[0];
  }

  try {
    await notificationManager.sendNotification({
      userId: updated?.user_id,
      customTitle:
        normalizedDecision === "approve"
          ? "Matrícula validada"
          : "Matrícula rechazada",
      customMessage:
        normalizedDecision === "approve"
          ? "Tu matrícula fue validada y ya está disponible para permisos por estudios."
          : "Tu matrícula fue rechazada. Revisa el motivo y vuelve a cargarla.",
      type: normalizedDecision === "approve" ? "success" : "warning",
      source: "permisos_vacaciones",
      priority: 1,
      email: true,
      meta: {
        enrollment_id: updated?.id,
        decision: normalizedDecision,
        reason: reviewReason,
        target_path: `/dashboard/talento-humano/permisos?tab=mine`,
      },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, enrollmentId: updated?.id }, "No se pudo notificar revisión de matrícula");
  }

  return updated;
}

async function createSolicitud({ body, user, meta }) {
  await ensureTable();
  let requesterIdentity = null;
  const requesterUserId = resolveActorId(user);
  await assertRequesterCanCreateTimeOff(requesterUserId);
  if (requesterUserId) {
    try {
      requesterIdentity = await getUserIdentity(requesterUserId);
    } catch (error) {
      logger.warn({ error, userId: requesterUserId }, "No se pudo resolver identidad del solicitante");
    }
  }
  const payload = { ...body };
  payload.tipo_solicitud = payload.tipo_solicitud || "permiso";
  payload.user_email = requesterIdentity?.email || user?.email;
  payload.user_fullname = requesterIdentity?.fullname || getDisplayName(user);
  payload.user_id = requesterUserId;
  payload.allow_negative = Boolean(payload.allow_negative);
  payload.es_emergencia =
    payload.tipo_solicitud === "permiso" ? normalizeBooleanFlag(payload.es_emergencia) : false;
  payload.projected_remaining_days = null;
  payload.recovery_date = null;
  payload.monetary_debt = null;
  const consentVersion = String(payload.fam_sign_notice_version || "FS-WF-2026.02").trim();
  const consentTextFromUi = String(payload.fam_sign_consent_text || "").trim();
  const famSignConsentText =
    consentTextFromUi ||
    `Acepto el uso de FamSign para firma y validacion del workflow de esta solicitud (${consentVersion}).`;
  const preferredApproverRoles = buildPreferredApproverRoles(user);
  const approverResolution = await resolveApproverWithFallback(preferredApproverRoles);
  payload.approver_role = approverResolution.approverRole;
  const approverUser = approverResolution.approverUser;
  payload.approver_user_id = approverUser?.id || null;
  payload.approver_email = approverUser?.email || null;
  logger.info(
    {
      requesterRoles: getActorRoleCandidates(user),
      preferredApproverRoles,
      resolvedApproverRole: payload.approver_role,
      resolvedApproverEmail: payload.approver_email,
      fallbackApplied: approverResolution.fallbackApplied,
    },
    "Resolucion de aprobador para solicitud de permiso/vacaciones"
  );
  if (!payload.approver_user_id) {
    const err = new Error(
      "No se encontró un aprobador activo para tu solicitud (jefe inmediato o gerencia general)."
    );
    err.status = 400;
    throw err;
  }

  let driveMeta = {};
  let justificacionRequerida = [];
  let esRecuperable = false;
  let recoveryPlan = [];
  let recoveryPlanTotalHours = 0;
  const startDateTimeRaw = payload.fecha_inicio_hora || payload.fecha_inicio_datetime || payload.start_time;
  const endDateTimeRaw = payload.fecha_fin_hora || payload.fecha_fin_datetime || payload.end_time;
  payload.fecha_inicio_hora = normalizeDateTime(startDateTimeRaw);
  payload.fecha_fin_hora = normalizeDateTime(endDateTimeRaw);
  payload.fecha_inicio = normalizeDateOnly(payload.fecha_inicio || payload.fecha_inicio_hora);
  payload.fecha_fin = normalizeDateOnly(payload.fecha_fin || payload.fecha_fin_hora);

  // Validar y procesar segun tipo de solicitud
  if (payload.tipo_solicitud === "permiso") {
    const isEstudios = payload.tipo_permiso === "estudios";
    const isPersonal = payload.tipo_permiso === "personal";
    const isSaludByHours =
      payload.tipo_permiso === "salud" &&
      Number(payload.duracion_horas || 0) > 0 &&
      !Number(payload.duracion_dias || 0);
    const isCalamidadByHours =
      payload.tipo_permiso === "calamidad" &&
      Number(payload.duracion_horas || 0) > 0 &&
      !Number(payload.duracion_dias || 0);
    const isSimpleHourlyPermiso = isEstudios || isPersonal || isSaludByHours || isCalamidadByHours;
    if (
      isSimpleHourlyPermiso &&
      payload.fecha_inicio_hora &&
      !payload.fecha_fin_hora &&
      Number(payload.duracion_horas || 0) > 0
    ) {
      const inferredEndDateTime = addHoursToDateTime(payload.fecha_inicio_hora, payload.duracion_horas);
      if (!inferredEndDateTime) {
        const err = new Error("No se pudo calcular la fecha/hora de fin del permiso.");
        err.status = 400;
        throw err;
      }
      payload.fecha_fin_hora = inferredEndDateTime;
      payload.fecha_fin = normalizeDateOnly(inferredEndDateTime);
    }
    const hasDateTimeRange = Boolean(payload.fecha_inicio_hora && payload.fecha_fin_hora);
    const shouldAutoCalculateHours =
      (isEstudios || isPersonal || payload.tipo_permiso === "salud" || payload.tipo_permiso === "calamidad") && hasDateTimeRange;
    if (shouldAutoCalculateHours) {
      const durationHours = calculateDurationHours(payload.fecha_inicio_hora, payload.fecha_fin_hora);
      if (!durationHours) {
        const err = new Error("La fecha/hora de fin debe ser posterior a la fecha/hora de inicio.");
        err.status = 400;
        throw err;
      }
      payload.duracion_horas = durationHours;
      payload.duracion_dias = "";
    }
    if (isSimpleHourlyPermiso) {
      const requestedHours = Number(payload.duracion_horas || 0);
      if (!Number.isFinite(requestedHours) || requestedHours <= 0) {
        const err = new Error("Debes indicar una duración válida en horas para este permiso.");
        err.status = 400;
        throw err;
      }
      const startDay = normalizeDateOnly(payload.fecha_inicio_hora);
      const endDay = normalizeDateOnly(payload.fecha_fin_hora);
      if (startDay && endDay && startDay !== endDay) {
        const err = new Error("El permiso debe iniciar y terminar el mismo día.");
        err.status = 400;
        throw err;
      }
    }
    // Guardrail de negocio en backend: no depender de validaciones de UI.
    if (isEstudios && Number(payload.duracion_horas || 0) > 3) {
      const err = new Error("El permiso por estudios no puede exceder 3 horas.");
      err.status = 400;
      throw err;
    }
    if (isPersonal && Number(payload.duracion_horas || 0) > 2) {
      const err = new Error("El permiso por asuntos personales no puede exceder 2 horas.");
      err.status = 400;
      throw err;
    }
    if (
      (payload.tipo_permiso === "salud" || payload.tipo_permiso === "calamidad") &&
      !payload.duracion_dias &&
      !payload.duracion_horas &&
      payload.fecha_inicio &&
      payload.fecha_fin
    ) {
      const start = new Date(payload.fecha_inicio);
      const end = new Date(payload.fecha_fin);
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
      payload.duracion_dias = diff >= 0 ? diff + 1 : 0;
    }
    if (payload.tipo_permiso === "salud") {
      payload.subtipo_salud = String(payload.subtipo_salud || "").trim().toLowerCase();
      if (!payload.subtipo_salud) {
        const err = new Error("Debes seleccionar el subtipo de permiso por salud.");
        err.status = 400;
        throw err;
      }
    } else {
      payload.subtipo_salud = null;
    }
    let validation = null;
    if (isEstudios) {
      const enrollmentId = Number(payload.study_enrollment_id || 0);
      if (!enrollmentId) {
        const err = new Error("Debes seleccionar una matrícula activa para solicitar permiso por estudios.");
        err.status = 400;
        throw err;
      }
      const { rows: enrollmentRows } = await db.query(
        `SELECT *
           FROM permisos_estudios_matriculas
          WHERE id = $1
            AND user_id = $2
          LIMIT 1`,
        [enrollmentId, payload.user_id]
      );
      const enrollment = enrollmentRows[0];
      const startDateForEnrollment = normalizeDateOnly(payload.fecha_inicio || payload.fecha_inicio_hora || new Date());
      if (
        !enrollment ||
        String(enrollment.status || "").toLowerCase() !== "active" ||
        enrollment.valid_from > startDateForEnrollment ||
        enrollment.valid_until < startDateForEnrollment
      ) {
        const err = new Error(
          "La matrícula seleccionada no está activa o no aplica a la fecha del permiso."
        );
        err.status = 400;
        throw err;
      }
      payload.study_enrollment_id = enrollmentId;
      validation = await validatePermisoRequest(payload);
    } else if (isPersonal) {
      validation = await validatePermisoRequest(payload);
      validation.justificantes_requeridos = [];
    } else {
      validation = await validatePermisoRequest(payload);
    }
    justificacionRequerida = validation.justificantes_requeridos || [];
    esRecuperable = Boolean(validation.es_recuperable);

    if (payload.recovery_plan !== undefined && payload.recovery_plan !== null && payload.recovery_plan !== "") {
      const err = new Error("La coordinación de tramos solo se habilita después de la aprobación definitiva.");
      err.status = 400;
      throw err;
    }
  } else if (payload.tipo_solicitud === "vacaciones") {
    const hasHourRangePayload =
      Boolean(payload.fecha_inicio_hora || payload.fecha_inicio_datetime || payload.start_time) &&
      Boolean(payload.fecha_fin_hora || payload.fecha_fin_datetime || payload.end_time);
    if (Number(payload.duracion_horas || 0) > 0 || hasHourRangePayload) {
      payload.fecha_inicio_hora = normalizeDateTime(
        payload.fecha_inicio_hora || payload.fecha_inicio_datetime || payload.start_time
      );
      payload.fecha_fin_hora = normalizeDateTime(
        payload.fecha_fin_hora || payload.fecha_fin_datetime || payload.end_time
      );
      if (!payload.fecha_inicio_hora || !payload.fecha_fin_hora) {
        const err = new Error("Para vacaciones por horas debes indicar fecha/hora inicio y fin.");
        err.status = 400;
        throw err;
      }
      const hours = calculateDurationHours(payload.fecha_inicio_hora, payload.fecha_fin_hora);
      if (!hours || hours <= 0) {
        const err = new Error("El rango horario de vacaciones no es válido.");
        err.status = 400;
        throw err;
      }
      payload.duracion_horas = hours;
      if (!payload.duracion_dias) payload.duracion_dias = Math.round((hours / 8) * 100) / 100;
      if (!payload.fecha_inicio) payload.fecha_inicio = normalizeDateOnly(payload.fecha_inicio_hora);
      if (!payload.fecha_fin) payload.fecha_fin = normalizeDateOnly(payload.fecha_fin_hora);
    }

    if (!payload.duracion_dias && payload.fecha_inicio && payload.fecha_fin) {
      const start = new Date(payload.fecha_inicio);
      const end = new Date(payload.fecha_fin);
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
      payload.duracion_dias = diff >= 0 ? diff + 1 : 0;
    }

    // Calcular fecha de regreso si no viene
    if (!payload.fecha_regreso && payload.fecha_fin) {
      const endDate = new Date(payload.fecha_fin);
      endDate.setDate(endDate.getDate() + 1);
      payload.fecha_regreso = endDate.toISOString().split("T")[0];
    }

    const requestYear = payload.fecha_inicio
      ? new Date(payload.fecha_inicio).getFullYear()
      : new Date().getFullYear();
    const hireDate = await getHireDate(payload.user_id);
    const allowanceInfo = computeVacationAllowance(hireDate, payload.fecha_inicio || new Date());
    const consumption = await getVacationConsumption({
      userId: payload.user_id,
      userEmail: payload.user_email,
      year: requestYear,
    });
    const historicalBalance = await getHistoricVacationBalance({
      userId: payload.user_id,
      userEmail: payload.user_email,
      year: requestYear,
    });
    const remaining =
      allowanceInfo.allowance + historicalBalance - consumption.approved - consumption.pending;
    const requestedVacationDays = Number(payload.duracion_dias || 0);
    const projection = computeVacationNegativeProjection({
      remaining,
      requestedDays: requestedVacationDays,
      allowancePerYear: allowanceInfo.allowance || ANNUAL_ALLOWANCE,
      startDate: payload.fecha_inicio || new Date(),
    });
    const exceedsBalance =
      allowanceInfo.eligible &&
      !allowanceInfo.missingHireDate &&
      projection.exceeds_balance;
    if (exceedsBalance && !payload.allow_negative) {
      const err = new Error(
        `La solicitud excede tu saldo. Déficit proyectado: ${projection.deficit_days} días (${projection.deficit_hours} horas). Saldo resultante: ${projection.projected_remaining} días. Confirma envío para continuar.`
      );
      err.status = 400;
      throw err;
    }
    payload.projected_remaining_days = projection.projected_remaining;
    payload.recovery_date = null;
    payload.monetary_debt = null;

    // Generar documento en Drive para vacaciones
    try {
      const { uploadVacationDocument } = require("./permisos.drive");
      driveMeta = await uploadVacationDocument({
        user,
        fecha_inicio: payload.fecha_inicio,
        fecha_fin: payload.fecha_fin,
        fecha_regreso: payload.fecha_regreso,
        periodo: payload.periodo_vacaciones,
        dias: payload.duracion_dias,
      });
    } catch (err) {
      console.warn("No se pudo generar documento de vacaciones:", err.message);
    }
  }

  const { rows } = await db.query(
    `INSERT INTO permisos_vacaciones (
      user_email, user_fullname, user_id, approver_role, approver_user_id, approver_email, department_id,
      tipo_solicitud, tipo_permiso, subtipo_calamidad, subtipo_salud,
      duracion_horas, duracion_dias, fecha_inicio, fecha_fin, fecha_inicio_hora, fecha_fin_hora, fecha_regreso,
      es_recuperable, periodo_vacaciones, justificacion_requerida, study_enrollment_id,
      recovery_plan, recovery_plan_total_hours, recovery_plan_updated_at, recovery_plan_updated_by_user_id, recovery_coordination_status,
      drive_doc_id, drive_pdf_id, drive_doc_link, drive_pdf_link, drive_folder_id,
      allow_negative, projected_remaining_days, recovery_date, monetary_debt, es_emergencia,
      status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,'pending') RETURNING *`,
    [
      payload.user_email,
      payload.user_fullname,
      payload.user_id,
      payload.approver_role,
      payload.approver_user_id,
      payload.approver_email,
      user?.department_id || null,
      payload.tipo_solicitud,
      payload.tipo_permiso || null,
      payload.subtipo_calamidad || null,
      payload.subtipo_salud || null,
      payload.duracion_horas || null,
      payload.duracion_dias || null,
      payload.fecha_inicio || null,
      payload.fecha_fin || null,
      payload.fecha_inicio_hora || null,
      payload.fecha_fin_hora || null,
      payload.fecha_regreso || null,
      esRecuperable,
      payload.periodo_vacaciones || null,
      justificacionRequerida.length > 0 ? justificacionRequerida : null,
      payload.study_enrollment_id || null,
      recoveryPlan.length > 0 ? JSON.stringify(recoveryPlan) : null,
      recoveryPlanTotalHours > 0 ? recoveryPlanTotalHours : null,
      recoveryPlan.length > 0 ? new Date().toISOString() : null,
      recoveryPlan.length > 0 ? payload.user_id : null,
      "not_required",
      driveMeta.drive_doc_id || null,
      driveMeta.drive_pdf_id || null,
      driveMeta.drive_doc_link || null,
      driveMeta.drive_pdf_link || null,
      driveMeta.folderId || null,
      payload.allow_negative,
      payload.projected_remaining_days,
      payload.recovery_date,
      payload.monetary_debt,
      payload.es_emergencia,
    ]
  );

  await logAction({ usuario_email: user?.email, modulo: "permisos", accion: "crear" });
  const approverLabel = GERENCIA_GENERAL_ROLES.has(String(payload.approver_role || "").toLowerCase())
    ? "gerencia general"
    : "jefe inmediato";

  try {
    if (payload.user_id) {
      await notificationManager.sendNotification({
        userId: payload.user_id,
        customTitle: "Solicitud enviada",
        customMessage: `Tu solicitud de ${payload.tipo_solicitud} fue enviada para aprobacion de ${approverLabel}.`,
        type: "info",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: rows[0].id,
          tipo_solicitud: payload.tipo_solicitud,
          solicitante: payload.user_email,
          approver_user_id: payload.approver_user_id,
          fam_sign_notice_version: consentVersion,
          target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}`,
        },
      });
    }
    if (payload.approver_user_id && payload.approver_user_id !== payload.user_id) {
      await notificationManager.sendNotification({
        userId: payload.approver_user_id,
        customTitle: "Nueva solicitud pendiente",
        customMessage: `${payload.user_fullname || payload.user_email} envio una solicitud de ${payload.tipo_solicitud}.`,
        type: "task",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: rows[0].id,
          tipo_solicitud: payload.tipo_solicitud,
          solicitante: payload.user_email,
          target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${rows[0].id}`,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: rows[0]?.id }, "No se pudo enviar notificaci?n de solicitud");
  }

  try {
    await recordWorkflowSignature({
      solicitud: rows[0],
      stage: WORKFLOW_SIGNATURE_STAGES.SOLICITUD,
      actor: user,
      meta,
      consentText: famSignConsentText,
    });
  } catch (signatureError) {
    logger.warn({ signatureError, solicitudId: rows[0]?.id }, "No se pudo registrar FamSign en solicitud");
  }

  const enriched = await attachWorkflowSignatures([rows[0]]);
  return enriched[0] || rows[0];
}

function canApprove({ approverRole, approverUserId, approver }) {
  const roleCandidates = getApproverRoleCandidates(approver);
  if (roleCandidates.length === 0) return false;
  const approverActorId = resolveActorId(approver);
  if (approverUserId && approverActorId === approverUserId) return true;
  if (!approverRole) return false;
  const expected = String(approverRole || "").toLowerCase();
  if (GERENCIA_GENERAL_ROLES.has(expected)) {
    return roleCandidates.some((role) => GERENCIA_GENERAL_ROLES.has(role));
  }
  return roleCandidates.includes(expected);
}

function normalizeRecoveryCoordinationStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  const allowed = new Set([
    "not_required",
    "pending_approver_proposal",
    "pending_requester_acceptance",
    "agreed",
    "finalized_by_approver",
  ]);
  if (allowed.has(status)) return status;
  return "not_required";
}

async function aprobarParcial({ id, approver, meta }) {
  await ensureTable();
  const existing = await db.query(
    `SELECT approver_role, approver_user_id, status, tipo_solicitud, tipo_permiso FROM permisos_vacaciones WHERE id = $1 LIMIT 1`,
    [id]
  );
  const solicitud = existing.rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.tipo_solicitud === "vacaciones") {
    const err = new Error("Las solicitudes de vacaciones se aprueban de forma definitiva");
    err.status = 400;
    throw err;
  }
  if (!canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver })) {
    const err = new Error("No autorizado para aprobar esta solicitud");
    err.status = 403;
    throw err;
  }
  const approverName = getDisplayName(approver);
  const shouldAutoFinal = isAutoFinalPermisoType(solicitud.tipo_permiso);
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET status = $3,
            aprobacion_parcial_at = CASE WHEN $4 THEN NULL ELSE now() END,
            aprobacion_parcial_por = $2,
            aprobacion_final_at = CASE WHEN $4 THEN now() ELSE aprobacion_final_at END,
            aprobacion_final_por = CASE WHEN $4 THEN $2 ELSE aprobacion_final_por END,
            recovery_coordination_status = CASE
              WHEN $4 AND COALESCE(es_recuperable, false) THEN 'pending_approver_proposal'
              ELSE recovery_coordination_status
            END,
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, approverName, shouldAutoFinal ? "approved" : "partially_approved", shouldAutoFinal]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "aprobar_parcial" });
  try {
    if (rows[0]?.user_id) {
      await notificationManager.sendNotification({
        userId: rows[0].user_id,
        customTitle: shouldAutoFinal ? "Solicitud aprobada" : "Solicitud aprobada parcialmente",
        customMessage: shouldAutoFinal
          ? "Tu solicitud fue aprobada de forma definitiva."
          : "Tu solicitud fue aprobada parcialmente. Debes subir los justificantes para la aprobación final.",
        type: "info",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: rows[0].id,
          tipo_solicitud: rows[0].tipo_solicitud,
          target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}`,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: rows[0]?.id }, "No se pudo notificar aprobación parcial");
  }

  try {
    await recordWorkflowSignature({
      solicitud: rows[0],
      stage: shouldAutoFinal
        ? WORKFLOW_SIGNATURE_STAGES.APROBACION_FINAL
        : WORKFLOW_SIGNATURE_STAGES.APROBACION_PARCIAL,
      actor: approver,
      meta,
      consentText: shouldAutoFinal
        ? "Confirmo la aprobacion final de la solicitud en SPI"
        : "Confirmo la aprobacion parcial de la solicitud en SPI",
    });
  } catch (signatureError) {
    logger.warn(
      { signatureError, solicitudId: rows[0]?.id },
      shouldAutoFinal
        ? "No se pudo registrar firma de aprobacion final"
        : "No se pudo registrar firma de aprobacion parcial"
    );
  }

  if (shouldAutoFinal) {
    await createSolicitudCalendarEvent(
      rows[0],
      "No se pudo crear evento de calendario en aprobación definitiva automática del permiso"
    );
  }

  if (shouldAutoFinal) {
    try {
      const requesterIdentity = await getUserIdentity(rows[0]?.user_id).catch(() => null);
      const approverIdentity = await getUserIdentity(resolveActorId(approver)).catch(() => null);
      let verificationToken = rows[0]?.legal_verification_token || null;
      if (!verificationToken) {
        verificationToken = generateLegalVerificationToken();
        await db.query(
          `UPDATE permisos_vacaciones
              SET legal_verification_token = $2,
                  legal_verification_created_at = COALESCE(legal_verification_created_at, NOW()),
                  updated_at = now()
            WHERE id = $1`,
          [id, verificationToken]
        );
      }

      const signaturesBySolicitud = await getSignaturesBySolicitudIds([rows[0].id]);
      const signatures = signaturesBySolicitud.get(String(rows[0].id)) || [];
      const solicitudSignature =
        signatures.find((item) => item.stage === WORKFLOW_SIGNATURE_STAGES.SOLICITUD) || null;
      const finalSignature =
        signatures.find((item) => item.stage === WORKFLOW_SIGNATURE_STAGES.APROBACION_FINAL) || null;
      const workflowSummary = buildWorkflowSignatureSummary(signatures);

      const pdfPayload = {
        ...rows[0],
        user_fullname: requesterIdentity?.fullname || rows[0].user_fullname || rows[0].user_email,
        user_document_id: requesterIdentity?.cedula || "",
        approver_fullname: approverName,
        approver_document_id: approverIdentity?.cedula || "",
        aprobacion_final_por: approverName,
        aprobacion_final_at: rows[0].aprobacion_final_at,
        firma_solicitante_texto: buildPdfSignatureText(
          solicitudSignature,
          requesterIdentity?.fullname || rows[0].user_fullname || rows[0].user_email
        ),
        firma_aprobador_texto: buildPdfSignatureText(finalSignature, approverName),
        firma_workflow_estado: workflowSummary?.estado || "pendiente",
        firma_solicitante_at: solicitudSignature?.signed_at || null,
        firma_aprobador_at: finalSignature?.signed_at || null,
        firma_solicitante_hash: solicitudSignature?.signature_hash_sha256 || null,
        firma_aprobador_hash: finalSignature?.signature_hash_sha256 || null,
        firma_aprobador_prev_hash: finalSignature?.previous_signature_hash_sha256 || null,
        legal_verification_token: verificationToken,
        legal_verification_url: buildLegalVerificationUrl(verificationToken),
        workflow_signature_summary: workflowSummary,
      };

      const pdfUrl = await generateFRH10(pdfPayload);
      const legalPdfUrl = await generateFirmaLegalValidationPdf({
        solicitud: {
          ...rows[0],
          user_fullname: requesterIdentity?.fullname || rows[0].user_fullname || rows[0].user_email,
          approver_fullname: approverName,
        },
        signatures,
        verification: {
          token: verificationToken,
          url: buildLegalVerificationUrl(verificationToken),
        },
      });

      if (pdfUrl || legalPdfUrl) {
        await db.query(
          `UPDATE permisos_vacaciones
              SET pdf_generado_url = COALESCE($2, pdf_generado_url),
                  pdf_validacion_legal_url = COALESCE($3, pdf_validacion_legal_url),
                  updated_at = now()
            WHERE id = $1`,
          [id, pdfUrl, legalPdfUrl]
        );
        rows[0].pdf_generado_url = pdfUrl || rows[0].pdf_generado_url || null;
        rows[0].pdf_validacion_legal_url = legalPdfUrl || rows[0].pdf_validacion_legal_url || null;
        rows[0].legal_verification_token = verificationToken || rows[0].legal_verification_token || null;
      }
    } catch (pdfError) {
      logger.warn({ pdfError, solicitudId: rows[0]?.id }, "No se pudo generar evidencia legal en auto-aprobación de permiso");
    }
  }

  const enriched = await attachWorkflowSignatures([rows[0]]);
  return enriched[0] || rows[0];
}

async function subirJustificantes({ id, urls, user }) {
  await ensureTable();
  const { rows: existingRows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = existingRows[0];
  if (!solicitud) {
    const err = new Error("Solicitud no encontrada");
    err.status = 404;
    throw err;
  }

  const normalizedStatus = normalizeStatusText(solicitud?.status);
  const normalizedTipoPermiso = String(solicitud?.tipo_permiso || "").trim().toLowerCase();
  const canUploadByDefaultFlow = ["partially_approved", "pending_final"].includes(normalizedStatus);
  const canUploadHealthEmergency =
    ["pending", "pendiente"].includes(normalizedStatus) && normalizedTipoPermiso === "salud";
  const isAutoCancelledPendingJustification =
    normalizedStatus === "cancelled" &&
    solicitud.cancellation_reason === "auto_expired_without_approval" &&
    solicitud.auto_cancelled_justification_deadline &&
    new Date() <= new Date(solicitud.auto_cancelled_justification_deadline) &&
    !solicitud.auto_cancelled_justification_submitted_at;
  if (!canUploadByDefaultFlow && !canUploadHealthEmergency && !isAutoCancelledPendingJustification) {
    const err = new Error(
      "Solo se pueden subir justificantes en solicitudes parcialmente aprobadas, pendientes finales, permisos de salud pendientes, o solicitudes canceladas automaticamente dentro del plazo de 30 dias."
    );
    err.status = 409;
    throw err;
  }

  const safeUrls = Array.isArray(urls) ? urls : [];

  // Auto-cancelled justification: move back to pending_final for approver review
  if (isAutoCancelledPendingJustification) {
    const { rows } = await db.query(
      `UPDATE permisos_vacaciones
          SET justificantes_urls = $2,
              status = 'pending_final',
              auto_cancelled_justification_submitted_at = NOW(),
              updated_at = now()
        WHERE id = $1
      RETURNING *`,
      [id, safeUrls]
    );
    await logAction({ usuario_email: user?.email, modulo: "permisos", accion: "subir_justificantes_cancelacion_automatica" });
    try {
      const updated = rows[0];
      if (updated?.approver_user_id && updated.approver_user_id != user?.id) {
        await notificationManager.sendNotification({
          userId: updated.approver_user_id,
          customTitle: "Justificantes subidos — solicitud cancelada automaticamente",
          customMessage: `${updated.user_fullname || updated.user_email} subio justificantes para la solicitud #${updated.id} que fue cancelada automaticamente. Requiere tu revision y aprobacion final.`,
          type: "info",
          source: "permisos_vacaciones",
          priority: 2,
          email: true,
          meta: {
            solicitud_id: updated.id,
            tipo_solicitud: updated.tipo_solicitud,
            target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${updated.id}`,
          },
        });
      }
    } catch (notifyError) {
      logger.warn({ notifyError, solicitudId: id }, "No se pudo notificar justificantes de cancelacion automatica");
    }
    const enriched = await attachWorkflowSignatures([rows[0]]);
    return enriched[0] || rows[0];
  }

  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET justificantes_urls = $2,
            status = 'pending_final',
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, safeUrls]
  );
  await logAction({ usuario_email: user?.email, modulo: "permisos", accion: "subir_justificantes" });

  try {
    const solicitud = rows[0];
    if (solicitud?.approver_user_id && solicitud.approver_user_id != user?.id) {
      await notificationManager.sendNotification({
        userId: solicitud.approver_user_id,
        customTitle: "Justificantes subidos",
        customMessage: `${solicitud.user_fullname || solicitud.user_email} subió los justificantes. La solicitud está lista para aprobación final.`,
        type: "info",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: solicitud.id,
          tipo_solicitud: solicitud.tipo_solicitud,
          target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${solicitud.id}`,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: id }, "No se pudo notificar justificantes");
  }
  const enriched = await attachWorkflowSignatures([rows[0]]);
  return enriched[0] || rows[0];
}

async function aprobarFinal({ id, approver, meta }) {
  await ensureTable();
  const { rows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (!canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver })) {
    const err = new Error("No autorizado para aprobar esta solicitud");
    err.status = 403;
    throw err;
  }
  const requesterIdentity = await getUserIdentity(solicitud.user_id).catch(() => null);
  const approverIdentity = await getUserIdentity(resolveActorId(approver)).catch(() => null);
  const approverName = approverIdentity?.fullname || getDisplayName(approver);
  const update = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'approved',
            aprobacion_final_at = now(),
            aprobacion_final_por = $2,
            recovery_coordination_status = CASE
              WHEN COALESCE(es_recuperable, false) THEN 'pending_approver_proposal'
              ELSE recovery_coordination_status
            END,
            updated_at = now()
      WHERE id = $1
    RETURNING *`,
    [id, approverName]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "aprobar_final" });
  try {
    if (update.rows[0]?.user_id) {
      await notificationManager.sendNotification({
        userId: update.rows[0].user_id,
        customTitle: "Solicitud aprobada",
        customMessage:
          "Tu solicitud fue aprobada de forma definitiva. No necesitas firmar ningun documento adicional; la solicitud ya fue validada legalmente con FamSign en SPI.",
        type: "success",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: update.rows[0].id,
          tipo_solicitud: update.rows[0].tipo_solicitud,
          target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${update.rows[0].id}`,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: update.rows[0]?.id }, "No se pudo notificar aprobaci?n final");
  }

  let existingSignatures = [];
  try {
    const signaturesBySolicitud = await getSignaturesBySolicitudIds([update.rows[0].id]);
    existingSignatures = signaturesBySolicitud.get(String(update.rows[0].id)) || [];
  } catch (signatureFetchError) {
    logger.warn({ signatureFetchError, solicitudId: update.rows[0]?.id }, "No se pudieron consultar firmas existentes");
  }

  const hasRequesterSignature = existingSignatures.some(
    (item) => item.stage === WORKFLOW_SIGNATURE_STAGES.SOLICITUD
  );
  if (!hasRequesterSignature && update.rows[0]?.user_id) {
    try {
      await recordWorkflowSignature({
        solicitud: update.rows[0],
        stage: WORKFLOW_SIGNATURE_STAGES.SOLICITUD,
        actor: {
          id: update.rows[0].user_id,
          email: update.rows[0].user_email,
          fullname: requesterIdentity?.fullname || update.rows[0].user_fullname || update.rows[0].user_email,
          role: "solicitante",
        },
        meta,
        consentText: "Firma de solicitante reconstruida al momento de aprobacion final",
      });
    } catch (requesterSignatureError) {
      logger.warn({ requesterSignatureError, solicitudId: update.rows[0]?.id }, "No se pudo registrar firma de solicitante en aprobacion final");
    }
  }

  let approvalSignature = null;
  try {
    approvalSignature = await recordWorkflowSignature({
      solicitud: update.rows[0],
      stage: WORKFLOW_SIGNATURE_STAGES.APROBACION_FINAL,
      actor: approver,
      meta,
      consentText: "Confirmo la aprobacion final de la solicitud en SPI",
    });
  } catch (signatureError) {
    logger.warn({ signatureError, solicitudId: update.rows[0]?.id }, "No se pudo registrar firma de aprobacion final");
  }

  let pdfUrl = null;
  let legalPdfUrl = null;
  let verificationToken = update.rows[0]?.legal_verification_token || null;
  if (!verificationToken) {
    verificationToken = generateLegalVerificationToken();
    await db.query(
      `UPDATE permisos_vacaciones
          SET legal_verification_token = $2,
              legal_verification_created_at = COALESCE(legal_verification_created_at, NOW()),
              updated_at = now()
        WHERE id = $1`,
      [id, verificationToken]
    );
  }
  try {
    const signaturesBySolicitud = await getSignaturesBySolicitudIds([update.rows[0].id]);
    const signatures = signaturesBySolicitud.get(String(update.rows[0].id)) || [];
    const solicitudSignature = signatures.find((item) => item.stage === WORKFLOW_SIGNATURE_STAGES.SOLICITUD) || null;
    const finalSignature =
      approvalSignature ||
      signatures.find((item) => item.stage === WORKFLOW_SIGNATURE_STAGES.APROBACION_FINAL) ||
      null;
    const workflowSummary = buildWorkflowSignatureSummary(signatures);

    const pdfPayload = {
      ...update.rows[0],
      user_fullname: requesterIdentity?.fullname || update.rows[0].user_fullname || update.rows[0].user_email,
      user_document_id: requesterIdentity?.cedula || "",
      approver_fullname: approverName,
      approver_document_id: approverIdentity?.cedula || "",
      aprobacion_final_por: approverName,
      aprobacion_final_at: update.rows[0].aprobacion_final_at,
      firma_solicitante_texto: buildPdfSignatureText(
        solicitudSignature,
        requesterIdentity?.fullname || update.rows[0].user_fullname || update.rows[0].user_email
      ),
      firma_aprobador_texto: buildPdfSignatureText(
        finalSignature,
        approverName
      ),
      firma_workflow_estado: workflowSummary?.estado || "pendiente",
      firma_solicitante_at: solicitudSignature?.signed_at || null,
      firma_aprobador_at: finalSignature?.signed_at || null,
      firma_solicitante_hash: solicitudSignature?.signature_hash_sha256 || null,
      firma_aprobador_hash: finalSignature?.signature_hash_sha256 || null,
      firma_aprobador_prev_hash: finalSignature?.previous_signature_hash_sha256 || null,
      legal_verification_token: verificationToken,
      legal_verification_url: buildLegalVerificationUrl(verificationToken),
      workflow_signature_summary: workflowSummary,
    };

    pdfUrl = await generateFRH10(pdfPayload);
    legalPdfUrl = await generateFirmaLegalValidationPdf({
      solicitud: {
        ...update.rows[0],
        user_fullname: requesterIdentity?.fullname || update.rows[0].user_fullname || update.rows[0].user_email,
        approver_fullname: approverName,
      },
      signatures,
      verification: {
        token: verificationToken,
        url: buildLegalVerificationUrl(verificationToken),
      },
    });
  } catch (pdfError) {
    logger.warn({ pdfError, solicitudId: update.rows[0]?.id }, "No se pudo generar PDF con firmas avanzadas");
  }

  if (pdfUrl || legalPdfUrl) {
    await db.query(
      `UPDATE permisos_vacaciones
          SET pdf_generado_url = COALESCE($2, pdf_generado_url),
              pdf_validacion_legal_url = COALESCE($3, pdf_validacion_legal_url),
              updated_at = now()
        WHERE id = $1`,
      [id, pdfUrl, legalPdfUrl]
    );
  }

  await createSolicitudCalendarEvent(
    update.rows[0],
    update.rows[0]?.tipo_solicitud === "vacaciones"
      ? "No se pudo crear evento de calendario en aprobación final de vacaciones"
      : "No se pudo crear evento de calendario en aprobación final del permiso"
  );

  const enriched = await attachWorkflowSignatures([update.rows[0]]);
  const responseRow = enriched[0] || update.rows[0];
  return {
    ...responseRow,
    pdf_generado_url: pdfUrl || responseRow.pdf_generado_url || null,
    pdf_validacion_legal_url: legalPdfUrl || responseRow.pdf_validacion_legal_url || null,
    legal_verification_token: verificationToken || responseRow.legal_verification_token || null,
    legal_verification_url: buildLegalVerificationUrl(
      verificationToken || responseRow.legal_verification_token || null
    ),
  };
}

async function getLegalVerificationByToken(token) {
  await ensureTable();
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT *
       FROM permisos_vacaciones
      WHERE legal_verification_token = $1
      LIMIT 1`,
    [token]
  );
  if (!rows[0]) return null;
  const normalizedStatus = String(rows[0]?.status || "").toLowerCase();
  if (normalizedStatus === "rejected" || normalizedStatus === "rechazado") return null;
  const enriched = await attachWorkflowSignatures([rows[0]]);
  const row = await attachCancellationActors(enriched[0] || rows[0]);
  return {
    id: row.id,
    tipo_solicitud: row.tipo_solicitud,
    tipo_permiso: row.tipo_permiso,
    status: row.status,
    solicitante: row.user_fullname || row.user_email || null,
    aprobador: row.aprobacion_final_por || row.approver_email || row.approver_role || null,
    aprobacion_final_at: row.aprobacion_final_at || null,
    pdf_generado_url: row.pdf_generado_url || null,
    pdf_validacion_legal_url: row.pdf_validacion_legal_url || null,
    legal_verification_token: row.legal_verification_token || token,
    legal_verification_url: buildLegalVerificationUrl(row.legal_verification_token || token),
    firmas_workflow: row.firmas_workflow || [],
    firma_avanzada_resumen: row.firma_avanzada_resumen || null,
    cancellation: buildCancellationVerification(row),
  };
}

async function getLegalCoverage() {
  await ensureTable();
  const { rows } = await db.query(
    `SELECT
        COUNT(*) FILTER (WHERE status IN ('approved','rejected')) AS total_closed,
        COUNT(*) FILTER (WHERE status = 'approved') AS total_approved,
        COUNT(*) FILTER (
          WHERE status = 'approved'
            AND pdf_validacion_legal_url IS NOT NULL
            AND legal_verification_token IS NOT NULL
        ) AS approved_with_legal_evidence,
        COUNT(*) FILTER (
          WHERE status = 'approved'
            AND EXISTS (
              SELECT 1
                FROM permisos_vacaciones_firmas f
               WHERE f.solicitud_id = permisos_vacaciones.id
                 AND f.stage = 'solicitud'
            )
            AND EXISTS (
              SELECT 1
                FROM permisos_vacaciones_firmas f
               WHERE f.solicitud_id = permisos_vacaciones.id
                 AND f.stage = 'aprobacion_final'
            )
        ) AS approved_with_complete_chain
      FROM permisos_vacaciones`
  );
  return rows[0] || {};
}

async function rechazar({ id, approver, observaciones, meta }) {
  await ensureTable();
  const current = await db.query(`SELECT approver_role, approver_user_id FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = current.rows[0];
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (!canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver })) {
    const err = new Error("No autorizado para rechazar esta solicitud");
    err.status = 403;
    throw err;
  }
  const obsArray = Array.isArray(observaciones)
    ? observaciones
    : observaciones
      ? [observaciones]
      : [];
  const approverName = getDisplayName(approver);
  const { rows } = await db.query(
    `UPDATE permisos_vacaciones
        SET status = 'rejected',
            observaciones = $2,
            updated_at = now(),
            aprobacion_final_por = $3,
            aprobacion_final_at = now(),
            pdf_validacion_legal_url = NULL,
            legal_verification_token = NULL,
            legal_verification_created_at = NULL
      WHERE id = $1
    RETURNING *`,
    [id, obsArray, approverName]
  );
  await logAction({ usuario_email: approver?.email, modulo: "permisos", accion: "rechazar" });
  try {
    if (rows[0]?.user_id) {
      await notificationManager.sendNotification({
        userId: rows[0].user_id,
        customTitle: "Solicitud rechazada",
        customMessage: "Tu solicitud fue rechazada. Revisa las observaciones.",
        type: "warning",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: rows[0].id,
          tipo_solicitud: rows[0].tipo_solicitud,
          observaciones: rows[0].observaciones,
          target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${rows[0].id}`,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: rows[0]?.id }, "No se pudo notificar rechazo");
  }

  try {
    await recordWorkflowSignature({
      solicitud: rows[0],
      stage: WORKFLOW_SIGNATURE_STAGES.RECHAZO,
      actor: approver,
      meta,
      consentText: "Confirmo el rechazo de la solicitud en SPI",
    });
  } catch (signatureError) {
    logger.warn({ signatureError, solicitudId: rows[0]?.id }, "No se pudo registrar firma de rechazo");
  }

  const enriched = await attachWorkflowSignatures([rows[0]]);
  return enriched[0] || rows[0];
}

async function cancelarSolicitud({ id, actor, reason }) {
  await ensureTable();
  const actorId = resolveActorId(actor);
  if (!actorId) {
    const err = new Error("Usuario inválido para cancelar la solicitud");
    err.status = 400;
    throw err;
  }
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) {
    const err = new Error("Debes registrar el motivo de cancelación");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = await settleExpiredRecoveryCoordination(rows[0]);
  if (!solicitud) {
    const err = new Error("Solicitud no encontrada");
    err.status = 404;
    throw err;
  }

  const status = normalizeStatusText(solicitud.status);
  if (["rejected", "cancelled"].includes(status)) {
    const err = new Error("La solicitud ya no puede ser cancelada");
    err.status = 409;
    throw err;
  }

  const isRequester = Number(solicitud.user_id) === Number(actorId);
  const isApprover =
    Number(solicitud.approver_user_id) === Number(actorId) ||
    canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver: actor });
  if (!isRequester && !isApprover) {
    const err = new Error("No autorizado para cancelar esta solicitud");
    err.status = 403;
    throw err;
  }

  const isApprovedStatus = ["approved", "aprobado"].includes(status);
  const isDirectCancelableStatus = [
    "pending",
    "pendiente",
    "partially_approved",
    "pending_final",
  ].includes(status);
  if (!isApprovedStatus && !isDirectCancelableStatus) {
    const err = new Error(
      "Solo solicitudes en estado pendiente, aprobacion parcial, aprobacion final o aprobada pueden cancelarse"
    );
    err.status = 409;
    throw err;
  }

  if (isApprovedStatus && !canCancelByDateRule(solicitud)) {
    const err = new Error("La solicitud solo puede cancelarse hasta el día del permiso o antes.");
    err.status = 409;
    throw err;
  }

  const requiresCancellationRequest = isApprovedStatus && isRequester && !isApprover;
  let updated = null;
  if (requiresCancellationRequest) {
    if (String(solicitud.cancellation_status || "none").toLowerCase() === "pending") {
      const err = new Error("Ya existe una solicitud de cancelación pendiente de revisión");
      err.status = 409;
      throw err;
    }
    const { rows: requestedRows } = await db.query(
      `UPDATE permisos_vacaciones
          SET cancellation_status = 'pending',
              cancellation_requested_at = NOW(),
              cancellation_requested_by_user_id = $2,
              cancellation_requested_by_email = $3,
              cancellation_request_reason = $4,
              cancellation_reviewed_at = NULL,
              cancellation_reviewed_by_user_id = NULL,
              cancellation_reviewed_by_email = NULL,
              cancellation_review_reason = NULL,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId, actor?.email || null, trimmedReason]
    );
    updated = requestedRows[0];
    try {
      if (updated?.approver_user_id && Number(updated.approver_user_id) !== Number(actorId)) {
        await notificationManager.sendNotification({
          userId: updated.approver_user_id,
          customTitle: "Solicitud de cancelación pendiente",
          customMessage: `El colaborador solicitó cancelar la solicitud #${updated.id}.`,
          type: "task",
          source: "permisos_vacaciones",
          priority: 1,
          email: true,
          meta: {
            solicitud_id: updated.id,
            cancellation_status: "pending",
            reason: trimmedReason,
            target_path: `/dashboard/talento-humano/permisos?tab=cancellation_requests&solicitudId=${updated.id}`,
          },
        });
      }
    } catch (notifyError) {
      logger.warn({ notifyError, solicitudId: updated?.id }, "No se pudo notificar solicitud de cancelación");
    }
  } else {
    const { rows: cancelledRows } = await db.query(
      `UPDATE permisos_vacaciones
          SET status = 'cancelled',
              cancelled_at = NOW(),
              cancelled_by_user_id = $2,
              cancelled_by_email = $3,
              cancellation_reason = $4,
              cancellation_status = 'approved',
              cancellation_requested_at = COALESCE(cancellation_requested_at, NOW()),
              cancellation_requested_by_user_id = COALESCE(cancellation_requested_by_user_id, $2),
              cancellation_requested_by_email = COALESCE(cancellation_requested_by_email, $3),
              cancellation_request_reason = COALESCE(cancellation_request_reason, $4),
              cancellation_reviewed_at = NOW(),
              cancellation_reviewed_by_user_id = $2,
              cancellation_reviewed_by_email = $3,
              cancellation_review_reason = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId, actor?.email || null, trimmedReason]
    );
    updated = cancelledRows[0];
    try {
      updated = await refreshLegalArtifactsForSolicitud(updated);
    } catch (legalRefreshError) {
      logger.warn(
        { legalRefreshError, solicitudId: updated?.id },
        "No se pudo regenerar evidencia legal al cancelar la solicitud"
      );
    }
    try {
      if (isRequester && !isApprover && updated?.approver_user_id) {
        await notificationManager.sendNotification({
          userId: updated.approver_user_id,
          customTitle: "Solicitud cancelada por colaborador",
          customMessage: `El colaborador canceló la solicitud #${updated.id}.`,
          type: "info",
          source: "permisos_vacaciones",
          priority: 1,
          email: true,
          meta: {
            solicitud_id: updated.id,
            reason: trimmedReason,
            status: "cancelled",
            target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${updated.id}`,
          },
        });
      }
    } catch (notifyError) {
      logger.warn(
        { notifyError, solicitudId: updated?.id },
        "No se pudo notificar cancelación directa al aprobador"
      );
    }
    try {
      if (updated?.user_id && Number(updated.user_id) !== Number(actorId)) {
        await notificationManager.sendNotification({
          userId: updated.user_id,
          customTitle: "Solicitud cancelada",
          customMessage: `Tu solicitud #${updated.id} fue cancelada por el jefe inmediato.`,
          type: "warning",
          source: "permisos_vacaciones",
          priority: 1,
          email: true,
          meta: {
            solicitud_id: updated.id,
            reason: trimmedReason,
            status: "cancelled",
            target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${updated.id}`,
          },
        });
      }
    } catch (notifyError) {
      logger.warn({ notifyError, solicitudId: updated?.id }, "No se pudo notificar cancelación");
    }
  }

  await logAction({
    usuario_email: actor?.email,
    modulo: "permisos",
    accion: requiresCancellationRequest ? "solicitar_cancelacion" : "cancelar",
  });

  const enriched = await attachWorkflowSignatures([updated]);
  return enriched[0] || updated;
}

async function revisarCancelacionSolicitud({ id, actor, decision, reason }) {
  await ensureTable();
  const actorId = resolveActorId(actor);
  if (!actorId) {
    const err = new Error("Usuario inválido para revisar la cancelación");
    err.status = 400;
    throw err;
  }
  const normalizedDecision = String(decision || "").trim().toLowerCase();
  if (!["approve", "reject"].includes(normalizedDecision)) {
    const err = new Error("Decisión inválida, usa approve o reject");
    err.status = 400;
    throw err;
  }
  const trimmedReason = String(reason || "").trim();
  const reviewReason = trimmedReason || null;
  if (normalizedDecision === "reject" && !reviewReason) {
    const err = new Error("Debes registrar el motivo del rechazo");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = rows[0];
  if (!solicitud) {
    const err = new Error("Solicitud no encontrada");
    err.status = 404;
    throw err;
  }
  if (String(solicitud.cancellation_status || "none").toLowerCase() !== "pending") {
    const err = new Error("No existe una cancelación pendiente para esta solicitud");
    err.status = 409;
    throw err;
  }

  if (normalizedDecision === "approve" && !canCancelByDateRule(solicitud)) {
    const err = new Error("La solicitud solo puede cancelarse hasta el día del permiso o antes.");
    err.status = 409;
    throw err;
  }

  const isApprover =
    Number(solicitud.approver_user_id) === Number(actorId) ||
    canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver: actor });
  if (!isApprover) {
    const err = new Error("No autorizado para revisar esta cancelación");
    err.status = 403;
    throw err;
  }

  let updated = null;
  if (normalizedDecision === "approve") {
    const { rows: approvedRows } = await db.query(
      `UPDATE permisos_vacaciones
          SET status = 'cancelled',
              cancelled_at = NOW(),
              cancelled_by_user_id = $2,
              cancelled_by_email = $3,
              cancellation_reason = COALESCE(cancellation_request_reason, $4),
              cancellation_status = 'approved',
              cancellation_reviewed_at = NOW(),
              cancellation_reviewed_by_user_id = $2,
              cancellation_reviewed_by_email = $3,
              cancellation_review_reason = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId, actor?.email || null, reviewReason]
    );
    updated = approvedRows[0];
    try {
      updated = await refreshLegalArtifactsForSolicitud(updated);
    } catch (legalRefreshError) {
      logger.warn(
        { legalRefreshError, solicitudId: updated?.id },
        "No se pudo regenerar evidencia legal al aprobar la cancelación"
      );
    }
  } else {
    const { rows: rejectedRows } = await db.query(
      `UPDATE permisos_vacaciones
          SET cancellation_status = 'rejected',
              cancellation_reviewed_at = NOW(),
              cancellation_reviewed_by_user_id = $2,
              cancellation_reviewed_by_email = $3,
              cancellation_review_reason = $4,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [id, actorId, actor?.email || null, reviewReason]
    );
    updated = rejectedRows[0];
  }

  await logAction({
    usuario_email: actor?.email,
    modulo: "permisos",
    accion: normalizedDecision === "approve" ? "aprobar_cancelacion" : "rechazar_cancelacion",
  });

  try {
    if (updated?.user_id) {
      await notificationManager.sendNotification({
        userId: updated.user_id,
        customTitle:
          normalizedDecision === "approve"
            ? "Cancelación aprobada"
            : "Cancelación rechazada",
        customMessage:
          normalizedDecision === "approve"
            ? `Tu solicitud #${updated.id} fue cancelada.`
            : `La cancelación de tu solicitud #${updated.id} fue rechazada.`,
        type: normalizedDecision === "approve" ? "warning" : "info",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: updated.id,
          decision: normalizedDecision,
          reason: reviewReason,
          target_path: `/dashboard/talento-humano/permisos?tab=cancellation_requests&solicitudId=${updated.id}`,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: updated?.id }, "No se pudo notificar revisión de cancelación");
  }

  const enriched = await attachWorkflowSignatures([updated]);
  return enriched[0] || updated;
}

async function updateRecoveryPlan({ id, actor, recoveryPlan, action }) {
  await ensureTable();
  const actorId = resolveActorId(actor);
  if (!actorId) {
    const err = new Error("Usuario inválido para actualizar plan de recuperación");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(`SELECT * FROM permisos_vacaciones WHERE id = $1 LIMIT 1`, [id]);
  const solicitud = rows[0];
  if (!solicitud) {
    const err = new Error("Solicitud no encontrada");
    err.status = 404;
    throw err;
  }

  if (solicitud.tipo_solicitud !== "permiso") {
    const err = new Error("Solo aplica plan de recuperación para permisos");
    err.status = 400;
    throw err;
  }

  if (!solicitud.es_recuperable) {
    const err = new Error("Este permiso no es recuperable según la política vigente");
    err.status = 400;
    throw err;
  }

  const status = normalizeStatusText(solicitud.status);
  if (["rejected", "cancelled"].includes(status)) {
    const err = new Error("No puedes editar el plan de recuperación en este estado");
    err.status = 409;
    throw err;
  }
  const coordinationEnabledStatuses = ["partially_approved", "pending_final", "approved", "aprobado"];
  if (!coordinationEnabledStatuses.includes(status)) {
    const err = new Error("La coordinación de tramos se habilita desde la aprobación parcial y en la aprobación final.");
    err.status = 409;
    throw err;
  }

  const isRequester = Number(solicitud.user_id) === Number(actorId);
  const isApprover =
    Number(solicitud.approver_user_id) === Number(actorId) ||
    canApprove({ approverRole: solicitud.approver_role, approverUserId: solicitud.approver_user_id, approver: actor });
  if (!isRequester && !isApprover) {
    const err = new Error("No autorizado para editar este plan de recuperación");
    err.status = 403;
    throw err;
  }

  const normalizedAction = String(action || "").trim().toLowerCase();
  const recoveryAction = ["propose", "accept", "finalize"].includes(normalizedAction)
    ? normalizedAction
    : "propose";
  const normalized = normalizeRecoveryPlan(recoveryPlan);
  if (!normalized.plan.length) {
    const err = new Error("Debes registrar al menos un tramo de recuperación");
    err.status = 400;
    throw err;
  }

  const requestedHours = estimateRequestedHours(solicitud);
  if (requestedHours > 0 && normalized.totalHours > requestedHours + 0.01) {
    const err = new Error("El plan de recuperación excede las horas del permiso solicitado");
    err.status = 400;
    throw err;
  }

  const currentCoordinationStatus = normalizeRecoveryCoordinationStatus(solicitud.recovery_coordination_status);
  if (["agreed", "finalized_by_approver"].includes(currentCoordinationStatus)) {
    const err = new Error(
      currentCoordinationStatus === "agreed"
        ? "La coordinación de recuperación ya fue aprobada y cerrada."
        : "El plan de recuperación ya fue definido de forma definitiva por el jefe inmediato."
    );
    err.status = 409;
    throw err;
  }
  let nextCoordinationStatus = currentCoordinationStatus;
  let nextRound = Number(solicitud.recovery_coordination_round || 0);
  let vacationCharge = null;

  if (recoveryAction === "accept") {
    if (!isRequester && !isApprover) {
      const err = new Error("No autorizado para aprobar la propuesta de recuperación");
      err.status = 403;
      throw err;
    }
    if (!["pending_requester_acceptance", "pending_approver_proposal"].includes(currentCoordinationStatus)) {
      const err = new Error("No existe una coordinación pendiente de aprobación");
      err.status = 409;
      throw err;
    }
    nextCoordinationStatus = "agreed";
  } else if (recoveryAction === "finalize") {
    if (!isApprover) {
      const err = new Error("Solo el jefe inmediato puede cerrar de forma definitiva los tramos");
      err.status = 403;
      throw err;
    }
    nextCoordinationStatus = "finalized_by_approver";
    vacationCharge = buildVacationCharge(solicitud);
  } else {
    if (isApprover) {
      nextCoordinationStatus = "pending_requester_acceptance";
    } else {
      nextCoordinationStatus = "pending_approver_proposal";
      nextRound += 1;
    }
  }

  const { rows: updatedRows } = await db.query(
    `UPDATE permisos_vacaciones
        SET recovery_plan = $2::jsonb,
            recovery_plan_total_hours = $3,
            recovery_plan_updated_at = NOW(),
            recovery_plan_updated_by_user_id = $4,
            recovery_coordination_status = $5,
            recovery_coordination_round = $6,
            charged_to_vacation = CASE WHEN $7 THEN true ELSE COALESCE(charged_to_vacation, false) END,
            charged_vacation_hours = CASE WHEN $7 THEN $8 ELSE charged_vacation_hours END,
            charged_vacation_days = CASE WHEN $7 THEN $9 ELSE charged_vacation_days END,
            charged_to_vacation_at = CASE WHEN $7 THEN NOW() ELSE charged_to_vacation_at END,
            charged_to_vacation_reason = CASE WHEN $7 THEN 'no_recovery_agreement' ELSE charged_to_vacation_reason END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      id,
      JSON.stringify(normalized.plan),
      normalized.totalHours,
      actorId,
      nextCoordinationStatus,
      nextRound,
      recoveryAction === "finalize",
      vacationCharge?.hours || null,
      vacationCharge?.days || null,
    ]
  );
  const updated = updatedRows[0];

  await logAction({
    usuario_email: actor?.email,
    modulo: "permisos",
    accion:
      recoveryAction === "accept"
        ? "aprobar_plan_recuperacion"
        : recoveryAction === "finalize"
          ? "cerrar_plan_recuperacion"
          : "proponer_plan_recuperacion",
  });

  try {
    const notifyTo = isRequester ? updated?.approver_user_id : updated?.user_id;
    if (notifyTo && Number(notifyTo) !== Number(actorId)) {
      const actionMessage =
        recoveryAction === "accept"
          ? "La propuesta de recuperación fue aprobada y la coordinación quedó cerrada."
          : recoveryAction === "finalize"
            ? `No hubo acuerdo en la recuperación y el permiso se cargó a vacaciones (${vacationCharge?.hours || 0}h).`
            : isApprover
              ? "El jefe inmediato propuso tramos de recuperación para revisión del solicitante."
              : "El solicitante propuso ajustes al plan de recuperación.";
      await notificationManager.sendNotification({
        userId: notifyTo,
        customTitle: "Plan de recuperación actualizado",
        customMessage: `${actionMessage} Solicitud #${updated.id}.`,
        type: "info",
        source: "permisos_vacaciones",
        priority: 1,
        email: true,
        meta: {
          solicitud_id: updated.id,
          recovery_plan_total_hours: updated.recovery_plan_total_hours,
          recovery_coordination_status: updated.recovery_coordination_status,
          recovery_action: recoveryAction,
          charged_to_vacation: Boolean(updated?.charged_to_vacation),
          charged_vacation_hours: updated?.charged_vacation_hours || null,
          charged_vacation_days: updated?.charged_vacation_days || null,
          target_path: `/dashboard/talento-humano/permisos?tab=approve&solicitudId=${updated.id}&openRecovery=true`,
        },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, solicitudId: updated?.id }, "No se pudo notificar actualización de plan de recuperación");
  }

  const enriched = await attachWorkflowSignatures([updated]);
  return enriched[0] || updated;
}

async function listarPendientes({ stage, approver }) {
  await ensureTable();
  await processExpiredPendingSolicitudes();
  let statusFilter = "pending";
  if (stage === "final" || stage === "pending_final") statusFilter = "pending_final";
  if (stage === "parcial") statusFilter = "pending";
  if (stage === "cancellation_pending") statusFilter = "approved";
  if (["approved", "rejected", "cancelled"].includes(String(stage || "").toLowerCase())) {
    statusFilter = String(stage || "").toLowerCase();
  }
  const normalizedStatusFilter = String(statusFilter || "").toLowerCase();
  const statusCandidates =
    normalizedStatusFilter === "approved"
      ? ["approved", "aprobado"]
      : normalizedStatusFilter === "rejected"
        ? ["rejected", "rechazado"]
        : normalizedStatusFilter === "cancelled"
          ? ["cancelled", "cancelado"]
          : normalizedStatusFilter === "pending"
            ? ["pending", "pendiente"]
            : [normalizedStatusFilter];
  const roleCandidates = getApproverRoleCandidates(approver);
  if (!approver?.id && roleCandidates.length === 0) return [];
  const { rows } = await db.query(
    `SELECT * FROM permisos_vacaciones
      WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])
        AND ($4::text IS NULL OR LOWER(COALESCE(cancellation_status, 'none')) = $4)
        AND ($5::boolean = false OR LOWER(COALESCE(cancellation_status, 'none')) <> 'pending')
        AND (
          (approver_user_id IS NOT NULL AND approver_user_id = $2)
          OR LOWER(COALESCE(approver_role, '')) = ANY($3)
        )
      ORDER BY created_at DESC`,
    [
      statusCandidates,
      approver?.id || null,
      roleCandidates,
      stage === "cancellation_pending" ? "pending" : null,
      stage === "approved",
    ]
  );
  const settledRows = await settleExpiredRecoveryCoordinationRows(rows);
  return attachWorkflowSignatures(settledRows);
}

async function listarPorUsuario({ user }) {
  await ensureTable();
  await processExpiredPendingSolicitudes();
  const email = user?.email;
  if (!email) return { data: [], summary: {} };

  const { rows } = await db.query(
    `SELECT t.*
       FROM (
         SELECT p.*,
                ROW_NUMBER() OVER (PARTITION BY p.user_email ORDER BY p.created_at ASC, p.id ASC) AS requester_sequence
           FROM permisos_vacaciones p
          WHERE p.user_email = $1
       ) t
      ORDER BY t.created_at DESC
      LIMIT 100`,
    [email]
  );

  const settledRows = await settleExpiredRecoveryCoordinationRows(rows);

  const summary = settledRows.reduce(
    (acc, row) => {
      const status = row.status || "pending";
      acc.status[status] = (acc.status[status] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, status: {} }
  );

  const vacationRows = settledRows.filter((row) => row.tipo_solicitud === "vacaciones");
  const chargedPermissionRows = settledRows.filter(
    (row) => row.tipo_solicitud !== "vacaciones" && row.charged_to_vacation === true
  );
  const approvedVacationDays = vacationRows
    .filter((row) => ["approved", "aprobado"].includes(String(row.status || "").toLowerCase()))
    .reduce((acc, row) => acc + calculateVacationDays(row), 0) +
    chargedPermissionRows
      .filter((row) => ["approved", "aprobado"].includes(String(row.status || "").toLowerCase()))
      .reduce((acc, row) => acc + getChargedVacationDays(row), 0);
  const pendingVacationDays = vacationRows
    .filter((row) =>
      ["pending", "pendiente", "pending_final", "partially_approved"].includes(
        String(row.status || "").toLowerCase()
      )
    )
    .reduce((acc, row) => acc + calculateVacationDays(row), 0);
  const rejectedVacationDays = vacationRows
    .filter((row) => ["rejected", "rechazado"].includes(String(row.status || "").toLowerCase()))
    .reduce((acc, row) => acc + calculateVacationDays(row), 0);
  const requestedVacationDays = approvedVacationDays + pendingVacationDays + rejectedVacationDays;

  const requesterUserId = resolveActorId(user);
  const currentYear = new Date().getFullYear();
  const hireDate = await getHireDate(requesterUserId);
  const allowanceInfo = computeVacationAllowance(hireDate, new Date());
  const historicalBalance = await getHistoricVacationBalance({
    userId: requesterUserId,
    userEmail: email,
    year: currentYear,
  });
  const totalAllowance = allowanceInfo.allowance + historicalBalance;
  const remainingRaw = totalAllowance - approvedVacationDays - pendingVacationDays;
  const remaining = remainingRaw;

  summary.vacaciones = {
    year: currentYear,
    allowance: totalAllowance,
    allowance_base: allowanceInfo.allowance,
    carry_over: historicalBalance,
    tenure_years: allowanceInfo.tenureYears,
    eligible: allowanceInfo.eligible,
    eligible_from: allowanceInfo.eligibleFrom,
    accrued_this_year: allowanceInfo.accruedThisYear,
    missing_hire_date: allowanceInfo.missingHireDate,
    remaining,
    requested_days: requestedVacationDays,
    approved_days: approvedVacationDays,
    pending_days: pendingVacationDays,
    rejected_days: rejectedVacationDays,
    charged_from_permisos_days: roundToTwo(
      chargedPermissionRows.reduce((acc, row) => acc + getChargedVacationDays(row), 0)
    ),
    requested_count: vacationRows.length,
    approved_count: vacationRows.filter((row) => ["approved", "aprobado"].includes(String(row.status || "").toLowerCase())).length,
    pending_count: vacationRows.filter((row) =>
      ["pending", "pendiente", "pending_final", "partially_approved"].includes(String(row.status || "").toLowerCase())
    ).length,
    rejected_count: vacationRows.filter((row) => ["rejected", "rechazado"].includes(String(row.status || "").toLowerCase())).length,
  };

  const data = await attachWorkflowSignatures(settledRows);
  return { data, summary };
}

async function getSolicitudById(id) {
  await ensureTable();
  await processExpiredPendingSolicitudes({ solicitudIds: [id] });
  const { rows } = await db.query(
    `SELECT * FROM permisos_vacaciones WHERE id = $1`,
    [id]
  );
  const settledRows = await settleExpiredRecoveryCoordinationRows(rows);
  const data = await attachWorkflowSignatures(settledRows);
  return data[0] || null;
}

function calculateVacationDays(row) {
  const explicitDays = Number(row?.duracion_dias);
  if (Number.isFinite(explicitDays) && explicitDays > 0) return explicitDays;
  if (!row?.fecha_inicio || !row?.fecha_fin) return 0;
  const startText = String(row.fecha_inicio).trim();
  const endText = String(row.fecha_fin).trim();
  const startMatch = startText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = endText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const start = startMatch
    ? Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]))
    : new Date(row.fecha_inicio).getTime();
  const end = endMatch
    ? Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]))
    : new Date(row.fecha_fin).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
}

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const calculateYearsOfService = (hireDate, asOfDate) => {
  if (!hireDate || !asOfDate) return 0;
  let years = asOfDate.getFullYear() - hireDate.getFullYear();
  const anniversary = new Date(hireDate.getTime());
  anniversary.setFullYear(hireDate.getFullYear() + years);
  if (asOfDate < anniversary) years -= 1;
  return Math.max(years, 0);
};

const computeVacationAllowance = (hireDateValue, asOfValue = new Date()) => {
  const hireDate = normalizeDate(hireDateValue);
  const asOfDate = normalizeDate(asOfValue) || new Date();
  if (!hireDate) {
    return {
      allowance: 0,
      tenureYears: 0,
      eligible: false,
      eligibleFrom: null,
      missingHireDate: true,
    };
  }

  const tenureYears = calculateYearsOfService(hireDate, asOfDate);
  if (tenureYears < 1) {
    const eligibleFrom = new Date(hireDate.getTime() + ONE_YEAR_MS);
    return {
      allowance: 0,
      tenureYears,
      eligible: false,
      eligibleFrom: eligibleFrom.toISOString().split("T")[0],
      accruedThisYear: false,
      missingHireDate: false,
    };
  }

  const anniversaryThisYear = new Date(hireDate.getTime());
  anniversaryThisYear.setFullYear(asOfDate.getFullYear());
  const accruedThisYear = asOfDate >= anniversaryThisYear;
  const eligibleFrom = anniversaryThisYear.toISOString().split("T")[0];
  if (!accruedThisYear) {
    return {
      allowance: 0,
      tenureYears,
      eligible: true,
      eligibleFrom,
      accruedThisYear: false,
      missingHireDate: false,
    };
  }

  const yearsAtAnniversary = calculateYearsOfService(hireDate, anniversaryThisYear);
  const extra = yearsAtAnniversary > 5 ? yearsAtAnniversary - 5 : 0;
  return {
    allowance: Math.min(ANNUAL_ALLOWANCE + extra, MAX_ANNUAL_ALLOWANCE),
    tenureYears,
    eligible: true,
    eligibleFrom,
    accruedThisYear: true,
    missingHireDate: false,
  };
};

async function listarResumenColaboradores() {
  await ensureTable();
  await processExpiredPendingSolicitudes();
  const usersResult = await db.query(
    `SELECT u.id, u.email, u.fullname, u.name, u.department_id,
            d.name AS department_name,
            cp.profile->'laboral'->>'fecha_ingreso' as fecha_ingreso,
            cp.profile->'extra'->>'applicant_source' as applicant_source
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN collaborator_profiles cp ON cp.user_id = u.id
      ORDER BY COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email, CONCAT('Usuario #', u.id)) ASC`
  );
  const { rows } = await db.query(
    `SELECT
        p.id,
        p.user_id,
        p.user_email,
        p.user_fullname,
        p.department_id,
        d.name AS department_name,
        p.tipo_solicitud,
        p.tipo_permiso,
        p.status,
        p.duracion_dias,
        p.duracion_horas,
        p.charged_to_vacation,
        p.charged_vacation_hours,
        p.charged_vacation_days,
        p.justificacion_requerida,
        p.justificantes_urls,
        p.es_emergencia,
        p.fecha_inicio,
        p.fecha_fin,
        p.aprobacion_parcial_at,
        p.aprobacion_final_at,
        p.created_at
      FROM permisos_vacaciones p
      LEFT JOIN departments d ON d.id = p.department_id
      ORDER BY p.created_at DESC`
  );
  const vacationRequestsResult = await db.query(
    `SELECT
        v.id,
        v.requester_id,
        u.email AS requester_email,
        COALESCE(u.fullname, u.name, u.email, CONCAT('Usuario #', v.requester_id)) AS requester_name,
        u.department_id,
        d.name AS department_name,
        v.status,
        v.start_date,
        v.end_date,
        v.days,
        v.created_at
      FROM vacaciones_solicitudes v
      LEFT JOIN users u ON u.id = v.requester_id
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY v.created_at DESC`
  );

  const collaborators = new Map();
  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const buildKey = ({ userEmail = null, userId = null, fallbackId = null }) => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (normalizedEmail) return `email-${normalizedEmail}`;
    if (userId) return `user-${userId}`;
    return `unknown-${fallbackId || "sin-id"}`;
  };
  const ensureCollaboratorRecord = ({
    key,
    userId = null,
    userEmail = null,
    userFullname = null,
    departmentId = null,
    departmentName = null,
  }) => {
    if (collaborators.has(key)) {
      const existing = collaborators.get(key);
      if (!existing.user_id && userId) existing.user_id = userId;
      if (!existing.user_email && userEmail) existing.user_email = userEmail;
      if ((!existing.user_fullname || existing.user_fullname.startsWith("Usuario #")) && userFullname) {
        existing.user_fullname = userFullname;
      }
      if (!existing.department_id && departmentId) existing.department_id = departmentId;
      if (!existing.department_name && departmentName) existing.department_name = departmentName;
      return existing;
    }

    collaborators.set(key, {
      user_id: userId,
      user_email: userEmail,
      user_fullname: userFullname || userEmail || `Usuario #${userId || "sin-correo"}`,
      department_id: departmentId,
      department_name: departmentName || null,
      permisos: {
        total: 0,
        aprobacion_completa: 0,
        aprobacion_parcial: 0,
        pendientes: 0,
        aprobados: 0,
        items: [],
      },
      vacaciones: {
        dias_aprobados: 0,
        dias_pendientes: 0,
        dias_disponibles: 0,
        dias_restantes: 0,
        dias_base: 0,
        dias_arrastre: 0,
        missing_hire_date: true,
        eligible: false,
        eligible_from: null,
        accrued_this_year: false,
        items: [],
      },
    });
    return collaborators.get(key);
  };

  for (const user of usersResult.rows) {
    if (String(user.applicant_source || "").toLowerCase() === "google_forms") {
      continue;
    }
    const userEmail = user.email || null;
    const key = buildKey({ userEmail, userId: user.id });
    if (collaborators.has(key)) continue;
    const allowanceInfo = computeVacationAllowance(user.fecha_ingreso, new Date());
    const year = new Date().getFullYear();
    const historicalBalance = await getHistoricVacationBalance({
      userId: user.id,
      userEmail,
      year,
    });
    const totalAllowance = allowanceInfo.allowance + historicalBalance;
    collaborators.set(key, {
      user_id: user.id,
      user_email: userEmail,
      user_fullname: user.fullname || user.name || userEmail || `Usuario #${user.id}`,
      department_id: user.department_id || null,
      department_name: user.department_name || null,
      permisos: {
        total: 0,
        aprobacion_completa: 0,
        aprobacion_parcial: 0,
        pendientes: 0,
        aprobados: 0,
        items: [],
      },
      vacaciones: {
        dias_aprobados: 0,
        dias_pendientes: 0,
        dias_disponibles: totalAllowance,
        dias_restantes: totalAllowance,
        dias_base: allowanceInfo.allowance,
        dias_arrastre: historicalBalance,
        missing_hire_date: allowanceInfo.missingHireDate,
        eligible: allowanceInfo.eligible,
        eligible_from: allowanceInfo.eligibleFrom,
        accrued_this_year: allowanceInfo.accruedThisYear,
        items: [],
      },
    });
  }

  const settledRows = await settleExpiredRecoveryCoordinationRows(rows);

  settledRows.forEach((row) => {
    const key = buildKey({
      userEmail: row.user_email,
      userId: row.user_id,
      fallbackId: row.id,
    });
    const record = ensureCollaboratorRecord({
      key,
      userId: row.user_id || null,
      userEmail: row.user_email || null,
      userFullname: row.user_fullname || null,
      departmentId: row.department_id || null,
      departmentName: row.department_name || null,
    });
    const status = row.status || "pending";

    if (row.tipo_solicitud === "vacaciones") {
      const days = calculateVacationDays(row);
      if (status === "approved" || status === "aprobado") {
        record.vacaciones.dias_aprobados += days;
      } else if (status === "pending" || status === "pendiente" || status === "pending_final" || status === "partially_approved") {
        record.vacaciones.dias_pendientes += days;
      }

      record.vacaciones.items.push({
        id: row.id,
        status,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        duracion_dias: days,
        created_at: row.created_at,
        source: "permisos_vacaciones",
      });
      return;
    }

    record.permisos.total += 1;
    if (status === "approved" || status === "aprobado") {
      record.permisos.aprobacion_completa += 1;
      record.permisos.aprobados += 1;
      if (row.charged_to_vacation) {
        record.vacaciones.dias_aprobados += getChargedVacationDays(row);
      }
    } else if (status === "partially_approved") {
      record.permisos.aprobacion_parcial += 1;
    } else if (status === "pending" || status === "pending_final" || status === "pendiente") {
      record.permisos.pendientes += 1;
    }

    record.permisos.items.push({
      id: row.id,
      status,
      tipo_permiso: row.tipo_permiso,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      duracion_horas: row.duracion_horas,
      duracion_dias: row.duracion_dias,
      charged_to_vacation: row.charged_to_vacation,
      charged_vacation_hours: row.charged_vacation_hours,
      charged_vacation_days: row.charged_vacation_days,
      justificacion_requerida: row.justificacion_requerida,
      justificantes_urls: row.justificantes_urls,
      es_emergencia: Boolean(row.es_emergencia),
      created_at: row.created_at,
      aprobacion_parcial_at: row.aprobacion_parcial_at,
      aprobacion_final_at: row.aprobacion_final_at,
    });
  });

  vacationRequestsResult.rows.forEach((row) => {
    const key = buildKey({
      userEmail: row.requester_email,
      userId: row.requester_id,
      fallbackId: row.id,
    });
    const record = ensureCollaboratorRecord({
      key,
      userId: row.requester_id || null,
      userEmail: row.requester_email || null,
      userFullname: row.requester_name || null,
      departmentId: row.department_id || null,
      departmentName: row.department_name || null,
    });
    const status = String(row.status || "").toLowerCase();
    const days = Number(row.days || 0);

    if (status === "approved" || status === "aprobado") {
      record.vacaciones.dias_aprobados += days;
    } else if (status === "pending" || status === "pendiente") {
      record.vacaciones.dias_pendientes += days;
    }

    record.vacaciones.items.push({
      id: row.id,
      status: row.status,
      fecha_inicio: row.start_date,
      fecha_fin: row.end_date,
      duracion_dias: days,
      created_at: row.created_at,
      source: "vacaciones_solicitudes",
    });
  });

  return Array.from(collaborators.values()).map((record) => {
    const saldo = record.vacaciones.dias_disponibles -
      record.vacaciones.dias_aprobados -
      record.vacaciones.dias_pendientes;
    record.vacaciones.dias_restantes = saldo;
    return {
      ...record,
      fullname: record.user_fullname || null,
      email: record.user_email || null,
    };
  });
}

// ─── Auto-cancelled justification window: warning (1 day before deadline) ─────

async function processAutoCancelledJustificationWarnings() {
  await ensureTable();
  const { rows } = await db.query(`
    SELECT * FROM permisos_vacaciones
     WHERE cancellation_reason = 'auto_expired_without_approval'
       AND auto_cancelled_justification_deadline IS NOT NULL
       AND auto_cancelled_justification_warning_sent = false
       AND auto_cancelled_justification_submitted_at IS NULL
       AND LOWER(COALESCE(status, '')) = 'cancelled'
       AND auto_cancelled_justification_deadline - NOW() <= INTERVAL '1 day'
       AND auto_cancelled_justification_deadline > NOW()
  `);

  if (!rows.length) return { scanned: 0, warned: 0 };

  let warned = 0;
  for (const row of rows) {
    try {
      await db.query(
        `UPDATE permisos_vacaciones
            SET auto_cancelled_justification_warning_sent = true,
                updated_at = NOW()
          WHERE id = $1
            AND auto_cancelled_justification_warning_sent = false`,
        [row.id]
      );

      if (row.user_id) {
        await notificationManager.sendNotification({
          userId: row.user_id,
          customTitle: "Plazo de justificacion por vencer",
          customMessage: `Tu solicitud #${row.id} cancelada automaticamente vence manana su plazo de justificacion. Si asististe sin aprobacion, sube los justificantes antes de que se descuenten de tus vacaciones.`,
          type: "alert",
          source: "permisos_vacaciones",
          priority: 2,
          email: true,
          meta: {
            solicitud_id: row.id,
            tipo_solicitud: row.tipo_solicitud || null,
            auto_cancelled_justification_deadline: row.auto_cancelled_justification_deadline,
            target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${row.id}`,
          },
        });
      }
      warned += 1;
    } catch (err) {
      logger.warn({ err, solicitudId: row.id }, "Error enviando advertencia de vencimiento de justificacion");
    }
  }

  return { scanned: rows.length, warned };
}

// ─── Auto-cancelled justification window: deduct from vacation after deadline ─

async function processAutoCancelledJustificationDeductions() {
  await ensureTable();
  const { rows } = await db.query(`
    SELECT * FROM permisos_vacaciones
     WHERE cancellation_reason = 'auto_expired_without_approval'
       AND auto_cancelled_justification_deadline IS NOT NULL
       AND NOW() >= auto_cancelled_justification_deadline
       AND auto_cancelled_justification_submitted_at IS NULL
       AND LOWER(COALESCE(status, '')) = 'cancelled'
       AND COALESCE(charged_to_vacation, false) = false
  `);

  if (!rows.length) return { scanned: 0, deducted: 0 };

  let deducted = 0;
  for (const row of rows) {
    try {
      const vacationCharge = buildVacationCharge(row);
      const { rows: updated } = await db.query(
        `UPDATE permisos_vacaciones
            SET charged_to_vacation = true,
                charged_vacation_hours = COALESCE(charged_vacation_hours, $2),
                charged_vacation_days = COALESCE(charged_vacation_days, $3),
                charged_to_vacation_at = COALESCE(charged_to_vacation_at, NOW()),
                charged_to_vacation_reason = COALESCE(charged_to_vacation_reason, 'auto_cancelled_no_justification'),
                updated_at = NOW()
          WHERE id = $1
            AND COALESCE(charged_to_vacation, false) = false
          RETURNING *`,
        [row.id, vacationCharge.hours, vacationCharge.days]
      );

      if (!updated[0]) continue;

      try {
        await logAction({
          usuario_id: null,
          usuario_email: "system_auto_expiry",
          modulo: "permisos",
          accion: "descuento_vacaciones_sin_justificacion",
          descripcion: "Dias descontados de vacaciones por solicitud cancelada automaticamente sin justificacion dentro del plazo.",
          datos_nuevos: {
            solicitud_id: row.id,
            charged_vacation_hours: vacationCharge.hours,
            charged_vacation_days: vacationCharge.days,
            charged_to_vacation_reason: "auto_cancelled_no_justification",
          },
          contexto: { auto: true },
        });
      } catch (auditErr) {
        logger.warn({ auditErr, solicitudId: row.id }, "No se pudo registrar auditoria de descuento automatico");
      }

      if (row.user_id) {
        await notificationManager.sendNotification({
          userId: row.user_id,
          customTitle: "Dias descontados de vacaciones",
          customMessage: `La solicitud #${row.id} no fue justificada dentro del plazo de 30 dias. Se han descontado ${vacationCharge.days} dia(s) de tus vacaciones disponibles.`,
          type: "alert",
          source: "permisos_vacaciones",
          priority: 2,
          email: true,
          meta: {
            solicitud_id: row.id,
            charged_vacation_days: vacationCharge.days,
            target_path: `/dashboard/talento-humano/permisos?tab=mine&solicitudId=${row.id}`,
          },
        });
      }

      if (row.approver_user_id) {
        await notificationManager.sendNotification({
          userId: row.approver_user_id,
          customTitle: "Descuento automatico de vacaciones aplicado",
          customMessage: `La solicitud #${row.id} de ${row.user_fullname || row.user_email} no fue justificada. Se descontaron ${vacationCharge.days} dia(s) de sus vacaciones.`,
          type: "info",
          source: "permisos_vacaciones",
          priority: 1,
          email: false,
          meta: {
            solicitud_id: row.id,
            charged_vacation_days: vacationCharge.days,
          },
        });
      }

      deducted += 1;
    } catch (err) {
      logger.warn({ err, solicitudId: row.id }, "Error aplicando descuento automatico de vacaciones");
    }
  }

  return { scanned: rows.length, deducted };
}

module.exports = {
  ensureTable,
  createSolicitud,
  aprobarParcial,
  subirJustificantes,
  aprobarFinal,
  rechazar,
  cancelarSolicitud,
  revisarCancelacionSolicitud,
  updateRecoveryPlan,
  listarPendientes,
  listarPorUsuario,
  getSolicitudById,
  listarResumenColaboradores,
  registerStudyEnrollment,
  getActiveStudyEnrollment,
  listMyStudyEnrollments,
  listPendingStudyEnrollments,
  reviewStudyEnrollment,
  recreateCalendarEventForSolicitud,
  processExpiredPendingSolicitudes,
  processExpiredRecoveryCoordinations,
  processAutoCancelledJustificationWarnings,
  processAutoCancelledJustificationDeductions,
  getLegalVerificationByToken,
  getLegalCoverage,
};
