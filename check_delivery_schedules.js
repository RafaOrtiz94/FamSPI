const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function checkSchedules() {
  try {
    console.log('=== VERIFICACIÓN TABLA purchase_delivery_schedules ===');

    const { rows } = await pool.query(
      'SELECT * FROM purchase_delivery_schedules ORDER BY created_at DESC LIMIT 5'
    );

    console.log('Registros encontrados:', rows.length);
    rows.forEach((row, i) => {
      console.log(`\nRegistro ${i + 1}:`);
      console.log('- ID:', row.id);
      console.log('- Purchase ID:', row.private_purchase_request_id);
      console.log('- Start:', row.delivery_start_at);
      console.log('- End:', row.delivery_end_at);
      console.log('- Created:', row.created_at);

      if (row.calendar_event_ids) {
        const events = typeof row.calendar_event_ids === 'string'
          ? JSON.parse(row.calendar_event_ids)
          : row.calendar_event_ids;

        console.log('- Calendar Events:', {
          mainEventId: events.mainEventId,
          htmlLink: events.htmlLink,
          attendeesCount: events.attendees?.length || 0
        });
      }
    });

    console.log('\n✅ Verificación completada');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

checkSchedules();