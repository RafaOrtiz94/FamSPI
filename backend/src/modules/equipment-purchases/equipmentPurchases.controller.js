const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const service = require("./equipmentPurchases.service");
const { logAction } = require("../../utils/audit");
const { normalizeDatesDeep } = require("../../utils/date.serializer");

exports.upload = upload;

exports.getMeta = async (req, res, next) => {
  try {
    const [clients, equipment, acpUsers] = await Promise.all([
      service.getApprovedClients(),
      service.getEquipmentCatalog(),
      service.getAcpCommercialUsers(),
    ]);

    await logAction({
      user_id: req.user.id,
      module: "equipment_purchases",
      action: "meta",
      entity: "meta",
      details: { clients: clients.length, equipment: equipment.length },
    });

    res.json({ ok: true, data: { clients, equipment, acp_users: acpUsers } });
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = await service.getStats({ requestType: req.query.request_type || "purchase" });
    res.json({ ok: true, data: stats });
  } catch (error) {
    next(error);
  }
};

exports.getBusinessCaseOptions = async (req, res, next) => {
  try {
    const options = await service.getBusinessCaseOptions();
    res.json({ ok: true, data: options });
  } catch (error) {
    next(error);
  }
};

exports.listMine = async (req, res, next) => {
  try {
    const data = await service.listByUser(req.user);
    const normalizedData = normalizeDatesDeep(data, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedData });
  } catch (error) {
    next(error);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const item = await service.getById(req.params.id, req.user);
    if (!item) return res.status(404).json({ ok: false, message: "No encontrado" });
    const normalizedItem = normalizeDatesDeep(item, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedItem });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      client_id,
      client_name,
      client_business_name,
      client_email,
      client_sector,
      provider_email,
      assigned_to,
      equipment,
      notes,
      extra,
      request_type,
    } = req.body;
    const parsedEquipment = Array.isArray(equipment)
      ? equipment
      : typeof equipment === "string"
        ? JSON.parse(equipment)
        : [];

    let parsedExtra = extra;
    try {
      parsedExtra = typeof extra === "string" ? JSON.parse(extra) : extra;
    } catch (parseError) {
      parsedExtra = null;
    }

    const created = await service.createPurchaseRequest({
      user: req.user,
      clientId: client_id,
      clientName: client_name,
      clientBusinessName: client_business_name,
      clientEmail: client_email,
      clientSector: client_sector,
      providerEmail: provider_email,
      assignedTo: assigned_to,
      equipment: parsedEquipment,
      notes,
      extra: parsedExtra,
      requestType: request_type,
    });

    await logAction({
      user_id: req.user.id,
      module: "equipment_purchases",
      action: "create",
      entity: "equipment_purchase_requests",
      entity_id: created.id,
    });

    const normalizedCreated = normalizeDatesDeep(created, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.status(201).json({ ok: true, data: normalizedCreated });
  } catch (error) {
    // Manejar errores de autorización de Gmail
    if (error.message?.includes("autorizar")) {
      await logAction({
        user_id: req.user.id,
        module: "equipment_purchases",
        action: "crear_failed",
        entity: "equipment_purchase_requests",
        details: { error: "gmail_not_authorized" },
      });

      return res.status(401).json({
        ok: false,
        message: "No se pudo enviar el correo. Por favor contacta al administrador para configurar el envío de emails.",
        error: "gmail_not_authorized",
        details: "El sistema necesita autorización para enviar correos electrónicos."
      });
    }

    await logAction({
      user_id: req.user.id,
      module: "equipment_purchases",
      action: "crear_failed",
      entity: "equipment_purchase_requests",
      details: { error: error.message },
    });

    next(error);
  }
};

exports.saveProviderResponse = async (req, res, next) => {
  try {
    const { outcome, items, notes } = req.body;
    const parsedItems = Array.isArray(items)
      ? items
      : typeof items === "string"
        ? JSON.parse(items)
        : [];

    const updated = await service.saveProviderResponse({
      id: req.params.id,
      user: req.user,
      outcome,
      items: parsedItems,
      notes,
    });

    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.requestProforma = async (req, res, next) => {
  try {
    const updated = await service.requestProforma({ id: req.params.id, user: req.user });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.uploadProforma = async (req, res, next) => {
  try {
    const updated = await service.uploadProforma({
      id: req.params.id,
      user: req.user,
      file: req.file,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.reserve = async (req, res, next) => {
  try {
    const updated = await service.reserveEquipment({ id: req.params.id, user: req.user });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.uploadSignedProforma = async (req, res, next) => {
  try {
    const { inspection_min_date, inspection_max_date, includes_starter_kit } = req.body;
    const updated = await service.uploadSignedProforma({
      id: req.params.id,
      user: req.user,
      file: req.file,
      inspection_min_date,
      inspection_max_date,
      includes_starter_kit: includes_starter_kit === "true" || includes_starter_kit === true,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.uploadContract = async (req, res, next) => {
  try {
    // FEATURE FLAG: BC gating for contracts
    const bcGatingEnabled = process.env.BC_GATING_FOR_CONTRACT === 'true';

    if (bcGatingEnabled) {
      // Check if contract upload is allowed
      await service.assertPurchaseCanProceedToContract(req.params.id, req.user);
    }

    const updated = await service.uploadContract({
      id: req.params.id,
      user: req.user,
      file: req.file,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.renewReservation = async (req, res, next) => {
  try {
    const updated = await service.renewReservation({ id: req.params.id, user: req.user });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const updated = await service.cancelOrder({ id: req.params.id, user: req.user, reason });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.updateBusinessCaseFields = async (req, res, next) => {
  try {
    const updated = await service.updateBusinessCaseFields({
      id: req.params.id,
      user: req.user,
      fields: req.body.fields || req.body,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.addBusinessCaseItem = async (req, res, next) => {
  try {
    const created = await service.addBusinessCaseItem({ id: req.params.id, user: req.user, item: req.body });
    const normalizedCreated = normalizeDatesDeep(created, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedCreated });
  } catch (error) {
    next(error);
  }
};

exports.listBusinessCaseItems = async (req, res, next) => {
  try {
    const items = await service.listBusinessCaseItems({ id: req.params.id, user: req.user });
    const normalizedItems = normalizeDatesDeep(items, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedItems });
  } catch (error) {
    next(error);
  }
};


exports.resolveBusinessCase = async (req, res, next) => {
  try {
    const result = await service.resolveBusinessCaseForPurchase({ id: req.params.id, user: req.user });

    await logAction({
      user_id: req.user.id,
      module: "equipment_purchases",
      action: result.created ? "create_business_case" : "link_business_case",
      entity: "equipment_purchase_requests",
      entity_id: req.params.id,
      details: { business_case_id: result.business_case_id, created: result.created }
    });

    const normalizedResult = normalizeDatesDeep(result, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedResult });
  } catch (error) {
    next(error);
  }
};

exports.submitSignedProformaWithInspection = async (req, res, next) => {
  try {
    const { inspection_min_date, inspection_max_date, includes_starter_kit } = req.body;
    const file = req.file; // Multer pone el archivo en req.file, no en req.body

    const result = await service.submitSignedProformaWithInspection({
      id: req.params.id,
      user: req.user,
      file,
      inspection_min_date,
      inspection_max_date,
      includes_starter_kit: includes_starter_kit === 'true' || includes_starter_kit === true
    });

    const normalizedResult = normalizeDatesDeep(result, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({
      ok: true,
      message: "Proforma firmada subida e inspección de ambiente creada",
      data: normalizedResult
    });
  } catch (error) {
    next(error);
  }
};

exports.startAvailability = async (req, res, next) => {
  try {
    const { provider_email, notes } = req.body;
    const updated = await service.startAvailabilityRequest({
      id: req.params.id,
      user: req.user,
      providerEmail: provider_email,
      notes,
    });

    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

// ===== BUSINESS CASE APPROVAL ENDPOINTS =====

exports.submitBusinessCase = async (req, res, next) => {
  try {
    const updated = await service.submitBusinessCaseForApproval(req.params.id, req.user);
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.approveBusinessCase = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const updated = await service.approveBusinessCase(req.params.id, req.user, notes);
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.rejectBusinessCase = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Se requiere razón de rechazo"
      });
    }

    const updated = await service.rejectBusinessCase(req.params.id, req.user, reason.trim());
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    res.json({ ok: true, data: normalizedUpdated });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseGatingStatus = async (req, res, next) => {
  try {
    const status = await service.getPurchaseGatingStatus(req.params.id, req.user);
    res.json({ ok: true, data: status });
  } catch (error) {
    next(error);
  }
};
