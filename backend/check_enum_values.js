// check_enum_values.js - Verificar valores del enum private_purchase_status_enum
const db = require('./src/config/db');

async function checkEnumValues() {
  console.log('🔍 Verificando valores del enum private_purchase_status_enum');

  try {
    const result = await db.query(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'private_purchase_status_enum'
      ORDER BY e.enumsortorder
    `);

    console.log('📋 Valores del enum encontrados:');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. '${row.enumlabel}'`);
    });

    // Verificar si existe 'delivered'
    const hasDelivered = result.rows.some(row => row.enumlabel === 'delivered');
    console.log(`\n🎯 ¿Existe 'delivered'? ${hasDelivered}`);

    // Verificar si existe 'delivered_signed'
    const hasDeliveredSigned = result.rows.some(row => row.enumlabel === 'delivered_signed');
    console.log(`🎯 ¿Existe 'delivered_signed'? ${hasDeliveredSigned}`);

    // Verificar si existe 'delivered_pending_signatures'
    const hasDeliveredPendingSignatures = result.rows.some(row => row.enumlabel === 'delivered_pending_signatures');
    console.log(`🎯 ¿Existe 'delivered_pending_signatures'? ${hasDeliveredPendingSignatures}`);

  } catch (error) {
    console.error('❌ Error consultando enum:', error);
  } finally {
    process.exit(0);
  }
}

checkEnumValues();
