const service = require("./privatePurchases.service");
const { logAction } = require("../../utils/audit");

exports.createPrivatePurchase = async (req, res) => {
  const user = req.user;
  const payload = req.body;
  const result = await service.createPrivatePurchase({ user, payload });
  await logAction({
    user_id: user.id,
    module: "private_purchase",
    action: "create",
    entity: "private_purchase_requests",
    entity_id: result.id,
  });
  res.status(201).json({ ok: true, data: result });
};

exports.listPrivatePurchases = async (req, res) => {
  const result = await service.listPrivatePurchases({
    user: req.user,
    status: req.query.status,
  });
  res.json({ ok: true, data: result });
};

exports.getPrivatePurchase = async (req, res) => {
  const request = await service.getPrivatePurchase(req.params.id);
  if (!request) return res.status(404).json({ ok: false, message: "No encontrada" });
  res.json({ ok: true, data: request });
};

exports.sendOffer = async (req, res) => {
  const payload = req.body;
  let result;
  if (payload.document_id && !payload.template_id) {
    result = await service.attachOfferDocument(
      req.params.id,
      payload.document_id,
      payload.folder_id,
    );
  } else {
    result = await service.createOfferDocument(req.params.id, payload, req.user);
  }
  res.json({ ok: true, data: result });
};

exports.uploadSignedOffer = async (req, res) => {
  console.log("[PURCHASE_FLOW][FASE2][UPLOAD_SIGNED_OFFER]", {
    purchaseId: req.params.id,
    userId: req.user?.id,
    userRole: req.user?.role
  });
  const result = await service.registerSignedOffer(req.params.id, req.body, req.user);
  res.json({ ok: true, data: result });
};

exports.registerClient = async (req, res) => {
  const result = await service.markClientRegistered(req.params.id);
  res.json({ ok: true, data: result });
};

exports.forwardToACP = async (req, res) => {
  const result = await service.forwardToACP(req.params.id, req.user);
  res.json({ ok: true, data: result });
};

// ===========================================
// FASE 2: Nuevos endpoints para flujo completo
// ===========================================

exports.getTimeline = async (req, res) => {
  const result = await service.getTimeline(req.params.id);
  res.json({ ok: true, data: result });
};

exports.managerDecision = async (req, res) => {
  const { decision, reason } = req.body;
  const result = await service.managerDecision(req.params.id, { decision, reason }, req.user);
  res.json({ ok: true, data: result });
};

exports.submitCorrections = async (req, res) => {
  const { reason, correctionDetails } = req.body;
  const result = await service.submitCorrections(req.params.id, { reason, correctionDetails }, req.user);
  res.json({ ok: true, data: result });
};

exports.submitContract = async (req, res) => {
  const result = await service.submitContract(req.params.id, req.body, req.user);
  res.json({ ok: true, data: result });
};

exports.requestDeliveryDates = async (req, res) => {
  const result = await service.requestDeliveryDates(req.params.id, req.user);
  res.json({ ok: true, data: result });
};

exports.submitDeliveryDates = async (req, res) => {
  const { deliveryDates, notes } = req.body;
  const result = await service.submitDeliveryDates(req.params.id, { deliveryDates, notes }, req.user);
  res.json({ ok: true, data: result });
};

exports.markDispatchReady = async (req, res) => {
  const result = await service.markDispatchReady(req.params.id, req.user);
  res.json({ ok: true, data: result });
};

exports.generateDeliveryAct = async (req, res) => {
  const result = await service.generateDeliveryAct(req.params.id, req.body, req.user);
  res.json({ ok: true, data: result });
};

// ===========================================
// FUNCIONES PARA COMODATO
// ===========================================

exports.requestAcpAvailability = async (req, res) => {
  const result = await service.requestAcpAvailability(req.params.id, req.user);
  res.json({ ok: true, data: result });
};

exports.startBusinessCase = async (req, res) => {
  const { businessCaseData } = req.body;
  const result = await service.startBusinessCase(req.params.id, { businessCaseData }, req.user);
  res.json({ ok: true, data: result });
};

// Validación auxiliar para debug
exports.validateClientApproval = async (req, res) => {
  const result = await service.validateClientApproval(await service.getPrivatePurchase(req.params.id));
  res.json({ ok: true, data: result });
};
