-- Clean up equipment purchase requests from sandbox
-- This script deletes all equipment purchase request records from both legacy and V2 tables

-- Start transaction for safety
BEGIN;

-- Delete from V2 requests table (purchase requests)
DELETE FROM requests
WHERE request_type_id = (
    SELECT id FROM request_types WHERE code = 'F.ST-19'
);

-- Delete from legacy equipment_purchase_requests table
DELETE FROM equipment_purchase_requests;

-- Reset any sequences if needed (optional, for clean state)
-- ALTER SEQUENCE requests_id_seq RESTART WITH 1;
-- ALTER SEQUENCE equipment_purchase_requests_id_seq RESTART WITH 1;

-- Log the cleanup operation
INSERT INTO audit_trail (
  action,
  module,
  entity,
  entity_id,
  details,
  created_at
) VALUES (
  'SANDBOX_CLEANUP',
  'equipment_purchases',
  'cleanup_script',
  'sandbox_cleanup',
  json_build_object(
    'description', 'Sandbox cleanup: deleted all equipment purchase request records',
    'tables_affected', json_build_array('requests', 'equipment_purchase_requests'),
    'timestamp', NOW()
  ),
  NOW()
);

-- Commit the transaction
COMMIT;

-- Show results
SELECT
  'requests table' as table_name,
  COUNT(*) as remaining_records
FROM requests
WHERE request_type_id = (SELECT id FROM request_types WHERE code = 'F.ST-19')

UNION ALL

SELECT
  'equipment_purchase_requests table' as table_name,
  COUNT(*) as remaining_records
FROM equipment_purchase_requests;

-- Show audit log entry
SELECT * FROM audit_trail
WHERE action = 'SANDBOX_CLEANUP'
ORDER BY created_at DESC
LIMIT 1;