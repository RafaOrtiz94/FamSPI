const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { getDbConfig } = require("./dbConnection");

async function applyMigration() {
  const client = new Client(getDbConfig());

  try {
    console.log('[MIGRACIÓN 171] Connecting...');
    await client.connect();
    console.log('[MIGRACIÓN 171] Connected successfully');

    // Leer migración
    const migrationPath = path.join(__dirname, '../migrations/171_unified_purchases_migration_part1.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRACIÓN 171] Ejecutando migración...');
    await client.query(migrationSql);
    console.log('[MIGRACIÓN 171] MIGRACIÓN COMPLETADA EXITOSAMENTE!');

    console.log('\n=== CAMPOS AGREGADOS ===');
    console.log('- forwarded_to_acp_at');
    console.log('- business_case_id');
    console.log('- offer_document_id');
    console.log('- offer_signed_document_id');
    console.log('- comodato_document_id');
    console.log('- contract_document_id');
    console.log('- contract_signed_document_id');
    console.log('- contract_client_signed_document_id');
    console.log('- delivery_act_document_id');
    console.log('- site_inspection_report_document_id');
    console.log('- inspection_acta_document_id');
    console.log('- manager_contract_decision');
    console.log('- manager_contract_decision_reason');
    console.log('- manager_contract_decision_at');
    console.log('- manager_contract_decision_by');
    console.log('- offer_valid_until');
    console.log('- offer_kind');
    console.log('- offer_signed_uploaded_at');
    console.log('- backoffice_approved_at');
    console.log('- commercial_accepted_offer_at');
    console.log('- signed_offer_received_at');
    console.log('- client_registered_at');
    console.log('- client_registration_requested_at');
    console.log('- client_approved_at');
    console.log('- operations_notes');
    console.log('- estimated_arrival_at');
    console.log('- estimated_arrival_updated_at');
    console.log('- dispatch_items_json');
    console.log('- dispatch_notes');
    console.log('- delivery_guides_json');
    console.log('- delivery_guides_uploaded_at');
    console.log('- delivery_act_number');
    console.log('- delivery_act_dispatched_by');
    console.log('- delivery_act_dispatched_at');
    console.log('- delivery_act_delivered_by');
    console.log('- delivery_act_delivered_at');
    console.log('- delivery_act_observations_json');
    console.log('- delivery_act_draft_document_id');
    console.log('- delivery_act_draft_generated_at');
    console.log('- delivery_act_generated_at');
    console.log('- delivery_act_assigned_to_user_id');
    console.log('- delivery_act_assigned_to_email');
    console.log('- delivery_act_assigned_to_name');
    console.log('- delivery_act_assigned_at');
    console.log('- delivery_act_assigned_by');
    console.log('- delivery_act_logistics_signed_document_id');
    console.log('- delivery_act_logistics_signed_at');
    console.log('- delivery_act_logistics_signed_by');
    console.log('- site_inspection');
    console.log('- site_inspection_status');
    console.log('- site_inspection_result');
    console.log('- site_inspection_follow_up_date');
    console.log('- site_inspection_report_link');
    console.log('- site_inspection_report_generated_at');
    console.log('- site_inspection_ready_for_installation');
    console.log('- site_inspection_requires_reinspection');
    console.log('- site_inspection_updated_at');
    console.log('- site_inspection_updated_by');
    console.log('- site_inspection_updated_by_email');
    console.log('- comodato_business_case_id');
    console.log('- equipment_purchase_request_id');
    console.log('- client_request_id');
    console.log('- client_snapshot');
    console.log('- client_type');
    console.log('- status_unified (enum completo)');

    console.log('\n=== ÍNDICES CREADOS ===');
    console.log('- idx_equipment_purchase_forwarded_to_acp');
    console.log('- idx_equipment_purchase_business_case');
    console.log('- idx_equipment_purchase_status_unified');

    console.log('\n✅ MIGRACIÓN 171 APLICADA EXITOSAMENTE!');

  } catch (error) {
    console.error('[MIGRACIÓN 171] ERROR:', error.message);
    console.error('[MIGRACIÓN 171] Stack:', error.stack);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration();
