const db = require('./backend/src/config/db');

async function createTestData() {
  try {
    console.log('🔍 Creando datos de prueba para attendance...');

    const userId = 1; // Asumiendo que hay un usuario con ID 1
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    console.log('Insertando:', { userId, today, now });

    const result = await db.query(
      `INSERT INTO user_attendance_records (user_id, date, entry_time)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date) DO NOTHING
       RETURNING *`,
      [userId, today, now]
    );

    console.log('✅ Datos creados:', result.rows[0]);

    // Verificar qué devuelve la consulta SELECT
    const selectResult = await db.query(
      'SELECT * FROM user_attendance_records WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    const data = selectResult.rows[0];
    console.log('📊 Datos desde SELECT:', data);

    if (data) {
      console.log('🔍 Tipos de datos:');
      console.log('  entry_time:', typeof data.entry_time, data.entry_time?.constructor?.name);
      console.log('  lunch_start_time:', typeof data.lunch_start_time, data.lunch_start_time?.constructor?.name);
      console.log('  lunch_end_time:', typeof data.lunch_end_time, data.lunch_end_time?.constructor?.name);
      console.log('  exit_time:', typeof data.exit_time, data.exit_time?.constructor?.name);
      console.log('  date:', typeof data.date, data.date?.constructor?.name);
      console.log('  created_at:', typeof data.created_at, data.created_at?.constructor?.name);
      console.log('  updated_at:', typeof data.updated_at, data.updated_at?.constructor?.name);

      // Probar JSON.stringify
      console.log('📝 JSON.stringify result:', JSON.stringify(data));
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await db.end();
  }
}

createTestData();