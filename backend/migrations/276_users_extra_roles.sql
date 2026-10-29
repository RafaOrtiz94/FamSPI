-- Permite otorgar capacidades adicionales de un rol especifico a un usuario
-- puntual sin cambiar su rol principal (el sistema es de un solo rol por
-- usuario). Se usa junto con collectUserRoles() en middlewares/roles.js.
ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_roles TEXT[] NOT NULL DEFAULT '{}';
