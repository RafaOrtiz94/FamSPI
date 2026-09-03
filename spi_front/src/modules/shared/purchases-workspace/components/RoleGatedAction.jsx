const normalizeRoles = (roles) => {
  const raw = Array.isArray(roles) ? roles : [roles];
  return raw
    .flatMap((role) => String(role || '').split(/[,\s]+/))
    .map((role) => role.toLowerCase().trim())
    .filter(Boolean);
};

const RoleGatedAction = ({ allowed, allowedRoles = [], userRoles = [], children }) => {
  const explicitAllowed = typeof allowed === 'boolean' ? allowed : null;
  const normalizedAllowedRoles = normalizeRoles(allowedRoles);
  const normalizedUserRoles = normalizeRoles(userRoles);

  const isAllowed = explicitAllowed ?? (
    !normalizedAllowedRoles.length ||
    normalizedUserRoles.some((role) => normalizedAllowedRoles.includes(role))
  );

  if (!isAllowed) return null;
  return children;
};

export default RoleGatedAction;
