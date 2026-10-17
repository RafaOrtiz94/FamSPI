const DEFAULT_VISUAL_CHECKLIST = Object.freeze({
  guide_vs_proforma: "",
  packaging_integrity: "",
  tilt_indicator: "",
  handling_indicator: "",
  serial_match: "",
  accessories_match: "",
});

const DEFAULT_INSTALLATION_WORKFLOW = Object.freeze({
  dispatch_request: {
    requested_at: null,
    requested_by: null,
    requested_by_email: null,
    required_date: null,
    requires_notice: false,
    lead_time_days: null,
    client_name: null,
    client_address: null,
    contact_name: null,
    contact_phone: null,
    notes: null,
    items: [],
  },
  logistics_validation: {
    status: "pending",
    guide_reference: null,
    proforma_reference: null,
    notes: null,
    validated_at: null,
    validated_by: null,
    validated_by_email: null,
  },
  visual_reception: {
    status: "pending",
    result: null,
    checklist: { ...DEFAULT_VISUAL_CHECKLIST },
    findings: null,
    corrective_actions: null,
    logistics_chain_notes: null,
    photos: [],
    report_file_id: null,
    report_link: null,
    report_generated_at: null,
    inspected_at: null,
    inspected_by: null,
    inspected_by_email: null,
  },
  verification_decision: {
    applies: null,
    source_type: null,
    source_reference: null,
    justification: null,
    decided_at: null,
    decided_by: null,
    decided_by_email: null,
    approved_at: null,
    approved_by: null,
    approved_by_email: null,
  },
  verification_cycle: {
    status: "pending_decision",
    attempts: [],
    remediation: {
      required: false,
      opened_at: null,
      opened_by: null,
      opened_by_email: null,
      notes: null,
      reviewed_at: null,
      reviewed_by: null,
      reviewed_by_email: null,
      review_notes: null,
    },
  },
  cu_flow: {
    is_cu: false,
    requires_parts_request: false,
    parts_request_status: "not_required",
    parts_request_notes: null,
    provider_repair_report_required: false,
    provider_repair_report_file_id: null,
    provider_repair_report_link: null,
    provider_repair_report_uploaded_at: null,
  },
  delivery_act: {
    final_file_id: null,
    final_link: null,
    generated_at: null,
    legal_internal_copy_file_id: null,
    legal_internal_copy_link: null,
    legal_client_copy_file_id: null,
    legal_client_copy_link: null,
    legalized_at: null,
    legalized_by: null,
    legalized_by_email: null,
  },
  closure_gate: {
    can_close: false,
    blocked_reasons: [],
    evaluated_at: null,
  },
});

const VISUAL_CHECKLIST_VALUE_MAP = new Set(["OK", "ISSUE", "NA"]);
const LOGISTICS_VALIDATION_STATES = new Set(["pending", "validated", "rejected"]);
const CU_PARTS_STATES = new Set(["not_required", "pending", "requested", "received"]);

const toObject = (value, fallback = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return fallback;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "yes", "si", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return Boolean(fallback);
};

const normalizeDateOnlyInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const es = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (es) {
    const [, dd, mm, yyyy] = es;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const daysBetweenTodayAnd = (dateOnlyValue) => {
  const normalized = normalizeDateOnlyInput(dateOnlyValue);
  if (!normalized) return null;
  const target = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
};

const cloneDefaultWorkflow = () => JSON.parse(JSON.stringify(DEFAULT_INSTALLATION_WORKFLOW));

const normalizeVisualChecklistValue = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (VISUAL_CHECKLIST_VALUE_MAP.has(normalized)) return normalized;
  return "";
};

const normalizeVisualReceptionChecklist = (input = {}) => {
  const source = toObject(input, {});
  const checklist = {};
  const pending = [];
  Object.keys(DEFAULT_VISUAL_CHECKLIST).forEach((key) => {
    const value = normalizeVisualChecklistValue(source[key]);
    checklist[key] = value;
    if (!value) pending.push(key);
  });
  return { checklist, pending };
};

const detectCuEquipment = (equipment = []) =>
  toArray(equipment).some((item) => {
    const type = String(
      item?.type ||
        item?.available_type ||
        item?.estado ||
        item?.equipment_type ||
        item?.equipmentType ||
        "",
    )
      .trim()
      .toLowerCase();
    return type === "cu";
  });

const deriveEquipmentContext = (equipment = []) => {
  const list = toArray(equipment)
    .map((item) => toObject(item, {}))
    .map((item) => ({
      equipment_name:
        normalizeText(item.equipment_name) ||
        normalizeText(item.name) ||
        normalizeText(item.label) ||
        normalizeText(item.sku) ||
        "Equipo",
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
      serial: normalizeText(item.serial),
      product_code: normalizeText(item.product_code) || normalizeText(item.code),
      equipment_type: normalizeText(item.type) || normalizeText(item.available_type),
    }));
  return {
    is_cu: detectCuEquipment(equipment),
    items: list,
  };
};

const normalizeVerificationStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["pending_decision", "pending_verification", "passed", "failed", "remediation_pending", "not_required"].includes(normalized)) {
    return normalized;
  }
  return "pending_decision";
};

const normalizeInstallationWorkflowState = (rawValue = {}, { equipment = [] } = {}) => {
  const source = toObject(rawValue, {});
  const defaults = cloneDefaultWorkflow();
  const equipmentContext = deriveEquipmentContext(equipment);

  const dispatch = toObject(source.dispatch_request, {});
  const logistics = toObject(source.logistics_validation, {});
  const visual = toObject(source.visual_reception, {});
  const verificationDecision = toObject(source.verification_decision, {});
  const verificationCycle = toObject(source.verification_cycle, {});
  const remediation = toObject(verificationCycle.remediation, {});
  const cuFlow = toObject(source.cu_flow, {});
  const deliveryAct = toObject(source.delivery_act, {});
  const closureGate = toObject(source.closure_gate, {});

  const normalizedChecklist = normalizeVisualReceptionChecklist(visual.checklist || {}).checklist;
  const normalizedAttempts = toArray(verificationCycle.attempts)
    .map((attempt) => toObject(attempt, {}))
    .map((attempt, index) => ({
      attempt_number: Number.isFinite(Number(attempt.attempt_number))
        ? Number(attempt.attempt_number)
        : index + 1,
      result: String(attempt.result || "").trim().toLowerCase() === "failed" ? "failed" : "passed",
      criteria_reference: normalizeText(attempt.criteria_reference),
      analysis: normalizeText(attempt.analysis),
      notes: normalizeText(attempt.notes),
      generated_at: attempt.generated_at || null,
      generated_by: Number.isFinite(Number(attempt.generated_by)) ? Number(attempt.generated_by) : null,
      generated_by_email: normalizeText(attempt.generated_by_email),
      document_file_id: normalizeText(attempt.document_file_id),
      document_link: normalizeText(attempt.document_link),
      request_id: Number.isFinite(Number(attempt.request_id)) ? Number(attempt.request_id) : null,
    }));

  const normalized = {
    ...defaults,
    dispatch_request: {
      ...defaults.dispatch_request,
      requested_at: dispatch.requested_at || null,
      requested_by: Number.isFinite(Number(dispatch.requested_by)) ? Number(dispatch.requested_by) : null,
      requested_by_email: normalizeText(dispatch.requested_by_email),
      required_date: normalizeDateOnlyInput(dispatch.required_date),
      requires_notice: normalizeBoolean(dispatch.requires_notice, false),
      lead_time_days: Number.isFinite(Number(dispatch.lead_time_days)) ? Number(dispatch.lead_time_days) : null,
      client_name: normalizeText(dispatch.client_name),
      client_address: normalizeText(dispatch.client_address),
      contact_name: normalizeText(dispatch.contact_name),
      contact_phone: normalizeText(dispatch.contact_phone),
      notes: normalizeText(dispatch.notes),
      items: toArray(dispatch.items).map((item) => ({
        equipment_name: normalizeText(item?.equipment_name) || "Equipo",
        quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 1,
        serial: normalizeText(item?.serial),
        product_code: normalizeText(item?.product_code),
        equipment_type: normalizeText(item?.equipment_type),
      })),
    },
    logistics_validation: {
      ...defaults.logistics_validation,
      status: LOGISTICS_VALIDATION_STATES.has(String(logistics.status || "").trim().toLowerCase())
        ? String(logistics.status || "").trim().toLowerCase()
        : "pending",
      guide_reference: normalizeText(logistics.guide_reference),
      proforma_reference: normalizeText(logistics.proforma_reference),
      notes: normalizeText(logistics.notes),
      validated_at: logistics.validated_at || null,
      validated_by: Number.isFinite(Number(logistics.validated_by)) ? Number(logistics.validated_by) : null,
      validated_by_email: normalizeText(logistics.validated_by_email),
    },
    visual_reception: {
      ...defaults.visual_reception,
      status: String(visual.status || "").trim().toLowerCase() === "completed" ? "completed" : "pending",
      result: ["pass", "failed"].includes(String(visual.result || "").trim().toLowerCase())
        ? String(visual.result || "").trim().toLowerCase()
        : null,
      checklist: normalizedChecklist,
      findings: normalizeText(visual.findings),
      corrective_actions: normalizeText(visual.corrective_actions),
      logistics_chain_notes: normalizeText(visual.logistics_chain_notes),
      photos: toArray(visual.photos).map((photo) => ({
        file_id: normalizeText(photo?.file_id || photo?.id),
        link: normalizeText(photo?.link),
      })),
      report_file_id: normalizeText(visual.report_file_id),
      report_link: normalizeText(visual.report_link),
      report_generated_at: visual.report_generated_at || null,
      inspected_at: visual.inspected_at || null,
      inspected_by: Number.isFinite(Number(visual.inspected_by)) ? Number(visual.inspected_by) : null,
      inspected_by_email: normalizeText(visual.inspected_by_email),
    },
    verification_decision: {
      ...defaults.verification_decision,
      applies:
        typeof verificationDecision.applies === "boolean"
          ? verificationDecision.applies
          : null,
      source_type: normalizeText(verificationDecision.source_type),
      source_reference: normalizeText(verificationDecision.source_reference),
      justification: normalizeText(verificationDecision.justification),
      decided_at: verificationDecision.decided_at || null,
      decided_by: Number.isFinite(Number(verificationDecision.decided_by))
        ? Number(verificationDecision.decided_by)
        : null,
      decided_by_email: normalizeText(verificationDecision.decided_by_email),
      approved_at: verificationDecision.approved_at || null,
      approved_by: Number.isFinite(Number(verificationDecision.approved_by))
        ? Number(verificationDecision.approved_by)
        : null,
      approved_by_email: normalizeText(verificationDecision.approved_by_email),
    },
    verification_cycle: {
      ...defaults.verification_cycle,
      status: normalizeVerificationStatus(verificationCycle.status),
      attempts: normalizedAttempts.slice(-15),
      remediation: {
        ...defaults.verification_cycle.remediation,
        required: normalizeBoolean(remediation.required, false),
        opened_at: remediation.opened_at || null,
        opened_by: Number.isFinite(Number(remediation.opened_by)) ? Number(remediation.opened_by) : null,
        opened_by_email: normalizeText(remediation.opened_by_email),
        notes: normalizeText(remediation.notes),
        reviewed_at: remediation.reviewed_at || null,
        reviewed_by: Number.isFinite(Number(remediation.reviewed_by))
          ? Number(remediation.reviewed_by)
          : null,
        reviewed_by_email: normalizeText(remediation.reviewed_by_email),
        review_notes: normalizeText(remediation.review_notes),
      },
    },
    cu_flow: {
      ...defaults.cu_flow,
      is_cu:
        typeof cuFlow.is_cu === "boolean"
          ? cuFlow.is_cu
          : equipmentContext.is_cu,
      requires_parts_request: normalizeBoolean(cuFlow.requires_parts_request, false),
      parts_request_status: CU_PARTS_STATES.has(String(cuFlow.parts_request_status || "").trim().toLowerCase())
        ? String(cuFlow.parts_request_status || "").trim().toLowerCase()
        : defaults.cu_flow.parts_request_status,
      parts_request_notes: normalizeText(cuFlow.parts_request_notes),
      provider_repair_report_required: normalizeBoolean(cuFlow.provider_repair_report_required, false),
      provider_repair_report_file_id: normalizeText(cuFlow.provider_repair_report_file_id),
      provider_repair_report_link: normalizeText(cuFlow.provider_repair_report_link),
      provider_repair_report_uploaded_at: cuFlow.provider_repair_report_uploaded_at || null,
    },
    delivery_act: {
      ...defaults.delivery_act,
      final_file_id: normalizeText(deliveryAct.final_file_id),
      final_link: normalizeText(deliveryAct.final_link),
      generated_at: deliveryAct.generated_at || null,
      legal_internal_copy_file_id: normalizeText(deliveryAct.legal_internal_copy_file_id),
      legal_internal_copy_link: normalizeText(deliveryAct.legal_internal_copy_link),
      legal_client_copy_file_id: normalizeText(deliveryAct.legal_client_copy_file_id),
      legal_client_copy_link: normalizeText(deliveryAct.legal_client_copy_link),
      legalized_at: deliveryAct.legalized_at || null,
      legalized_by: Number.isFinite(Number(deliveryAct.legalized_by)) ? Number(deliveryAct.legalized_by) : null,
      legalized_by_email: normalizeText(deliveryAct.legalized_by_email),
    },
    closure_gate: {
      ...defaults.closure_gate,
      can_close: normalizeBoolean(closureGate.can_close, false),
      blocked_reasons: Array.isArray(closureGate.blocked_reasons)
        ? closureGate.blocked_reasons.filter(Boolean).map((reason) => String(reason))
        : [],
      evaluated_at: closureGate.evaluated_at || null,
    },
  };

  if (!normalized.dispatch_request.items.length && equipmentContext.items.length) {
    normalized.dispatch_request.items = equipmentContext.items;
  }

  if (!normalized.cu_flow.is_cu && equipmentContext.is_cu) {
    normalized.cu_flow.is_cu = true;
  }
  if (!normalized.cu_flow.is_cu) {
    normalized.cu_flow.requires_parts_request = false;
    normalized.cu_flow.parts_request_status = "not_required";
    normalized.cu_flow.provider_repair_report_required = false;
    normalized.cu_flow.provider_repair_report_file_id = null;
    normalized.cu_flow.provider_repair_report_link = null;
    normalized.cu_flow.provider_repair_report_uploaded_at = null;
  }

  return normalized;
};

const createInstallationWorkflowError = (message, { status = 400, code = "INSTALLATION_WORKFLOW_ERROR", details = null } = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details && typeof details === "object") error.details = details;
  return error;
};

const buildDispatchRequestPatch = ({
  workflow,
  payload = {},
  user = null,
  defaults = {},
}) => {
  const current = normalizeInstallationWorkflowState(workflow || {});
  const requiredDate = normalizeDateOnlyInput(payload.required_date || payload.requiredDate);
  const requiresNotice = normalizeBoolean(
    payload.requires_notice ?? payload.requiresNotice ?? payload.notice_required,
    current.dispatch_request.requires_notice,
  );
  const leadTimeDays = daysBetweenTodayAnd(requiredDate);
  const clientName = normalizeText(payload.client_name) || normalizeText(defaults.client_name);
  const clientAddress = normalizeText(payload.client_address) || normalizeText(defaults.client_address);
  const contactName = normalizeText(payload.contact_name) || normalizeText(defaults.contact_name);
  const contactPhone = normalizeText(payload.contact_phone) || normalizeText(defaults.contact_phone);
  const notes = normalizeText(payload.notes);
  const sourceItems = Array.isArray(payload.items) ? payload.items : current.dispatch_request.items;
  const items = sourceItems
    .map((item) => toObject(item, {}))
    .map((item) => ({
      equipment_name: normalizeText(item.equipment_name) || normalizeText(item.name) || "Equipo",
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
      serial: normalizeText(item.serial),
      product_code: normalizeText(item.product_code),
      equipment_type: normalizeText(item.equipment_type),
    }));

  if (!requiredDate) {
    throw createInstallationWorkflowError("Debe registrar la fecha requerida de despacho", {
      status: 400,
      code: "DISPATCH_REQUIRED_DATE_MISSING",
    });
  }
  if (!clientName || !clientAddress) {
    throw createInstallationWorkflowError("Debe registrar cliente y direccion en la solicitud de despacho", {
      status: 400,
      code: "DISPATCH_CLIENT_DATA_MISSING",
    });
  }
  if (!items.length) {
    throw createInstallationWorkflowError("Debe registrar al menos un item en la solicitud de despacho", {
      status: 400,
      code: "DISPATCH_ITEMS_REQUIRED",
    });
  }
  if (requiresNotice && (!Number.isFinite(leadTimeDays) || leadTimeDays < 15)) {
    throw createInstallationWorkflowError(
      "La solicitud de despacho requiere al menos 15 dias de anticipacion",
      {
        status: 409,
        code: "DISPATCH_LEAD_TIME_INVALID",
        details: { required_days: 15, lead_time_days: Number.isFinite(leadTimeDays) ? leadTimeDays : null },
      },
    );
  }

  return {
    ...current,
    dispatch_request: {
      ...current.dispatch_request,
      requested_at: new Date().toISOString(),
      requested_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      requested_by_email: normalizeText(user?.email),
      required_date: requiredDate,
      requires_notice: requiresNotice,
      lead_time_days: Number.isFinite(leadTimeDays) ? leadTimeDays : null,
      client_name: clientName,
      client_address: clientAddress,
      contact_name: contactName,
      contact_phone: contactPhone,
      notes,
      items,
    },
  };
};

const buildLogisticsValidationPatch = ({ workflow, payload = {}, user = null }) => {
  const current = normalizeInstallationWorkflowState(workflow || {});
  const status = String(payload.status || "").trim().toLowerCase();
  const normalizedStatus = LOGISTICS_VALIDATION_STATES.has(status)
    ? status
    : normalizeBoolean(payload.validated, false)
      ? "validated"
      : "pending";
  const guideReference = normalizeText(payload.guide_reference || payload.guideReference);
  const proformaReference = normalizeText(payload.proforma_reference || payload.proformaReference);
  const notes = normalizeText(payload.notes);

  if (normalizedStatus === "validated" && (!guideReference || !proformaReference)) {
    throw createInstallationWorkflowError(
      "Para validar logistica debe registrar guia y referencia de proforma",
      {
        status: 400,
        code: "LOGISTICS_VALIDATION_DATA_MISSING",
      },
    );
  }

  return {
    ...current,
    logistics_validation: {
      ...current.logistics_validation,
      status: normalizedStatus,
      guide_reference: guideReference || current.logistics_validation.guide_reference,
      proforma_reference: proformaReference || current.logistics_validation.proforma_reference,
      notes,
      validated_at: normalizedStatus === "pending" ? null : new Date().toISOString(),
      validated_by:
        normalizedStatus === "pending"
          ? null
          : Number.isFinite(Number(user?.id))
            ? Number(user.id)
            : null,
      validated_by_email: normalizedStatus === "pending" ? null : normalizeText(user?.email),
    },
  };
};

const buildVerificationDecisionPatch = ({ workflow, payload = {}, user = null }) => {
  const current = normalizeInstallationWorkflowState(workflow || {});
  if (typeof payload.applies !== "boolean") {
    throw createInstallationWorkflowError("Debe indicar si aplica o no la verificacion tecnica", {
      status: 400,
      code: "VERIFICATION_DECISION_REQUIRED",
    });
  }

  const applies = payload.applies;
  const sourceType = normalizeText(payload.source_type || payload.sourceType);
  const sourceReference = normalizeText(payload.source_reference || payload.sourceReference);
  const justification = normalizeText(payload.justification);

  if (applies && !sourceReference) {
    throw createInstallationWorkflowError(
      "Si aplica verificacion debe registrar la fuente tecnica (guia fabricante o portal proveedor)",
      {
        status: 400,
        code: "VERIFICATION_SOURCE_REQUIRED",
      },
    );
  }

  if (!applies && !justification) {
    throw createInstallationWorkflowError(
      "Si no aplica verificacion debe registrar una justificacion formal",
      {
        status: 400,
        code: "VERIFICATION_EXCEPTION_JUSTIFICATION_REQUIRED",
      },
    );
  }

  const now = new Date().toISOString();
  return {
    ...current,
    verification_decision: {
      ...current.verification_decision,
      applies,
      source_type: sourceType,
      source_reference: sourceReference,
      justification,
      decided_at: now,
      decided_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      decided_by_email: normalizeText(user?.email),
      approved_at: applies ? null : now,
      approved_by: applies ? null : Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      approved_by_email: applies ? null : normalizeText(user?.email),
    },
    verification_cycle: {
      ...current.verification_cycle,
      status: applies ? "pending_verification" : "not_required",
      remediation: applies
        ? current.verification_cycle.remediation
        : {
            ...current.verification_cycle.remediation,
            required: false,
            opened_at: null,
            opened_by: null,
            opened_by_email: null,
            notes: null,
            reviewed_at: null,
            reviewed_by: null,
            reviewed_by_email: null,
            review_notes: null,
          },
    },
  };
};

const buildVerificationRemediationPatch = ({ workflow, payload = {}, user = null }) => {
  const current = normalizeInstallationWorkflowState(workflow || {});
  const reviewNotes = normalizeText(payload.review_notes || payload.reviewNotes || payload.notes);
  if (!reviewNotes) {
    throw createInstallationWorkflowError("Debe registrar notas de revision para cerrar la remediacion", {
      status: 400,
      code: "VERIFICATION_REMEDIATION_REVIEW_NOTES_REQUIRED",
    });
  }

  return {
    ...current,
    verification_cycle: {
      ...current.verification_cycle,
      status: "pending_verification",
      remediation: {
        ...current.verification_cycle.remediation,
        required: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
        reviewed_by_email: normalizeText(user?.email),
        review_notes: reviewNotes,
      },
    },
  };
};

const buildCuProviderReportPatch = ({ workflow, payload = {}, user = null }) => {
  const current = normalizeInstallationWorkflowState(workflow || {});
  const reportFileId = normalizeText(payload.provider_repair_report_file_id || payload.file_id);
  const reportLink = normalizeText(payload.provider_repair_report_link || payload.link);
  const partsStatus = String(payload.parts_request_status || "").trim().toLowerCase();
  const requiresPartsRequest = normalizeBoolean(
    payload.requires_parts_request,
    current.cu_flow.requires_parts_request,
  );
  const providerReportRequired = normalizeBoolean(
    payload.provider_repair_report_required,
    current.cu_flow.provider_repair_report_required,
  );
  const partsRequestNotes = normalizeText(payload.parts_request_notes || payload.notes);

  if (current.cu_flow.is_cu && providerReportRequired && !reportFileId && !reportLink) {
    throw createInstallationWorkflowError("Debe adjuntar reporte de reparacion del proveedor para equipos CU", {
      status: 400,
      code: "CU_PROVIDER_REPAIR_REPORT_REQUIRED",
    });
  }

  return {
    ...current,
    cu_flow: {
      ...current.cu_flow,
      requires_parts_request: current.cu_flow.is_cu ? requiresPartsRequest : false,
      parts_request_status:
        current.cu_flow.is_cu && CU_PARTS_STATES.has(partsStatus)
          ? partsStatus
          : current.cu_flow.is_cu
            ? current.cu_flow.parts_request_status
            : "not_required",
      parts_request_notes: current.cu_flow.is_cu ? partsRequestNotes : null,
      provider_repair_report_required: current.cu_flow.is_cu ? providerReportRequired : false,
      provider_repair_report_file_id: current.cu_flow.is_cu
        ? reportFileId || current.cu_flow.provider_repair_report_file_id
        : null,
      provider_repair_report_link: current.cu_flow.is_cu
        ? reportLink || current.cu_flow.provider_repair_report_link
        : null,
      provider_repair_report_uploaded_at:
        current.cu_flow.is_cu && (reportFileId || reportLink) ? new Date().toISOString() : current.cu_flow.provider_repair_report_uploaded_at,
    },
    verification_cycle: {
      ...current.verification_cycle,
      remediation: {
        ...current.verification_cycle.remediation,
        reviewed_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : current.verification_cycle.remediation.reviewed_by,
        reviewed_by_email: normalizeText(user?.email) || current.verification_cycle.remediation.reviewed_by_email,
      },
    },
  };
};

const buildVisualReceptionPatch = ({
  workflow,
  payload = {},
  user = null,
  report = {},
}) => {
  const current = normalizeInstallationWorkflowState(workflow || {});
  const result = String(payload.result || "").trim().toLowerCase();
  const normalizedResult = result === "failed" ? "failed" : result === "pass" ? "pass" : null;
  const { checklist, pending } = normalizeVisualReceptionChecklist(payload.checklist || {});
  if (!normalizedResult) {
    throw createInstallationWorkflowError("Debe registrar el resultado de la recepcion visual F.ST-14", {
      status: 400,
      code: "FST14_RESULT_REQUIRED",
    });
  }
  if (pending.length) {
    throw createInstallationWorkflowError("Checklist de recepcion visual incompleto", {
      status: 400,
      code: "FST14_CHECKLIST_INCOMPLETE",
      details: { pending },
    });
  }

  const correctiveActions = normalizeText(payload.corrective_actions || payload.correctiveActions);
  if (normalizedResult === "failed" && !correctiveActions) {
    throw createInstallationWorkflowError(
      "Cuando F.ST-14 falla debe registrar acciones correctivas",
      {
        status: 400,
        code: "FST14_CORRECTIVE_ACTIONS_REQUIRED",
      },
    );
  }

  const photos = toArray(payload.photos)
    .map((photo) => toObject(photo, {}))
    .map((photo) => ({
      file_id: normalizeText(photo.file_id || photo.id),
      link: normalizeText(photo.link),
    }))
    .filter((photo) => photo.file_id || photo.link);

  return {
    ...current,
    visual_reception: {
      ...current.visual_reception,
      status: "completed",
      result: normalizedResult,
      checklist,
      findings: normalizeText(payload.findings),
      corrective_actions: correctiveActions,
      logistics_chain_notes: normalizeText(payload.logistics_chain_notes || payload.logisticsChainNotes),
      photos,
      report_file_id: normalizeText(report.file_id) || current.visual_reception.report_file_id,
      report_link: normalizeText(report.link) || current.visual_reception.report_link,
      report_generated_at: report.generated_at || current.visual_reception.report_generated_at,
      inspected_at: new Date().toISOString(),
      inspected_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      inspected_by_email: normalizeText(user?.email),
    },
  };
};

const appendVerificationAttempt = ({
  workflow,
  payload = {},
  user = null,
  document = {},
}) => {
  const current = normalizeInstallationWorkflowState(workflow || {});
  if (current.verification_decision.applies !== true) {
    throw createInstallationWorkflowError(
      "No se puede registrar F.ST-09 sin decision tecnica de verificacion aplicable",
      {
        status: 409,
        code: "VERIFICATION_NOT_ENABLED",
      },
    );
  }

  const resultRaw = String(payload.result || payload.verification_result || "").trim().toLowerCase();
  const result = resultRaw === "failed" ? "failed" : resultRaw === "passed" ? "passed" : null;
  if (!result) {
    throw createInstallationWorkflowError("Debe indicar el resultado de la verificacion F.ST-09", {
      status: 400,
      code: "VERIFICATION_RESULT_REQUIRED",
    });
  }
  const criteriaReference = normalizeText(payload.criteria_reference || payload.criteriaReference);
  if (!criteriaReference) {
    throw createInstallationWorkflowError("Debe registrar el criterio tecnico de verificacion utilizado", {
      status: 400,
      code: "VERIFICATION_CRITERIA_REQUIRED",
    });
  }

  const now = new Date().toISOString();
  const currentAttempts = toArray(current.verification_cycle.attempts);
  const attemptNumber = currentAttempts.length + 1;
  const nextAttempt = {
    attempt_number: attemptNumber,
    result,
    criteria_reference: criteriaReference,
    analysis: normalizeText(payload.analysis || payload.ANALISIS || payload["ANÁLISIS"]),
    notes: normalizeText(payload.notes || payload.remediation_notes),
    generated_at: now,
    generated_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
    generated_by_email: normalizeText(user?.email),
    document_file_id: normalizeText(document.file_id),
    document_link: normalizeText(document.link),
    request_id: Number.isFinite(Number(payload.request_id)) ? Number(payload.request_id) : null,
  };

  const remediationNotes = normalizeText(payload.remediation_review_notes || payload.remediation_notes);
  const nextRemediation =
    result === "failed"
      ? {
          ...current.verification_cycle.remediation,
          required: true,
          opened_at: now,
          opened_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
          opened_by_email: normalizeText(user?.email),
          notes: remediationNotes || current.verification_cycle.remediation.notes,
          reviewed_at: null,
          reviewed_by: null,
          reviewed_by_email: null,
          review_notes: null,
        }
      : {
          ...current.verification_cycle.remediation,
          required: false,
          reviewed_at: remediationNotes ? now : current.verification_cycle.remediation.reviewed_at,
          reviewed_by:
            remediationNotes && Number.isFinite(Number(user?.id))
              ? Number(user.id)
              : current.verification_cycle.remediation.reviewed_by,
          reviewed_by_email:
            remediationNotes
              ? normalizeText(user?.email)
              : current.verification_cycle.remediation.reviewed_by_email,
          review_notes: remediationNotes || current.verification_cycle.remediation.review_notes,
        };

  return {
    ...current,
    verification_cycle: {
      ...current.verification_cycle,
      status: result === "passed" ? "passed" : "remediation_pending",
      attempts: [...currentAttempts, nextAttempt].slice(-15),
      remediation: nextRemediation,
    },
  };
};

const computeInstallationClosureGate = ({
  workflow,
  siteReady = true,
  requiresSiteInspection = true,
} = {}) => {
  const normalized = normalizeInstallationWorkflowState(workflow || {});
  const reasons = [];

  if (!normalized.dispatch_request.required_date || !normalized.dispatch_request.items.length) {
    reasons.push("DISPATCH_REQUEST_PENDING");
  }

  if (normalized.logistics_validation.status !== "validated") {
    reasons.push("LOGISTICS_VALIDATION_PENDING");
  }

  if (normalized.visual_reception.status !== "completed") {
    reasons.push("FST14_PENDING");
  } else if (normalized.visual_reception.result !== "pass") {
    reasons.push("FST14_NOT_APPROVED");
  }

  if (requiresSiteInspection && !siteReady) {
    reasons.push("SITE_NOT_READY_FOR_INSTALLATION");
  }

  if (normalized.verification_decision.applies === null) {
    reasons.push("VERIFICATION_DECISION_PENDING");
  } else if (normalized.verification_decision.applies === true) {
    if (normalized.verification_cycle.status !== "passed") {
      reasons.push("VERIFICATION_PENDING");
    }
  } else {
    const hasJustification = Boolean(normalized.verification_decision.justification);
    const hasApprover = Boolean(normalized.verification_decision.approved_by_email);
    if (!hasJustification || !hasApprover) {
      reasons.push("VERIFICATION_EXCEPTION_INCOMPLETE");
    }
  }

  if (normalized.cu_flow.is_cu) {
    if (
      normalized.cu_flow.requires_parts_request &&
      normalized.cu_flow.parts_request_status !== "received"
    ) {
      reasons.push("CU_PARTS_PENDING");
    }
    if (
      normalized.cu_flow.provider_repair_report_required &&
      !normalized.cu_flow.provider_repair_report_file_id
    ) {
      reasons.push("CU_PROVIDER_REPORT_PENDING");
    }
  }

  return {
    can_close: reasons.length === 0,
    blocked_reasons: reasons,
    evaluated_at: new Date().toISOString(),
  };
};

const enrichInstallationWorkflowWithGate = ({
  workflow,
  siteReady = true,
  requiresSiteInspection = true,
} = {}) => {
  const normalized = normalizeInstallationWorkflowState(workflow || {});
  return {
    ...normalized,
    closure_gate: computeInstallationClosureGate({
      workflow: normalized,
      siteReady,
      requiresSiteInspection,
    }),
  };
};

module.exports = {
  DEFAULT_VISUAL_CHECKLIST,
  normalizeDateOnlyInput,
  detectCuEquipment,
  deriveEquipmentContext,
  normalizeVisualReceptionChecklist,
  normalizeInstallationWorkflowState,
  createInstallationWorkflowError,
  buildDispatchRequestPatch,
  buildLogisticsValidationPatch,
  buildVisualReceptionPatch,
  buildVerificationDecisionPatch,
  buildVerificationRemediationPatch,
  buildCuProviderReportPatch,
  appendVerificationAttempt,
  computeInstallationClosureGate,
  enrichInstallationWorkflowWithGate,
};
