const db = require("./src/config/db");

async function fixConstraint() {
    try {
        console.log("🔧 Eliminando restricción antigua...");
        await db.query(`
      ALTER TABLE client_visit_logs 
      DROP CONSTRAINT IF EXISTS client_visit_logs_status_check;
    `);

        console.log("✅ Agregando nueva restricción con 'in_visit'...");
        await db.query(`
      ALTER TABLE client_visit_logs 
      ADD CONSTRAINT client_visit_logs_status_check 
      CHECK (status IN ('visited', 'pending', 'skipped', 'in_visit'));
    `);

        console.log("✅ Restricción actualizada correctamente");
        console.log("📋 Estados permitidos: visited, pending, skipped, in_visit");
    } catch (err) {
        console.error("❌ Error actualizando restricción:", err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

fixConstraint();
