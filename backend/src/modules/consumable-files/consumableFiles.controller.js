const service = require("./consumableFiles.service");

exports.getByPurchase = async (req, res, next) => {
  try {
    const { purchase_type, purchase_request_id } = req.query || {};
    const { file } = await service.getFileHeaderByPurchase({
      purchaseType: purchase_type,
      purchaseRequestId: purchase_request_id,
    });
    if (!file) return res.json({ ok: true, data: null });
    const detail = await service.getFileDetail(file.id);
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.getOverview = async (req, res, next) => {
  try {
    const data = await service.listFilesOverview({ user: req.user });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
};

exports.createFromPurchase = async (req, res, next) => {
  try {
    const detail = await service.createFileFromPurchase({
      purchaseType: req.body?.purchase_type,
      purchaseRequestId: req.body?.purchase_request_id,
      processName: req.body?.process_name,
      user: req.user,
    });
    res.status(201).json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.createStandalone = async (req, res, next) => {
  try {
    const detail = await service.createStandaloneFile({
      processName: req.body?.process_name,
      processCode: req.body?.process_code,
      clientId: req.body?.client_id,
      contractingEntity: req.body?.contracting_entity,
      sameEntityAsClient: req.body?.same_entity_as_client,
      contractObject: req.body?.contract_object,
      equipmentIds: req.body?.equipment_ids,
      user: req.user,
    });
    res.status(201).json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const detail = await service.getFileDetail(req.params.id);
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.updateHeader = async (req, res, next) => {
  try {
    const detail = await service.updateFileHeader({
      fileId: req.params.id,
      processName: req.body?.process_name,
      processCode: req.body?.process_code,
      clientId: req.body?.client_id,
      contractingEntity: req.body?.contracting_entity,
      sameEntityAsClient: req.body?.same_entity_as_client,
      contractObject: req.body?.contract_object,
      advisorUserId: req.body?.advisor_user_id,
      equipmentIds: req.body?.equipment_ids,
      user: req.user,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.uploadStandaloneDocument = async (req, res, next) => {
  try {
    const detail = await service.uploadStandaloneDocument({
      fileId: req.params.id,
      docType: req.body?.doc_type,
      fileBase64: req.body?.file_base64,
      fileName: req.body?.file_name,
      mimeType: req.body?.mime_type,
      user: req.user,
    });
    res.status(201).json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.previewStandaloneBusinessCase = async (req, res, next) => {
  try {
    const data = await service.previewStandaloneBusinessCaseFile({
      fileBase64: req.body?.file_base64,
      fileName: req.body?.file_name,
      user: req.user,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
};

exports.importStandaloneBusinessCase = async (req, res, next) => {
  try {
    const detail = await service.importStandaloneBusinessCaseFile({
      fileId: req.params.id,
      sectionId: Number(req.body?.section_id),
      fileBase64: req.body?.file_base64,
      fileName: req.body?.file_name,
      mimeType: req.body?.mime_type,
      user: req.user,
    });
    res.status(201).json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.requestClientAssignment = async (req, res, next) => {
  try {
    const data = await service.requestClientAssignment({
      clientId: req.body?.client_id,
      clientLabel: req.body?.client_label,
      user: req.user,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
};

exports.previewStandaloneCatalog = async (req, res, next) => {
  try {
    const data = await service.previewStandaloneCatalog({
      equipmentIds: req.body?.equipment_ids || [],
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
};

exports.createSection = async (req, res, next) => {
  try {
    const section = await service.createSection({
      fileId: req.params.id,
      areaCode: req.body?.area_code,
      label: req.body?.label,
      sortOrder: req.body?.sort_order,
      user: req.user,
    });
    res.status(201).json({ ok: true, data: section });
  } catch (error) {
    next(error);
  }
};

exports.importBusinessCase = async (req, res, next) => {
  try {
    const detail = await service.importBusinessCaseLines({
      sectionId: req.params.sectionId,
      user: req.user,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.addLine = async (req, res, next) => {
  try {
    const line = await service.addLine({
      sectionId: req.params.sectionId,
      payload: req.body || {},
      user: req.user,
    });
    res.status(201).json({ ok: true, data: line });
  } catch (error) {
    next(error);
  }
};

exports.updateLine = async (req, res, next) => {
  try {
    const line = await service.updateLine({
      lineId: req.params.lineId,
      payload: req.body || {},
      user: req.user,
    });
    res.json({ ok: true, data: line });
  } catch (error) {
    next(error);
  }
};

exports.deleteLine = async (req, res, next) => {
  try {
    const result = await service.deleteLine({
      lineId: req.params.lineId,
      user: req.user,
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.importEquipment = async (req, res, next) => {
  try {
    const detail = await service.importEquipmentLines({
      sectionId: req.params.sectionId,
      equipmentId: req.body?.equipment_id,
      boxQty: req.body?.box_qty,
      user: req.user,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.registerFile = async (req, res, next) => {
  try {
    const detail = await service.registerFile({
      fileId: req.params.id,
      user: req.user,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.cancelFile = async (req, res, next) => {
  try {
    const detail = await service.cancelFile({
      fileId: req.params.id,
      user: req.user,
      reason: req.body?.reason,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.searchCatalog = async (req, res, next) => {
  try {
    const rows = await service.searchCatalog({
      q: req.query?.q,
      type: req.query?.type,
      limit: req.query?.limit,
    });
    res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const detail = await service.createOrder({
      fileId: req.params.id,
      period: req.body?.period,
      notes: req.body?.notes,
      lines: req.body?.lines || [],
      user: req.user,
    });
    res.status(201).json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.reviewExtra = async (req, res, next) => {
  try {
    const detail = await service.reviewExtra({
      orderId: req.params.orderId,
      decision: req.body?.decision,
      lines: req.body?.lines || [],
      user: req.user,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.dispatchOrder = async (req, res, next) => {
  try {
    const detail = await service.dispatchOrder({
      orderId: req.params.orderId,
      lines: req.body?.lines || [],
      notes: req.body?.notes,
      user: req.user,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const detail = await service.cancelOrder({
      orderId: req.params.orderId,
      user: req.user,
      reason: req.body?.reason,
    });
    res.json({ ok: true, data: detail });
  } catch (error) {
    next(error);
  }
};
