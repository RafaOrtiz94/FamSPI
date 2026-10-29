const db = require("./src/config/db");

async function logMigration(name, operation, table, field, success, error = null) {
  try {
    await db.query(
      `INSERT INTO migration_audit_log (migration_name, phase, operation, table_name, field_name, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, 'execution', operation, table, field, success, error]
    );
  } catch (err) {
    console.warn("⚠️ No se pudo registrar en migration_audit_log:", err.message);
  }
}

async function migrate() {
  const start = Date.now();
  try {
    console.log("🚀 Iniciando migraciones en Neon...");

    // 0. Asegurar tabla migration_audit_log
    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_audit_log (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL,
        phase VARCHAR(50) NOT NULL,
        operation VARCHAR(100) NOT NULL,
        table_name VARCHAR(100),
        field_name VARCHAR(100),
        rows_affected INTEGER DEFAULT 0,
        details TEXT,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        execution_duration_ms INTEGER,
        success BOOLEAN DEFAULT true,
        error_message TEXT
      );
    `);
    console.log("✅ Tabla 'migration_audit_log' asegurada");
    
    // 1. scheduled_visits.justification
    await db.query(`ALTER TABLE scheduled_visits ADD COLUMN IF NOT EXISTS justification TEXT;`);
    console.log("✅ Columna 'justification' añadida a 'scheduled_visits'");
    await logMigration('migrate_justification.js', 'ADD COLUMN', 'scheduled_visits', 'justification', true);
    
    // 2. visit_schedules.general_justification
    await db.query(`ALTER TABLE visit_schedules ADD COLUMN IF NOT EXISTS general_justification TEXT;`);
    console.log("✅ Columna 'general_justification' añadida a 'visit_schedules'");
    await logMigration('migrate_justification.js', 'ADD COLUMN', 'visit_schedules', 'general_justification', true);

    // 3. visit_schedules.review_notes
    await db.query(`ALTER TABLE visit_schedules ADD COLUMN IF NOT EXISTS review_notes TEXT;`);
    console.log("✅ Columna 'review_notes' añadida a 'visit_schedules'");
    await logMigration('migrate_justification.js', 'ADD COLUMN', 'visit_schedules', 'review_notes', true);
    
    console.log(`✨ Todas las migraciones completadas exitosamente en ${Date.now() - start}ms.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error en migración:", err);
    await logMigration('migrate_justification.js', 'FAILED', null, null, false, err.message);
    process.exit(1);
  }
}
migrate();
