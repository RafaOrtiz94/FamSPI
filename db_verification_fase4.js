// DB Verification Script for FASE 4
// Run with: node db_verification_fase4.js

const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "FamDb",
  database: "FamSPI"
});

async function verifyDB() {
  console.log("[FASE4_DB] Iniciando verificación de DB...");

  try {
    // 1.1 Confirmar estructura private_purchase_requests
    console.log("\n[FASE4_DB][STRUCTURE] Verificando private_purchase_requests...");
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests'
      ORDER BY ordinal_position
    `);

    console.log("Columnas encontradas:");
    structureResult.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Verificar columnas críticas de FASE 2/3
    const criticalColumns = [
      'client_registration_requested_at',
      'client_approved_at',
      'manager_contract_decision',
      'contract_document_id',
      'delivery_act_document_id'
    ];

    const existingColumns = structureResult.rows.map(r => r.column_name);
    const missingCritical = criticalColumns.filter(col => !existingColumns.includes(col));

    if (missingCritical.length === 0) {
      console.log("✅ Todas las columnas críticas de FASE 2/3 están presentes");
    } else {
      console.log("❌ Columnas críticas faltantes:", missingCritical);
    }

    // 1.2 Verificar purchase_corrections
    console.log("\n[FASE4_DB][CORRECTIONS] Verificando purchase_corrections...");
    const correctionsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'purchase_corrections'
      ORDER BY ordinal_position
    `);

    if (correctionsStructure.rows.length > 0) {
      console.log("✅ Tabla purchase_corrections existe");
      console.log("Columnas:");
      correctionsStructure.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log("❌ Tabla purchase_corrections no encontrada");
    }

    // 1.3 Buscar inconsistencias
    console.log("\n[FASE4_DB][INCONSISTENCIES] Buscando inconsistencias...");

    // Compras con oferta firmada pero sin cliente aprobado
    const signedWithoutApproval = await pool.query(`
      SELECT id, status, client_registration_requested_at, client_approved_at
      FROM private_purchase_requests
      WHERE (status ILIKE '%offer_signed%' OR status ILIKE '%signed%')
        AND client_approved_at IS NULL
      ORDER BY created_at DESC LIMIT 20
    `);

    console.log(`Compras con oferta firmada sin cliente aprobado: ${signedWithoutApproval.rows.length}`);
    if (signedWithoutApproval.rows.length > 0) {
      console.log("❌ INCONSISTENCIA DETECTADA: Ofertas firmadas sin aprobación de cliente");
      signedWithoutApproval.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Status: ${row.status}, Approved: ${row.client_approved_at}`);
      });
    } else {
      console.log("✅ No se encontraron ofertas firmadas sin aprobación de cliente");
    }

    // Contrato subido pero decisión de gerencia no existe
    const contractWithoutDecision = await pool.query(`
      SELECT id, status, manager_contract_decision, contract_document_id
      FROM private_purchase_requests
      WHERE contract_document_id IS NOT NULL
        AND (manager_contract_decision IS NULL OR manager_contract_decision = 'pending')
      ORDER BY created_at DESC LIMIT 20
    `);

    console.log(`Contratos subidos sin decisión de gerencia: ${contractWithoutDecision.rows.length}`);
    if (contractWithoutDecision.rows.length > 0) {
      console.log("❌ INCONSISTENCIA DETECTADA: Contratos sin decisión de gerencia");
      contractWithoutDecision.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Decision: ${row.manager_contract_decision}, Contract: ${row.contract_document_id}`);
      });
    } else {
      console.log("✅ Todos los contratos tienen decisión de gerencia");
    }

    // Correcciones abiertas duplicadas
    const duplicateCorrections = await pool.query(`
      SELECT private_purchase_id, COUNT(*) as count
      FROM purchase_corrections
      WHERE status = 'open'
      GROUP BY private_purchase_id
      HAVING COUNT(*) > 1
    `);

    console.log(`Compras con correcciones abiertas duplicadas: ${duplicateCorrections.rows.length}`);
    if (duplicateCorrections.rows.length > 0) {
      console.log("⚠️  POSIBLE INCONSISTENCIA: Correcciones abiertas duplicadas");
      duplicateCorrections.rows.forEach(row => {
        console.log(`  Purchase ID: ${row.private_purchase_id}, Count: ${row.count}`);
      });
    } else {
      console.log("✅ No hay correcciones abiertas duplicadas");
    }

    // 1.4 Estados usados en DB
    console.log("\n[FASE4_DB][STATES] Estados encontrados en DB:");
    const statesInDB = await pool.query(`
      SELECT DISTINCT status, COUNT(*) as count
      FROM private_purchase_requests
      GROUP BY status
      ORDER BY status
    `);

    console.log("Estados y conteos:");
    statesInDB.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Verificar que todos los estados estén definidos en código
    const knownStates = [
      'draft', 'client_registered', 'offer_submitted', 'offer_signed', 'contract_submitted',
      'pending_manager_contract_approval', 'contract_rejected_needs_correction',
      'contract_approved_pending_upload', 'pending_operations_schedule',
      'awaiting_dispatch', 'delivered_pending_signatures', 'completed'
    ];

    const unknownStates = statesInDB.rows.filter(row =>
      !knownStates.some(state => row.status.toLowerCase().includes(state.toLowerCase()))
    );

    if (unknownStates.length > 0) {
      console.log("⚠️  Estados desconocidos en DB:");
      unknownStates.forEach(row => {
        console.log(`  ${row.status}: ${row.count}`);
      });
    } else {
      console.log("✅ Todos los estados en DB están reconocidos");
    }

    // 1.5 Muestra de datos para timeline
    console.log("\n[FASE4_DB][SAMPLE] Muestra de datos para timeline (últimas 3 compras):");
    const sampleData = await pool.query(`
      SELECT id, status, client_registration_requested_at, client_approved_at,
             manager_contract_decision, contract_document_id, delivery_act_document_id,
             created_at
      FROM private_purchase_requests
      ORDER BY created_at DESC LIMIT 3
    `);

    sampleData.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Client registered: ${row.client_registration_requested_at}`);
      console.log(`  Client approved: ${row.client_approved_at}`);
      console.log(`  Manager decision: ${row.manager_contract_decision}`);
      console.log(`  Contract doc: ${row.contract_document_id}`);
      console.log(`  Delivery act: ${row.delivery_act_document_id}`);
      console.log(`  Created: ${row.created_at}`);
      console.log("---");
    });

    // 1.6 Verificar LOPDP
    console.log("\n[FASE4_DB][LOPDP] Verificando consentimientos LOPDP:");
    const lopdpCount = await pool.query(`
      SELECT COUNT(*) as count FROM user_lopdp_consents
    `);

    console.log(`Total consentimientos LOPDP: ${lopdpCount.rows[0].count}`);

    const recentLopdp = await pool.query(`
      SELECT id, user_id, consent_given, created_at
      FROM user_lopdp_consents
      ORDER BY created_at DESC LIMIT 3
    `);

    console.log("Consentimientos recientes:");
    recentLopdp.rows.forEach(row => {
      console.log(`  User ${row.user_id}: ${row.consent_given} (${row.created_at})`);
    });

    console.log("\n[FASE4_DB] =================================================");
    console.log("[FASE4_DB] REPORTE DE VERIFICACIÓN DB");
    console.log("[FASE4_DB] =================================================");

    const inconsistencies = [
      signedWithoutApproval.rows.length > 0,
      contractWithoutDecision.rows.length > 0,
      duplicateCorrections.rows.length > 0,
      unknownStates.length > 0
    ].filter(Boolean).length;

    if (inconsistencies === 0) {
      console.log("✅ DB EN PERFECTO ESTADO - Sin inconsistencias detectadas");
    } else {
      console.log(`⚠️  ${inconsistencies} tipos de inconsistencias detectadas (ver arriba)`);
      console.log("Recomendaciones:");
      console.log("- Revisar ofertas firmadas sin aprobación de cliente");
      console.log("- Verificar contratos sin decisión de gerencia");
      console.log("- Consolidar correcciones abiertas duplicadas");
      console.log("- Definir estados desconocidos o normalizar");
    }

  } catch (err) {
    console.error('Error en verificación DB:', err);
  } finally {
    await pool.end();
  }
}

verifyDB();