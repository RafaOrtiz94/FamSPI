const service = require("./moduleAccess.service");

async function getCatalog(_req, res) {
  const data = service.getCatalog();
  return res.status(200).json({ ok: true, data });
}

async function getUserModules(req, res) {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ ok: false, message: "userId invalido" });
  }
  const data = await service.listUserModuleAccess(userId);
  return res.status(200).json({ ok: true, data });
}

async function updateUserModules(req, res) {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ ok: false, message: "userId invalido" });
  }
  const modules = Array.isArray(req.body?.modules) ? req.body.modules : [];
  const data = await service.upsertUserModuleAccess({
    userId,
    modules,
    actorUserId: req.user?.id || null,
  });
  return res.status(200).json({ ok: true, data });
}

async function getGlobalStatuses(_req, res) {
  const data = await service.listGlobalModuleStatuses();
  return res.status(200).json({ ok: true, data });
}

async function updateGlobalStatus(req, res) {
  const moduleKey = req.params.moduleKey;
  const { stage, whitelist_emails } = req.body;
  try {
    const data = await service.upsertGlobalModuleStatus({
      moduleKey,
      stage,
      whitelist_emails,
      actorUserId: req.user?.id || null,
    });
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, message: err.message });
  }
}

module.exports = {
  getCatalog,
  getUserModules,
  updateUserModules,
  getGlobalStatuses,
  updateGlobalStatus,
};
