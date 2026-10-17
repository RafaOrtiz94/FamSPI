-- 056_add_active_column_to_users.sql
-- Agregar columna 'active' a la tabla users para controlar usuarios activos/inactivos

-- Agregar columna active con valor por defecto true (todos los usuarios existentes serán activos)
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Crear índice para optimizar consultas por estado activo
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Agregar comentario explicativo
COMMENT ON COLUMN users.active IS 'Indica si el usuario está activo en el sistema. Los usuarios inactivos no pueden acceder.';
