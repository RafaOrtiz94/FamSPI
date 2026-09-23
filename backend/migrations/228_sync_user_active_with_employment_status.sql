-- Migration: 228_sync_user_active_with_employment_status.sql
-- Sync users.active with collaborator_profiles.profile->'laboral'->>'estatus_empleado'
-- Fuente única de verdad: users.active

-- 1. Usuarios con estatus_empleado inactivo/pasivo pero users.active=true
-- Estos deben desactivarse en users
UPDATE users u
SET active = false,
    updated_at = NOW()
FROM collaborator_profiles cp
WHERE u.id = cp.user_id
  AND u.active = true
  AND LOWER(cp.profile->'laboral'->>'estatus_empleado') IN ('pasivo', 'desvinculado', 'inactivo', 'en_desvinculacion');

-- 2. Usuarios con users.active=false pero estatus_empleado activo o nulo
-- Estos deben reactivarse en users (asumiendo que están activos a menos que tengan estatus pasivo)
UPDATE users u
SET active = true,
    updated_at = NOW()
FROM collaborator_profiles cp
WHERE u.id = cp.user_id
  AND u.active = false
  AND (cp.profile->'laboral'->>'estatus_empleado') IS NULL
  AND u.role NOT IN ('pendiente');

-- 3. Usuarios sin perfil de colaborador pero con active=false
-- Mantener así (ya están desactivados por otra razón)

-- Log the sync operation
INSERT INTO audit_logs (user_id, module, action, entity, entity_id, details)
SELECT 
  1,
  'migration',
  'sync_user_active_status',
  'users',
  u.id,
  jsonb_build_object(
    'previous_active', true,
    'new_active', false,
    'reason', 'employment_status_pasivo'
 )
FROM users u
JOIN collaborator_profiles cp ON u.id = cp.user_id
WHERE u.active = false
  AND LOWER(cp.profile->'laboral'->>'estatus_empleado') IN ('pasivo', 'desvinculado', 'inactivo', 'en_desvinculacion');