const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const service = require("./equipmentPurchases.service");
const { logAction } = require("../../utils/audit");

exports.upload = upload;

exports.getMeta = async (req, res, next) => {
  try {
    const [clients, equipment] = await Promise.all([
      service.getApprovedClients(),
      service.getEquipmentCatalog(),
    ]);

    await logAction({
      user_id: req.user.id,
      module: "equipment_purchases",
      action: "meta",
      entity: "meta",
      details: { clients: clients.length, equipment: equipment.length },
    });

    res.json({ ok: true, data: { clients, equipment } });
  } catch (error) {
    next(error);
  }
};

exports.listMine = async (req, res, next) => {
  try {
    const data = await service.listByUser(req.user.id);
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const item = await service.getById(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ ok: false, message: "No encontrado" });
    res.json({ ok: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { client_id, client_name, client_email, provider_email, equipment, notes } = req.body;
    const parsedEquipment = Array.isArray(equipment)
      ? equipment
      : typeof equipment === "string"
        ? JSON.parse(equipment)
        : [];

    const created = await service.createRequest({
      user: req.user,
      clientId: client_id,
      clientName: client_name,
      clientEmail: client_email,
      providerEmail: provider_email,
      equipment: parsedEquipment,
      notes,
    });

    await logAction({
      user_id: req.user.id,
      module: "equipment_purchases",
      action: "create",
      entity: "equipment_purchase_requests",
      entity_id: created.id,
    });

    res.status(201).json({ ok: true, data: created });
  } catch (error) {
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
      userId: req.user.id,
      outcome,
      items: parsedItems,
      notes,
    });

    res.json({ ok: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.requestProforma = async (req, res, next) => {
  try {
    const updated = await service.requestProforma({ id: req.params.id, user: req.user });
    res.json({ ok: true, data: updated });
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
    res.json({ ok: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.reserve = async (req, res, next) => {
  try {
    const updated = await service.reserveEquipment({ id: req.params.id, user: req.user });
    res.json({ ok: true, data: updated });
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
    res.json({ ok: true, data: updated });
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
    });
    res.json({ ok: true, data: updated });
  } catch (error) {
    next(error);
  }
};
