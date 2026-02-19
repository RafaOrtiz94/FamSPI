const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const service = require("./equipmentPurchases.service");
const { logAction } = require("../../utils/audit");
const { normalizeDatesDeep } = require("../../utils/date.serializer");
const { broadcastPurchaseUpdate } = require("./purchaseEvents");
const logger = require("../../config/logger");

const respondAndBroadcast = ({
  res,
  req,
  payload,
  action = "updated",
  statusCode = 200,
  extra = {},
  selector = (data) => data,
  meta = {},
}) => {
  if (statusCode && statusCode !== 200) {
    res.status(statusCode);
  }
  res.json({ ok: true, ...extra, data: payload });
  try {
    const requestPayload = selector(payload);
    if (requestPayload && requestPayload.id) {
      broadcastPurchaseUpdate({
        request: requestPayload,
        action,
        user: req.user,
        meta,
      });
    }
  } catch (err) {
    logger.warn("No se pudo emitir evento de compra:", err);
  }
};

exports.upload = upload;

exports.getMeta = async (req, res, next) => {
  try {
    const [clients, equipment, acpUsers, providerContacts] = await Promise.all([
      service.getApprovedClients(),
      service.getEquipmentCatalog(),
      service.getAcpCommercialUsers(),
      service.listProviderContacts({ user: req.user, limit: 50 }),
    ]);

    await logAction({
      user_id: req.user.id,
      module: "equipment_purchases",
      action: "meta",
      entity: "meta",
      details: { clients: clients.length, equipment: equipment.length },
    });

    res.json({
      ok: true,
      data: {
        clients,
        equipment,
        acp_users: acpUsers,
        provider_contacts: providerContacts,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.listProviderContacts = async (req, res, next) => {
  try {
    const contacts = await service.listProviderContacts({
      user: req.user,
      query: req.query?.q || "",
      limit: req.query?.limit,
    });
    res.json({ ok: true, data: contacts });
  } catch (error) {
    next(error);
  }
};

exports.saveProviderContact = async (req, res, next) => {
  try {
    const contact = await service.saveProviderContact({
      user: req.user,
      email: req.body?.email,
      display_name: req.body?.display_name,
    });
    res.status(201).json({ ok: true, data: contact });
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

exports.getTechnicalScheduleCalendar = async (req, res, next) => {
  try {
    const from = req.query?.from;
    const to = req.query?.to;
    const data = await service.getTechnicalScheduleCalendar({
      user: req.user,
      from,
      to,
    });
    res.json({ ok: true, data });
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
    respondAndBroadcast({
      res,
      req,
      payload: normalizedCreated,
      action: "created",
      statusCode: 201,
    });
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
    const { outcome, items, notes, expected_updated_at } = req.body;
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
      expected_updated_at,
    });

    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "provider_response",
    });
  } catch (error) {
    next(error);
  }
};

exports.requestProforma = async (req, res, next) => {
  try {
    const updated = await service.requestProforma({
      id: req.params.id,
      user: req.user,
      expected_updated_at: req.body?.expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "proforma_requested",
    });
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
      expected_updated_at: req.body?.expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "proforma_uploaded",
    });
  } catch (error) {
    next(error);
  }
};

exports.reserve = async (req, res, next) => {
  try {
    const updated = await service.reserveEquipment({
      id: req.params.id,
      user: req.user,
      expected_updated_at: req.body?.expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "reserved",
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadSignedProforma = async (req, res, next) => {
  try {
    const { inspection_min_date, inspection_max_date, includes_starter_kit, expected_updated_at } = req.body;
    const updated = await service.uploadSignedProforma({
      id: req.params.id,
      user: req.user,
      file: req.file,
      inspection_min_date,
      inspection_max_date,
      includes_starter_kit: includes_starter_kit === "true" || includes_starter_kit === true,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "signed_proforma_uploaded",
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadContract = async (req, res, next) => {
  try {
    const updated = await service.uploadContract({
      id: req.params.id,
      user: req.user,
      file: req.file,
      expected_updated_at: req.body?.expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "contract_uploaded",
    });
  } catch (error) {
    next(error);
  }
};

exports.requestDeliveryDates = async (req, res, next) => {
  try {
    const { notes, expected_updated_at } = req.body || {};
    const updated = await service.requestDeliveryDates({
      id: req.params.id,
      user: req.user,
      notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "delivery_dates_requested",
    });
  } catch (error) {
    next(error);
  }
};

exports.submitDeliveryDates = async (req, res, next) => {
  try {
    const { delivery_start_at, delivery_end_at, notes, expected_updated_at } = req.body || {};
    const updated = await service.submitDeliveryDates({
      id: req.params.id,
      user: req.user,
      delivery_start_at,
      delivery_end_at,
      notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "delivery_dates_submitted",
    });
  } catch (error) {
    next(error);
  }
};

exports.markEquipmentArrived = async (req, res, next) => {
  try {
    const { notes, expected_updated_at } = req.body || {};
    const updated = await service.markEquipmentArrived({
      id: req.params.id,
      user: req.user,
      notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "equipment_arrived",
    });
  } catch (error) {
    next(error);
  }
};

exports.markDispatchReady = async (req, res, next) => {
  try {
    const { notes, expected_updated_at } = req.body || {};
    const updated = await service.markDispatchReady({
      id: req.params.id,
      user: req.user,
      notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "dispatch_ready",
    });
  } catch (error) {
    next(error);
  }
};

exports.completeDelivery = async (req, res, next) => {
  try {
    const { notes, expected_updated_at } = req.body || {};
    const updated = await service.completeDelivery({
      id: req.params.id,
      user: req.user,
      notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "delivery_completed",
    });
  } catch (error) {
    next(error);
  }
};

exports.renewReservation = async (req, res, next) => {
  try {
    const updated = await service.renewReservation({
      id: req.params.id,
      user: req.user,
      expected_updated_at: req.body?.expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "reservation_renewed",
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason, expected_updated_at } = req.body;
    const updated = await service.cancelOrder({
      id: req.params.id,
      user: req.user,
      reason,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "cancelled",
    });
  } catch (error) {
    next(error);
  }
};

exports.submitSignedProformaWithInspection = async (req, res, next) => {
  try {
    const { inspection_min_date, inspection_max_date, includes_starter_kit, expected_updated_at } = req.body;
    const file = req.file; // Multer pone el archivo en req.file, no en req.body

    const result = await service.submitSignedProformaWithInspection({
      id: req.params.id,
      user: req.user,
      file,
      inspection_min_date,
      inspection_max_date,
      includes_starter_kit: includes_starter_kit === 'true' || includes_starter_kit === true,
      expected_updated_at,
    });

    const normalizedResult = normalizeDatesDeep(result, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedResult,
      action: "inspection_created",
      extra: { message: "Proforma firmada subida e inspección de ambiente creada" },
      selector: (data) => data?.purchase_request,
    });
  } catch (error) {
    next(error);
  }
};

exports.requestInspectionEnvironment = async (req, res, next) => {
  try {
    const { inspection_min_date, inspection_max_date, includes_starter_kit, expected_updated_at } = req.body || {};

    const result = await service.requestInspectionEnvironment({
      id: req.params.id,
      user: req.user,
      inspection_min_date,
      inspection_max_date,
      includes_starter_kit: includes_starter_kit === "true" || includes_starter_kit === true,
      expected_updated_at,
    });

    const normalizedResult = normalizeDatesDeep(result, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });

    respondAndBroadcast({
      res,
      req,
      payload: normalizedResult,
      action: "inspection_requested",
      extra: { message: "Solicitud de inspección de ambiente registrada" },
      selector: (data) => data?.purchase_request,
    });
  } catch (error) {
    next(error);
  }
};

exports.coordinateInspectionDate = async (req, res, next) => {
  try {
    const { inspection_date, notes, expected_updated_at } = req.body || {};
    const updated = await service.coordinateInspectionDate({
      id: req.params.id,
      user: req.user,
      inspection_date,
      notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "inspection_coordinated",
      meta: { inspection_date: inspection_date || null },
    });
  } catch (error) {
    next(error);
  }
};

exports.reviewInspectionDate = async (req, res, next) => {
  try {
    const { decision, review_notes, expected_updated_at } = req.body || {};
    const updated = await service.reviewInspectionDateProposal({
      id: req.params.id,
      user: req.user,
      decision,
      review_notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: decision === "accept" ? "inspection_coordination_approved" : "inspection_coordination_rejected",
      meta: { decision: String(decision || "").toLowerCase() },
    });
  } catch (error) {
    next(error);
  }
};

exports.registerSiteInspection = async (req, res, next) => {
  try {
    const {
      result,
      checklist,
      observations,
      recommendations,
      follow_up_date,
      is_reinspection,
      expected_updated_at,
    } = req.body || {};

    const updated = await service.registerSiteInspection({
      id: req.params.id,
      user: req.user,
      result,
      checklist,
      observations,
      recommendations,
      follow_up_date,
      is_reinspection,
      expected_updated_at,
    });

    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });

    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action:
        String(result || "").toLowerCase() === "compliant"
          ? "site_inspection_completed"
          : "site_inspection_requires_reinspection",
      meta: { result: String(result || "").toLowerCase() || null },
    });
  } catch (error) {
    next(error);
  }
};

exports.startAvailability = async (req, res, next) => {
  try {
    const { provider_email, notes, expected_updated_at } = req.body;
    const updated = await service.startAvailabilityRequest({
      id: req.params.id,
      user: req.user,
      providerEmail: provider_email,
      notes,
      expected_updated_at,
    });

    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: 'equipment_purchases',
      keysToNormalize: ['created_at', 'updated_at', 'provider_response_at']
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "availability_requested",
    });
  } catch (error) {
    next(error);
  }
};

exports.updateChecklist = async (req, res, next) => {
  try {
    const { item_key, checked, note } = req.body || {};
    const updated = await service.updateChecklistItem({
      id: req.params.id,
      user: req.user,
      itemKey: item_key,
      checked,
      note,
    });

    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "checklist_updated",
      meta: { item_key, checked: Boolean(checked) },
    });
  } catch (error) {
    next(error);
  }
};

exports.registerPublicPortalOutcome = async (req, res, next) => {
  try {
    const { outcome, notes, expected_updated_at } = req.body || {};
    const updated = await service.registerPublicPortalOutcome({
      id: req.params.id,
      user: req.user,
      outcome,
      notes,
      expected_updated_at,
    });
    const normalizedUpdated = normalizeDatesDeep(updated, {
      endpoint: "equipment_purchases",
      keysToNormalize: ["created_at", "updated_at", "provider_response_at"],
    });
    respondAndBroadcast({
      res,
      req,
      payload: normalizedUpdated,
      action: "public_portal_outcome_registered",
      meta: { outcome: String(outcome || "").toLowerCase() || null },
    });
  } catch (error) {
    next(error);
  }
};
