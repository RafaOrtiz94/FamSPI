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
