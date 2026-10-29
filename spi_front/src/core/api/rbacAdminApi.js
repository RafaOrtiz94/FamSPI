import api from "./index";

const unwrap = (response) => response?.data?.data;

export const getRbacSummary = async () => unwrap(await api.get("/rbac/summary"));
export const getRbacMembers = async () => unwrap(await api.get("/rbac/members")) || [];
export const getRbacRoles = async () => unwrap(await api.get("/rbac/roles")) || [];
export const getRbacRole = async (roleId) => unwrap(await api.get(`/rbac/roles/${roleId}`));
export const createRbacRole = async (payload) => unwrap(await api.post("/rbac/roles", payload));
export const updateRbacRole = async (roleId, payload) => unwrap(await api.put(`/rbac/roles/${roleId}`, payload));
export const archiveRbacRole = async (roleId, reason) => unwrap(await api.delete(`/rbac/roles/${roleId}`, { data: { reason } }));
export const getRbacPermissions = async (params = {}) => unwrap(await api.get("/rbac/permissions", { params })) || [];
export const getRbacMatrix = async () => unwrap(await api.get("/rbac/matrix"));
export const getRbacAudit = async (params = {}) => unwrap(await api.get("/rbac/audit", { params })) || [];
export const syncRbacInherited = async () => unwrap(await api.post("/rbac/sync-inherited"));
export const getRbacUserAccess = async (userId) => unwrap(await api.get(`/rbac/users/${userId}`));

export const assignRbacRole = async (userId, { role, reason, expiresAt }) =>
  unwrap(await api.post(`/rbac/users/${userId}/roles`, { role, reason, expires_at: expiresAt || undefined }));
export const revokeRbacRole = async (userId, assignmentId, reason) =>
  unwrap(await api.delete(`/rbac/users/${userId}/roles/${assignmentId}`, { data: { reason } }));
export const grantRbacPermission = async (userId, { permission, reason, expiresAt }) =>
  unwrap(await api.post(`/rbac/users/${userId}/grants`, { permission, reason, expires_at: expiresAt || undefined }));
export const revokeRbacGrant = async (userId, grantId) =>
  unwrap(await api.delete(`/rbac/users/${userId}/grants/${grantId}`));
