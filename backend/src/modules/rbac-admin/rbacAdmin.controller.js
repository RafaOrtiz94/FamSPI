const service = require("./rbacAdmin.service");
const { resolveTenantScope } = require("../../security/authorization/tenantContext");

const positiveInt = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw Object.assign(new Error(`${label} invalido`), { status: 400 });
  return number;
};

const ok = (res, data) => res.status(200).json({ ok: true, data });
const actor = (req) => req.user?.id;
// Empresa del administrador que hace la peticion (NO_TENANT mientras RBAC_TENANT_MODE este apagado).
const scopeOf = (req) => resolveTenantScope(actor(req));

async function getSummary(req, res) { return ok(res, await service.getSummary(await scopeOf(req))); }
async function listRoles(req, res) { return ok(res, await service.listRoles(await scopeOf(req))); }
async function listMembers(req, res) { return ok(res, await service.listMembers(await scopeOf(req))); }
async function listPermissions(req, res) {
  return ok(res, await service.listPermissions({ q: req.query.q, moduleKey: req.query.module, limit: req.query.limit, offset: req.query.offset }));
}
async function getUserAccess(req, res) { return ok(res, await service.getUserAccess(positiveInt(req.params.userId, "userId"), await scopeOf(req))); }
async function assignRole(req, res) {
  const { role, reason, expires_at: expiresAt } = req.body || {};
  return ok(res, await service.assignRole({ actorId: actor(req), userId: positiveInt(req.params.userId, "userId"), roleKey: role, reason, expiresAt, scope: await scopeOf(req) }));
}
async function revokeRole(req, res) {
  return ok(res, await service.revokeRole({
    actorId: actor(req), userId: positiveInt(req.params.userId, "userId"), assignmentId: positiveInt(req.params.assignmentId, "assignmentId"), reason: req.body?.reason, scope: await scopeOf(req),
  }));
}
async function grantPermission(req, res) {
  const { permission, reason, expires_at: expiresAt } = req.body || {};
  return ok(res, await service.grantPermission({ actorId: actor(req), userId: positiveInt(req.params.userId, "userId"), permissionKey: permission, reason, expiresAt, scope: await scopeOf(req) }));
}
async function revokeGrant(req, res) {
  return ok(res, await service.revokeGrant({ actorId: actor(req), userId: positiveInt(req.params.userId, "userId"), grantId: positiveInt(req.params.grantId, "grantId"), scope: await scopeOf(req) }));
}

async function getMatrix(req, res) { return ok(res, await service.getMatrix(await scopeOf(req))); }
async function listAudit(req, res) {
  const userId = req.query.user_id ? positiveInt(req.query.user_id, "user_id") : null;
  return ok(res, await service.listAudit({ userId, limit: req.query.limit, scope: await scopeOf(req) }));
}
async function syncInherited(req, res) { return ok(res, await service.syncInherited({ actorId: actor(req), scope: await scopeOf(req) })); }

async function getRole(req, res) { return ok(res, await service.getRole(positiveInt(req.params.roleId, "roleId"), await scopeOf(req))); }
async function createRole(req, res) {
  const { key, label, permissions, clone_from: cloneFromId, reason } = req.body || {};
  const data = await service.createRole({
    actorId: actor(req), key, label, permissions, cloneFromId: cloneFromId ? positiveInt(cloneFromId, "clone_from") : null, reason, scope: await scopeOf(req),
  });
  return res.status(201).json({ ok: true, data });
}
async function updateRole(req, res) {
  const { label, permissions, reason } = req.body || {};
  return ok(res, await service.updateRole({ actorId: actor(req), roleId: positiveInt(req.params.roleId, "roleId"), label, permissions, reason, scope: await scopeOf(req) }));
}
async function archiveRole(req, res) {
  return ok(res, await service.archiveRole({ actorId: actor(req), roleId: positiveInt(req.params.roleId, "roleId"), reason: req.body?.reason, scope: await scopeOf(req) }));
}

module.exports = {
  getRole, createRole, updateRole, archiveRole, getMatrix, listAudit, syncInherited, listMembers,
  getSummary, listRoles, listPermissions, getUserAccess, assignRole, revokeRole, grantPermission, revokeGrant,
};
