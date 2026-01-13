-- Script SQL para verificación de Private Purchases en BD
-- Ejecutar con: psql -U postgres -d FamSPI -f scripts/pp_queries.sql

-- ===========================================
-- ESTADO ACTUAL DE COMPRAS PRIVADAS
-- ===========================================

-- Ver estado de todas las compras privadas
SELECT
    id,
    status,
    contract_document_id,
    delivery_dates_json,
    delivery_act_document_id,
    created_at,
    updated_at
FROM private_purchase_requests
ORDER BY created_at DESC
LIMIT 10;

-- ===========================================
-- CALENDARIO Y HORARIOS
-- ===========================================

-- Ver schedules de entrega
SELECT
    ppr.id as purchase_id,
    ppr.status,
    pds.delivery_start_at,
    pds.delivery_end_at,
    pds.calendar_event_ids,
    pds.created_at as schedule_created
FROM private_purchase_requests ppr
LEFT JOIN purchase_delivery_schedules pds ON ppr.id::text = pds.private_purchase_request_id
WHERE pds.id IS NOT NULL
ORDER BY pds.created_at DESC;

-- ===========================================
-- DOCUMENTOS GENERADOS
-- ===========================================

-- Ver documentos relacionados con compras privadas
SELECT
    d.id,
    d.request_id,
    d.doc_drive_id,
    d.pdf_drive_id,
    d.folder_drive_id,
    d.created_at,
    'contract_document' as doc_type
FROM documents d
WHERE d.request_id IN (
    SELECT id FROM private_purchase_requests WHERE contract_document_id IS NOT NULL
)
UNION ALL
SELECT
    d.id,
    d.request_id,
    d.doc_drive_id,
    d.pdf_drive_id,
    d.folder_drive_id,
    d.created_at,
    'delivery_act' as doc_type
FROM documents d
WHERE d.request_id IN (
    SELECT id FROM private_purchase_requests WHERE delivery_act_document_id IS NOT NULL
)
ORDER BY created_at DESC;

-- ===========================================
-- CLIENTES Y APROBACIONES
-- ===========================================

-- Ver estado de clientes relacionados
SELECT
    cr.id,
    cr.client_email,
    cr.approval_status,
    cr.approved_at,
    cr.lopdp_consent_status,
    cr.lopdp_consent_at,
    ppr.id as purchase_id,
    ppr.status as purchase_status
FROM client_requests cr
LEFT JOIN private_purchase_requests ppr ON cr.id = ppr.client_request_id
WHERE ppr.id IS NOT NULL
ORDER BY cr.created_at DESC;

-- Ver consents LOPDP
SELECT
    ulc.user_email,
    ulc.status as consent_status,
    ulc.created_at as consent_created,
    cr.client_email,
    cr.approval_status,
    ppr.id as purchase_id
FROM user_lopdp_consents ulc
LEFT JOIN client_requests cr ON ulc.user_email = cr.client_email
LEFT JOIN private_purchase_requests ppr ON cr.id = ppr.client_request_id
WHERE ppr.id IS NOT NULL
ORDER BY ulc.created_at DESC;

-- ===========================================
-- TIMELINE Y AUDITORÍA
-- ===========================================

-- Ver timeline completo de una compra específica (cambiar el ID)
-- SELECT * FROM private_purchase_requests WHERE id = 'your-purchase-id';
-- Luego usar el endpoint GET /api/private-purchases/{id}/timeline

-- ===========================================
-- ESTADÍSTICAS GENERALES
-- ===========================================

-- Conteo por estados
SELECT
    status,
    COUNT(*) as total,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM private_purchase_requests
GROUP BY status
ORDER BY total DESC;

-- Compras con documentos completos
SELECT
    COUNT(*) as total_with_contract,
    SUM(CASE WHEN delivery_act_document_id IS NOT NULL THEN 1 ELSE 0 END) as with_delivery_act,
    SUM(CASE WHEN delivery_dates_json IS NOT NULL THEN 1 ELSE 0 END) as with_delivery_dates
FROM private_purchase_requests
WHERE contract_document_id IS NOT NULL;

-- ===========================================
-- CORRECCIONES Y RECHAZOS
-- ===========================================

-- Ver correcciones enviadas
SELECT
    pc.id,
    pc.private_purchase_id,
    pc.reason,
    pc.created_by_user_id,
    pc.created_at,
    ppr.status as current_status
FROM purchase_corrections pc
LEFT JOIN private_purchase_requests ppr ON pc.private_purchase_id::text = ppr.id::text
ORDER BY pc.created_at DESC;

-- ===========================================
-- VERIFICACIÓN DE CONSTRAINTS
-- ===========================================

-- Ver constraints de la tabla
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'private_purchase_requests'
    AND tc.constraint_schema = 'public'
ORDER BY tc.constraint_name;

-- ===========================================
-- LIMPIEZA PARA PRUEBAS (SOLO DESARROLLO)
-- ===========================================

-- ATENCIÓN: Solo ejecutar en ambiente de desarrollo
-- DELETE FROM purchase_delivery_schedules;
-- DELETE FROM purchase_corrections;
-- DELETE FROM private_purchase_requests;
-- DELETE FROM documents WHERE request_type_id = (SELECT id FROM request_types WHERE code = 'private_purchase');