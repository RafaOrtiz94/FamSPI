-- =============================================================
-- Script de Verificación - Sistema de Asistencia
-- =============================================================
-- Ejecuta estas consultas en pgAdmin para verificar la implementación
-- =============================================================

-- 1. Verificar que la tabla user_attendance_records existe
SELECT 
    table_name, 
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_attendance_records';

-- Resultado esperado: 1 fila con table_name = 'user_attendance_records'

-- =============================================================

-- 2. Verificar la estructura de la tabla
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_attendance_records'
ORDER BY ordinal_position;

-- Resultado esperado: 10 columnas (id, user_id, date, entry_time, lunch_start_time, lunch_end_time, exit_time, notes, created_at, updated_at)

-- =============================================================

-- 3. Verificar los índices creados
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'user_attendance_records';

-- Resultado esperado: 3-4 índices incluyendo idx_attendance_user_date, idx_attendance_date, idx_attendance_incomplete

-- =============================================================

-- 4. Verificar que los campos de firma existen en users
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
    'lopdp_internal_signature_file_id', 
    'lopdp_internal_signed_at',
    'lopdp_internal_status'
)
ORDER BY column_name;

-- Resultado esperado: 3 filas con los campos de firma LOPDP

-- =============================================================

-- 5. Ver registros de asistencia (si existen)
SELECT 
    a.id,
    a.user_id,
    u.fullname,
    u.email,
    a.date,
    a.entry_time,
    a.lunch_start_time,
    a.lunch_end_time,
    a.exit_time,
    a.created_at
FROM user_attendance_records a
LEFT JOIN users u ON a.user_id = u.id
ORDER BY a.date DESC, a.created_at DESC
LIMIT 10;

-- Resultado esperado: Registros de asistencia si ya se han creado, o vacío si aún no hay

-- =============================================================

-- 6. Ver usuarios con firma registrada
SELECT 
    id,
    email,
    fullname,
    lopdp_internal_status,
    lopdp_internal_signed_at,
    CASE 
        WHEN lopdp_internal_signature_file_id IS NOT NULL THEN 'Sí'
        ELSE 'No'
    END as tiene_firma
FROM users
WHERE lopdp_internal_signature_file_id IS NOT NULL
ORDER BY lopdp_internal_signed_at DESC;

-- Resultado esperado: Usuarios que ya tienen firma registrada

-- =============================================================

-- 7. Verificar el trigger de updated_at
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'user_attendance_records';

-- Resultado esperado: 1 trigger llamado 'trg_attendance_updated_at'

-- =============================================================

-- 8. Insertar registro de prueba (OPCIONAL - solo para testing)
-- Descomenta estas líneas si quieres crear un registro de prueba:

/*
INSERT INTO user_attendance_records 
(user_id, date, entry_time, lunch_start_time, lunch_end_time, exit_time, notes)
VALUES 
(1, CURRENT_DATE, 
 CURRENT_DATE + TIME '08:00:00', 
 CURRENT_DATE + TIME '12:00:00',
 CURRENT_DATE + TIME '13:00:00',
 CURRENT_DATE + TIME '17:00:00',
 'Registro de prueba creado manualmente');
*/

-- =============================================================

-- 9. Ver el registro de prueba (si lo creaste)
/*
SELECT * FROM user_attendance_records 
WHERE notes LIKE '%prueba%'
ORDER BY created_at DESC;
*/

-- =============================================================

-- 10. Limpiar registro de prueba (si lo creaste)
/*
DELETE FROM user_attendance_records 
WHERE notes = 'Registro de prueba creado manualmente';
*/

-- =============================================================
-- FIN DEL SCRIPT DE VERIFICACIÓN
-- =============================================================
