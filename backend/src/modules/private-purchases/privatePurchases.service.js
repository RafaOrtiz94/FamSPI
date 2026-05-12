/**
 * Private Purchases Service
 *
 * Servicio principal para gestiรณn de compras privadas.
 * Maneja creaciรณn, transiciones de estado y operaciones del workflow.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { PrivatePurchaseStateMachine, PRIVATE_PURCHASE_STATES, FLOW_TYPES } = require('./privatePurchaseStateMachine');
const notificationManager = require('../notifications/notificationManager');
const { createDeliveryEvents } = require('../calendar/calendar.service');
const { createAllDayEvent } = require("../../utils/calendar");
const { uploadBase64File, ensureFolder, drive } = require("../../utils/drive");
const { resolveExternalDriveIntegrity } = require("../../utils/documentHash");
const { sendAndArchive } = require("../../utils/emailArchive");
const { generateDeliveryActPdf } = require("./privatePurchases.acta");
const businessCaseService = require('../business-case/businessCase.service');
const { enqueuePurchaseStatusChangedEvent } = require("../integrations/hooks");
const {
  SITE_INSPECTION_RESULT,
  SITE_INSPECTION_STATUS,
  normalizeDateOnlyInput,
  normalizeInspectionResult,
  normalizeFst07Checklist,
  getSiteInspectionState,
  createSiteInspectionError,
  assertFollowUpDateConsistency,
} = require("../servicio/siteInspectionRules.service");
const { generateFst07PdfBuffer, buildFst07FileName } = require("../servicio/fst07Pdf.service");
const { trackFst07WorkflowDocument } = require("../servicio/fst07.service");
const { generateFst14PdfBuffer, buildFst14FileName } = require("../servicio/fst14Pdf.service");
const { trackFst14WorkflowDocument, trackFst10WorkflowDocument } = require("../servicio/fst14.service");
const {
  normalizeInstallationWorkflowState,
  buildDispatchRequestPatch,
  buildLogisticsValidationPatch,
  buildVisualReceptionPatch,
  buildVerificationDecisionPatch,
  buildVerificationRemediationPatch,
  buildCuProviderReportPatch,
  computeInstallationClosureGate,
  enrichInstallationWorkflowWithGate,
  createInstallationWorkflowError,
} = require("../servicio/installationWorkflow.service");
const {
  createRequest: createServiceRequest,
  addDriveAttachment,
} = require("../requests/requests.service");

const driveLink = (fileId) => (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);
const RESERVATION_REMINDER_OFFSET_DAYS = 55;
const PRIVATE_OFFER_KIND_CANONICAL_MAP = Object.freeze({
  venta: "venta",
  comodato: "comodato",
  alquiler: "alquiler",
  prestamo: "alquiler",
  alquiler_transferencia_dominio: "alquiler_transferencia_dominio",
  alquiler_con_transferencia_de_dominio: "alquiler_transferencia_dominio"
});
const PRIVATE_OFFER_KIND_ALLOWED = Object.freeze([
  "venta",
  "comodato",
  "alquiler",
  "alquiler_transferencia_dominio",
]);
const PRIVATE_CHECKLIST_ITEM_LABELS = {
  client_data_complete: "Datos del cliente completos",
  equipment_defined: "Equipos definidos",
  availability_email_sent: "Correo de disponibilidad enviado al proveedor",
  provider_response_registered: "Respuesta del proveedor registrada",
  business_case_created: "Business Case creado",
  offer_uploaded: "Oferta cargada",
  signed_offer_uploaded: "Oferta firmada del cliente cargada",
  client_registered: "Cliente registrado",
  inspection_requested: "Inspección de ambiente solicitada",
  inspection_act_uploaded: "Acta de inspección cargada",
  inspection_window_defined: "Ventana de inspección definida",
  inspection_date_coordinated: "Fecha de inspección coordinada",
  lopdp_approved: "Aprobación LOPDP confirmada",
  client_id_uploaded: "Documento de identificación del cliente cargado",
  contract_draft_uploaded: "Contrato borrador cargado",
  contract_client_signed_uploaded: "Contrato firmado por cliente cargado",
  inspection_site_compliant: "Sitio conforme para instalación (F.ST-07)",
  equipment_arrived: "Equipo marcado como arribado",
  delivery_dates_submitted: "Fechas de entrega registradas",
};

const formatEquipmentList = (equipment = []) => {
  return equipment
    .map((item) => {
      const typeLabel = item.type === "cu" ? " (CU)" : item.type === "new_import" ? " (Nuevo para importación)" : item.type === "installed_client" ? " (Instalado en cliente)" : " (Nuevo disponible)";
      const name = item.name || item.sku || "Equipo";
      return `- ${name}${typeLabel}`;
    })
    .join("<br>");
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const addDaysIso = (days = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  return toIsoDate(date);
};
const TECHNICAL_DAILY_CAPACITY = Number.parseInt(process.env.TECHNICAL_DAILY_CAPACITY || "3", 10);
let privateSiteInspectionColumnsReady = false;
let privateInstallationWorkflowColumnsReady = false;

const ensurePrivateSiteInspectionColumns = async () => {
  if (privateSiteInspectionColumnsReady) return;
  await db.query(`
    ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS site_inspection JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS site_inspection_status TEXT,
      ADD COLUMN IF NOT EXISTS site_inspection_result TEXT,
      ADD COLUMN IF NOT EXISTS site_inspection_follow_up_date DATE,
      ADD COLUMN IF NOT EXISTS site_inspection_report_document_id TEXT,
      ADD COLUMN IF NOT EXISTS site_inspection_report_link TEXT,
      ADD COLUMN IF NOT EXISTS site_inspection_report_generated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS site_inspection_ready_for_installation BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS site_inspection_requires_reinspection BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS site_inspection_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS site_inspection_updated_by INTEGER,
      ADD COLUMN IF NOT EXISTS site_inspection_updated_by_email TEXT;
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_private_purchase_site_inspection_status
      ON private_purchase_requests (site_inspection_status, site_inspection_ready_for_installation)`,
  );
  privateSiteInspectionColumnsReady = true;
};

const ensurePrivateInstallationWorkflowColumns = async () => {
  if (privateInstallationWorkflowColumnsReady) return;
  await db.query(`
    ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS installation_workflow JSONB NOT NULL DEFAULT '{}'::jsonb
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_private_purchase_installation_workflow
      ON private_purchase_requests USING GIN (installation_workflow)`,
  );
  privateInstallationWorkflowColumnsReady = true;
};

class PrivatePurchasesService {
  _normalizeStatusFilter(rawStatus) {
    const normalized = String(rawStatus || "").trim().toLowerCase();
    if (!normalized) return null;
    if (!Object.values(PRIVATE_PURCHASE_STATES).includes(normalized)) {
      const error = new Error(`Estado inválido para filtro: ${rawStatus}`);
      error.status = 400;
      error.code = 'INVALID_STATUS_FILTER';
      throw error;
    }
    return normalized;
  }

  _normalizeOfferKind(rawOfferKind, { allowLegacyAlias = true } = {}) {
    const normalized = String(rawOfferKind || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (!normalized) return "venta";
    if (allowLegacyAlias && PRIVATE_OFFER_KIND_CANONICAL_MAP[normalized]) {
      return PRIVATE_OFFER_KIND_CANONICAL_MAP[normalized];
    }
    return PRIVATE_OFFER_KIND_ALLOWED.includes(normalized) ? normalized : null;
  }

  _normalizeOfferKindsInRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [rows];
    list.forEach((row) => {
      if (!row || typeof row !== "object") return;
      row.offer_kind = this._normalizeOfferKind(row.offer_kind, { allowLegacyAlias: true }) || row.offer_kind;
    });
  }

  _getUserRoles(user) {
    const candidates = [];
    if (Array.isArray(user?.role)) {
      candidates.push(...user.role);
    } else if (user?.role) {
      candidates.push(user.role);
    }
    if (Array.isArray(user?.roles)) {
      candidates.push(...user.roles);
    }
    if (user?.scope) {
      candidates.push(user.scope);
    }
    return Array.from(
      new Set(
        candidates
          .flatMap((value) => String(value || "").split(/[,\s]+/))
          .map((role) => role.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  _hasRoleToken(user, token) {
    if (!token) return false;
    const tokenText = String(token).toLowerCase();
    return this._getUserRoles(user).some((role) => role.includes(tokenText));
  }

  _hasAnyRoleToken(user, tokens = []) {
    return tokens.some((token) => this._hasRoleToken(user, token));
  }

  _getInspectionResponsibleName(user) {
    const fullName = String(user?.fullname || user?.name || "").trim();
    if (fullName) return fullName;
    return String(user?.email || "").trim() || "N/D";
  }

  _parseSiteInspectionState(row = {}) {
    const source = row?.site_inspection && typeof row.site_inspection === "object"
      ? row.site_inspection
      : {};
    const mergedSource = {
      ...source,
      status: row.site_inspection_status || source.status || null,
      result: row.site_inspection_result || source.result || null,
      follow_up_date: row.site_inspection_follow_up_date || source.follow_up_date || null,
      report_file_id: row.site_inspection_report_document_id || source.report_file_id || null,
      report_link: row.site_inspection_report_link || source.report_link || null,
      report_generated_at:
        row.site_inspection_report_generated_at || source.report_generated_at || null,
      ready_for_installation:
        row.site_inspection_ready_for_installation ?? source.ready_for_installation,
      requires_reinspection:
        row.site_inspection_requires_reinspection ?? source.requires_reinspection,
      updated_at: row.site_inspection_updated_at || source.updated_at || null,
      updated_by: row.site_inspection_updated_by || source.updated_by || null,
      updated_by_email: row.site_inspection_updated_by_email || source.updated_by_email || null,
    };
    return getSiteInspectionState(mergedSource);
  }

  _applySiteInspectionState(row) {
    if (!row || typeof row !== "object") return row;
    const state = this._parseSiteInspectionState(row);
    row.site_inspection = state;
    row.site_inspection_status = state.status;
    row.site_inspection_result = state.result;
    row.site_inspection_follow_up_date = state.follow_up_date || null;
    row.site_inspection_report_document_id = state.report_file_id;
    row.site_inspection_report_link = state.report_link;
    row.site_inspection_report_generated_at = state.report_generated_at || null;
    row.site_inspection_ready_for_installation = Boolean(state.ready_for_installation);
    row.site_inspection_requires_reinspection = Boolean(state.requires_reinspection);
    row.site_inspection_updated_at = state.updated_at || null;
    row.site_inspection_updated_by = state.updated_by || null;
    row.site_inspection_updated_by_email = state.updated_by_email || null;

    // Aliases compat para workspace técnico existente.
    row.inspection_site_status = state.status;
    row.inspection_site_result = state.result;
    row.inspection_site_follow_up_date = state.follow_up_date || null;
    row.inspection_site_report_file_id = state.report_file_id || null;
    row.inspection_site_report_link = state.report_link || null;
    row.inspection_site_report_generated_at = state.report_generated_at || null;
    row.inspection_site_ready_for_installation = Boolean(state.ready_for_installation);
    row.inspection_site_requires_reinspection = Boolean(state.requires_reinspection);
    row.inspection_site_checklist = state.checklist || {};
    row.inspection_site_observations = state.observations || null;
    row.inspection_site_recommendations = state.recommendations || null;
    row.inspection_site_responsible_name = state.responsible_name || null;
    row.inspection_site_client_signer_name = state.client_signer_name || null;
    row.inspection_site_inspected_at = state.inspected_at || null;
    row.inspection_site_history = Array.isArray(state.history) ? state.history : [];
    return row;
  }

  _attachSiteInspectionState(rows = []) {
    const list = Array.isArray(rows) ? rows : [rows];
    list.forEach((row) => this._applySiteInspectionState(row));
    return list;
  }

  _parseInstallationWorkflowState(row = {}) {
    const normalized = normalizeInstallationWorkflowState(row?.installation_workflow || {}, {
      equipment: Array.isArray(row?.equipment) ? row.equipment : [],
    });
    const gate = computeInstallationClosureGate({
      workflow: normalized,
      siteReady: Boolean(this._parseSiteInspectionState(row).ready_for_installation),
      requiresSiteInspection: Boolean(row?.inspection_request_id || row?.inspection_scheduled_date),
    });
    return {
      ...normalized,
      closure_gate: gate,
    };
  }

  _applyInstallationWorkflowState(row) {
    if (!row || typeof row !== "object") return row;
    const state = this._parseInstallationWorkflowState(row);
    row.installation_workflow = state;
    row.installation_can_close = Boolean(state?.closure_gate?.can_close);
    row.installation_blocked_reasons = Array.isArray(state?.closure_gate?.blocked_reasons)
      ? state.closure_gate.blocked_reasons
      : [];
    row.installation_dispatch_request = state.dispatch_request;
    row.installation_logistics_validation = state.logistics_validation;
    row.installation_visual_reception = state.visual_reception;
    row.installation_verification_decision = state.verification_decision;
    row.installation_verification_cycle = state.verification_cycle;
    row.installation_cu_flow = state.cu_flow;
    row.installation_delivery_act = state.delivery_act;

    // Aliases para frontend técnico.
    row.fst14_report_file_id = state.visual_reception?.report_file_id || null;
    row.fst14_report_link = state.visual_reception?.report_link || null;
    row.fst14_result = state.visual_reception?.result || null;
    row.verification_decision_applies = state.verification_decision?.applies;
    row.verification_cycle_status = state.verification_cycle?.status || null;
    row.verification_attempts = Array.isArray(state.verification_cycle?.attempts)
      ? state.verification_cycle.attempts
      : [];
    row.delivery_act_internal_copy_file_id = state.delivery_act?.legal_internal_copy_file_id || null;
    row.delivery_act_internal_copy_link = state.delivery_act?.legal_internal_copy_link || null;
    row.delivery_act_client_copy_file_id = state.delivery_act?.legal_client_copy_file_id || null;
    row.delivery_act_client_copy_link = state.delivery_act?.legal_client_copy_link || null;
    return row;
  }

  _attachInstallationWorkflowState(rows = []) {
    const list = Array.isArray(rows) ? rows : [rows];
    list.forEach((row) => this._applyInstallationWorkflowState(row));
    return list;
  }

  _assertInstallationClosureReady(row = {}) {
    const state = this._parseInstallationWorkflowState(row);
    const gate = state?.closure_gate || {};
    if (gate.can_close) return state;
    const error = createInstallationWorkflowError(
      "No se puede cerrar la instalacion: existen prerequisitos pendientes",
      {
        status: 409,
        code: "INSTALLATION_CLOSURE_BLOCKED",
        details: {
          blocked_reasons: Array.isArray(gate.blocked_reasons) ? gate.blocked_reasons : [],
        },
      },
    );
    throw error;
  }

  _assertSiteReadyForInstallation(row = {}) {
    const state = this._parseSiteInspectionState(row);
    if (state.ready_for_installation) return;
    const error = new Error("El sitio inspeccionado no está conforme para instalación");
    error.status = 409;
    error.code = "SITE_NOT_READY_FOR_INSTALLATION";
    error.details = {
      inspection_site_status: state.status,
      follow_up_date: state.follow_up_date || null,
    };
    throw error;
  }

  async _upsertPrivateReinspectionTechnicalActivity({ purchase, followUpDate, user }) {
    if (!purchase?.id || !followUpDate) return;
    const sourceType = "private_purchase_reinspection";
    const sourceId = String(purchase.id);
    const title = `Reinspección de ambiente - ${purchase?.client_snapshot?.commercial_name || purchase?.client_snapshot?.name || "cliente"}`;
    const notes = `Reinspección F.ST-07 para compra privada #${purchase.id}`;

    const { rows } = await db.query(
      `SELECT id
         FROM servicio.cronograma_actividades_tecnicas
        WHERE source_type = $1
          AND source_id = $2
        ORDER BY id DESC
        LIMIT 1`,
      [sourceType, sourceId],
    );

    if (rows[0]?.id) {
      await db.query(
        `UPDATE servicio.cronograma_actividades_tecnicas
            SET activity_date = $1,
                title = $2,
                notes = $3,
                status = 'programado',
                updated_at = now()
          WHERE id = $4`,
        [followUpDate, title, notes, rows[0].id],
      );
      return;
    }

    await db.query(
      `INSERT INTO servicio.cronograma_actividades_tecnicas (
          user_id, activity_date, title, notes, status, source_type, source_id, created_by, created_by_email, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'programado', $5, $6, $7, $8, now(), now())`,
      [
        Number.isFinite(Number(purchase?.inspection_coordinated_by))
          ? Number(purchase.inspection_coordinated_by)
          : null,
        followUpDate,
        title,
        notes,
        sourceType,
        sourceId,
        Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
        user?.email || null,
      ],
    );
  }

  async _closePrivateReinspectionTechnicalActivity(purchaseId) {
    if (!purchaseId) return;
    await db.query(
      `UPDATE servicio.cronograma_actividades_tecnicas
          SET status = 'completado',
              updated_at = now()
        WHERE source_type = 'private_purchase_reinspection'
          AND source_id = $1
          AND COALESCE(lower(status), 'programado') IN ('programado', 'confirmado', 'en_proceso')`,
      [String(purchaseId)],
    );
  }

  async _listTechnicalScheduleByDate({ date, excludePrivatePurchaseId = null, excludeInspectionRequestId = null }) {
    const dateKey = String(date || "").slice(0, 10);
    if (!dateKey) return [];
    const { rows } = await db.query(
      `
        SELECT activity_date, source_type, summary
        FROM (
          SELECT
            a.activity_date::date AS activity_date,
            'actividad_tecnica'::text AS source_type,
            COALESCE(a.title, 'Actividad técnica') AS summary
          FROM servicio.cronograma_actividades_tecnicas a
          WHERE a.activity_date = $1::date
            AND COALESCE(lower(a.status), 'programado') IN ('programado', 'confirmado', 'en_proceso')

          UNION ALL

          SELECT
            m.fecha_programada::date AS activity_date,
            'mantenimiento'::text AS source_type,
            COALESCE(m.descripcion, 'Mantenimiento programado') AS summary
          FROM servicio.cronograma_mantenimientos m
          WHERE m.fecha_programada = $1::date
            AND COALESCE(lower(m.estado), 'pendiente') IN ('pendiente', 'en proceso')

          UNION ALL

          SELECT
            c.fecha::date AS activity_date,
            'capacitacion'::text AS source_type,
            COALESCE(c.titulo, 'Capacitación técnica') AS summary
          FROM servicio.cronograma_capacitacion c
          WHERE c.fecha = $1::date
            AND COALESCE(lower(c.estado), 'programado') NOT IN ('cancelada', 'cancelado')

          UNION ALL

          SELECT
            epr.inspection_scheduled_date::date AS activity_date,
            'inspeccion_compra_publica'::text AS source_type,
            COALESCE(epr.client_name, 'Inspección compra pública') AS summary
          FROM equipment_purchase_requests epr
          WHERE epr.inspection_scheduled_date = $1::date
            AND (epr.status IS NULL OR epr.status::text NOT IN ('completed'))

          UNION ALL

          SELECT
            ppr.inspection_scheduled_date::date AS activity_date,
            'inspeccion_compra_privada'::text AS source_type,
            COALESCE(ppr.client_name, 'Inspección compra privada') AS summary
          FROM private_purchase_requests ppr
          WHERE ppr.inspection_scheduled_date = $1::date
            AND ($2::uuid IS NULL OR ppr.id <> $2::uuid)
            AND (ppr.status IS NULL OR ppr.status::text NOT IN ('completed', 'cancelled'))

          UNION ALL

          SELECT
            (r.payload->>'fecha_instalacion')::date AS activity_date,
            'solicitud_inspeccion'::text AS source_type,
            COALESCE(r.payload->>'nombre_cliente', 'Solicitud de inspección') AS summary
          FROM requests r
          JOIN request_types rt ON rt.id = r.request_type_id
          WHERE rt.code = 'F.ST-20'
            AND (r.payload->>'fecha_instalacion') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            AND (r.payload->>'fecha_instalacion')::date = $1::date
            AND ($3::int IS NULL OR r.id <> $3::int)
            AND COALESCE(r.status, '') NOT IN ('rechazado', 'cancelado')
        ) timeline
      `,
      [dateKey, excludePrivatePurchaseId, excludeInspectionRequestId],
    );
    return rows;
  }

  _isRoleAllowedForList(user, requestedRole) {
    const role = String(requestedRole || "").toLowerCase();
    const userRoles = this._getUserRoles(user);
    if (userRoles.includes(role)) return true;
    if (role === "comercial" && userRoles.includes("jefe_comercial")) return true;
    if (role === "backoffice_comercial" && userRoles.includes("jefe_comercial")) return true;
    if (role === "gerencia_general" && userRoles.includes("gerente_general")) return true;
    return false;
  }

  async ensureBusinessCaseForComodato(purchaseId, user, purchaseRow = null) {
    const row =
      purchaseRow ||
      (await db.query(
        `SELECT
            id,
            business_case_id,
            offer_kind,
            client_snapshot,
            drive_folder_id,
            status
         FROM private_purchase_requests
        WHERE id = $1
        LIMIT 1`,
        [purchaseId]
      )).rows[0];

    if (!row) {
      return null;
    }

    if (row.offer_kind !== 'comodato') {
      return null;
    }

    if (row.business_case_id) {
      return row.business_case_id;
    }

    logger.info({
      purchaseId,
      status: row.status,
      message: 'Comodato sin BC, creando automáticamente'
    }, '[FLOW_PRIVADA][BE][BC_AUTO][START]');

    const clientSnapshot = row.client_snapshot || {};
    const rawClientId =
      clientSnapshot.client_identifier ||
      clientSnapshot.ruc_cedula ||
      clientSnapshot.nit ||
      null;
    const safeClientId = this._toSafeInt(rawClientId);

    const bcPayload = {
      client_name:
        clientSnapshot.commercial_name ||
        clientSnapshot.name ||
        clientSnapshot.legal_person_business_name ||
        'Cliente',
      client_id:
        clientSnapshot.client_identifier ||
        clientSnapshot.ruc_cedula ||
        clientSnapshot.nit ||
        null,
      bc_purchase_type: 'private_comodato',
      bc_stage: 'pending_backoffice',
      bc_progress: { source: 'private_purchase', purchaseId },
      extra: { private_purchase_id: purchaseId },
      modern_bc_metadata: { private_purchase_id: purchaseId, offer_kind: row.offer_kind },
      assigned_to_email: user?.email,
      assigned_to_name: user?.fullname || user?.name || null
    };

    try {
      const bcRecord = await businessCaseService.createBusinessCase(
        { ...bcPayload, client_id: safeClientId },
        user
      );
      const bcId = bcRecord?.business_case_id || bcRecord?.id || null;
      if (!bcId) {
        logger.warn({ purchaseId }, 'Business Case automático creado sin ID');
        return null;
      }

      await db.query(
        'UPDATE private_purchase_requests SET business_case_id = $1, updated_at = NOW() WHERE id = $2',
        [bcId, purchaseId]
      );

      try {
        if (row.status !== PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS) {
          await this.transitionState(
            purchaseId,
            PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS,
            user,
            'Business Case creado automáticamente'
          );
        }
      } catch (transitionError) {
        logger.warn({ transitionError, purchaseId }, 'No se pudo transicionar tras crear BC automático');
      }

      logger.info({
        purchaseId,
        bcId,
        status: row.status
      }, '[FLOW_PRIVADA][BE][BC_AUTO][CREATED]');

      return bcId;
    } catch (bcError) {
      logger.error({ bcError, purchaseId }, 'Error creando Business Case automático para comodato');
      return null;
    }
  }

  async startBusinessCaseForComodato(purchaseId, user) {
    const { rows } = await db.query(
      `SELECT id, offer_kind, business_case_id, status
         FROM private_purchase_requests
        WHERE id = $1
        LIMIT 1`,
      [purchaseId],
    );

    const row = rows[0];
    if (!row) {
      const error = new Error("Solicitud no encontrada");
      error.status = 404;
      throw error;
    }

    if (row.offer_kind !== "comodato") {
      const error = new Error("El Business Case manual solo aplica para solicitudes de comodato");
      error.status = 409;
      error.code = "BUSINESS_CASE_ONLY_FOR_COMODATO";
      throw error;
    }

    const existingBcId = row.business_case_id || null;
    const bcId = await this.ensureBusinessCaseForComodato(purchaseId, user, row);

    const { rows: refreshedRows } = await db.query(
      `SELECT id, status, business_case_id
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId],
    );
    const refreshed = refreshedRows[0] || row;

    return {
      purchase_id: purchaseId,
      business_case_id: refreshed.business_case_id || bcId || null,
      status: refreshed.status,
      created: !existingBcId && Boolean(refreshed.business_case_id || bcId),
      already_linked: Boolean(existingBcId),
    };
  }

  /**
   * Crear nueva solicitud de compra privada
   */
  async createPurchaseRequest({
    user,
    clientData,
    equipment,
    offerKind = 'venta',
    notes = '',
    businessCaseId = null,
  }) {
    logger.debug('[FLOW_PRIVADA][BE][CREATE][INPUT]', {
      userId: user?.id,
      offerKind,
      equipmentCount: Array.isArray(equipment) ? equipment.length : 0
    });
    // ===== VALIDACIONES DE ENTRADA =====
    if (!user || !user.id) {
      throw new Error('Usuario requerido para crear solicitud');
    }

    if (!clientData || typeof clientData !== 'object') {
      throw new Error('Datos del cliente requeridos');
    }

    if (!clientData.name || clientData.name.trim().length === 0) {
      throw new Error('Nombre del cliente es requerido');
    }

    if (!equipment || !Array.isArray(equipment) || equipment.length === 0) {
      throw new Error('Al menos un equipo es requerido');
    }

    const invalidEquipment = equipment.find((eq) => {
      const name = String(eq?.name || eq?.label || eq?.sku || "").trim();
      return !name;
    });
    if (invalidEquipment) {
      throw new Error('Todos los equipos deben tener al menos nombre o SKU');
    }

    const normalizedOfferKind = this._normalizeOfferKind(offerKind, { allowLegacyAlias: true });
    if (!normalizedOfferKind) {
      throw new Error(`Tipo de oferta invรกlido. Valores permitidos: ${PRIVATE_OFFER_KIND_ALLOWED.join(', ')}`);
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Verificar permisos del usuario (debe ser asesor comercial)
      const userCheck = await client.query(
        'SELECT role FROM users WHERE id = $1 AND active = true',
        [user.id]
      );

      if (!userCheck.rows.length) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      const userRole = userCheck.rows[0].role;
      if (!userRole || !userRole.includes('comercial')) {
        throw new Error('Solo asesores comerciales pueden crear solicitudes privadas');
      }

      // Verificar que no exista una solicitud similar reciente (evitar duplicados)
      const recentCheck = await client.query(`
        SELECT id FROM private_purchase_requests
        WHERE created_by = $1
        AND client_snapshot->>'name' = $2
        AND status NOT IN ('${PRIVATE_PURCHASE_STATES.DELIVERED}', '${PRIVATE_PURCHASE_STATES.REJECTED}')
        AND created_at > NOW() - INTERVAL '24 hours'
      `, [user.id, clientData.name]);

      // Se permite hasta 3 solicitudes similares por día (antes era 1)
      if (recentCheck.rows.length >= 3) {
        throw new Error('Has alcanzado el límite de 3 solicitudes similares creadas en las últimas 24 horas');
      }

      // Crear registro en private_purchase_requests
      const insertQuery = `
        INSERT INTO private_purchase_requests (
          created_by, created_by_email, client_snapshot,
          equipment, status, offer_kind, notes, business_case_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, status
      `;

      const normalizedEquipment = equipment.map((eq) => {
        const { id, ...rest } = eq || {};
        return {
          ...rest,
          name: rest?.name || rest?.label || rest?.sku || "Equipo",
          type: rest?.type || "new_available"
        };
      });

      const values = [
        user.id,
        user.email,
        JSON.stringify(clientData),
        JSON.stringify(normalizedEquipment),
        PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE,
        normalizedOfferKind,
        notes,
        businessCaseId
      ];

      const result = await client.query(insertQuery, values);
      const purchaseId = result.rows[0].id;

      await client.query('COMMIT');

      logger.debug('[FLOW_PRIVADA][BE][CREATE][COMMIT]', {
        requestId: purchaseId,
        userId: user.id,
        role: userRole
      });

      const isComodato = normalizedOfferKind === 'comodato';
      const clientDisplayName = clientData.name || clientData.commercial_name || 'Cliente sin nombre';
      const queueStartEvent = isComodato ? 'business_case_general_saved' : 'request_created';
      const creatorSubject = `Compra privada - ${clientDisplayName} - Solicitud ${purchaseId}`;
      const backofficeSubject = `Nueva solicitud privada - ${clientDisplayName} - ${normalizedOfferKind}`;

      // Enviar notificaciรณn de creaciรณn (síncrono para Cloud Run)
      try {
        await notificationManager.sendNotification({
          userId: user.id,
          template: 'private_purchase_created',
          customTitle: creatorSubject,
          data: {
            creator_name: user.fullname || user.name || 'Usuario',
            client_name: clientDisplayName,
            purchase_id: purchaseId,
            email_subject: creatorSubject,
          },
          source: 'private_purchase.creation',
          email: !isComodato,
          chat: false,
          meta: {
            purchase_id: purchaseId,
            offer_kind: normalizedOfferKind,
            queue_start_event: queueStartEvent,
          },
        });
      } catch (error) {
        logger.error('[PRIVATE_PURCHASE] Error enviando notificaciรณn de creaciรณn:', error);
      }

      // Notificar a backoffice (síncrono para Cloud Run)
      try {
        const recipients = await PrivatePurchaseStateMachine._getUsersByRole('backoffice_comercial');
        if (!recipients.length) {
          logger.info({ purchaseId }, '[PRIVATE_PURCHASE] Sin destinatarios backoffice para notificación inicial');
        }
        const payload = {
          purchase_id: purchaseId,
          client_name: clientDisplayName,
          offer_kind: normalizedOfferKind,
          email_subject: backofficeSubject,
        };
        if (recipients.length) {
          await Promise.all(recipients.map((recipient) => notificationManager.sendNotification({
            userId: recipient.id,
            template: 'private_purchase_request_submitted',
            customTitle: backofficeSubject,
            data: payload,
            email: !isComodato,
            chat: !isComodato,
            source: 'private_purchase.request',
            meta: {
              purchase_id: purchaseId,
              offer_kind: normalizedOfferKind,
              queue_start_event: queueStartEvent,
            },
          })));
        }
      } catch (error) {
        logger.warn({ error, purchaseId }, 'No se pudo notificar a backoffice de nueva solicitud');
      }

      if (normalizedOfferKind === 'comodato' && !businessCaseId) {
        await this.ensureBusinessCaseForComodato(purchaseId, user, {
          business_case_id: null,
          offer_kind: normalizedOfferKind,
          client_snapshot: clientData,
          drive_folder_id: null,
          status: PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE
        });

        try {
          await this.forwardToAcp(purchaseId, user);
        } catch (forwardError) {
          logger.warn({ forwardError, purchaseId }, 'No se pudo enviar automáticamente a ACP para comodato');
        }
      }

      return {
        id: purchaseId,
        status: result.rows[0].status,
        created: true
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[PRIVATE_PURCHASE] Error creando solicitud:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener solicitud por ID con permisos
   */

  async _getPurchaseRow(purchaseId) {
    const { rows } = await db.query(
      `SELECT id, status, client_snapshot, drive_folder_id
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    return rows[0];
  }

  async _ensureDriveFolder(purchaseId, clientSnapshot, existingFolderId) {
    if (existingFolderId) return existingFolderId;

    // Priorizar DRIVE_ROOT_FOLDER_ID sobre DRIVE_FOLDER_ID
    const baseFolderId = process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FOLDER_ID || process.env.DRIVE_DOCS_FOLDER_ID || null;

    // Intentar usar la carpeta padre configurada, pero fallback a null si no existe
    let root;
    try {
      root = await ensureFolder('Compras Privadas', baseFolderId);
      logger.debug('[FLOW_PRIVADA][BE][DRIVE][SUCCESS] Carpeta padre encontrada:', baseFolderId);
    } catch (error) {
      if (error.message?.includes('File not found') && baseFolderId) {
        logger.debug('[FLOW_PRIVADA][BE][DRIVE][FALLBACK] Carpeta padre no existe, creando en raíz:', baseFolderId);
        // Si la carpeta padre no existe, crear en la raíz de Drive
        root = await ensureFolder('Compras Privadas', null);
      } else {
        throw error;
      }
    }

    const safeClient = String(clientSnapshot?.commercial_name || clientSnapshot?.name || 'Cliente')
      .trim()
      .replace(/[\/:*?"<>|]/g, '-');
    const purchaseFolderName = `PP-${purchaseId}-${safeClient || 'Cliente'}`;
    const purchaseFolder = await ensureFolder(purchaseFolderName, root?.id || null);

    await db.query(
      'UPDATE private_purchase_requests SET drive_folder_id = $1, updated_at = NOW() WHERE id = $2',
      [purchaseFolder.id, purchaseId]
    );

    return purchaseFolder.id;
  }

  async getById(id, user) {
    await ensurePrivateSiteInspectionColumns();
    await ensurePrivateInstallationWorkflowColumns();
    const query = `
      SELECT * FROM private_purchase_requests
      WHERE id = $1
    `;

    const { rows } = await db.query(query, [id]);

    if (!rows.length) {
      throw new Error('Solicitud de compra privada no encontrada');
    }

    const purchase = rows[0];
    this._normalizeOfferKindsInRows([purchase]);
    this._attachSiteInspectionState([purchase]);
    this._attachInstallationWorkflowState([purchase]);
    await this._attachClientRequestSnapshot(purchase);
    await this._ensureArrivalStates([purchase], user);
    await this._attachChecklistState([purchase]);

    // Verificar permisos bรกsicos (por ahora todos pueden ver, pero se puede restringir)
    return purchase;
  }


  async getDocuments(purchaseId) {
    const { rows } = await db.query(
      `SELECT offer_document_id, offer_signed_document_id, contract_document_id, contract_client_signed_document_id, contract_signed_document_id,
              comodato_document_id, delivery_act_document_id, delivery_act_draft_document_id, delivery_act_logistics_signed_document_id, delivery_guides_json,
              inspection_acta_document_id,
              site_inspection_report_document_id,
              site_inspection_report_link,
              availability_email_file_id, reservation_email_file_id, reservation_calendar_event_link,
              client_snapshot, client_request_id, installation_workflow
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const row = rows[0];      const documents = [];
      const installationWorkflow = normalizeInstallationWorkflowState(row.installation_workflow || {});
      const normalizeLink = (fileRef) => {
        if (!fileRef) return null;
        if (typeof fileRef === 'string' && fileRef.startsWith('http')) return fileRef;
        return driveLink(fileRef);
      };
      const addDoc = (docType, fileId, fileName = null) => {
        if (!fileId) return;
        documents.push({
          doc_type: docType,
          drive_file_id: fileId,
          doc_name: fileName,
          link: normalizeLink(fileId)
        });
      };
      const addDocLink = (docType, link, fileName = null) => {
        if (!link) return;
        documents.push({
          doc_type: docType,
          drive_file_id: null,
          doc_name: fileName,
          link
        });
      };

    const clientRequestId =
      row.client_request_id ||
      row.client_snapshot?.registered_client_id ||
      null;
    let clientRequest = null;
    if (clientRequestId) {
      const { rows: clientRows } = await db.query(
        `SELECT
            id,
            id_file_id,
            ruc_file_id,
            operating_permit_file_id,
            legal_rep_appointment_file_id,
            approval_letter_file_id,
            consent_record_file_id,
            consent_evidence_file_id
          FROM client_requests
          WHERE id = $1`,
        [clientRequestId]
      );
      clientRequest = clientRows[0] || null;
    }

    addDoc('OFFER', row.offer_document_id);
    addDoc('SIGNED_OFFER', row.offer_signed_document_id);
    addDoc('CONTRACT_DRAFT', row.contract_document_id);
    addDoc('CONTRACT_CLIENT_SIGNED', row.contract_client_signed_document_id);
    addDoc('CONTRACT_SIGNED', row.contract_signed_document_id);
    addDoc('INSPECTION_ACT', row.inspection_acta_document_id);
    addDoc('F.ST-20', row.inspection_acta_document_id);
    addDoc('F.ST-07', row.site_inspection_report_document_id);
    if (!row.site_inspection_report_document_id) {
      addDocLink('F.ST-07', row.site_inspection_report_link);
    }
    addDoc('F.ST-14', installationWorkflow?.visual_reception?.report_file_id);
    if (!installationWorkflow?.visual_reception?.report_file_id) {
      addDocLink('F.ST-14', installationWorkflow?.visual_reception?.report_link);
    }
    const verificationAttempts = Array.isArray(installationWorkflow?.verification_cycle?.attempts)
      ? installationWorkflow.verification_cycle.attempts
      : [];
    verificationAttempts.forEach((attempt, index) => {
      const attemptDocType = `F.ST-09_ATTEMPT_${index + 1}`;
      if (attempt?.document_file_id) addDoc(attemptDocType, attempt.document_file_id);
      else if (attempt?.document_link) addDocLink(attemptDocType, attempt.document_link);
    });
    addDoc('DELIVERY_ACT_DRAFT', row.delivery_act_draft_document_id);
    addDoc('DELIVERY_ACT_LOGISTICS_SIGNED', row.delivery_act_logistics_signed_document_id);
    addDoc('DELIVERY_ACT', row.delivery_act_document_id);
      addDoc('F.ST-10_INTERNAL_COPY', installationWorkflow?.delivery_act?.legal_internal_copy_file_id);
      if (!installationWorkflow?.delivery_act?.legal_internal_copy_file_id) {
        addDocLink('F.ST-10_INTERNAL_COPY', installationWorkflow?.delivery_act?.legal_internal_copy_link);
      }
      addDoc('F.ST-10_CLIENT_COPY', installationWorkflow?.delivery_act?.legal_client_copy_file_id);
      if (!installationWorkflow?.delivery_act?.legal_client_copy_file_id) {
        addDocLink('F.ST-10_CLIENT_COPY', installationWorkflow?.delivery_act?.legal_client_copy_link);
      }
      addDoc('COMODATO', row.comodato_document_id);
      addDoc('AVAILABILITY_EMAIL', row.availability_email_file_id);
      addDoc('RESERVATION_EMAIL', row.reservation_email_file_id);
      addDocLink('RESERVATION_EVENT', row.reservation_calendar_event_link);
    const deliveryGuides = Array.isArray(row.delivery_guides_json) ? row.delivery_guides_json : [];
    deliveryGuides.forEach((guide) => {
      addDoc(
        'DELIVERY_GUIDE',
        guide?.file_id || guide?.id,
        guide?.file_name || guide?.name || null
      );
    });

    // Client registration docs (from client_requests when available)
    addDoc('CLIENT_ID', clientRequest?.id_file_id || row.client_snapshot?.id_file_id);
    addDoc('RUC', clientRequest?.ruc_file_id || row.client_snapshot?.ruc_file_id);
    addDoc('OPERATING_PERMIT', clientRequest?.operating_permit_file_id);
    addDoc('LEGAL_REP_APPOINTMENT', clientRequest?.legal_rep_appointment_file_id);
    addDoc('APPROVAL_LETTER', clientRequest?.approval_letter_file_id);
    addDoc('LOPDP_RECORD', clientRequest?.consent_record_file_id);
    addDoc('LOPDP_EVIDENCE', clientRequest?.consent_evidence_file_id);

    return documents;
  }

  /**
   * Listar solicitudes del usuario
   */
  async listByUser(user) {
    await ensurePrivateSiteInspectionColumns();
    await ensurePrivateInstallationWorkflowColumns();
    const query = `
      SELECT
        id,
        client_snapshot,
        equipment,
        status,
        offer_kind,
        business_case_id,
        client_request_id,
        client_approved_at,
        offer_valid_until,
        created_at,
        updated_at,
        created_by,
        created_by_email,
        notes,
        offer_document_id,
        offer_signed_document_id,
        contract_document_id,
        contract_client_signed_document_id,
        contract_signed_document_id,
        delivery_act_document_id,
        delivery_act_draft_document_id,
        delivery_act_logistics_signed_document_id,
        delivery_act_assigned_to_user_id,
        delivery_act_assigned_to_email,
        delivery_act_assigned_to_name,
        delivery_act_assigned_at,
        delivery_act_assigned_by,
        delivery_act_logistics_signed_at,
        delivery_act_logistics_signed_by,
        delivery_start_at,
        delivery_end_at,
        delivery_notes,
        comodato_document_id,
        client_registered_at,
        provider_email,
        availability_request_notes,
        availability_email_sent_at,
        availability_email_file_id,
        provider_response,
        provider_response_at,\n        reservation_email_sent_at,\n        reservation_email_file_id,\n        reservation_calendar_event_id,\n        reservation_calendar_event_link,\n        includes_starter_kit,\n        operations_notes,\n        estimated_arrival_at,\n        estimated_arrival_updated_at,\n        equipment_arrived_at,\n        equipment_arrived_by,
        dispatch_items_json,
        dispatch_notes,
        inspection_request_id,\n        inspection_acta_document_id,\n        inspection_requested_at,\n        inspection_min_date,\n        inspection_max_date,\n        inspection_proposed_date,\n        inspection_proposed_notes,\n        inspection_proposed_at,\n        inspection_proposed_by,\n        inspection_proposed_by_email,\n        inspection_coordination_status,\n        inspection_review_notes,\n        inspection_reviewed_at,\n        inspection_reviewed_by,\n        inspection_reviewed_by_email,\n        inspection_scheduled_date,\n        inspection_coordination_notes,\n        inspection_coordinated_at,\n        inspection_coordinated_by,\n        inspection_coordinated_by_email,\n        site_inspection,\n        site_inspection_status,\n        site_inspection_result,\n        site_inspection_follow_up_date,\n        site_inspection_report_document_id,\n        site_inspection_report_link,\n        site_inspection_report_generated_at,\n        site_inspection_ready_for_installation,\n        site_inspection_requires_reinspection,\n        site_inspection_updated_at,\n        site_inspection_updated_by,\n        site_inspection_updated_by_email,\n        installation_workflow\n      FROM private_purchase_requests
      WHERE created_by = $1
      ORDER BY created_at DESC
    `;

    const { rows } = await db.query(query, [user.id]);
    this._normalizeOfferKindsInRows(rows);
    this._attachSiteInspectionState(rows);
    this._attachInstallationWorkflowState(rows);
    await this._autoResolveClientRegistration(rows, user);
    await this._attachClientRequestSnapshot(rows);
    await this._ensureArrivalStates(rows, user);
    await this._attachChecklistState(rows);
    return rows;
  }

  async _ensureArrivalStates(rows, user) {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const needTransition = new Set([
      PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE,
      PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED,
      PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED,
      PRIVATE_PURCHASE_STATES.CALENDAR_EVENTS_CREATED
    ]);

    await Promise.all(rows.map(async (row) => {
      if (!row?.equipment_arrived_at) return;
      if (!needTransition.has(row.status)) return;

      try {
        await this.transitionState(
          row.id,
          PRIVATE_PURCHASE_STATES.WAITING_DISPATCH,
          user,
          'Autotransición tras llegada registrada'
        );
        const { rows: refreshed } = await db.query(
          'SELECT status, updated_at FROM private_purchase_requests WHERE id = $1',
          [row.id]
        );
        if (refreshed.length) {
          row.status = refreshed[0].status;
          row.updated_at = refreshed[0].updated_at;
        }
      } catch (error) {
        logger.warn({ purchaseId: row.id, error }, 'No se pudo actualizar estado tras llegada registrada');
      }
    }));
  }

  /**
   * Listar solicitudes por rol (para dashboards) - FASE 6: hardening acceso
   */
  async listByRole(user, role) {
    await ensurePrivateSiteInspectionColumns();
    await ensurePrivateInstallationWorkflowColumns();
    // FASE 6: Verificar que el rol solicitado coincida con permisos del usuario
    logger.debug(`[FLOW_PRIVADA][BE][FASE6][ACCESS][CHECK] Usuario ${user.id} solicita listByRole: ${role}`);
    const userRoles = this._getUserRoles(user);
    const hasRequestedRole = this._isRoleAllowedForList(user, role);

    if (!hasRequestedRole) {
      logger.debug(`[FLOW_PRIVADA][BE][FASE6][ACCESS][DENY] Usuario ${user.id} no tiene rol ${role}, roles: ${userRoles.join(', ')}`);
      throw new Error(`Acceso denegado: rol ${role} no autorizado`);
    }

    logger.debug(`[FLOW_PRIVADA][BE][FASE6][ACCESS][ALLOW] Usuario ${user.id} autorizado para rol ${role}`);

    let whereClause = '';
    let params = [];

    switch (role) {
      case 'comercial':
        whereClause = 'created_by = $1';
        params = [user.id];
        break;

      case 'backoffice_comercial':
        whereClause = 'status IN ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)';
        params = [
          PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE,
          PRIVATE_PURCHASE_STATES.OFFER_SENT,
          PRIVATE_PURCHASE_STATES.PENDING_MANAGER_SIGNATURE,
          PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE,
          PRIVATE_PURCHASE_STATES.OFFER_SIGNED,
          PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED,
          PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED,
          PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE,
          PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL,
          PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED,
          PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED,
          PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED,
          PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REJECTED
        ];
        break;

      case 'acp_comercial':
        whereClause = 'status IN ($1, $2, $3, $4)';
        params = [
          PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED,
          PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED,
          PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REJECTED,
          PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED,
        ];
        break;

      case 'gerencia_general':
        whereClause = 'status = $1 AND contract_client_signed_document_id IS NOT NULL';
        params = [PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL];
        break;

      case 'jefe_operaciones':
        whereClause = 'status = ANY($1)';
        params = [[
          PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE,
          PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED,
          PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED,
          PRIVATE_PURCHASE_STATES.CALENDAR_EVENTS_CREATED,
          PRIVATE_PURCHASE_STATES.WAITING_DISPATCH,
          PRIVATE_PURCHASE_STATES.DISPATCH_READY,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED
        ]];
        break;

      case 'jefe_logistica':
        whereClause = 'status = ANY($1)';
        params = [[
          PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED,
          PRIVATE_PURCHASE_STATES.WAITING_DISPATCH,
          PRIVATE_PURCHASE_STATES.DISPATCH_READY,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED
        ]];
        break;

      case 'jefe_tecnico':
      case 'jefe_servicio_tecnico':
        whereClause = 'status = ANY($1)';
        params = [[
          PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED,
          PRIVATE_PURCHASE_STATES.WAITING_DISPATCH,
          PRIVATE_PURCHASE_STATES.DISPATCH_READY,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED
        ]];
        break;

      case 'tecnico':
        whereClause = 'status = ANY($1)';
        params = [[
          PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED
        ]];
        break;

      default:
        // Sin restricciones para otros roles
        whereClause = '1=1';
    }

    const query = `
      SELECT
        id,
        client_snapshot,
        equipment,
        status,
        offer_kind,
        business_case_id,
        client_request_id,
        client_approved_at,
        offer_valid_until,
        created_at,
        updated_at,
        created_by,
        created_by_email,
        notes,
        offer_document_id,
        offer_signed_document_id,
        contract_document_id,
        contract_client_signed_document_id,
        contract_signed_document_id,
        delivery_act_document_id,
        delivery_act_draft_document_id,
        delivery_act_number,
        delivery_act_dispatched_by,
        delivery_act_dispatched_at,
        delivery_act_delivered_by,
        delivery_act_delivered_at,
        delivery_act_generated_at,
        delivery_act_assigned_to_user_id,
        delivery_act_assigned_to_email,
        delivery_act_assigned_to_name,
        delivery_act_assigned_at,
        delivery_act_assigned_by,
        delivery_act_logistics_signed_document_id,
        delivery_act_logistics_signed_at,
        delivery_act_logistics_signed_by,
        delivery_start_at,
        delivery_end_at,
        delivery_notes,
        comodato_document_id,
        client_registered_at,
        provider_email,
        availability_request_notes,
        availability_email_sent_at,
        availability_email_file_id,
        provider_response,
        provider_response_at,\n        reservation_email_sent_at,\n        reservation_email_file_id,\n        reservation_calendar_event_id,\n        reservation_calendar_event_link,\n        includes_starter_kit,\n        operations_notes,\n        estimated_arrival_at,\n        estimated_arrival_updated_at,\n        equipment_arrived_at,\n        equipment_arrived_by,
        dispatch_items_json,
        dispatch_notes,
        delivery_act_observations_json,
        inspection_request_id,\n        inspection_acta_document_id,\n        inspection_requested_at,\n        inspection_min_date,\n        inspection_max_date,\n        inspection_proposed_date,\n        inspection_proposed_notes,\n        inspection_proposed_at,\n        inspection_proposed_by,\n        inspection_proposed_by_email,\n        inspection_coordination_status,\n        inspection_review_notes,\n        inspection_reviewed_at,\n        inspection_reviewed_by,\n        inspection_reviewed_by_email,\n        inspection_scheduled_date,\n        inspection_coordination_notes,\n        inspection_coordinated_at,\n        inspection_coordinated_by,\n        inspection_coordinated_by_email,\n        site_inspection,\n        site_inspection_status,\n        site_inspection_result,\n        site_inspection_follow_up_date,\n        site_inspection_report_document_id,\n        site_inspection_report_link,\n        site_inspection_report_generated_at,\n        site_inspection_ready_for_installation,\n        site_inspection_requires_reinspection,\n        site_inspection_updated_at,\n        site_inspection_updated_by,\n        site_inspection_updated_by_email,\n        installation_workflow\n      FROM private_purchase_requests
      WHERE ${whereClause}
      ORDER BY
        CASE
          WHEN status = '${PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE}' THEN 1
          WHEN status = '${PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL}' THEN 2
          WHEN status = '${PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE}' THEN 3
          WHEN status = '${PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED}' THEN 4
          WHEN status = '${PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED}' THEN 5
          WHEN status = '${PRIVATE_PURCHASE_STATES.WAITING_DISPATCH}' THEN 6
          WHEN status = '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY}' THEN 7
          WHEN status = '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED}' THEN 8
          WHEN status = '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED}' THEN 9
          ELSE 10
        END,
        created_at DESC
    `;

    logger.debug('[FLOW_PRIVADA][BE][LIST_BY_ROLE][QUERY]', {
      role,
      userId: user?.id,
      userRole: user?.role,
      whereClause,
      params
    });
    const { rows } = await db.query(query, params);
    this._normalizeOfferKindsInRows(rows);
    this._attachSiteInspectionState(rows);
    this._attachInstallationWorkflowState(rows);
    logger.debug('[FLOW_PRIVADA][BE][LIST_BY_ROLE][RESULT]', {
      role,
      count: rows.length
    });
    await this._autoResolveClientRegistration(rows, user);
    await this._attachClientRequestSnapshot(rows);
    await this._attachChecklistState(rows);
    return rows;
  }

  /**
   * Transiciรณn de estado con validaciรณn - FASE 6: auditoría contrato errores
   */
  async transitionState(purchaseId, toState, user, reason = '') {
    logger.debug(`[FLOW_PRIVADA][BE][FASE6][ERROR_CONTRACT][MISMATCH] Verificando contrato error para transitionState`);

    const { rows } = await db.query(
      'SELECT status FROM private_purchase_requests WHERE id = $1 LIMIT 1',
      [purchaseId]
    );
    const currentState = rows[0]?.status;
    if (!currentState) {
      const error = new Error('Solicitud no encontrada');
      error.status = 404;
      throw error;
    }

    // FASE 6: Validar contrato de errores consistente
    if (toState === PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED && (!reason || reason.trim().length === 0)) {
      logger.debug(`[FLOW_PRIVADA][BE][FASE6][ERROR_CONTRACT][MISMATCH] Falta reason obligatorio para contract_rejected`);
      const error = new Error('Motivo de rechazo es obligatorio');
      error.status = 400;
      error.code = 'GERENCIA_REJECTION_REASON_REQUIRED';
      error.message = 'Motivo de rechazo es obligatorio';
      error.details = { requiredField: 'reason', forState: 'contract_rejected' };
      throw error;
    }

    if (toState === PRIVATE_PURCHASE_STATES.OFFER_REJECTED_BY_COMMERCIAL) {
      const isCommercial = this._hasRoleToken(user, 'comercial') && !this._hasRoleToken(user, 'jefe_comercial');
      if (!isCommercial) {
        const error = new Error('Solo comercial puede rechazar la oferta');
        error.status = 403;
        error.code = 'ROLE_NOT_ALLOWED';
        throw error;
      }
      if (![PRIVATE_PURCHASE_STATES.OFFER_SENT, PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE].includes(currentState)) {
        const error = new Error('La oferta solo puede rechazarse cuando está enviada al cliente');
        error.status = 409;
        error.code = 'INVALID_STATE';
        throw error;
      }
    }

    if (toState === PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED) {
      const isJefeComercial = this._hasRoleToken(user, 'jefe_comercial');
      if (!isJefeComercial) {
        const error = new Error('Solo jefe comercial puede solicitar mejora de precios');
        error.status = 403;
        error.code = 'ROLE_NOT_ALLOWED';
        throw error;
      }
      if (currentState !== PRIVATE_PURCHASE_STATES.OFFER_REJECTED_BY_COMMERCIAL) {
        const error = new Error('La mejora de precios solo aplica tras rechazo de oferta por comercial');
        error.status = 409;
        error.code = 'INVALID_STATE';
        throw error;
      }
    }

    if (toState === PRIVATE_PURCHASE_STATES.REJECTED && currentState === PRIVATE_PURCHASE_STATES.OFFER_REJECTED_BY_COMMERCIAL) {
      const isJefeComercial = this._hasRoleToken(user, 'jefe_comercial');
      if (!isJefeComercial) {
        const error = new Error('Solo jefe comercial puede confirmar el rechazo final');
        error.status = 403;
        error.code = 'ROLE_NOT_ALLOWED';
        throw error;
      }
    }

    logger.debug(`[FLOW_PRIVADA][BE][FASE6][ERROR_CONTRACT][FIXED] Contrato errores validado para transitionState`);

    const transitionResult = await PrivatePurchaseStateMachine.transition(purchaseId, toState, user.id, reason, {
      user_role: user.role,
      user_name: user.fullname || user.name
    });

    // REQ-SPI-013: no await externo en el request path.
    enqueuePurchaseStatusChangedEvent({
      purchaseType: "private_purchase",
      id: purchaseId,
      status: toState,
      businessCaseId: null,
    });

    return transitionResult;
  }


  async sendOffer(purchaseId, { offerBase64, fileName, mimeType } = {}, user) {
    if (!offerBase64 || !fileName) {
      const error = new Error('Archivo de oferta requerido');
      error.status = 400;
      throw error;
    }

    const { rows } = await db.query(
      'SELECT offer_document_id, status, client_snapshot, drive_folder_id FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const purchase = rows[0];
    const isImprovementFlow = purchase.status === PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED;
    const isAcp = this._hasRoleToken(user, 'acp_comercial');
    const isBackoffice = this._hasRoleToken(user, 'backoffice');

    if (isImprovementFlow && !isAcp) {
      const error = new Error('La oferta con mejora de precios debe ser cargada por ACP Comercial');
      error.status = 403;
      error.code = 'ROLE_NOT_ALLOWED';
      throw error;
    }

    if (!isImprovementFlow && !isBackoffice && !isAcp) {
      const error = new Error('Solo backoffice o ACP Comercial pueden cargar oferta');
      error.status = 403;
      error.code = 'ROLE_NOT_ALLOWED';
      throw error;
    }

    if (!isImprovementFlow && purchase.offer_document_id) {
      const error = new Error('Oferta ya fue subida anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      error.details = { docType: 'OFFER', existingRef: purchase.offer_document_id };
      throw error;
    }

    const folderId = await this._ensureDriveFolder(purchaseId, purchase.client_snapshot, purchase.drive_folder_id);
    const stored = await uploadBase64File(fileName, offerBase64, mimeType || 'application/pdf', folderId);

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
          SET offer_document_id = $1,
              offer_signed_document_id = CASE WHEN $3 THEN NULL ELSE offer_signed_document_id END,
              offer_signed_uploaded_at = CASE WHEN $3 THEN NULL ELSE offer_signed_uploaded_at END,
              updated_at = NOW()
        WHERE id = $2
        RETURNING *`,
      [stored.id, purchaseId, isImprovementFlow]
    );

    const transitionReason = isImprovementFlow
      ? 'Oferta mejorada enviada por ACP Comercial'
      : 'Oferta enviada';
    await this.transitionState(purchaseId, PRIVATE_PURCHASE_STATES.OFFER_SENT, user, transitionReason);

    return {
      ...updatedRows[0],
      offer_document_id: stored.id,
      offer_document_link: stored.webViewLink || null
    };
  }

  async requestDeliveryDates(purchaseId, user) {
    await ensurePrivateSiteInspectionColumns();
    const { rows } = await db.query(
      `SELECT status,
              created_by,
              client_snapshot,
              equipment_arrived_at,
              inspection_request_id,
              inspection_scheduled_date,
              site_inspection,
              site_inspection_status,
              site_inspection_result,
              site_inspection_follow_up_date,
              site_inspection_ready_for_installation
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const isOperationsRole = this._hasRoleToken(user, 'operaciones');

    if (!isOperationsRole) {
      const error = new Error('Solo operaciones puede solicitar fecha de entrega');
      error.status = 403;
      error.code = 'ROLE_NOT_ALLOWED';
      throw error;
    }

    const currentStatus = rows[0].status;
    if (currentStatus !== PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE) {
      const error = new Error('La solicitud no esta lista para solicitar fecha de entrega');
      error.status = 409;
      error.code = 'INVALID_STATUS';
      error.details = { status: currentStatus };
      throw error;
    }

    if (!rows[0].equipment_arrived_at) {
      const error = new Error('Debe marcar la llegada del equipo antes de solicitar fecha de entrega');
      error.status = 409;
      error.code = 'EQUIPMENT_NOT_ARRIVED';
      throw error;
    }

    if (rows[0]?.inspection_request_id || rows[0]?.inspection_scheduled_date) {
      this._assertSiteReadyForInstallation(rows[0]);
    }

    await this.transitionState(
      purchaseId,
      PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED,
      user,
      'Solicitar fechas de entrega'
    );

    const purchase = rows[0];
    if (purchase.created_by) {
      await notificationManager.sendNotification({
        userId: purchase.created_by,
        template: 'private_purchase_delivery_date_requested',
        data: {
          client_name: purchase.client_snapshot?.commercial_name || purchase.client_snapshot?.name || 'Cliente',
          purchase_id: purchaseId
        },
        source: 'private_purchase.delivery_date_requested',
        email: true,
        chat: false
      });
    }

    return { ok: true };
  }

  async submitDeliveryDates(purchaseId, deliveryDates, deliveryNotes, user) {
    return this.setDeliveryDates(purchaseId, deliveryDates, user, deliveryNotes);
  }

  async uploadDeliveryAct(purchaseId, { fileId, actBase64, fileName, mimeType } = {}, user) {
    const isLogisticsRole = this._hasRoleToken(user, 'logistica');

    if (!isLogisticsRole) {
      const error = new Error('Rol no autorizado para subir acta de entrega');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const { rows: existingRows } = await db.query(
      'SELECT delivery_act_document_id, client_snapshot, drive_folder_id FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    if (existingRows[0].delivery_act_document_id) {
      const error = new Error('Acta de entrega ya fue subida anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      error.details = { docType: 'DELIVERY_ACT', existingRef: existingRows[0].delivery_act_document_id };
      throw error;
    }

    let resolvedFileId = fileId;
    if (!resolvedFileId) {
      if (!actBase64 || !fileName) {
        const error = new Error('Archivo de acta requerido');
        error.status = 400;
        throw error;
      }
      const baseFolderId = await this._ensureDriveFolder(purchaseId, existingRows[0].client_snapshot, existingRows[0].drive_folder_id);
      const targetFolder = await ensureFolder('Acta de entrega', baseFolderId);
      const stored = await uploadBase64File(fileName, actBase64, mimeType || 'application/pdf', targetFolder?.id || baseFolderId);
      resolvedFileId = stored.id;
    }

    const { rows } = await db.query(
      `UPDATE private_purchase_requests
         SET delivery_act_document_id = $1,
             updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [resolvedFileId, purchaseId]
    );

    await this.transitionState(
      purchaseId,
      PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED,
      user,
      'Acta de entrega-recepcion generada'
    );

    return rows[0];
  }

  /**
   * FASE 2: Upload signed offer with idempotency check
   */
  async uploadSignedOffer(purchaseId, { fileId, signedOfferBase64, fileName, mimeType } = {}, user) {
    logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][CHECK] Verificando duplicado signed offer para purchase ${purchaseId}`);

    const { rows: existingRows } = await db.query(
      'SELECT offer_signed_document_id, client_snapshot, drive_folder_id FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    if (existingRows[0].offer_signed_document_id) {
      logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][BLOCKED] Signed offer ya existe para purchase ${purchaseId}`);
      const error = new Error('Oferta firmada ya fue subida anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      error.details = { docType: 'SIGNED_OFFER', existingRef: existingRows[0].offer_signed_document_id };
      throw error;
    }

    let resolvedFileId = fileId;
    if (!resolvedFileId) {
      if (!signedOfferBase64 || !fileName) {
        const error = new Error('Archivo de oferta firmada requerido');
        error.status = 400;
        throw error;
      }
      const folderId = await this._ensureDriveFolder(purchaseId, existingRows[0].client_snapshot, existingRows[0].drive_folder_id);
      const stored = await uploadBase64File(fileName, signedOfferBase64, mimeType || 'application/pdf', folderId);
      resolvedFileId = stored.id;
    }

    logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][OK] Signed offer no existe, permitiendo upload para purchase ${purchaseId}`);

    const { rows } = await db.query(
      'UPDATE private_purchase_requests SET offer_signed_document_id = $1, offer_signed_uploaded_at = NOW(), signed_offer_received_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *',
      [resolvedFileId, purchaseId]
    );

    await this.transitionState(purchaseId, PRIVATE_PURCHASE_STATES.OFFER_SIGNED, user, 'Oferta firmada recibida');

    return rows[0];
  }

  /**
   * FASE 2: Upload contract with idempotency check
   */
  async uploadContract(purchaseId, { fileId, contractBase64, fileName, mimeType, decisionReason } = {}, user) {
    logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][CHECK] Verificando duplicado contract para purchase ${purchaseId}`);

    const { rows: existingRows } = await db.query(
      'SELECT contract_document_id, contract_client_signed_document_id, contract_signed_document_id, inspection_request_id, inspection_acta_document_id, inspection_scheduled_date, client_snapshot, drive_folder_id FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const isManagerRole = this._hasAnyRoleToken(user, ['gerencia', 'gerente']);
    const isBackofficeRole = this._hasRoleToken(user, 'backoffice');

    if (!isManagerRole && !isBackofficeRole) {
      const error = new Error('Acceso denegado para subir contrato');
      error.status = 403;
      error.code = 'ROLE_NOT_ALLOWED';
      throw error;
    }

    if (!isManagerRole && !existingRows[0].inspection_request_id) {
      const error = new Error('Debe solicitar inspeccion de ambiente antes de subir el contrato');
      error.status = 409;
      error.code = 'INSPECTION_REQUIRED';
      throw error;
    }

    if (!isManagerRole && !existingRows[0].inspection_scheduled_date) {
      const error = new Error('Debe coordinar la fecha de inspección antes de subir el contrato');
      error.status = 409;
      error.code = 'INSPECTION_COORDINATION_REQUIRED';
      throw error;
    }

    if (!isManagerRole && existingRows[0].contract_document_id) {
      logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][BLOCKED] Contract draft ya existe para purchase ${purchaseId}`);
      const error = new Error('Contrato ya fue subido anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      error.details = { docType: 'CONTRACT_DRAFT', existingRef: existingRows[0].contract_document_id };
      throw error;
    }

    if (isManagerRole && existingRows[0].contract_signed_document_id) {
      logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][BLOCKED] Contract signed ya existe para purchase ${purchaseId}`);
      const error = new Error('Contrato firmado ya fue subido anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      error.details = { docType: 'CONTRACT_SIGNED', existingRef: existingRows[0].contract_signed_document_id };
      throw error;
    }

    if (isManagerRole && !existingRows[0].contract_client_signed_document_id) {
      const error = new Error('Debe subir el contrato firmado por el cliente antes de gerencia');
      error.status = 409;
      error.code = 'CLIENT_SIGNATURE_REQUIRED';
      throw error;
    }

    let resolvedFileId = fileId;
    if (!resolvedFileId) {
      if (!contractBase64 || !fileName) {
        const error = new Error('Archivo de contrato requerido');
        error.status = 400;
        throw error;
      }
      const baseFolderId = await this._ensureDriveFolder(purchaseId, existingRows[0].client_snapshot, existingRows[0].drive_folder_id);
      const subfolderName = isManagerRole ? 'Contrato firmado gerencia' : 'Contrato borrador';
      const targetFolder = await ensureFolder(subfolderName, baseFolderId);
      const stored = await uploadBase64File(fileName, contractBase64, mimeType || 'application/pdf', targetFolder?.id || baseFolderId);
      resolvedFileId = stored.id;
    }

    logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][OK] Contract no existe, permitiendo upload para purchase ${purchaseId}`);

    const updateQuery = isManagerRole
      ? `UPDATE private_purchase_requests
           SET contract_signed_document_id = $1,
               contract_signed_uploaded_at = NOW(),
               manager_contract_decision = 'approved',
               manager_contract_decision_reason = $3,
               manager_contract_decision_at = NOW(),
               manager_contract_decision_by = $4,
               updated_at = NOW()
         WHERE id = $2
         RETURNING *`
      : `UPDATE private_purchase_requests
           SET contract_document_id = $1,
               updated_at = NOW()
         WHERE id = $2
         RETURNING *`;

    const updateParams = isManagerRole
      ? [resolvedFileId, purchaseId, decisionReason || null, user?.id || null]
      : [resolvedFileId, purchaseId];

    const { rows } = await db.query(updateQuery, updateParams);

    const nextState = isManagerRole
      ? PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE
      : PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE;

    await this.transitionState(
      purchaseId,
      nextState,
      user,
      isManagerRole ? 'Contrato firmado por gerencia' : 'Contrato borrador cargado, pendiente firma cliente'
    );

    return rows[0];
  }

  /**
   * FASE 2: Upload client-signed contract
   */
  async uploadClientSignedContract(purchaseId, { fileId, contractBase64, fileName, mimeType } = {}, user) {
    logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][CHECK] Verificando duplicado contrato firmado cliente para purchase ${purchaseId}`);

    const { rows } = await db.query(
      'SELECT status, contract_document_id, contract_client_signed_document_id, client_snapshot, drive_folder_id FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const purchase = rows[0];
    const isManagerRole = this._hasAnyRoleToken(user, ['gerencia', 'gerente']);
    const isBackofficeRole = this._hasRoleToken(user, 'backoffice');
    const isCommercialRole = this._hasAnyRoleToken(user, ['comercial', 'asesor']);

    if (!isCommercialRole || isBackofficeRole || isManagerRole) {
      const error = new Error('Acceso denegado para subir contrato firmado por cliente');
      error.status = 403;
      error.code = 'ROLE_NOT_ALLOWED';
      throw error;
    }

    if (!purchase.contract_document_id) {
      const error = new Error('Debe existir un contrato borrador antes de subir la firma del cliente');
      error.status = 409;
      error.code = 'CONTRACT_DRAFT_REQUIRED';
      throw error;
    }

    if (purchase.status !== PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE) {
      const error = new Error('La solicitud no esta lista para subir la firma del cliente');
      error.status = 409;
      error.code = 'INVALID_STATUS';
      error.details = { status: purchase.status };
      throw error;
    }

    if (purchase.contract_client_signed_document_id) {
      const error = new Error('Contrato firmado por cliente ya fue subido anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      error.details = { docType: 'CONTRACT_CLIENT_SIGNED', existingRef: purchase.contract_client_signed_document_id };
      throw error;
    }

    let resolvedFileId = fileId;
    if (!resolvedFileId) {
      if (!contractBase64 || !fileName) {
        const error = new Error('Archivo de contrato firmado por cliente requerido');
        error.status = 400;
        throw error;
      }
      const baseFolderId = await this._ensureDriveFolder(purchaseId, purchase.client_snapshot, purchase.drive_folder_id);
      const targetFolder = await ensureFolder('Contrato firmado cliente', baseFolderId);
      const stored = await uploadBase64File(fileName, contractBase64, mimeType || 'application/pdf', targetFolder?.id || baseFolderId);
      resolvedFileId = stored.id;
    } else {
      // Si recibimos un ID externo, resolver integridad en segundo plano
      resolveExternalDriveIntegrity(resolvedFileId, drive)
        .catch((err) => logger.warn({ err, fileId: resolvedFileId }, "Error resolviendo integridad externa para contrato privado"));
    }

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
         SET contract_client_signed_document_id = $1,
             contract_client_signed_uploaded_at = NOW(),
             contract_client_signed_by = $3,
             updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [resolvedFileId, purchaseId, user?.id || null]
    );

    await this.transitionState(
      purchaseId,
      PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL,
      user,
      'Contrato firmado por cliente cargado, pendiente aprobacion de gerencia'
    );

    await this.ensureBusinessCaseForComodato(purchaseId, user, updatedRows[0]);

    return updatedRows[0];
  }


  async forwardToAcp(purchaseId, user) {
    logger.debug('[FLOW_PRIVADA][BE][ACP_FORWARD][REQUEST]', {
      requestId: purchaseId,
      userId: user?.id
    });
    const { rows } = await db.query(
      'SELECT forwarded_to_acp_at FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    if (rows[0].forwarded_to_acp_at) {
      const error = new Error('Solicitud ya fue enviada a ACP');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      throw error;
    }

    await db.query(
      'UPDATE private_purchase_requests SET forwarded_to_acp_at = NOW(), updated_at = NOW() WHERE id = $1',
      [purchaseId]
    );

    await this.transitionState(purchaseId, PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED, user, 'Solicitud enviada a ACP');

    const { rows: statusRows } = await db.query(
      'SELECT status FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );
    logger.debug('[FLOW_PRIVADA][BE][ACP_FORWARD][STATUS_CHECK]', {
      requestId: purchaseId,
      status: statusRows[0]?.status
    });

    logger.debug('[FLOW_PRIVADA][BE][ACP_FORWARD][DONE]', {
      requestId: purchaseId
    });
    return { forwarded: true };
  }

  async startAvailabilityRequest(purchaseId, user, providerEmail, notes = '') {
    logger.debug('[FLOW_PRIVADA][BE][ACP][EMAIL][START]', {
      requestId: purchaseId,
      userId: user?.id,
      providerEmail
    });
    if (!providerEmail) {
      const error = new Error('El correo del proveedor es obligatorio');
      error.status = 400;
      throw error;
    }

    const { rows } = await db.query(
      `SELECT id, status, equipment, notes, client_snapshot, drive_folder_id, created_at, availability_email_sent_at
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const purchase = rows[0];
    if (purchase.status !== PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED) {
      const error = new Error('La solicitud no esta en disponibilidad ACP');
      error.status = 409;
      throw error;
    }

    if (purchase.availability_email_sent_at) {
      const error = new Error('El correo de disponibilidad ya fue enviado');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      throw error;
    }

    const equipment = Array.isArray(purchase.equipment) ? purchase.equipment : [];
    if (!equipment.length) {
      const error = new Error('No hay equipos registrados para solicitar disponibilidad');
      error.status = 400;
      throw error;
    }

    const equipmentList = formatEquipmentList(equipment);
    const html = `
      <h2>Solicitud de disponibilidad</h2>
      <p>Equipos requeridos para la solicitud #${purchaseId}:</p>
      <p>${equipmentList}</p>
      ${notes ? `<p>Notas: ${notes}</p>` : purchase.notes ? `<p>Notas: ${purchase.notes}</p>` : ""}
    `;

    const folderId = await this._ensureDriveFolder(purchaseId, purchase.client_snapshot, purchase.drive_folder_id);
    const clientName =
      purchase.client_snapshot?.commercial_name ||
      purchase.client_snapshot?.name ||
      'Cliente';

    const emailFileId = await sendAndArchive({
      user,
      to: providerEmail,
      subject: `Disponibilidad de equipos - Solicitud #${purchaseId}`,
      html,
      folderId,
      prefix: 'disponibilidad',
      request: {
        id: purchaseId,
        client_name: clientName,
        provider_email: providerEmail,
        equipment,
        created_at: purchase.created_at,
        notes: notes || purchase.notes
      },
      actionLabel: 'Informe de disponibilidad de equipos'
    });

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
          SET provider_email = $1,
              availability_request_notes = $2,
              availability_email_sent_at = NOW(),
              availability_email_file_id = $3,
              updated_at = NOW()
        WHERE id = $4
        RETURNING *`,
      [providerEmail, notes || null, emailFileId, purchaseId]
    );

    logger.debug('[FLOW_PRIVADA][BE][ACP][EMAIL][SUCCESS]', {
      requestId: purchaseId,
      providerEmail
    });
    return updatedRows[0];
  }

  async saveProviderResponse({ id, user, outcome, items, notes }) {
    logger.debug('[FLOW_PRIVADA][BE][ACP][RESPONSE][START]', {
      requestId: id,
      userId: user?.id,
      outcome,
      itemsCount: items?.length || 0
    });

    const { rows } = await db.query(
      `SELECT id, status, provider_response_at, equipment, provider_email, reservation_email_sent_at,
              availability_email_sent_at, client_snapshot, drive_folder_id
         FROM private_purchase_requests
        WHERE id = $1`,
      [id]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const purchase = rows[0];
    if (purchase.status !== PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED) {
      const error = new Error('La solicitud no está en disponibilidad ACP');
      error.status = 409;
      throw error;
    }

    if (purchase.provider_response_at) {
      const error = new Error('La respuesta del proveedor ya fue registrada');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      throw error;
    }

    if (!purchase.availability_email_sent_at) {
      const error = new Error('Debe enviar el correo de disponibilidad antes de registrar respuesta');
      error.status = 409;
      error.code = 'AVAILABILITY_EMAIL_NOT_SENT';
      throw error;
    }

    // Normalizar items de respuesta (id/equipment_id/inventory_id) y resolver nombre de equipo
    const requestedEquipment = Array.isArray(purchase.equipment) ? purchase.equipment : [];
    const requestedMap = new Map();
    requestedEquipment.forEach((item) => {
      const keys = [item?.id, item?.equipment_id, item?.inventory_id]
        .map((value) => (value === undefined || value === null ? "" : String(value).trim()))
        .filter(Boolean);
      keys.forEach((key) => requestedMap.set(key, item));
    });

    const resolveRequestedItem = (responseItem) => {
      const keys = [responseItem?.id, responseItem?.equipment_id, responseItem?.inventory_id]
        .map((value) => (value === undefined || value === null ? "" : String(value).trim()))
        .filter(Boolean);
      for (const key of keys) {
        if (requestedMap.has(key)) {
          return { key, item: requestedMap.get(key) };
        }
      }
      return { key: keys[0] || null, item: {} };
    };

    const normalizedItems = Array.isArray(items)
      ? items.map((item, index) => {
        const { key, item: requestedItem } = resolveRequestedItem(item);
        const availableType = item.available_type || "none";
        const decision = availableType === "none" ? "reject" : item.decision || "reject";
        const fallbackName = requestedItem.name || requestedItem.label || requestedItem.sku || null;
        const resolvedId = key || `item_${index + 1}`;
        const resolvedName =
          item.name ||
          item.equipment_name ||
          fallbackName ||
          `Equipo ${index + 1}`;

        return {
          id: resolvedId,
          name: resolvedName,
          requested_type: item.requested_type || requestedItem.type,
          available_type: availableType,
          decision: decision,
          sku: item.sku || requestedItem.sku || null
        };
      })
      : [];

    // Calcular outcome basado en items aceptados
    const acceptedItems = normalizedItems.filter(
      (item) => item.available_type !== "none" && item.decision !== "reject"
    );
    const normalizedOutcome = acceptedItems.length > 0 ? "new" : "none";

    logger.debug('[FLOW_PRIVADA][BE][ACP][RESPONSE][NORMALIZED]', {
      requestId: id,
      originalOutcome: outcome,
      normalizedOutcome,
      acceptedItems: acceptedItems.length,
      totalItems: normalizedItems.length
    });

    const actor = {
      id: user?.id || null,
      name: user?.fullname || user?.name || user?.email || 'Usuario',
      role: user?.role || null
    };

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
          SET provider_response = $1,
              provider_response_at = NOW(),
              updated_at = NOW()
        WHERE id = $2
        RETURNING *`,
      [{ outcome: normalizedOutcome, items: normalizedItems, notes, actor }, id]
    );

    logger.debug('[FLOW_PRIVADA][BE][ACP][RESPONSE][SUCCESS]', {
      requestId: id,
      finalOutcome: normalizedOutcome
    });

    // La respuesta queda registrada y se mantiene en disponibilidad ACP
    // para que backoffice apruebe o rechace.
    logger.debug('[FLOW_PRIVADA][BE][ACP][RESPONSE][PENDING_BACKOFFICE_DECISION]', {
      requestId: id,
      state: purchase.status,
      outcome: normalizedOutcome
    });

    // Solicitar reserva al proveedor cuando hay equipos aceptados
    const hasReservation = Boolean(purchase.reservation_email_sent_at);
    const hasProviderEmail = Boolean(purchase.provider_email);
    const acceptedForReservation = acceptedItems || [];
    if (!hasReservation && hasProviderEmail && acceptedForReservation.length > 0) {
      logger.debug('[FLOW_PRIVADA][BE][ACP][RESERVATION][START]', {
        requestId: id,
        providerEmail: purchase.provider_email,
        itemsCount: acceptedForReservation.length
      });
      try {
        const folderId = await this._ensureDriveFolder(id, purchase.client_snapshot, purchase.drive_folder_id);
        const reservationHtml = `
          <p>Solicitamos reservar los equipos cotizados para la solicitud #${id}.</p>
          <p>Confirmamos reserva para:</p>
          ${formatEquipmentList(acceptedForReservation)}
        `;
        const reservationFileId = await sendAndArchive({
          user,
          to: purchase.provider_email,
          subject: `Reserva de equipos - Solicitud #${id}`,
          html: reservationHtml,
          folderId,
          prefix: 'reserva',
          request: {
            id,
            client_name: purchase.client_snapshot?.commercial_name || purchase.client_snapshot?.name || 'Cliente',
            provider_email: purchase.provider_email,
            equipment: acceptedForReservation
          },
          actionLabel: 'Confirmacion de reserva'
        });

        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + RESERVATION_REMINDER_OFFSET_DAYS);
        let calendarEvent = {};
        try {
          calendarEvent = await createAllDayEvent({
            summary: `Recordatorio de reserva - ${purchase.client_snapshot?.commercial_name || purchase.client_snapshot?.name || 'Cliente'}`,
            description: 'La reserva caduca en 60 dias. Confirma cierre o renovacion.',
            date: reminderDate,
            attendees: [user?.email].filter(Boolean)
          });
        } catch (calendarError) {
          logger.warn('[FLOW_PRIVADA][BE][ACP][RESERVATION][CALENDAR_WARN]', calendarError.message);
        }

        await db.query(
          `UPDATE private_purchase_requests
              SET reservation_email_sent_at = NOW(),
                  reservation_email_file_id = $2,
                  reservation_calendar_event_id = $3,
                  reservation_calendar_event_link = $4,
                  updated_at = NOW()
            WHERE id = $1`,
          [
            id,
            reservationFileId,
            calendarEvent?.id || null,
            calendarEvent?.htmlLink || null
          ]
        );

        logger.debug('[FLOW_PRIVADA][BE][ACP][RESERVATION][SUCCESS]', {
          requestId: id,
          reservationFileId,
          calendarEventId: calendarEvent?.id || null
        });
      } catch (reservationError) {
        logger.warn('[FLOW_PRIVADA][BE][ACP][RESERVATION][ERROR]', {
          requestId: id,
          error: reservationError.message
        });
      }
    }

    return updatedRows[0];
  }


  /**
   * Solicitar registro de cliente
   * Cambia el estado a CLIENT_REGISTRATION_REQUESTED para indicar que se está esperando aprobación
   */
  async requestClientRegistration(purchaseId, user) {
    logger.debug(`[FLOW_PRIVADA][CLIENT_REGISTRATION][REQUEST] Solicitando registro de cliente para purchase ${purchaseId}`);

    const purchaseQuery = `SELECT status, client_snapshot FROM private_purchase_requests WHERE id = $1`;
    const { rows: purchaseRows } = await db.query(purchaseQuery, [purchaseId]);

    if (!purchaseRows.length) {
      throw new Error('Solicitud de compra privada no encontrada');
    }

    const purchase = purchaseRows[0];

    const allowedStates = new Set([
      PRIVATE_PURCHASE_STATES.OFFER_SIGNED,
      PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED
    ]);

    if (!allowedStates.has(purchase.status)) {
      const error = new Error('La solicitud debe estar en estado "Oferta firmada" o "Registro solicitado" para enviar o actualizar la solicitud de registro de cliente');
      error.status = 409;
      error.code = 'INVALID_STATE';
      throw error;
    }

    const clientName = purchase.client_snapshot?.commercial_name || purchase.client_snapshot?.name || 'Cliente';

    const approval = await this.checkClientApprovalStatus(purchase.client_snapshot, { id: purchaseId });
    if (approval?.isApproved) {
      await this.updateClientRegistration(purchaseId, approval.clientId, user);
      return {
        registered: true,
        autoRegistered: true,
        clientId: approval.clientId,
      };
    }

    const alreadyRequested = purchase.status === PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED;

    if (!alreadyRequested) {
      await this.transitionState(
        purchaseId,
        PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED,
        user,
        'Solicitud de registro de cliente enviada'
      );

      try {
        const backofficeUsers = await this._getUsersByRole('backoffice_comercial');
        for (const recipient of backofficeUsers) {
          await notificationManager.sendNotification({
            userId: recipient.id,
            template: 'private_purchase_client_registration_requested',
            data: {
              client_name: clientName,
              purchase_id: purchaseId,
              requester_name: user.fullname || user.name || 'Usuario'
            },
            source: 'private_purchase.client_registration_requested',
            email: true,
            chat: true
          });
        }
      } catch (error) {
        logger.warn('Error notificando solicitud de registro cliente:', error);
      }
    }

    return {
      requested: true,
      alreadyRequested,
      clientName
    };
  }

  /**
   * Actualizar datos de cliente registrado
   * Valida que el cliente esté aprobado antes de permitir el registro
   */
  async updateClientRegistration(purchaseId, clientId, user) {
    logger.debug(`[FLOW_PRIVADA][CLIENT_REGISTRATION][VALIDATION] Iniciando validación para purchase ${purchaseId}`);

    // Obtener datos de la compra privada
    const purchaseQuery = `
      SELECT client_snapshot, status
      FROM private_purchase_requests
      WHERE id = $1
    `;
    const { rows: purchaseRows } = await db.query(purchaseQuery, [purchaseId]);

    if (!purchaseRows.length) {
      throw new Error('Solicitud de compra privada no encontrada');
    }

    const purchase = purchaseRows[0];
    const clientData = purchase.client_snapshot || {};

    logger.debug(`[FLOW_PRIVADA][CLIENT_REGISTRATION][VALIDATION] Cliente en compra: ${clientData.commercial_name || clientData.name}`);

    // Validar que el cliente esté aprobado en el sistema de solicitudes de clientes
    const clientValidationQuery = `
      SELECT id, status, commercial_name, ruc_cedula
      FROM client_requests
      WHERE status = 'approved'
      AND (
        commercial_name = $1
        OR (ruc_cedula = $2 AND ruc_cedula IS NOT NULL)
      )
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const { rows: approvedClients } = await db.query(clientValidationQuery, [
      clientData.commercial_name || clientData.name,
      clientData.ruc_cedula
    ]);

    const approvedClient = approvedClients[0] || null;

    if (approvedClient) {
      logger.debug(`[FLOW_PRIVADA][CLIENT_REGISTRATION][VALIDATION] Cliente aprobado encontrado: ${approvedClient.commercial_name} (ID: ${approvedClient.id})`);
    } else {
      logger.debug(`[FLOW_PRIVADA][CLIENT_REGISTRATION][VALIDATION] Cliente no encontrado en sistema, procede como posible cliente: ${clientData.commercial_name || clientData.name}`);
    }

    // Si está registrado usa su ID; si no, procede sin registered_client_id (posible cliente)
    const finalClientId = clientId || approvedClient?.id || null;

    const hasClientId = finalClientId !== undefined && finalClientId !== null && String(finalClientId).trim().length > 0;
    const query = hasClientId
      ? `UPDATE private_purchase_requests
          SET
            client_snapshot = jsonb_set(client_snapshot, '{registered_client_id}', $2::text::jsonb),
            client_registered_at = NOW(),
            client_approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *`
      : `UPDATE private_purchase_requests
          SET
            client_registered_at = NOW(),
            client_approved_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *`;

    const params = hasClientId ? [purchaseId, finalClientId] : [purchaseId];
    const { rows } = await db.query(query, params);

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const clientLabel = approvedClient?.commercial_name || clientData.commercial_name || clientData.name || 'Posible cliente';
    logger.debug(`[FLOW_PRIVADA][CLIENT_REGISTRATION][SUCCESS] Cliente registrado: ${clientLabel}`);

    // Transicion automatica a CLIENT_REGISTERED (esperando contrato)
    await this.transitionState(
      purchaseId,
      PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED,
      user,
      `Cliente registrado: ${clientLabel}`
    );

    // Notificar a backoffice que puede continuar flujo documental
    try {
      const backofficeUsers = await this._getUsersByRole('backoffice_comercial');

      for (const recipient of backofficeUsers) {
        await notificationManager.sendNotification({
          userId: recipient.id,
          template: 'private_purchase_client_approved_contract_pending',
          data: {
            client_name: clientLabel,
            purchase_id: purchaseId
          },
          source: 'private_purchase.client_registration',
          email: true,
          chat: true
        });
      }
    } catch (error) {
      logger.warn('Error enviando notificacion de cliente aprobado:', error);
    }
    let result = rows[0];
    try {
      // Producción madura: generar inspección automáticamente al aprobar registro del cliente.
      result = await this.saveInspectionRequest(
        purchaseId,
        {
          inspection_min_date: addDaysIso(1),
          inspection_max_date: addDaysIso(7),
        },
        user
      );
    } catch (inspectionError) {
      logger.error(
        { inspectionError, purchaseId },
        'No se pudo generar automáticamente la inspección de ambiente',
      );
      throw inspectionError;
    }

    return result;
  }

  /**
   * FASE 2: Establecer fechas de entrega con idempotencia
   */
  async setDeliveryDates(purchaseId, deliveryDates, user, deliveryNotes = '') {
    await ensurePrivateSiteInspectionColumns();
    logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][CHECK] Verificando duplicado delivery dates para purchase ${purchaseId}`);

    const { rows: existingRows } = await db.query(
      `SELECT delivery_dates_json,
              inspection_request_id,
              inspection_scheduled_date,
              site_inspection,
              site_inspection_status,
              site_inspection_result,
              site_inspection_follow_up_date,
              site_inspection_ready_for_installation
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const existingDates = existingRows[0].delivery_dates_json;
    const hasExistingDates = Array.isArray(existingDates)
      ? existingDates.length > 0
      : existingDates && typeof existingDates === 'object'
        ? Object.keys(existingDates).length > 0
        : Boolean(existingDates);

    if (hasExistingDates) {
      logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][BLOCKED] Delivery dates ya existen para purchase ${purchaseId}`);
      const error = new Error('Fechas de entrega ya fueron establecidas anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      error.details = { docType: 'DELIVERY_DATES', existingRef: existingDates };
      throw error;
    }

    if (existingRows[0]?.inspection_request_id || existingRows[0]?.inspection_scheduled_date) {
      this._assertSiteReadyForInstallation(existingRows[0]);
    }

    logger.debug(`[FLOW_PRIVADA][BE][FASE2][IDEMPOTENCY][OK] Delivery dates no existen, permitiendo set para purchase ${purchaseId}`);

    const query = `
      UPDATE private_purchase_requests
      SET
        delivery_dates_json = $2,
        delivery_start_at = $3,
        delivery_end_at = $4,
        delivery_notes = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const startDate = deliveryDates?.start ? new Date(deliveryDates.start) : null;
    const endDate = deliveryDates?.end ? new Date(deliveryDates.end) : null;

    const { rows } = await db.query(query, [
      purchaseId,
      JSON.stringify(deliveryDates),
      startDate,
      endDate,
      deliveryNotes || null
    ]);

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    // Transicion a fechas establecidas
    await this.transitionState(purchaseId, PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED, user, 'Fechas de entrega establecidas');

    // Crear evento en calendario
    const purchase = rows[0];
    const clientData = purchase.client_snapshot || {};
    let calendarStatus = { status: 'pending' };

    try {
      logger.debug(`[FLOW_PRIVADA][BE][FASE4][CALENDAR][CREATE][START] Creando evento calendar para purchase ${purchaseId}`);

      const calendarResult = await createDeliveryEvents({
        purchaseId,
        clientName: clientData.name || 'Cliente sin nombre',
        deliveryStartAt: startDate,
        deliveryEndAt: endDate
      });

      if (calendarResult.success) {
        logger.debug(`[FLOW_PRIVADA][BE][FASE4][CALENDAR][CREATE][OK] Evento creado exitosamente: ${calendarResult.eventId}`);
        calendarStatus = {
          status: 'created',
          eventId: calendarResult.eventId,
          attendeesCount: calendarResult.attendees?.length || 0
        };
      } else {
        logger.debug(`[FLOW_PRIVADA][BE][FASE4][CALENDAR][CREATE][FALLBACK] Evento fallo: ${calendarResult.error}`);
        calendarStatus = {
          status: 'warning',
          code: 'CALENDAR_CREATE_FAILED',
          message: calendarResult.error
        };
      }
    } catch (calendarError) {
      logger.debug(`[FLOW_PRIVADA][BE][FASE4][CALENDAR][CREATE][ERR] Error creando evento: ${calendarError.message}`);
      calendarStatus = {
        status: 'warning',
        code: 'CALENDAR_CONFIG_MISSING',
        message: calendarError.message
      };
    }

    const result = rows[0];
    result.calendar = calendarStatus;

    // Notificacion de fechas establecidas (síncrona para Cloud Run)
    try {
      const logisticsUsers = await this._getUsersByRole('jefe_logistica');
      const deliveryLabel = `${startDate?.toLocaleDateString('es-ES')} - ${endDate?.toLocaleDateString('es-ES')}`;

      for (const recipient of logisticsUsers) {
        await notificationManager.sendNotification({
          userId: recipient.id,
          template: 'private_purchase_delivery_date_set',
          data: {
            client_name: clientData.name || 'Cliente',
            delivery_dates: deliveryLabel,
            purchase_id: purchaseId
          },
          source: 'private_purchase.delivery_dates',
          email: true,
          chat: true
        });
      }
    } catch (error) {
      logger.warn('Error enviando notificacion de fechas entrega:', error);
    }

    return result;
  }

  /**
   * Marcar como listo para entrega
   */
  async markReadyForDelivery(purchaseId, user) {
    await ensurePrivateSiteInspectionColumns();
    const { rows: inspectionRows } = await db.query(
      `SELECT id,
              inspection_request_id,
              inspection_scheduled_date,
              site_inspection,
              site_inspection_status,
              site_inspection_result,
              site_inspection_follow_up_date,
              site_inspection_ready_for_installation
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId],
    );
    if (!inspectionRows.length) {
      throw new Error('Solicitud no encontrada');
    }
    if (inspectionRows[0]?.inspection_request_id || inspectionRows[0]?.inspection_scheduled_date) {
      this._assertSiteReadyForInstallation(inspectionRows[0]);
    }

    const query = `
      UPDATE private_purchase_requests
      SET updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const { rows } = await db.query(query, [purchaseId]);

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    // Transiciรณn a listo para entrega
    await this.transitionState(purchaseId, PRIVATE_PURCHASE_STATES.DISPATCH_READY, user, 'Listo para entrega final');

    // Notificaciรณn
    const purchase = rows[0];
    const clientData = purchase.client_snapshot || {};

    setImmediate(async () => {
      try {
        await notificationManager.sendNotification({
          userId: user.id,
          template: 'private_purchase_ready_for_delivery',
          data: {
            client_name: clientData.name || 'Cliente',
            purchase_id: purchaseId
          },
          source: 'private_purchase.ready_for_delivery',
          email: true,
          chat: true
        });
      } catch (error) {
        logger.warn('Error enviando notificaciรณn listo para entrega:', error);
      }
    });

    return rows[0];
  }

  /**
   * Finalizar entrega
   */
  async completeDelivery(purchaseId, user, deliveryNotes = '') {
    await ensurePrivateSiteInspectionColumns();
    const { rows: inspectionRows } = await db.query(
      `SELECT id,
              inspection_request_id,
              inspection_scheduled_date,
              site_inspection,
              site_inspection_status,
              site_inspection_result,
              site_inspection_follow_up_date,
              site_inspection_ready_for_installation
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId],
    );
    if (!inspectionRows.length) {
      throw new Error('Solicitud no encontrada');
    }
    if (inspectionRows[0]?.inspection_request_id || inspectionRows[0]?.inspection_scheduled_date) {
      this._assertSiteReadyForInstallation(inspectionRows[0]);
    }

    const query = `
      UPDATE private_purchase_requests
      SET
        delivery_notes = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const { rows } = await db.query(query, [purchaseId, deliveryNotes]);

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    // Transiciรณn final
    await this.transitionState(purchaseId, PRIVATE_PURCHASE_STATES.DELIVERED, user, 'Entrega completada exitosamente');

    return rows[0];
  }

  /**
   * Cancelar solicitud
   */
  async cancelPurchase(purchaseId, user, reason = '') {
    await this.transitionState(purchaseId, PRIVATE_PURCHASE_STATES.REJECTED, user, reason);
    return { cancelled: true };
  }

  async updateOperationsDetails(purchaseId, { includesStarterKit, operationsNotes, estimatedArrivalAt } = {}, user) {
    const isOperationsRole = this._hasRoleToken(user, 'jefe_operaciones');

    if (!isOperationsRole) {
      const error = new Error('Rol no autorizado para actualizar detalles de operaciones');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const { rows: currentRows } = await db.query(
      'SELECT equipment_arrived_at, estimated_arrival_at FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!currentRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const currentArrival = currentRows[0]?.equipment_arrived_at;
    const currentEstimated = currentRows[0]?.estimated_arrival_at;
    if (currentArrival && estimatedArrivalAt !== undefined) {
      const normalizedIncoming = estimatedArrivalAt ? new Date(estimatedArrivalAt).toISOString() : null;
      const normalizedCurrent = currentEstimated ? new Date(currentEstimated).toISOString() : null;
      if (normalizedIncoming !== normalizedCurrent) {
        const error = new Error('La fecha tentativa no se puede editar luego de la llegada del equipo');
        error.status = 409;
        error.code = 'ARRIVAL_LOCKED';
        throw error;
      }
    }

    const shouldUpdateArrival = estimatedArrivalAt !== undefined;
    logger.debug('[FLOW_PRIVADA][BE][OPS_DETAILS][INPUT]', {
      purchaseId,
      includesStarterKit,
      hasNotes: Boolean(operationsNotes),
      estimatedArrivalAt,
      shouldUpdateArrival,
      equipment_arrived_at: currentArrival,
      estimated_arrival_at: currentEstimated
    });
    const query = `
      UPDATE private_purchase_requests
      SET
        includes_starter_kit = $2,
        operations_notes = $3,
        estimated_arrival_at = $4,
        estimated_arrival_updated_at = CASE WHEN $5 THEN NOW() ELSE estimated_arrival_updated_at END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const { rows } = await db.query(query, [
      purchaseId,
      includesStarterKit === undefined ? null : includesStarterKit,
      operationsNotes || null,
      shouldUpdateArrival ? estimatedArrivalAt : currentEstimated,
      shouldUpdateArrival
    ]);

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }
    logger.debug('[FLOW_PRIVADA][BE][OPS_DETAILS][UPDATED]', {
      purchaseId,
      includes_starter_kit: rows[0].includes_starter_kit,
      estimated_arrival_at: rows[0].estimated_arrival_at,
      updated_at: rows[0].updated_at
    });

    return rows[0];
  }

  async markEquipmentArrived(purchaseId, user) {
    const isOperationsRole = this._hasRoleToken(user, 'jefe_operaciones');

    if (!isOperationsRole) {
      const error = new Error('Rol no autorizado para marcar llegada de equipo');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    logger.debug('[FLOW_PRIVADA][BE][OPS_ARRIVAL][INPUT]', {
      purchaseId,
      userId: user?.id,
      userRole: user?.role
    });
    const { rows } = await db.query(
      `UPDATE private_purchase_requests
         SET equipment_arrived_at = NOW(),
             equipment_arrived_by = $2,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [purchaseId, user?.id || null]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const updated = rows[0];
    logger.debug('[FLOW_PRIVADA][BE][OPS_ARRIVAL][UPDATED]', {
      purchaseId,
      status: updated?.status,
      equipment_arrived_at: updated?.equipment_arrived_at
    });
    if (updated && updated.status !== PRIVATE_PURCHASE_STATES.WAITING_DISPATCH) {
      try {
        await this.transitionState(
          purchaseId,
          PRIVATE_PURCHASE_STATES.WAITING_DISPATCH,
          user,
          'Equipo recibido, iniciar despacho'
        );
        const { rows: refreshed } = await db.query(
          'SELECT * FROM private_purchase_requests WHERE id = $1',
          [purchaseId]
        );
        return refreshed[0] || updated;
      } catch (error) {
        logger.warn({ error, purchaseId }, 'No se pudo transicionar a waiting_dispatch');
      }
    }
    return updated;
  }

  async updateDispatchDetails(purchaseId, { items = [], notes = '', dispatchedAt, observations } = {}, user) {
    await ensurePrivateInstallationWorkflowColumns();
    const isLogisticsRole = this._hasAnyRoleToken(user, ['jefe_logistica', 'logistica']);

    if (!isLogisticsRole) {
      const error = new Error('Rol no autorizado para registrar despacho');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const normalizedItems = Array.isArray(items) ? items : [];

    const { rows: existingRows } = await db.query(
      `SELECT id,
              status,
              client_snapshot,
              drive_folder_id,
              delivery_start_at,
              delivery_end_at,
              delivery_act_number,
              delivery_act_dispatched_by,
              delivery_act_dispatched_at,
              delivery_act_observations_json,
              delivery_act_draft_document_id,
              dispatch_items_json,
              dispatch_notes,
              equipment,
              installation_workflow
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const existing = existingRows[0];
    if (existing.delivery_act_draft_document_id) {
      const error = new Error('El borrador del acta ya fue generado');
      error.status = 409;
      error.code = 'DELIVERY_ACT_DRAFT_EXISTS';
      throw error;
    }
    if (![PRIVATE_PURCHASE_STATES.WAITING_DISPATCH, PRIVATE_PURCHASE_STATES.DISPATCH_READY].includes(existing.status)) {
      const error = new Error('Estado invalido para generar borrador de acta');
      error.status = 409;
      error.code = 'INVALID_STATUS';
      error.details = { status: existing.status };
      throw error;
    }
    const actaNumber = existing.delivery_act_number || await this._generateDeliveryActNumber();
    const dispatchedBy = existing.delivery_act_dispatched_by || this._formatUserName(user);
    const dispatchedAtValue = dispatchedAt ? new Date(dispatchedAt) : existing.delivery_act_dispatched_at || new Date();
    const observationsArray = observations
      ? this._normalizeObservations(observations)
      : Array.isArray(existing.delivery_act_observations_json)
      ? existing.delivery_act_observations_json
      : this._normalizeObservations(notes);

    const { rows } = await db.query(
      `UPDATE private_purchase_requests
         SET dispatch_items_json = $2,
             dispatch_notes = $3,
             delivery_act_number = $4,
             delivery_act_dispatched_by = $5,
             delivery_act_dispatched_at = $6,
             delivery_act_observations_json = $7,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        purchaseId,
        JSON.stringify(normalizedItems),
        notes || null,
        actaNumber,
        dispatchedBy,
        dispatchedAtValue,
        JSON.stringify(observationsArray)
      ]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const updated = rows[0];
    try {
      const currentInstallationWorkflow = normalizeInstallationWorkflowState(
        existing.installation_workflow || {},
        { equipment: existing.equipment || [] },
      );
      const snapshot = existing?.client_snapshot || {};
      const dispatchWorkflow = buildDispatchRequestPatch({
        workflow: currentInstallationWorkflow,
        payload: {
          required_date: existing.delivery_start_at || existing.delivery_end_at || addDaysIso(15),
          requires_notice: Boolean(existing.delivery_start_at || existing.delivery_end_at),
          client_name: snapshot.commercial_name || snapshot.client_name || snapshot.name || "Cliente",
          client_address: snapshot.shipping_address || snapshot.address || "Pendiente",
          contact_name: snapshot.shipping_contact_name || snapshot.contact_name || "",
          contact_phone: snapshot.shipping_phone || snapshot.shipping_cellphone || snapshot.phone || "",
          items: normalizedItems,
          notes,
        },
        user,
      });
      const logisticsWorkflow = buildLogisticsValidationPatch({
        workflow: dispatchWorkflow,
        payload: {
          status: "validated",
          guide_reference: notes || "Guía validada en despacho",
          proforma_reference: existing?.delivery_act_number || null,
          notes,
        },
        user,
      });
      const mergedInstallationWorkflow = enrichInstallationWorkflowWithGate({
        workflow: logisticsWorkflow,
        siteReady: Boolean(this._parseSiteInspectionState(existing).ready_for_installation),
        requiresSiteInspection: Boolean(existing?.inspection_request_id || existing?.inspection_scheduled_date),
      });
      await db.query(
        `UPDATE private_purchase_requests
            SET installation_workflow = $2::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [purchaseId, JSON.stringify(mergedInstallationWorkflow)],
      );
    } catch (workflowSyncError) {
      logger.warn({ workflowSyncError, purchaseId }, "No se pudo sincronizar workflow de instalacion en despacho");
    }

    const draftDoc = await this._generateDeliveryActDocument({
      purchaseId,
      purchase: {
        ...existing,
        ...updated
      },
      actaNumber,
      observations: observationsArray,
      dispatchItems: normalizedItems,
      dispatchedBy,
      dispatchedAt: dispatchedAtValue,
      deliveredBy: null,
      deliveredAt: null,
      isDraft: true
    });

    if (draftDoc?.fileId) {
      const { rows: draftRows } = await db.query(
        `UPDATE private_purchase_requests
           SET delivery_act_draft_document_id = $2,
               delivery_act_draft_generated_at = NOW(),
               updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [purchaseId, draftDoc.fileId]
      );
      const updatedRow = draftRows[0] || updated;
      if (updatedRow.status !== PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY) {
        await this.transitionState(
          purchaseId,
          PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY,
          user,
          'Borrador de acta generado'
        );
      }
      return updatedRow;
    }

    return updated;
  }

  async assignDeliveryActTechnician(purchaseId, { assigned_to_email, assigned_to_name } = {}, user) {
    const isLeadRole = this._hasAnyRoleToken(user, ['jefe_tecnico', 'jefe_servicio_tecnico']);

    if (!isLeadRole) {
      const error = new Error('Rol no autorizado para asignar tecnico');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    if (!assigned_to_email && !assigned_to_name) {
      const error = new Error('Debe indicar el tecnico asignado');
      error.status = 400;
      error.code = 'MISSING_TECHNICIAN';
      throw error;
    }

    const { rows: existingRows } = await db.query(
      `SELECT id, status, delivery_act_draft_document_id
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const existing = existingRows[0];
    if (existing.status !== PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY) {
      const error = new Error('Estado invalido para asignar tecnico');
      error.status = 409;
      error.code = 'INVALID_STATUS';
      error.details = { status: existing.status };
      throw error;
    }

    if (!existing.delivery_act_draft_document_id) {
      const error = new Error('Borrador de acta pendiente');
      error.status = 409;
      error.code = 'DELIVERY_ACT_DRAFT_MISSING';
      throw error;
    }

    let technicianUserId = null;
    let technicianName = assigned_to_name || null;
    let technicianEmail = assigned_to_email || null;

    if (assigned_to_email) {
      const { rows: userRows } = await db.query(
        'SELECT id, fullname, email FROM users WHERE email = $1 AND active = true',
        [assigned_to_email]
      );
      if (userRows.length) {
        technicianUserId = userRows[0].id;
        technicianName = technicianName || userRows[0].fullname || null;
        technicianEmail = userRows[0].email;
      }
    }

    if (!technicianName && technicianEmail) {
      technicianName = technicianEmail;
    }

    const { rows } = await db.query(
      `UPDATE private_purchase_requests
         SET delivery_act_assigned_to_user_id = $2,
             delivery_act_assigned_to_email = $3,
             delivery_act_assigned_to_name = $4,
             delivery_act_assigned_at = NOW(),
             delivery_act_assigned_by = $5,
             delivery_act_delivered_by = $4,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        purchaseId,
        technicianUserId,
        technicianEmail,
        technicianName,
        user?.id || null
      ]
    );

    await this.transitionState(
      purchaseId,
      PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED,
      user,
      'Tecnico asignado para entrega'
    );

    return rows[0];
  }

  async uploadDeliveryActLogisticsSigned(purchaseId, { fileId, actBase64, fileName, mimeType } = {}, user) {
    const isLogisticsRole = this._hasRoleToken(user, 'logistica');

    if (!isLogisticsRole) {
      const error = new Error('Rol no autorizado para firmar acta');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const { rows: existingRows } = await db.query(
      `SELECT status,
              delivery_act_logistics_signed_document_id,
              client_snapshot,
              drive_folder_id
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const existing = existingRows[0];
    if (existing.status !== PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED) {
      const error = new Error('Estado invalido para firmar acta por logistica');
      error.status = 409;
      error.code = 'INVALID_STATUS';
      error.details = { status: existing.status };
      throw error;
    }

    if (existing.delivery_act_logistics_signed_document_id) {
      const error = new Error('Acta firmada por logistica ya fue subida');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      throw error;
    }

    let resolvedFileId = fileId;
    if (!resolvedFileId) {
      if (!actBase64 || !fileName) {
        const error = new Error('Archivo de acta firmado requerido');
        error.status = 400;
        throw error;
      }
      const baseFolderId = await this._ensureDriveFolder(purchaseId, existing.client_snapshot, existing.drive_folder_id);
      const targetFolder = await ensureFolder('Acta de entrega', baseFolderId);
      const stored = await uploadBase64File(fileName, actBase64, mimeType || 'application/pdf', targetFolder?.id || baseFolderId);
      resolvedFileId = stored.id;
    }

    const { rows } = await db.query(
      `UPDATE private_purchase_requests
         SET delivery_act_logistics_signed_document_id = $2,
             delivery_act_logistics_signed_at = NOW(),
             delivery_act_logistics_signed_by = $3,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [purchaseId, resolvedFileId, this._formatUserName(user)]
    );

    await this.transitionState(
      purchaseId,
      PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED,
      user,
      'Acta firmada por logistica'
    );

    return rows[0];
  }

  async uploadDeliveryActFinalSigned(purchaseId, { fileId, actBase64, fileName, mimeType } = {}, user) {
    await ensurePrivateInstallationWorkflowColumns();
    const isTechnicalRole = this._hasRoleToken(user, 'tecnico');

    if (!isTechnicalRole) {
      const error = new Error('Rol no autorizado para subir acta final');
      error.status = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const { rows: existingRows } = await db.query(
      `SELECT id,
              status,
              delivery_act_number,
              delivery_act_document_id,
              delivery_act_logistics_signed_document_id,
              delivery_act_assigned_to_user_id,
              delivery_act_assigned_to_email,
              client_snapshot,
              drive_folder_id,
              delivery_start_at,
              delivery_end_at,
              equipment,
              inspection_request_id,
              inspection_scheduled_date,
              site_inspection,
              site_inspection_ready_for_installation,
              installation_workflow
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!existingRows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const existing = existingRows[0];
    if (existing.status !== PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED) {
      const error = new Error('Estado invalido para subir acta final');
      error.status = 409;
      error.code = 'INVALID_STATUS';
      error.details = { status: existing.status };
      throw error;
    }

    if (existing.delivery_act_document_id) {
      const error = new Error('Acta final ya fue subida anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      throw error;
    }

    if (!existing.delivery_act_logistics_signed_document_id) {
      const error = new Error('Acta firmada por logistica pendiente');
      error.status = 409;
      error.code = 'LOGISTICS_SIGNATURE_REQUIRED';
      throw error;
    }

    if (existing.delivery_act_assigned_to_user_id && existing.delivery_act_assigned_to_user_id !== user?.id) {
      const error = new Error('Solo el tecnico asignado puede subir el acta final');
      error.status = 403;
      error.code = 'TECH_ASSIGNED_ONLY';
      throw error;
    }
    if (existing.delivery_act_assigned_to_email && existing.delivery_act_assigned_to_email !== user?.email) {
      const error = new Error('Solo el tecnico asignado puede subir el acta final');
      error.status = 403;
      error.code = 'TECH_ASSIGNED_ONLY';
      throw error;
    }

    this._assertInstallationClosureReady(existing);

    let resolvedFileId = fileId;
    let resolvedFileLink = fileId ? driveLink(fileId) : null;
    const baseFolderId = await this._ensureDriveFolder(
      purchaseId,
      existing.client_snapshot,
      existing.drive_folder_id,
    );
    const targetFolder = await ensureFolder('Acta de entrega', baseFolderId);
    if (!resolvedFileId) {
      if (!actBase64 || !fileName) {
        const error = new Error('Archivo de acta final requerido');
        error.status = 400;
        throw error;
      }
      const stored = await uploadBase64File(fileName, actBase64, mimeType || 'application/pdf', targetFolder?.id || baseFolderId);
      resolvedFileId = stored.id;
      resolvedFileLink = stored?.webViewLink || driveLink(stored?.id);
    }

    const legalCopies = await this._createDeliveryActLegalCopies({
      actaNumber: existing.delivery_act_number || `PP-${String(purchaseId).slice(0, 8)}`,
      sourceFileId: resolvedFileId,
      destinationFolderId: targetFolder?.id || baseFolderId,
      user,
    });
    const currentInstallationWorkflow = normalizeInstallationWorkflowState(
      existing.installation_workflow || {},
      { equipment: existing.equipment || [] },
    );
    const nextInstallationWorkflow = enrichInstallationWorkflowWithGate({
      workflow: {
        ...currentInstallationWorkflow,
        delivery_act: {
          ...currentInstallationWorkflow.delivery_act,
          final_file_id: resolvedFileId,
          final_link: resolvedFileLink || driveLink(resolvedFileId),
          generated_at: new Date().toISOString(),
          legal_internal_copy_file_id: legalCopies.internal_copy_file_id || null,
          legal_internal_copy_link: legalCopies.internal_copy_link || null,
          legal_client_copy_file_id: legalCopies.client_copy_file_id || null,
          legal_client_copy_link: legalCopies.client_copy_link || null,
          legalized_at: legalCopies.legalized_at || null,
          legalized_by: legalCopies.legalized_by || null,
          legalized_by_email: legalCopies.legalized_by_email || null,
        },
      },
      siteReady: Boolean(this._parseSiteInspectionState(existing).ready_for_installation),
      requiresSiteInspection: Boolean(existing?.inspection_request_id || existing?.inspection_scheduled_date),
    });

    const { rows } = await db.query(
      `UPDATE private_purchase_requests
         SET delivery_act_document_id = $2,
             delivery_act_generated_at = NOW(),
             installation_workflow = $3::jsonb,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [purchaseId, resolvedFileId, JSON.stringify(nextInstallationWorkflow)]
    );

    await this.transitionState(
      purchaseId,
      PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED,
      user,
      'Acta final firmada por tecnico y cliente'
    );

    await trackFst10WorkflowDocument({
      sourceType: 'private_purchase',
      sourceId: String(purchaseId),
      requestId: existing?.inspection_request_id || null,
      driveFileId: resolvedFileId,
      driveFolderId: targetFolder?.id || baseFolderId || null,
      driveLink: resolvedFileLink || driveLink(resolvedFileId),
      clientName:
        existing?.client_snapshot?.commercial_name ||
        existing?.client_snapshot?.name ||
        existing?.client_snapshot?.client_name ||
        null,
      equipmentName: Array.isArray(existing?.equipment)
        ? existing.equipment.map((item) => item?.name || item?.label || item?.sku).filter(Boolean).join(', ')
        : null,
      user,
      metadata: {
        source_module: 'private_purchases',
        private_purchase_id: purchaseId,
        legal_internal_copy_file_id: legalCopies.internal_copy_file_id || null,
        legal_client_copy_file_id: legalCopies.client_copy_file_id || null,
      },
    });

    const baseDate =
      existing.delivery_start_at ||
      existing.delivery_end_at ||
      new Date();

    const equipmentPayload = Array.isArray(existing.equipment)
      ? existing.equipment
      : (() => {
          try {
            return JSON.parse(existing.equipment || '[]');
          } catch (_err) {
            return [];
          }
        })();

    await this._schedulePreventiveMaintenance({
      purchase: {
        id: purchaseId,
        equipment: equipmentPayload
      },
      baseDate,
      scheduledBy: { id: user?.id || null, name: user?.fullname || user?.name, email: user?.email }
    });

    return rows[0];
  }

  _buildPrivateInspectionPayload(purchase = {}, inspectionWindow = {}) {
    const snapshot = purchase?.client_snapshot || {};
    const equipment = Array.isArray(purchase?.equipment) ? purchase.equipment : [];
    const equipos = equipment.map((item) => ({
      nombre_equipo: item?.name || item?.label || item?.sku || "Equipo",
      estado: item?.type || item?.estado || "nuevo",
      unidad_id: item?.unidad_id || item?.id || "",
      serial: item?.serial || "",
    }));

    return {
      nombre_cliente: snapshot?.commercial_name || snapshot?.name || snapshot?.client_name || "",
      direccion_cliente: snapshot?.shipping_address || snapshot?.address || "",
      persona_contacto: snapshot?.shipping_contact_name || snapshot?.contact_name || snapshot?.legal_rep_name || "",
      celular_contacto: snapshot?.shipping_phone || snapshot?.shipping_cellphone || snapshot?.phone || "",
      email_cliente: snapshot?.client_email || snapshot?.email || "",
      fecha_instalacion: inspectionWindow?.inspection_min_date || addDaysIso(1),
      fecha_tope_instalacion: inspectionWindow?.inspection_max_date || addDaysIso(7),
      requiere_lis: Boolean(purchase?.includes_starter_kit),
      equipos,
      anotaciones: "Inspección de ambiente generada automáticamente desde compra privada",
      accesorios: "",
      observaciones: purchase?.notes || "",
    };
  }

  async _notifyInspectionStakeholders(purchaseId, purchaseRow, user, message) {
    try {
      const creatorId = purchaseRow?.created_by || null;
      const technicalRoles = ["jefe_tecnico", "jefe_servicio_tecnico", "tecnico"];
      const technicalUsers = await Promise.all(technicalRoles.map((role) => this._getUsersByRole(role)));
      const recipients = new Map();

      if (creatorId) recipients.set(String(creatorId), creatorId);
      technicalUsers.flat().forEach((u) => {
        if (u?.id) recipients.set(String(u.id), u.id);
      });

      const title = "Inspección de ambiente - Compra privada";
      const notificationPayload = {
        client_name:
          purchaseRow?.client_snapshot?.commercial_name ||
          purchaseRow?.client_snapshot?.name ||
          "Cliente",
        purchase_id: purchaseId,
      };

      for (const userId of recipients.values()) {
        await notificationManager.sendNotification({
          userId,
          customTitle: title,
          customMessage: message,
          type: "task",
          source: "private_purchase.inspection",
          priority: 2,
          email: true,
          chat: true,
          meta: notificationPayload,
        });
      }
    } catch (error) {
      logger.warn({ error, purchaseId }, "No se pudo notificar coordinación de inspección privada");
    }
  }

  async saveInspectionRequest(purchaseId, { requestId, actaDocumentId, inspection_min_date, inspection_max_date } = {}, user) {
    const { rows } = await db.query(
      `SELECT id, status, inspection_request_id, inspection_scheduled_date, inspection_min_date, inspection_max_date,
              created_by, created_by_email, client_snapshot, equipment, includes_starter_kit, notes, offer_kind,
              offer_signed_document_id
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const purchase = rows[0];
    const allowedStates = new Set([
      PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED,
      PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED,
    ]);
    if (!allowedStates.has(purchase.status)) {
      const error = new Error('Estado invalido para solicitar inspeccion');
      error.status = 409;
      error.code = 'INVALID_TRANSITION';
      throw error;
    }

    if (purchase.inspection_request_id) {
      if (purchase.status !== PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED) {
        await this.transitionState(
          purchaseId,
          PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED,
          user,
          'Inspeccion de ambiente ya registrada'
        );
      }

      const { rows: existingRows } = await db.query('SELECT * FROM private_purchase_requests WHERE id = $1', [purchaseId]);
      return existingRows[0] || purchase;
    }

    const minDate = inspection_min_date || purchase.inspection_min_date || addDaysIso(1);
    const maxDate = inspection_max_date || purchase.inspection_max_date || addDaysIso(7);
    const payload = this._buildPrivateInspectionPayload(purchase, {
      inspection_min_date: minDate,
      inspection_max_date: maxDate,
    });

    let resolvedRequestId = requestId;
    if (!resolvedRequestId) {
      const inspectionRequest = await createServiceRequest({
        requester_id: user?.id,
        requester_email: user?.email || purchase.created_by_email || null,
        requester_name: user?.fullname || user?.name || null,
        request_type_id: "F.ST-20",
        payload,
      });
      resolvedRequestId = inspectionRequest?.request?.id || inspectionRequest?.request_id || inspectionRequest?.id || null;
      const autoActaId =
        inspectionRequest?.document?.id ||
        inspectionRequest?.document?.pdfId ||
        inspectionRequest?.document?.docId ||
        null;
      if (!actaDocumentId && autoActaId) actaDocumentId = autoActaId;
    }

    if (!resolvedRequestId) {
      const error = new Error("No se pudo generar la solicitud de inspección");
      error.status = 500;
      error.code = "INSPECTION_REQUEST_CREATE_FAILED";
      throw error;
    }

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
         SET inspection_request_id = $1,
             inspection_acta_document_id = COALESCE($2, inspection_acta_document_id),
             inspection_min_date = COALESCE($3, inspection_min_date),
             inspection_max_date = COALESCE($4, inspection_max_date),
             inspection_proposed_date = NULL,
             inspection_proposed_notes = NULL,
             inspection_proposed_at = NULL,
             inspection_proposed_by = NULL,
             inspection_proposed_by_email = NULL,
             inspection_coordination_status = 'pending_proposal',
             inspection_review_notes = NULL,
             inspection_reviewed_at = NULL,
             inspection_reviewed_by = NULL,
             inspection_reviewed_by_email = NULL,
             inspection_scheduled_date = NULL,
             inspection_coordinated_at = NULL,
             inspection_coordinated_by = NULL,
             inspection_coordinated_by_email = NULL,
             inspection_requested_at = NOW(),
             updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [resolvedRequestId, actaDocumentId || null, minDate, maxDate, purchaseId]
    );

    if (purchase.offer_signed_document_id) {
      try {
        await addDriveAttachment({
          request_id: resolvedRequestId,
          drive_file_id: purchase.offer_signed_document_id,
          title: "Oferta firmada del cliente",
        });
      } catch (attachmentError) {
        logger.warn({ attachmentError, purchaseId }, "No se pudo adjuntar oferta firmada a inspección privada");
      }
    }

    if (purchase.status !== PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED) {
      await this.transitionState(
        purchaseId,
        PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED,
        user,
        'Inspeccion de ambiente solicitada'
      );
    }

    await this._notifyInspectionStakeholders(
      purchaseId,
      updatedRows[0],
      user,
      "Se creó la inspección de ambiente. Comercial debe coordinar fecha con Jefe Técnico/Técnico.",
    );

    return updatedRows[0];
  }

  async coordinateInspectionDate(purchaseId, { inspection_date, notes = '' } = {}, user) {
    const canCoordinate = this._hasAnyRoleToken(user, [
      'comercial',
      'acp_comercial',
      'jefe_comercial',
    ]);
    if (!canCoordinate) {
      const error = new Error('No autorizado para coordinar inspección');
      error.status = 403;
      error.code = 'ROLE_NOT_ALLOWED';
      throw error;
    }

    const { rows } = await db.query(
      `SELECT id, status, inspection_request_id, inspection_min_date, inspection_max_date, client_snapshot, created_by
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );
    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }
    const purchase = rows[0];

    if (!purchase.inspection_request_id) {
      const error = new Error('La inspección de ambiente aún no fue generada');
      error.status = 409;
      error.code = 'INSPECTION_REQUIRED';
      throw error;
    }

    if (!inspection_date) {
      const error = new Error('Debe seleccionar fecha coordinada de inspección');
      error.status = 400;
      error.code = 'INSPECTION_DATE_REQUIRED';
      throw error;
    }

    const selected = new Date(`${inspection_date}T00:00:00`);
    const min = purchase.inspection_min_date ? new Date(`${purchase.inspection_min_date}T00:00:00`) : null;
    const max = purchase.inspection_max_date ? new Date(`${purchase.inspection_max_date}T00:00:00`) : null;
    if (Number.isNaN(selected.getTime())) {
      const error = new Error('Formato de fecha inválido');
      error.status = 400;
      error.code = 'INVALID_DATE_FORMAT';
      throw error;
    }
    if ((min && selected < min) || (max && selected > max)) {
      const error = new Error('La fecha coordinada debe estar dentro de la ventana de inspección');
      error.status = 409;
      error.code = 'INSPECTION_DATE_OUT_OF_WINDOW';
      throw error;
    }

    const conflictRows = await this._listTechnicalScheduleByDate({
      date: inspection_date,
      excludePrivatePurchaseId: purchaseId,
      excludeInspectionRequestId: purchase.inspection_request_id || null,
    });
    if (conflictRows.length >= TECHNICAL_DAILY_CAPACITY) {
      const error = new Error('El cronograma técnico está lleno para esa fecha. Selecciona otro día.');
      error.status = 409;
      error.code = 'TECHNICAL_SCHEDULE_FULL';
      error.details = {
        date: String(inspection_date || '').slice(0, 10),
        capacity: TECHNICAL_DAILY_CAPACITY,
        conflicts_count: conflictRows.length,
        conflicts: conflictRows.map((item) => ({
          source_type: item.source_type,
          summary: item.summary,
        })),
      };
      throw error;
    }

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
         SET inspection_proposed_date = $2,
             inspection_proposed_notes = $3,
             inspection_proposed_at = NOW(),
             inspection_proposed_by = $4,
             inspection_proposed_by_email = $5,
             inspection_coordination_status = 'pending_review',
             inspection_scheduled_date = NULL,
             inspection_coordinated_at = NULL,
             inspection_coordinated_by = NULL,
             inspection_coordinated_by_email = NULL,
             inspection_reviewed_at = NULL,
             inspection_reviewed_by = NULL,
             inspection_reviewed_by_email = NULL,
             inspection_review_notes = NULL,
             inspection_coordination_notes = $3,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [purchaseId, inspection_date, notes || null, user?.id || null, user?.email || null]
    );

    await this._notifyInspectionStakeholders(
      purchaseId,
      updatedRows[0],
      user,
      `Comercial propuso fecha de inspección para ${inspection_date}. Pendiente validación de Jefe Técnico.`,
    );

    return updatedRows[0];
  }

  async reviewInspectionDate(purchaseId, { decision, review_notes = '' } = {}, user) {
    const canReview = this._hasAnyRoleToken(user, ['jefe_tecnico', 'jefe_servicio_tecnico']);
    if (!canReview) {
      const error = new Error('No autorizado para revisar coordinación de inspección');
      error.status = 403;
      error.code = 'ROLE_NOT_ALLOWED';
      throw error;
    }

    const normalizedDecision = String(decision || '').toLowerCase();
    if (!['accept', 'reject'].includes(normalizedDecision)) {
      const error = new Error("Decisión inválida. Usa 'accept' o 'reject'");
      error.status = 400;
      error.code = 'INVALID_REVIEW_DECISION';
      throw error;
    }

    const { rows } = await db.query(
      `SELECT id, status, inspection_request_id, inspection_proposed_date, inspection_proposed_notes
         FROM private_purchase_requests
        WHERE id = $1`,
      [purchaseId]
    );
    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }
    const purchase = rows[0];

    if (!purchase.inspection_request_id) {
      const error = new Error('La inspección de ambiente aún no fue generada');
      error.status = 409;
      error.code = 'INSPECTION_REQUIRED';
      throw error;
    }
    if (!purchase.inspection_proposed_date) {
      const error = new Error('No existe fecha propuesta pendiente de revisión');
      error.status = 409;
      error.code = 'INSPECTION_PROPOSAL_REQUIRED';
      throw error;
    }

    const proposalDate = String(purchase.inspection_proposed_date).slice(0, 10);

    if (normalizedDecision === 'reject') {
      const { rows: updatedRows } = await db.query(
        `UPDATE private_purchase_requests
           SET inspection_coordination_status = 'rejected',
               inspection_review_notes = $2,
               inspection_reviewed_at = NOW(),
               inspection_reviewed_by = $3,
               inspection_reviewed_by_email = $4,
               inspection_scheduled_date = NULL,
               inspection_coordinated_at = NULL,
               inspection_coordinated_by = NULL,
               inspection_coordinated_by_email = NULL,
               updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [purchaseId, review_notes || null, user?.id || null, user?.email || null],
      );
      await this._notifyInspectionStakeholders(
        purchaseId,
        updatedRows[0],
        user,
        `Jefe Técnico rechazó la fecha propuesta. ${review_notes || 'Comercial debe proponer otra fecha.'}`,
      );
      return updatedRows[0];
    }

    const conflictRows = await this._listTechnicalScheduleByDate({
      date: proposalDate,
      excludePrivatePurchaseId: purchaseId,
      excludeInspectionRequestId: purchase.inspection_request_id || null,
    });
    if (conflictRows.length >= TECHNICAL_DAILY_CAPACITY) {
      const error = new Error('El cronograma técnico está lleno para esa fecha.');
      error.status = 409;
      error.code = 'TECHNICAL_SCHEDULE_FULL';
      error.details = {
        date: proposalDate,
        capacity: TECHNICAL_DAILY_CAPACITY,
        conflicts_count: conflictRows.length,
        conflicts: conflictRows.map((item) => ({
          source_type: item.source_type,
          summary: item.summary,
        })),
      };
      throw error;
    }

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
         SET inspection_scheduled_date = $2,
             inspection_coordination_notes = COALESCE($3, inspection_coordination_notes),
             inspection_coordination_status = 'accepted',
             inspection_review_notes = $3,
             inspection_reviewed_at = NOW(),
             inspection_reviewed_by = $4,
             inspection_reviewed_by_email = $5,
             inspection_coordinated_at = NOW(),
             inspection_coordinated_by = $4,
             inspection_coordinated_by_email = $5,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        purchaseId,
        proposalDate,
        review_notes || purchase.inspection_proposed_notes || null,
        user?.id || null,
        user?.email || null,
      ],
    );

    await this._notifyInspectionStakeholders(
      purchaseId,
      updatedRows[0],
      user,
      `Jefe Técnico aprobó la fecha de inspección para ${proposalDate}.`,
    );

    return updatedRows[0];
  }

  async registerSiteInspection(
    purchaseId,
    {
      result,
      checklist,
      observations = "",
      recommendations = "",
      follow_up_date = null,
      is_reinspection = false,
      client_signer_name = "",
      expected_updated_at = null,
    } = {},
    user,
  ) {
    await ensurePrivateSiteInspectionColumns();
    const canRegister = this._hasAnyRoleToken(user, ["tecnico", "jefe_tecnico", "jefe_servicio_tecnico"]);
    if (!canRegister) {
      const error = new Error("No autorizado para registrar F.ST-07");
      error.status = 403;
      error.code = "ROLE_NOT_ALLOWED";
      throw error;
    }

    const { rows } = await db.query(
      `SELECT id,
              status,
              updated_at,
              inspection_request_id,
              inspection_scheduled_date,
              inspection_coordinated_by,
              inspection_coordinated_by_email,
              site_inspection,
              site_inspection_status,
              site_inspection_result,
              site_inspection_follow_up_date,
              site_inspection_report_document_id,
              site_inspection_report_link,
              site_inspection_report_generated_at,
              site_inspection_ready_for_installation,
              site_inspection_requires_reinspection,
              site_inspection_updated_at,
              site_inspection_updated_by,
              site_inspection_updated_by_email,
              client_snapshot,
              equipment,
              drive_folder_id,
              created_by
         FROM private_purchase_requests
        WHERE id = $1
        LIMIT 1`,
      [purchaseId],
    );
    if (!rows.length) {
      const error = new Error("Solicitud no encontrada");
      error.status = 404;
      error.code = "REQUEST_NOT_FOUND";
      throw error;
    }
    const purchase = rows[0];

    if (expected_updated_at) {
      const expectedMs = new Date(expected_updated_at).getTime();
      const currentMs = new Date(purchase?.updated_at).getTime();
      if (
        Number.isFinite(expectedMs) &&
        Number.isFinite(currentMs) &&
        Math.abs(expectedMs - currentMs) > 1000
      ) {
        const error = new Error("La solicitud cambió en otra sesión. Refresca e intenta nuevamente.");
        error.status = 409;
        error.code = "STALE_REQUEST_STATE";
        throw error;
      }
    }

    if (!purchase.inspection_request_id || !purchase.inspection_scheduled_date) {
      throw createSiteInspectionError(
        "Primero se debe coordinar la fecha exacta de inspección (F.ST-20)",
        {
          status: 409,
          code: "SITE_INSPECTION_NOT_COORDINATED",
        },
      );
    }

    const normalizedResult = normalizeInspectionResult(result);
    if (!normalizedResult) {
      throw createSiteInspectionError("Debes indicar un resultado válido para la inspección en sitio", {
        status: 400,
        code: "SITE_INSPECTION_RESULT_REQUIRED",
      });
    }

    const normalizedChecklist = normalizeFst07Checklist(checklist || {});
    const normalizedFollowUpDate = assertFollowUpDateConsistency({
      result: normalizedResult,
      followUpDate: follow_up_date,
      scheduledDate: purchase.inspection_scheduled_date,
    });
    if (normalizedResult === SITE_INSPECTION_RESULT.NON_COMPLIANT && normalizedFollowUpDate) {
      const conflicts = await this._listTechnicalScheduleByDate({
        date: normalizedFollowUpDate,
        excludePrivatePurchaseId: purchaseId,
        excludeInspectionRequestId: purchase.inspection_request_id || null,
      });
      if (conflicts.length >= TECHNICAL_DAILY_CAPACITY) {
        const error = new Error("El cronograma técnico está lleno para la reinspección en esa fecha");
        error.status = 409;
        error.code = "TECHNICAL_SCHEDULE_FULL";
        error.details = {
          date: normalizedFollowUpDate,
          capacity: TECHNICAL_DAILY_CAPACITY,
          conflicts_count: conflicts.length,
        };
        throw error;
      }
    }

    const responsibleName = this._getInspectionResponsibleName(user);
    const clientSignerName = String(client_signer_name || "").trim();
    if (!clientSignerName) {
      throw createSiteInspectionError("Debes registrar el nombre de quien firma por parte del cliente", {
        status: 400,
        code: "CLIENT_SIGNATURE_REQUIRED",
      });
    }

    const equipmentItems = Array.isArray(purchase?.equipment) ? purchase.equipment : [];
    const equipmentName =
      equipmentItems
        .map((item) => item?.name || item?.label || item?.sku)
        .filter(Boolean)
        .join(", ") || "Equipo no especificado";
    const clientName =
      purchase?.client_snapshot?.commercial_name ||
      purchase?.client_snapshot?.name ||
      purchase?.client_snapshot?.client_name ||
      "Cliente";

    const baseFolderId = await this._ensureDriveFolder(
      purchaseId,
      purchase.client_snapshot,
      purchase.drive_folder_id,
    );
    const siteInspectionFolder = await ensureFolder("Inspección de ambiente", baseFolderId);

    const { buffer: fst07Buffer, generatedAt } = await generateFst07PdfBuffer({
      clientName,
      equipmentName,
      scheduledDate: purchase.inspection_scheduled_date,
      responsibleName,
      result: normalizedResult,
      checklist: normalizedChecklist,
      observations: String(observations || "").trim() || "",
      recommendations: String(recommendations || "").trim() || "",
      followUpDate: normalizedFollowUpDate || null,
      isReinspection: Boolean(is_reinspection),
      clientSignerName,
    });

    const fileName = buildFst07FileName({ clientName, generatedAt });
    const stored = await uploadBase64File(
      fileName,
      fst07Buffer.toString("base64"),
      "application/pdf",
      siteInspectionFolder?.id || baseFolderId,
    );
    const reportFileId = stored?.id || null;
    if (!reportFileId) {
      throw createSiteInspectionError("No se pudo almacenar el documento F.ST-07 en Drive", {
        status: 500,
        code: "SITE_INSPECTION_REPORT_FAILED",
      });
    }
    const reportLink = stored?.webViewLink || driveLink(reportFileId);

    if (purchase?.inspection_request_id) {
      try {
        await addDriveAttachment({
          request_id: purchase.inspection_request_id,
          drive_file_id: reportFileId,
          title: "F.ST-07 Inspección de Ambiente",
        });
      } catch (attachmentError) {
        logger.warn({ attachmentError, purchaseId }, "No se pudo adjuntar F.ST-07 a la solicitud técnica privada");
      }
    }

    const previousState = this._parseSiteInspectionState(purchase);
    const nowIso = new Date().toISOString();
    const historyEntry = {
      result: normalizedResult,
      is_reinspection: Boolean(is_reinspection),
      scheduled_date: normalizeDateOnlyInput(purchase.inspection_scheduled_date) || null,
      follow_up_date:
        normalizedResult === SITE_INSPECTION_RESULT.NON_COMPLIANT ? normalizedFollowUpDate || null : null,
      observations: String(observations || "").trim() || null,
      recommendations: String(recommendations || "").trim() || null,
      responsible_name: responsibleName,
      client_signer_name: clientSignerName,
      inspected_at: nowIso,
      updated_at: nowIso,
      updated_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      updated_by_email: user?.email || null,
      report_file_id: reportFileId,
      report_link: reportLink || null,
    };

    const nextState = {
      ...previousState,
      status:
        normalizedResult === SITE_INSPECTION_RESULT.COMPLIANT
          ? SITE_INSPECTION_STATUS.READY_FOR_INSTALLATION
          : SITE_INSPECTION_STATUS.NON_COMPLIANT_REINSPECTION_PENDING,
      result: normalizedResult,
      follow_up_date:
        normalizedResult === SITE_INSPECTION_RESULT.NON_COMPLIANT ? normalizedFollowUpDate || null : null,
      report_file_id: reportFileId,
      report_link: reportLink || null,
      report_generated_at: generatedAt || nowIso,
      ready_for_installation: normalizedResult === SITE_INSPECTION_RESULT.COMPLIANT,
      requires_reinspection: normalizedResult !== SITE_INSPECTION_RESULT.COMPLIANT,
      checklist: normalizedChecklist,
      observations: String(observations || "").trim() || null,
      recommendations: String(recommendations || "").trim() || null,
      responsible_name: responsibleName,
      client_signer_name: clientSignerName,
      inspected_at: nowIso,
      updated_at: nowIso,
      updated_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      updated_by_email: user?.email || null,
      history: [...(Array.isArray(previousState.history) ? previousState.history : []), historyEntry].slice(-40),
    };

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
          SET site_inspection = $2::jsonb,
              site_inspection_status = $3,
              site_inspection_result = $4,
              site_inspection_follow_up_date = $5,
              site_inspection_report_document_id = $6,
              site_inspection_report_link = $7,
              site_inspection_report_generated_at = $8,
              site_inspection_ready_for_installation = $9,
              site_inspection_requires_reinspection = $10,
              site_inspection_updated_at = now(),
              site_inspection_updated_by = $11,
              site_inspection_updated_by_email = $12,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [
        purchaseId,
        JSON.stringify(nextState),
        nextState.status,
        nextState.result,
        nextState.follow_up_date || null,
        nextState.report_file_id || null,
        nextState.report_link || null,
        nextState.report_generated_at || null,
        Boolean(nextState.ready_for_installation),
        Boolean(nextState.requires_reinspection),
        Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
        user?.email || null,
      ],
    );
    const updated = updatedRows[0];
    this._applySiteInspectionState(updated);

    if (
      normalizedResult === SITE_INSPECTION_RESULT.NON_COMPLIANT &&
      normalizedFollowUpDate
    ) {
      await this._upsertPrivateReinspectionTechnicalActivity({
        purchase: updated,
        followUpDate: normalizedFollowUpDate,
        user,
      });
    } else if (normalizedResult === SITE_INSPECTION_RESULT.COMPLIANT) {
      await this._closePrivateReinspectionTechnicalActivity(purchaseId);
    }

    await trackFst07WorkflowDocument({
      sourceType: "private_purchase",
      sourceId: String(updated.id),
      requestId: updated.inspection_request_id || null,
      driveFileId: reportFileId,
      driveFolderId: siteInspectionFolder?.id || baseFolderId || null,
      driveLink: reportLink || null,
      result: normalizedResult,
      followUpDate: nextState.follow_up_date || null,
      isReinspection: Boolean(is_reinspection),
      clientName,
      equipmentName,
      user,
      metadata: {
        source_module: "private_purchases",
        private_purchase_id: updated.id,
      },
    });

    await this._notifyInspectionStakeholders(
      purchaseId,
      updated,
      user,
      normalizedResult === SITE_INSPECTION_RESULT.COMPLIANT
        ? "F.ST-07 registrado conforme. Se habilita instalación/entrega."
        : `F.ST-07 no conforme. Reinspección requerida para ${normalizedFollowUpDate || "fecha pendiente"}.`,
    );

    return updated;
  }

  async _storeInstallationEvidencePhoto(baseFolderId, photo, index = 0) {
    const source = typeof photo === "string" ? { raw: photo } : (photo || {});
    const fileId = source.file_id || source.id || null;
    const link = source.link || source.url || null;
    if (fileId || link) {
      return { file_id: fileId || null, link: link || driveLink(fileId) };
    }

    const rawImage = source.raw || source.base64 || source.data || null;
    if (!rawImage || typeof rawImage !== "string") return null;
    if (!rawImage.startsWith("data:image")) return null;

    const mimeTypeMatch = rawImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeTypeMatch?.[1] || "image/png";
    const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
    const base64 = rawImage.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (!base64) return null;

    const evidenceFolder = await ensureFolder("F.ST-14 Evidencias", baseFolderId);
    const fileName = `F.ST-14-evidencia-${Date.now()}-${index + 1}.${extension}`;
    const stored = await uploadBase64File(
      fileName,
      base64,
      mimeType,
      evidenceFolder?.id || baseFolderId,
    );
    return {
      file_id: stored?.id || null,
      link: stored?.webViewLink || (stored?.id ? driveLink(stored.id) : null),
    };
  }

  async updateInstallationWorkflow(
    purchaseId,
    { action, payload = {}, expected_updated_at = null } = {},
    user,
  ) {
    await ensurePrivateSiteInspectionColumns();
    await ensurePrivateInstallationWorkflowColumns();

    const allowedRoles = [
      "tecnico",
      "jefe_tecnico",
      "jefe_servicio_tecnico",
      "jefe_operaciones",
      "jefe_logistica",
      "logistica",
      "jefe_comercial",
      "acp_comercial",
    ];
    if (!this._hasAnyRoleToken(user, allowedRoles)) {
      const error = new Error("Rol no autorizado para actualizar workflow de instalacion");
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    const normalizedAction = String(action || payload?.action || "")
      .trim()
      .toLowerCase();
    if (!normalizedAction) {
      throw createInstallationWorkflowError("Debe indicar la accion del workflow de instalacion", {
        status: 400,
        code: "INSTALLATION_ACTION_REQUIRED",
      });
    }

    const { rows } = await db.query(
      `SELECT id,
              status,
              updated_at,
              client_snapshot,
              equipment,
              drive_folder_id,
              inspection_request_id,
              inspection_scheduled_date,
              site_inspection,
              site_inspection_ready_for_installation,
              installation_workflow
         FROM private_purchase_requests
        WHERE id = $1
        LIMIT 1`,
      [purchaseId],
    );
    if (!rows.length) {
      throw createInstallationWorkflowError("Solicitud no encontrada", {
        status: 404,
        code: "REQUEST_NOT_FOUND",
      });
    }

    const purchase = rows[0];
    if (expected_updated_at) {
      const expectedMs = new Date(expected_updated_at).getTime();
      const currentMs = new Date(purchase?.updated_at).getTime();
      if (
        Number.isFinite(expectedMs) &&
        Number.isFinite(currentMs) &&
        Math.abs(expectedMs - currentMs) > 1000
      ) {
        throw createInstallationWorkflowError(
          "La solicitud cambió en otra sesión. Refresca e intenta nuevamente.",
          {
            status: 409,
            code: "STALE_REQUEST_STATE",
          },
        );
      }
    }

    const currentWorkflow = normalizeInstallationWorkflowState(
      purchase.installation_workflow || {},
      { equipment: purchase.equipment || [] },
    );
    const snapshot = purchase?.client_snapshot || {};
    const defaultClientName =
      snapshot.commercial_name || snapshot.client_name || snapshot.name || "Cliente";
    const defaultAddress = snapshot.shipping_address || snapshot.address || null;
    const defaultContactName = snapshot.shipping_contact_name || snapshot.contact_name || null;
    const defaultContactPhone = snapshot.shipping_phone || snapshot.shipping_cellphone || snapshot.phone || null;

    let nextWorkflow = currentWorkflow;
    if (normalizedAction === "dispatch_request") {
      nextWorkflow = buildDispatchRequestPatch({
        workflow: currentWorkflow,
        payload,
        user,
        defaults: {
          client_name: defaultClientName,
          client_address: defaultAddress,
          contact_name: defaultContactName,
          contact_phone: defaultContactPhone,
        },
      });
    } else if (normalizedAction === "logistics_validation") {
      nextWorkflow = buildLogisticsValidationPatch({ workflow: currentWorkflow, payload, user });
    } else if (normalizedAction === "visual_inspection_fst14") {
      const canVisualInspect = this._hasAnyRoleToken(user, [
        "tecnico",
        "jefe_tecnico",
        "jefe_servicio_tecnico",
      ]);
      if (!canVisualInspect) {
        throw createInstallationWorkflowError("Solo el equipo tecnico puede registrar F.ST-14", {
          status: 403,
          code: "FORBIDDEN",
        });
      }

      const baseFolderId = await this._ensureDriveFolder(
        purchaseId,
        purchase.client_snapshot,
        purchase.drive_folder_id,
      );
      const installationFolder = await ensureFolder("Instalación y entrega", baseFolderId);
      const reportFolder = await ensureFolder("F.ST-14", installationFolder?.id || baseFolderId);

      const photoPayload = Array.isArray(payload.photos) ? payload.photos : [];
      const storedPhotos = [];
      for (let i = 0; i < photoPayload.length; i += 1) {
         
        const stored = await this._storeInstallationEvidencePhoto(baseFolderId, photoPayload[i], i);
        if (stored) storedPhotos.push(stored);
      }

      const technicalName =
        user?.fullname || user?.name || user?.email || "Tecnico";
      const logisticsValidatorName =
        currentWorkflow?.logistics_validation?.validated_by_email ||
        currentWorkflow?.logistics_validation?.validated_by ||
        "Pendiente";
      const equipmentName = Array.isArray(purchase?.equipment)
        ? purchase.equipment.map((item) => item?.name || item?.label || item?.sku).filter(Boolean).join(", ")
        : null;

      const { buffer: fst14Buffer, generatedAt } = await generateFst14PdfBuffer({
        clientName: defaultClientName,
        clientAddress: defaultAddress,
        equipmentName: equipmentName || "Equipo",
        inspectionDate: payload.inspection_date || new Date().toISOString(),
        responsibleName: technicalName,
        logisticsValidatorName,
        dispatchRequiredDate: currentWorkflow?.dispatch_request?.required_date || null,
        guideReference:
          payload.guide_reference ||
          currentWorkflow?.logistics_validation?.guide_reference ||
          null,
        proformaReference:
          payload.proforma_reference ||
          currentWorkflow?.logistics_validation?.proforma_reference ||
          null,
        checklist: payload.checklist || {},
        findings: payload.findings || "",
        correctiveActions: payload.corrective_actions || "",
        logisticsChainNotes: payload.logistics_chain_notes || "",
        result: payload.result || "pass",
        photos: storedPhotos,
        isPreinstallation: true,
      });

      const fst14FileName = buildFst14FileName({
        clientName: defaultClientName,
        generatedAt: new Date(generatedAt),
      });
      const storedReport = await uploadBase64File(
        fst14FileName,
        fst14Buffer.toString("base64"),
        "application/pdf",
        reportFolder?.id || baseFolderId,
      );
      const reportFileId = storedReport?.id || null;
      if (!reportFileId) {
        throw createInstallationWorkflowError("No se pudo almacenar F.ST-14 en Drive", {
          status: 500,
          code: "FST14_REPORT_STORE_FAILED",
        });
      }
      const reportLink =
        storedReport?.webViewLink || (reportFileId ? driveLink(reportFileId) : null);

      nextWorkflow = buildVisualReceptionPatch({
        workflow: currentWorkflow,
        payload: {
          ...payload,
          photos: storedPhotos,
        },
        user,
        report: {
          file_id: reportFileId,
          link: reportLink,
          generated_at: generatedAt,
        },
      });

      await trackFst14WorkflowDocument({
        sourceType: "private_purchase",
        sourceId: String(purchaseId),
        requestId: purchase.inspection_request_id || null,
        driveFileId: reportFileId,
        driveFolderId: reportFolder?.id || baseFolderId || null,
        driveLink: reportLink,
        clientName: defaultClientName,
        equipmentName: equipmentName || null,
        user,
        metadata: {
          source_module: "private_purchases",
          private_purchase_id: purchaseId,
          result: nextWorkflow?.visual_reception?.result || null,
        },
      });
    } else if (normalizedAction === "verification_decision") {
      const canDecideVerification = this._hasAnyRoleToken(user, [
        "jefe_tecnico",
        "jefe_servicio_tecnico",
      ]);
      if (!canDecideVerification) {
        throw createInstallationWorkflowError(
          "Solo jefatura tecnica puede decidir si aplica verificacion",
          {
            status: 403,
            code: "FORBIDDEN",
          },
        );
      }
      nextWorkflow = buildVerificationDecisionPatch({
        workflow: currentWorkflow,
        payload,
        user,
      });
    } else if (normalizedAction === "verification_remediation_review") {
      nextWorkflow = buildVerificationRemediationPatch({
        workflow: currentWorkflow,
        payload,
        user,
      });
    } else if (normalizedAction === "cu_provider_report") {
      let fileId = payload.provider_repair_report_file_id || payload.file_id || null;
      let link = payload.provider_repair_report_link || payload.link || null;
      if (!fileId && payload.file_base64 && payload.file_name) {
        const baseFolderId = await this._ensureDriveFolder(
          purchaseId,
          purchase.client_snapshot,
          purchase.drive_folder_id,
        );
        const cuFolder = await ensureFolder("CU Reportes proveedor", baseFolderId);
        const stored = await uploadBase64File(
          payload.file_name,
          String(payload.file_base64).includes(",")
            ? String(payload.file_base64).split(",")[1]
            : String(payload.file_base64),
          payload.mime_type || "application/pdf",
          cuFolder?.id || baseFolderId,
        );
        fileId = stored?.id || null;
        link = stored?.webViewLink || (fileId ? driveLink(fileId) : null);
      }
      nextWorkflow = buildCuProviderReportPatch({
        workflow: currentWorkflow,
        payload: {
          ...payload,
          provider_repair_report_file_id: fileId,
          provider_repair_report_link: link,
        },
        user,
      });
    } else {
      throw createInstallationWorkflowError("Accion de workflow de instalacion no soportada", {
        status: 400,
        code: "INSTALLATION_ACTION_INVALID",
        details: { action: normalizedAction },
      });
    }

    nextWorkflow = enrichInstallationWorkflowWithGate({
      workflow: nextWorkflow,
      siteReady: Boolean(this._parseSiteInspectionState(purchase).ready_for_installation),
      requiresSiteInspection: Boolean(purchase?.inspection_request_id || purchase?.inspection_scheduled_date),
    });

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
          SET installation_workflow = $2::jsonb,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [purchaseId, JSON.stringify(nextWorkflow)],
    );

    const updated = updatedRows[0] || purchase;
    this._applySiteInspectionState(updated);
    this._applyInstallationWorkflowState(updated);
    return updated;
  }

  async _createDeliveryActLegalCopies({
    actaNumber,
    sourceFileId,
    destinationFolderId,
    user,
  }) {
    if (!sourceFileId || !destinationFolderId) {
      return {
        internal_copy_file_id: null,
        internal_copy_link: null,
        client_copy_file_id: null,
        client_copy_link: null,
      };
    }

    const makeCopy = async (name) => {
      try {
        const { data } = await drive.files.copy({
          fileId: sourceFileId,
          requestBody: {
            name,
            parents: [destinationFolderId],
          },
          supportsAllDrives: true,
        });
        return {
          file_id: data?.id || null,
          link: data?.webViewLink || (data?.id ? driveLink(data.id) : null),
        };
      } catch (error) {
        logger.warn({ error, sourceFileId, destinationFolderId, name }, "No se pudo crear copia legalizada de F.ST-10");
        return { file_id: null, link: null };
      }
    };

    const internalCopy = await makeCopy(`ACTA-ENTREGA-${actaNumber}-COPIA-INTERNA.pdf`);
    const clientCopy = await makeCopy(`ACTA-ENTREGA-${actaNumber}-COPIA-CLIENTE.pdf`);

    return {
      internal_copy_file_id: internalCopy.file_id,
      internal_copy_link: internalCopy.link,
      client_copy_file_id: clientCopy.file_id,
      client_copy_link: clientCopy.link,
      legalized_at: new Date().toISOString(),
      legalized_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      legalized_by_email: user?.email || null,
    };
  }

  async uploadDeliveryGuides(purchaseId, { guides = [] } = {}, user) {
    if (!Array.isArray(guides) || guides.length === 0) {
      const error = new Error('Debe adjuntar al menos una guia');
      error.status = 400;
      throw error;
    }

    const { rows } = await db.query(
      'SELECT delivery_guides_json, client_snapshot, drive_folder_id FROM private_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const baseFolderId = await this._ensureDriveFolder(purchaseId, rows[0].client_snapshot, rows[0].drive_folder_id);
    const targetFolder = await ensureFolder('Guias de despacho', baseFolderId);

    const storedGuides = [];
    for (const guide of guides) {
      const fileName = guide?.file_name || guide?.name;
      let base64 = guide?.file_base64 || guide?.base64 || '';
      const mimeType = guide?.mime_type || guide?.mimeType || 'application/pdf';

      if (base64.includes(',')) {
        base64 = base64.split(',')[1] || '';
      }

      if (!fileName || !base64) {
        const error = new Error('Archivo de guia incompleto');
        error.status = 400;
        throw error;
      }

      const stored = await uploadBase64File(fileName, base64, mimeType, targetFolder?.id || baseFolderId);
      storedGuides.push({
        file_id: stored.id,
        file_name: fileName,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.id || null
      });
    }

    const existingGuides = Array.isArray(rows[0].delivery_guides_json) ? rows[0].delivery_guides_json : [];
    const updatedGuides = existingGuides.concat(storedGuides);

    const { rows: updatedRows } = await db.query(
      `UPDATE private_purchase_requests
         SET delivery_guides_json = $1,
             delivery_guides_uploaded_at = NOW(),
             updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(updatedGuides), purchaseId]
    );

    return updatedRows[0];
  }

  /**
   * Listar todas las solicitudes con filtros opcionales
   */
  async listAll(user, filters = {}) {
    await ensurePrivateSiteInspectionColumns();
    await ensurePrivateInstallationWorkflowColumns();
    let whereClause = '1=1';
    let params = [];
    let paramIndex = 1;

    // Aplicar filtros básicos
    const normalizedStatusFilter = this._normalizeStatusFilter(filters.status);
    if (normalizedStatusFilter) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(normalizedStatusFilter);
      paramIndex++;
    }

    if (filters.offer_kind) {
      const normalizedFilterOfferKind = this._normalizeOfferKind(filters.offer_kind, { allowLegacyAlias: true });
      if (!normalizedFilterOfferKind) {
        return [];
      }
      whereClause += ` AND offer_kind = $${paramIndex}`;
      params.push(normalizedFilterOfferKind);
      paramIndex++;
    }

    if (filters.created_by) {
      whereClause += ` AND created_by = $${paramIndex}`;
      params.push(filters.created_by);
      paramIndex++;
    }

    // Aplicar filtros de fecha
    if (filters.date_from) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(filters.date_from);
      paramIndex++;
    }

    if (filters.date_to) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(filters.date_to);
      paramIndex++;
    }

    const query = `
      SELECT
        p.id,
        p.client_snapshot,
        p.equipment,
        p.status,
        p.offer_kind,
        p.business_case_id,
        p.client_request_id,
        p.client_approved_at,
        p.offer_valid_until,
        p.created_at,
        p.updated_at,
        p.created_by,
        p.created_by_email,
        p.notes,
        p.offer_document_id,
        p.offer_signed_document_id,
        p.offer_signed_uploaded_at,
        p.contract_document_id,
        p.contract_client_signed_document_id,
        p.contract_client_signed_uploaded_at,
        p.contract_signed_document_id,
        p.contract_signed_uploaded_at,
        p.manager_contract_decision,
        p.manager_contract_decision_at,
        p.manager_contract_decision_by,
        p.delivery_act_document_id,
        p.delivery_act_draft_document_id,
        p.delivery_act_logistics_signed_document_id,
        p.delivery_act_assigned_to_user_id,
        p.delivery_act_assigned_to_email,
        p.delivery_act_assigned_to_name,
        p.delivery_act_assigned_at,
        p.delivery_act_assigned_by,
        p.delivery_act_logistics_signed_at,
        p.delivery_act_logistics_signed_by,
        p.delivery_start_at,
        p.delivery_end_at,
        p.delivery_notes,
        p.delivery_guides_json,
        p.delivery_guides_uploaded_at,
        p.comodato_document_id,
        p.client_registered_at,
        p.provider_email,
        p.availability_request_notes,
        p.availability_email_sent_at,
        p.availability_email_file_id,
        p.provider_response,
        p.provider_response_at,
        p.reservation_email_sent_at,
        p.reservation_email_file_id,
        p.reservation_calendar_event_id,
        p.reservation_calendar_event_link,
        p.includes_starter_kit,
        p.operations_notes,
        p.estimated_arrival_at,
        p.estimated_arrival_updated_at,
        p.equipment_arrived_at,
        p.equipment_arrived_by,
        p.dispatch_items_json,
        p.dispatch_notes,
        p.inspection_request_id,
        p.inspection_acta_document_id,
        p.inspection_requested_at,
        p.inspection_min_date,
        p.inspection_max_date,
        p.inspection_proposed_date,
        p.inspection_proposed_notes,
        p.inspection_proposed_at,
        p.inspection_proposed_by,
        p.inspection_proposed_by_email,
        p.inspection_coordination_status,
        p.inspection_review_notes,
        p.inspection_reviewed_at,
        p.inspection_reviewed_by,
        p.inspection_reviewed_by_email,
        p.inspection_scheduled_date,
        p.inspection_coordination_notes,
        p.inspection_coordinated_at,
        p.inspection_coordinated_by,
        p.inspection_coordinated_by_email,
        p.site_inspection,
        p.site_inspection_status,
        p.site_inspection_result,
        p.site_inspection_follow_up_date,
        p.site_inspection_report_document_id,
        p.site_inspection_report_link,
        p.site_inspection_report_generated_at,
        p.site_inspection_ready_for_installation,
        p.site_inspection_requires_reinspection,
        p.site_inspection_updated_at,
        p.site_inspection_updated_by,
        p.site_inspection_updated_by_email,
        p.installation_workflow,
        COALESCE(u_creator.fullname, u_creator.name) AS created_by_name,
        COALESCE(u_manager.fullname, u_manager.name) AS manager_contract_decision_by_name
      FROM private_purchase_requests p
      LEFT JOIN users u_creator ON u_creator.id = p.created_by
      LEFT JOIN users u_manager ON u_manager.id = p.manager_contract_decision_by
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const { rows } = await db.query(query, params);
    this._normalizeOfferKindsInRows(rows);
    this._attachSiteInspectionState(rows);
    this._attachInstallationWorkflowState(rows);
    await this._attachClientRequestSnapshot(rows);
    await this._attachChecklistState(rows);
    return rows;
  }

  /**
   * Obtener estadรญsticas por rol
   */
  async getStatsByRole(user, role) {
    let statusFilter = '';

    switch (role) {
      case 'comercial':
        statusFilter = `WHERE created_by = ${user.id}`;
        break;

      case 'backoffice_comercial':
        statusFilter = `WHERE status IN ('${PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE}', '${PRIVATE_PURCHASE_STATES.OFFER_SENT}', '${PRIVATE_PURCHASE_STATES.PENDING_MANAGER_SIGNATURE}', '${PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE}', '${PRIVATE_PURCHASE_STATES.OFFER_SIGNED}', '${PRIVATE_PURCHASE_STATES.OFFER_REJECTED_BY_COMMERCIAL}', '${PRIVATE_PURCHASE_STATES.PRICE_IMPROVEMENT_REQUESTED}', '${PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED}', '${PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE}', '${PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL}', '${PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED}')`;
        break;

      case 'gerencia_general':
        statusFilter = `WHERE status = '${PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL}'`;
        break;

      case 'jefe_operaciones':
        statusFilter = `WHERE status IN ('${PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE}', '${PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED}', '${PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED}', '${PRIVATE_PURCHASE_STATES.CALENDAR_EVENTS_CREATED}', '${PRIVATE_PURCHASE_STATES.WAITING_DISPATCH}', '${PRIVATE_PURCHASE_STATES.DISPATCH_READY}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED}')`;
        break;

      case 'jefe_logistica':
        statusFilter = `WHERE status IN ('${PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED}', '${PRIVATE_PURCHASE_STATES.WAITING_DISPATCH}', '${PRIVATE_PURCHASE_STATES.DISPATCH_READY}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED}', '${PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED}')`;
        break;
    }

    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = '${PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL}' THEN 1 END) as pending_approval,
        COUNT(CASE WHEN status = '${PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED}' THEN 1 END) as pending_delivery,
        COUNT(CASE WHEN status = '${PRIVATE_PURCHASE_STATES.WAITING_DISPATCH}' THEN 1 END) as preparing_dispatch,
        COUNT(CASE WHEN status = '${PRIVATE_PURCHASE_STATES.DISPATCH_READY}' THEN 1 END) as ready_for_delivery,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_week
      FROM private_purchase_requests
      ${statusFilter}
    `;

    const { rows } = await db.query(query);
    return rows[0];
  }

  /**
   * Consultar estado de aprobación de cliente
   */
  async checkClientApprovalStatus(clientData, purchase = {}) {
    const clientRequestId =
      purchase?.client_request_id ||
      clientData?.registered_client_id ||
      clientData?.client_request_id ||
      null;

    logger.debug('[CLIENT_APPROVAL_CHECK] Iniciando consulta de aprobacion para cliente:', {
      clientData,
      clientRequestId,
      hasName: !!clientData?.name,
      hasCommercialName: !!clientData?.commercial_name,
      hasRucCedula: !!clientData?.ruc_cedula,
      hasClientIdentifier: !!clientData?.client_identifier
    });

    if (clientRequestId) {
      logger.debug('[CLIENT_APPROVAL_CHECK] Buscando cliente aprobado por ID:', {
        clientRequestId
      });
      const { rows: clientRows } = await db.query(
        `SELECT id, status, commercial_name, ruc_cedula, created_at
           FROM client_requests
          WHERE id = $1
            AND status = 'approved'
          LIMIT 1`,
        [clientRequestId]
      );

      if (clientRows.length > 0) {
        const approvedClient = clientRows[0];
        logger.debug('[CLIENT_APPROVAL_CHECK] OK Cliente aprobado encontrado por ID:', {
          clientId: approvedClient.id,
          commercialName: approvedClient.commercial_name,
          rucCedula: approvedClient.ruc_cedula,
          approvedAt: approvedClient.created_at
        });
        return {
          isApproved: true,
          clientId: approvedClient.id,
          approvedAt: approvedClient.created_at,
          commercialName: approvedClient.commercial_name,
          rucCedula: approvedClient.ruc_cedula
        };
      }

      logger.debug('[CLIENT_APPROVAL_CHECK] ERROR Cliente no aprobado para ID:', {
        clientRequestId
      });
    }

    const nameValue = clientData?.commercial_name || clientData?.name || '';
    const rucValue = clientData?.ruc_cedula || clientData?.client_identifier || '';
    if (!nameValue && !rucValue) {
      logger.debug('[CLIENT_APPROVAL_CHECK] ERROR Datos del cliente incompletos');
      return { isApproved: false, message: 'Datos del cliente incompletos' };
    }

    try {
      const commercialName = nameValue;
      const rucCedula = rucValue;

      logger.debug('[CLIENT_APPROVAL_CHECK] Buscando cliente aprobado con:', {
        commercialName,
        rucCedula
      });

      const clientValidationQuery = `
        SELECT id, status, commercial_name, ruc_cedula, created_at
        FROM client_requests
        WHERE status = 'approved'
        AND (
          commercial_name = $1
          OR (ruc_cedula = $2 AND ruc_cedula IS NOT NULL)
        )
        ORDER BY created_at DESC
        LIMIT 1
      `;

      logger.debug('[CLIENT_APPROVAL_CHECK] Ejecutando query:', {
        query: clientValidationQuery,
        params: [commercialName, rucCedula]
      });

      const { rows } = await db.query(clientValidationQuery, [
        commercialName,
        rucCedula
      ]);

      logger.debug('[CLIENT_APPROVAL_CHECK] Resultado de query:', {
        rowsCount: rows.length,
        firstRow: rows[0] || null
      });

      if (rows.length > 0) {
        const approvedClient = rows[0];
        logger.debug('[CLIENT_APPROVAL_CHECK] OK Cliente aprobado encontrado:', {
          clientId: approvedClient.id,
          commercialName: approvedClient.commercial_name,
          rucCedula: approvedClient.ruc_cedula,
          approvedAt: approvedClient.created_at
        });

        return {
          isApproved: true,
          clientId: approvedClient.id,
          approvedAt: approvedClient.created_at,
          commercialName: approvedClient.commercial_name,
          rucCedula: approvedClient.ruc_cedula
        };
      }

      logger.debug('[CLIENT_APPROVAL_CHECK] ERROR Cliente no encontrado como aprobado');
      return {
        isApproved: false,
        message: 'Cliente pendiente de aprobacion por backoffice'
      };
    } catch (error) {
      logger.error('[CLIENT_APPROVAL_CHECK] ERROR Error consultando aprobacion:', error);
      return {
        isApproved: false,
        message: 'Error consultando estado de aprobacion',
        error: error.message
      };
    }
  }

  async _autoResolveClientRegistration(rows = [], user) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const targets = rows.filter((row) =>
      !row.client_registered_at &&
      (row.status === PRIVATE_PURCHASE_STATES.OFFER_SIGNED ||
        row.status === PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED)
    );

    for (const row of targets) {
      try {
        const approval = await this.checkClientApprovalStatus(row.client_snapshot || {}, row);
        if (approval?.isApproved) {
          const updated = await this.updateClientRegistration(row.id, approval.clientId, user);
          Object.assign(row, updated);
          continue;
        }

        if (row.status !== PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED) {
          await this.transitionState(
            row.id,
            PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED,
            user,
            'Cliente no registrado, solicitar registro'
          );
          row.status = PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED;
        }
      } catch (error) {
        logger.warn('[FLOW_PRIVADA][BE][CLIENT_SYNC][WARN]', {
          purchaseId: row.id,
          error: error.message
        });
      }
    }

    return rows;
  }

  _formatUserName(user) {
    return user?.fullname || user?.name || user?.email || 'Usuario';
  }

  _normalizeObservations(input) {
    if (Array.isArray(input)) {
      return input.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 3);
    }
    if (!input) return [];
    return String(input)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  _toSafeInt(value) {
    if (value === undefined || value === null) return null;
    const digits = String(value).trim().replace(/[^\d-]/g, '');
    if (digits === '') return null;
    const num = Number(digits);
    if (!Number.isFinite(num) || num > 2147483647 || num < -2147483648) {
      return null;
    }
    return num;
  }

  _getSnapshotSources(snapshot) {
    return [
      snapshot,
      snapshot?.client_data,
      snapshot?.client_request,
      snapshot?.client,
      snapshot?.data
    ];
  }

  _resolveSnapshotValue(snapshot, keys = []) {
    const sources = this._getSnapshotSources(snapshot);
    for (const key of keys) {
      for (const source of sources) {
        const value = source?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          return value;
        }
      }
    }
    return '';
  }

  async _getClientRequestData(clientRequestId) {
    if (!clientRequestId) return null;
    const { rows } = await db.query(
      `SELECT
          id,
          commercial_name,
          ruc_cedula,
          establishment_name,
          establishment_address,
          establishment_phone,
          shipping_contact_name,
          shipping_address,
          shipping_phone,
          shipping_delivery_hours
       FROM client_requests
       WHERE id = $1`,
      [clientRequestId]
    );
    return rows[0] || null;
  }

  async _attachClientRequestSnapshot(rows = []) {
    const list = Array.isArray(rows) ? rows : [rows];
    const ids = [];

    for (const row of list) {
      const snapshot = row?.client_snapshot || {};
      const clientRequestId =
        row?.client_request_id ||
        snapshot?.registered_client_id ||
        snapshot?.client_request_id ||
        null;
      const numericId = Number(clientRequestId);
      if (Number.isFinite(numericId)) {
        ids.push(numericId);
      }
    }

    if (!ids.length) return rows;

    const { rows: clientRows } = await db.query(
      `SELECT
          id,
          commercial_name,
          ruc_cedula,
          establishment_name,
          establishment_address,
          establishment_phone,
          shipping_contact_name,
          shipping_address,
          shipping_phone,
          shipping_delivery_hours
       FROM client_requests
       WHERE id = ANY($1::int[])`,
      [Array.from(new Set(ids))]
    );

    const clientMap = new Map(clientRows.map((row) => [row.id, row]));

    for (const row of list) {
      const snapshot = row?.client_snapshot || {};
      const clientRequestId =
        row?.client_request_id ||
        snapshot?.registered_client_id ||
        snapshot?.client_request_id ||
        null;
      const numericId = Number(clientRequestId);
      if (!Number.isFinite(numericId)) continue;
      const clientData = clientMap.get(numericId);
      if (!clientData) continue;
      row.client_snapshot = {
        ...snapshot,
        client_request: clientData
      };
    }

    return rows;
  }

  _extractClientRequestIdFromRow(row = {}) {
    const snapshot = row?.client_snapshot || {};
    const candidate =
      row?.client_request_id ||
      snapshot?.registered_client_id ||
      snapshot?.client_request_id ||
      snapshot?.client_request?.id ||
      null;
    const numeric = Number(candidate);
    return Number.isFinite(numeric) ? numeric : null;
  }

  _getChecklistActionByStatus(row = {}) {
    const status = String(row?.status || "");
    const isComodato = row?.offer_kind === "comodato";

    switch (status) {
      case PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE:
        return {
          action: "request_acp_availability",
          action_label: "Solicitar disponibilidad al ACP",
          requirements: ["client_data_complete", "equipment_defined"],
        };
      case PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED:
        return {
          action: "register_provider_response",
          action_label: "Registrar respuesta del proveedor",
          requirements: ["availability_email_sent", "provider_response_registered"],
        };
      case PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED:
        return {
          action: "send_offer",
          action_label: "Enviar oferta al cliente",
          requirements: isComodato
            ? ["provider_response_registered", "business_case_created"]
            : ["provider_response_registered"],
        };
      case PRIVATE_PURCHASE_STATES.OFFER_SENT:
      case PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE:
        return {
          action: "upload_signed_offer",
          action_label: "Subir oferta firmada del cliente",
          requirements: ["offer_uploaded", "signed_offer_uploaded"],
        };
      case PRIVATE_PURCHASE_STATES.OFFER_SIGNED:
        return {
          action: "request_client_registration",
          action_label: "Solicitar registro del cliente",
          requirements: ["signed_offer_uploaded"],
        };
      case PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED:
        return {
          action: "wait_client_registration",
          action_label: "Esperar aprobación del registro del cliente",
          requirements: ["client_registered"],
        };
      case PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED:
        return {
          action: "auto_inspection_creation",
          action_label: "Generación automática de inspección",
          requirements: ["client_registered", "inspection_requested", "inspection_window_defined"],
        };
      case PRIVATE_PURCHASE_STATES.INSPECTION_REQUESTED:
        return {
          action: "coordinate_inspection_then_upload_contract",
          action_label: "Coordinar inspección y subir contrato borrador",
          requirements: [
            "inspection_requested",
            "inspection_window_defined",
            "inspection_date_coordinated",
            "contract_draft_uploaded",
          ],
        };
      case PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE:
        return {
          action: "upload_client_signed_contract",
          action_label: "Subir contrato firmado por cliente",
          requirements: ["contract_draft_uploaded", "contract_client_signed_uploaded"],
        };
      case PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL:
        return {
          action: "manager_review",
          action_label: "Revisión de gerencia",
          requirements: [
            "client_registered",
            "inspection_act_uploaded",
            "lopdp_approved",
            "client_id_uploaded",
            "provider_response_registered",
            "offer_uploaded",
            "signed_offer_uploaded",
            "contract_draft_uploaded",
            "contract_client_signed_uploaded",
          ],
        };
      case PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED:
        return {
          action: "resubmit_to_manager",
          action_label: "Completar documentos y reenviar a gerencia",
          requirements: [
            "client_registered",
            "inspection_act_uploaded",
            "lopdp_approved",
            "client_id_uploaded",
            "provider_response_registered",
            "offer_uploaded",
            "signed_offer_uploaded",
            "contract_draft_uploaded",
            "contract_client_signed_uploaded",
          ],
        };
      case PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE:
        return {
          action: "request_delivery_dates",
          action_label: "Solicitar fechas de entrega",
          requirements: ["inspection_site_compliant", "equipment_arrived"],
        };
      case PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED:
        return {
          action: "submit_delivery_dates",
          action_label: "Registrar fechas de entrega",
          requirements: ["inspection_site_compliant", "equipment_arrived", "delivery_dates_submitted"],
        };
      default:
        return null;
    }
  }

  _isChecklistItemComplete(row = {}, clientRequest = {}, key = "") {
    const snapshot = row?.client_snapshot || {};
    switch (key) {
      case "client_data_complete": {
        const clientName =
          snapshot?.commercial_name ||
          snapshot?.name ||
          snapshot?.client_name ||
          "";
        return Boolean(String(clientName).trim());
      }
      case "equipment_defined":
        return Array.isArray(row?.equipment) && row.equipment.length > 0;
      case "availability_email_sent":
        return Boolean(row?.availability_email_sent_at);
      case "provider_response_registered":
        return Boolean(row?.provider_response_at);
      case "business_case_created":
        return Boolean(row?.business_case_id);
      case "offer_uploaded":
        return Boolean(row?.offer_document_id);
      case "signed_offer_uploaded":
        return Boolean(row?.offer_signed_document_id);
      case "client_registered":
        return Boolean(row?.client_registered_at || snapshot?.registered_client_id);
      case "inspection_requested":
        return Boolean(row?.inspection_request_id || row?.inspection_requested_at);
      case "inspection_act_uploaded":
        return Boolean(row?.inspection_acta_document_id);
      case "inspection_window_defined":
        return Boolean(row?.inspection_min_date && row?.inspection_max_date);
      case "inspection_date_coordinated":
        return Boolean(row?.inspection_scheduled_date);
      case "inspection_site_compliant":
        return Boolean(this._parseSiteInspectionState(row).ready_for_installation);
      case "lopdp_approved": {
        const lopdpStatus = String(clientRequest?.lopdp_consent_status || "").toLowerCase();
        return Boolean(
          lopdpStatus === "granted" ||
          clientRequest?.consent_record_file_id ||
          clientRequest?.consent_evidence_file_id ||
          row?.client_approved_at
        );
      }
      case "client_id_uploaded":
        return String(clientRequest?.client_sector || "").toLowerCase() === "publico"
          ? true
          : Boolean(clientRequest?.id_file_id || snapshot?.id_file_id);
      case "contract_draft_uploaded":
        return Boolean(row?.contract_document_id);
      case "contract_client_signed_uploaded":
        return Boolean(row?.contract_client_signed_document_id);
      case "equipment_arrived":
        return Boolean(row?.equipment_arrived_at);
      case "delivery_dates_submitted":
        return Boolean(row?.delivery_start_at && row?.delivery_end_at);
      default:
        return false;
    }
  }

  _buildChecklistState(row = {}, clientRequest = {}) {
    const actionDef = this._getChecklistActionByStatus(row);
    if (!actionDef) {
      return {
        action: null,
        action_label: null,
        requirements: [],
        pending: [],
        items: [],
      };
    }

    const requirements = Array.isArray(actionDef.requirements) ? actionDef.requirements : [];
    const items = requirements.map((key) => ({
      key,
      label: PRIVATE_CHECKLIST_ITEM_LABELS[key] || key,
      auto: true,
      checked: this._isChecklistItemComplete(row, clientRequest, key),
    }));
    const pending = items.filter((item) => !item.checked).map((item) => item.key);

    return {
      action: actionDef.action,
      action_label: actionDef.action_label,
      requirements,
      pending,
      items,
    };
  }

  async _attachChecklistState(rows = []) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (!list.length) return rows;

    const clientRequestIds = Array.from(
      new Set(
        list
          .map((row) => this._extractClientRequestIdFromRow(row))
          .filter((id) => Number.isFinite(id))
      )
    );

    const clientRequestMap = new Map();
    if (clientRequestIds.length > 0) {
      const { rows: clientRows } = await db.query(
        `SELECT
            id,
            operating_permit_status,
            operating_permit_file_id,
            id_file_id,
            consent_record_file_id,
            consent_evidence_file_id,
            lopdp_consent_status
         FROM client_requests
         WHERE id = ANY($1::int[])`,
        [clientRequestIds]
      );
      clientRows.forEach((item) => {
        clientRequestMap.set(item.id, item);
      });
    }

    for (const row of list) {
      const clientRequestId = this._extractClientRequestIdFromRow(row);
      const clientRequest = clientRequestId ? clientRequestMap.get(clientRequestId) || {} : {};
      row.checklist_state = this._buildChecklistState(row, clientRequest);
    }

    return rows;
  }

  async _generateDeliveryActNumber() {
    const { rows } = await db.query("SELECT nextval('private_purchase_delivery_act_seq') AS seq");
    const seq = rows[0]?.seq || 1;
    const year = new Date().getFullYear();
    return `${year}-SPI-${String(seq).padStart(4, '0')}`;
  }

  async _generateDeliveryActDocument({
    purchaseId,
    purchase,
    actaNumber,
    observations,
    dispatchItems,
    dispatchedBy,
    dispatchedAt,
    deliveredBy,
    deliveredAt,
    isDraft
  }) {
    const baseSnapshot = purchase?.client_snapshot || {};
    const clientRequestId =
      purchase?.client_request_id ||
      baseSnapshot?.registered_client_id ||
      baseSnapshot?.client_request_id ||
      null;
    const clientRequest = await this._getClientRequestData(clientRequestId);
    const clientSnapshot = clientRequest
      ? { ...baseSnapshot, client_request: clientRequest }
      : baseSnapshot;
    const clientName = this._resolveSnapshotValue(clientSnapshot, [
      'commercial_name',
      'legal_person_business_name',
      'client_name',
      'name'
    ]) || 'Cliente';
    const clientId = this._resolveSnapshotValue(clientSnapshot, [
      'ruc_cedula',
      'client_identifier',
      'ruc',
      'cedula',
      'identification'
    ]);
    const clientAddress = this._resolveSnapshotValue(clientSnapshot, [
      'address',
      'shipping_address',
      'establishment_address'
    ]);
    const clientPhone = this._resolveSnapshotValue(clientSnapshot, [
      'phone',
      'cellphone',
      'shipping_phone',
      'shipping_cellphone'
    ]);

    const deliveryDate =
      deliveredAt ||
      purchase?.delivery_start_at ||
      purchase?.delivery_end_at ||
      null;

    const pdfBuffer = await generateDeliveryActPdf({
      actaNumber,
      clientName,
      clientId,
      clientAddress,
      clientPhone,
      deliveryDate,
      dispatchItems,
      observations,
      dispatchedBy,
      dispatchedAt,
      deliveredBy,
      deliveredAt
    });

    const baseFolderId = await this._ensureDriveFolder(
      purchaseId,
      purchase?.client_snapshot,
      purchase?.drive_folder_id
    );
    const targetFolder = await ensureFolder('Acta de entrega', baseFolderId);
    const suffix = isDraft ? '-BORRADOR' : '';
    const fileName = `ACTA-ENTREGA-${actaNumber}${suffix}.pdf`;
    const base64 = pdfBuffer.toString('base64');
    const stored = await uploadBase64File(
      fileName,
      base64,
      'application/pdf',
      targetFolder?.id || baseFolderId
    );

    return {
      fileId: stored?.id || null,
      link: stored?.webViewLink || (stored?.id ? driveLink(stored.id) : null)
    };
  }

  _toDateOnly(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }

  _getSpanishMonthName(date) {
    const names = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ];
    return names[date.getUTCMonth()] || 'Enero';
  }

  async _schedulePreventiveMaintenance({ purchase, baseDate, scheduledBy }) {
    const equipmentList = Array.isArray(purchase?.equipment) ? purchase.equipment : [];
    if (!equipmentList.length) {
      logger.warn('[FLOW_PRIVADA][BE][MAINTENANCE] Sin equipos para programar mantenimientos', {
        purchaseId: purchase?.id
      });
      return { created: 0, skipped: equipmentList.length };
    }

    const base = baseDate instanceof Date ? baseDate : new Date(baseDate || Date.now());
    if (Number.isNaN(base.getTime())) {
      logger.warn('[FLOW_PRIVADA][BE][MAINTENANCE] Fecha base invalida para mantenimiento', {
        purchaseId: purchase?.id,
        baseDate
      });
      return { created: 0, skipped: equipmentList.length };
    }

    const sixMonths = new Date(base.getTime());
    sixMonths.setUTCMonth(sixMonths.getUTCMonth() + 6);
    const yearAhead = new Date(base.getTime());
    yearAhead.setUTCFullYear(yearAhead.getUTCFullYear() + 1);

    const sixMonthsDate = this._toDateOnly(sixMonths);
    const yearDate = this._toDateOnly(yearAhead);
    const yearMonthName = this._getSpanishMonthName(yearAhead);

    let created = 0;
    let skipped = 0;

    for (const item of equipmentList) {
      const equipmentId = Number(item?.id);
      if (!Number.isFinite(equipmentId)) {
        skipped += 1;
        logger.warn('[FLOW_PRIVADA][BE][MAINTENANCE] Equipo sin id valido, se omite', {
          purchaseId: purchase?.id,
          equipment: item
        });
        continue;
      }

      if (sixMonthsDate) {
        const { rows: existing } = await db.query(
          `SELECT id_mantenimiento
             FROM servicio.cronograma_mantenimientos
            WHERE id_equipo = $1
              AND fecha_programada = $2
              AND LOWER(tipo) = 'preventivo'
            LIMIT 1`,
          [equipmentId, sixMonthsDate]
        );

        if (existing.length === 0) {
          await db.query(
            `INSERT INTO servicio.cronograma_mantenimientos
             (id_equipo, tipo, responsable, fecha_programada, estado, observaciones, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              equipmentId,
              'Preventivo',
              scheduledBy?.name || scheduledBy?.email || 'Sin asignar',
              sixMonthsDate,
              'Pendiente',
              `Generado automaticamente por compra privada ${purchase?.id || ''}`.trim(),
              scheduledBy?.id || null
            ]
          );
          created += 1;
        } else {
          skipped += 1;
        }
      }

      if (yearDate) {
        const { rows: annualExisting } = await db.query(
          `SELECT id_mant_anual
             FROM servicio.cronograma_mantenimientos_anuales
            WHERE id_equipo = $1
              AND fecha_programada = $2
            LIMIT 1`,
          [equipmentId, yearDate]
        );

        if (annualExisting.length === 0) {
          await db.query(
            `INSERT INTO servicio.cronograma_mantenimientos_anuales
             (id_equipo, mes, responsable, fecha_programada, estado, comentarios)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              equipmentId,
              yearMonthName,
              scheduledBy?.name || scheduledBy?.email || 'Sin asignar',
              yearDate,
              'Pendiente',
              `Generado automaticamente por compra privada ${purchase?.id || ''}`.trim()
            ]
          );
          created += 1;
        } else {
          skipped += 1;
        }
      }
    }

    return { created, skipped };
  }

  async _getUsersByRole(role) {
    try {
      const { rows } = await db.query(
        'SELECT id, email, fullname FROM users WHERE role = $1 AND active = true',
        [role]
      );
      return rows;
    } catch (error) {
      logger.warn('[PRIVATE_PURCHASE] Error obteniendo usuarios por rol:', error.message);
      return [];
    }
  }

  // ----------------------------------------------------------
  // WORKFLOW ALIGNMENT — supply_control_type
  // ----------------------------------------------------------

  _deriveSupplyControlType(offerKind, hasCommercialDeliverables = false) {
    const kind = String(offerKind || '').trim().toLowerCase();
    if (kind === 'comodato') return 'bc_maximums';
    if (['venta', 'alquiler', 'alquiler_transferencia_dominio'].includes(kind)) {
      return hasCommercialDeliverables ? 'commercial_deliverables' : 'none';
    }
    return 'pending';
  }

  async setSupplyControlType(purchaseId, user, { controlType, hasCommercialDeliverables = false } = {}) {
    const { rows } = await db.query(
      `SELECT id, offer_kind, supply_control_type, status, created_by FROM private_purchase_requests WHERE id = $1 LIMIT 1`,
      [purchaseId]
    );
    if (!rows.length) {
      const err = new Error('Solicitud de compra privada no encontrada');
      err.status = 404;
      err.code = 'PRIVATE_PURCHASE_NOT_FOUND';
      throw err;
    }
    const row = rows[0];

    const derived = controlType
      ? String(controlType).trim()
      : this._deriveSupplyControlType(row.offer_kind, hasCommercialDeliverables);

    const allowed = ['bc_maximums', 'commercial_deliverables', 'none'];
    if (!allowed.includes(derived)) {
      const err = new Error(`supply_control_type inválido: ${derived}. Valores: ${allowed.join(', ')}`);
      err.status = 400;
      err.code = 'INVALID_SUPPLY_CONTROL_TYPE';
      throw err;
    }

    const { rows: updated } = await db.query(
      `UPDATE private_purchase_requests
          SET supply_control_type = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, offer_kind, supply_control_type, status`,
      [derived, purchaseId]
    );

    try {
      await notificationManager.sendNotification({
        userId: row.created_by,
        customTitle: 'Control de insumos activado',
        customMessage: `La solicitud quedó en modo "${derived === 'bc_maximums' ? 'Máximos del BC' : derived === 'commercial_deliverables' ? 'Entregables comerciales' : 'Sin control de insumos'}".`,
        type: 'info',
        source: 'private_purchase_supply_control',
        priority: 1,
        data: { purchase_id: purchaseId, supply_control_type: derived },
        email: true,
        chat: false,
      });
    } catch (notifyErr) {
      logger.warn({ notifyErr, purchaseId }, '[PRIVATE_PURCHASE] No se pudo notificar activación de control de insumos');
    }

    return updated[0];
  }

  // ----------------------------------------------------------
  // WORKFLOW ALIGNMENT — serial_status
  // ----------------------------------------------------------

  async registerSerial(purchaseId, user, { serialNumber, unitId = null } = {}) {
    const { rows } = await db.query(
      `SELECT id, serial_status, status, created_by, client_snapshot, equipment FROM private_purchase_requests WHERE id = $1 LIMIT 1`,
      [purchaseId]
    );
    if (!rows.length) {
      const err = new Error('Solicitud de compra privada no encontrada');
      err.status = 404;
      err.code = 'PRIVATE_PURCHASE_NOT_FOUND';
      throw err;
    }
    const row = rows[0];

    if (row.serial_status !== 'received_pending_serial') {
      const err = new Error(
        `El serial solo se registra cuando el equipo ha sido recibido físicamente. Estado actual: ${row.serial_status || 'not_applicable_yet'}`
      );
      err.status = 409;
      err.code = 'SERIAL_NOT_ALLOWED_YET';
      err.details = {
        current_serial_status: row.serial_status || 'not_applicable_yet',
        required_serial_status: 'received_pending_serial',
        hint: 'Primero registra la llegada física del equipo (mark-equipment-arrived).',
      };
      throw err;
    }

    if (!serialNumber || !String(serialNumber).trim()) {
      const err = new Error('El número de serie es obligatorio');
      err.status = 400;
      err.code = 'SERIAL_NUMBER_REQUIRED';
      throw err;
    }

    const { rows: updated } = await db.query(
      `UPDATE private_purchase_requests
          SET serial_status = 'serial_registered',
              extra = COALESCE(extra, '{}'::jsonb) || jsonb_build_object(
                'serial_number', $1::text,
                'serial_registered_at', NOW()::text,
                'serial_registered_by', $2::integer,
                'unit_id', $3::text
              ),
              updated_at = NOW()
        WHERE id = $4
        RETURNING id, serial_status, extra, status`,
      [
        String(serialNumber).trim(),
        user?.id || null,
        unitId ? String(unitId) : null,
        purchaseId,
      ]
    );

    try {
      await notificationManager.sendNotification({
        userId: row.created_by,
        customTitle: 'Número de serie registrado',
        customMessage: `Serie ${serialNumber} registrada para la solicitud de compra privada.`,
        type: 'success',
        source: 'private_purchase_serial',
        priority: 1,
        data: { purchase_id: purchaseId, serial_number: serialNumber },
        email: true,
        chat: false,
      });
    } catch (notifyErr) {
      logger.warn({ notifyErr, purchaseId }, '[PRIVATE_PURCHASE] No se pudo notificar registro de serial');
    }

    return updated[0];
  }

  // ----------------------------------------------------------
  // WORKFLOW ALIGNMENT — notificación supply bloqueado
  // ----------------------------------------------------------

  async notifySupplyBlocked(purchaseId, { itemName, maxQuantity, sentQty, requestedBy } = {}) {
    try {
      const { rows } = await db.query(
        `SELECT created_by FROM private_purchase_requests WHERE id = $1 LIMIT 1`,
        [purchaseId]
      );
      const userIds = [rows[0]?.created_by, requestedBy].filter(Boolean);
      await Promise.all(userIds.map((userId) =>
        notificationManager.sendNotification({
          userId,
          customTitle: 'Solicitud de insumo bloqueada',
          customMessage: `No se puede solicitar "${itemName}": saldo agotado. Máximo: ${maxQuantity}, Enviado: ${sentQty}.`,
          type: 'warning',
          source: 'private_purchase_supply_blocked',
          priority: 2,
          data: { purchase_id: purchaseId, item_name: itemName, max_quantity: maxQuantity, sent_qty: sentQty },
          email: true,
          chat: true,
        })
      ));
    } catch (err) {
      logger.warn({ err, purchaseId }, '[PRIVATE_PURCHASE] No se pudo notificar bloqueo de insumo');
    }
  }

}

module.exports = new PrivatePurchasesService();
