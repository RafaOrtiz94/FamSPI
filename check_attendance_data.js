const db = require('./backend/src/config/db');

async function checkAttendanceData() {
  try {
    console.log('🔍 Verificando datos de attendance en la base de datos...');

    // Verificar estructura de la tabla
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_attendance_records'
      ORDER BY ordinal_position;
    `;

    console.log('\n📋 Estructura de user_attendance_records:');
    const schema = await db.query(schemaQuery);
    schema.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

    // Verificar datos de hoy
    console.log('\n📅 Datos de attendance para hoy:');
    const todayData = await db.query(`
      SELECT id, user_id, date, entry_time, lunch_start_time, lunch_end_time, exit_time,
             entry_location, lunch_start_location, lunch_end_location, exit_location,
             created_at, updated_at
      FROM user_attendance_records
      WHERE date = CURRENT_DATE
      ORDER BY id DESC
      LIMIT 5;
    `);

    if (todayData.rows.length === 0) {
      console.log('  ❌ No hay registros de attendance para hoy');
    } else {
      todayData.rows.forEach((row, index) => {
        console.log(`\n  Registro ${index + 1}:`);
        console.log(`    ID: ${row.id}, User: ${row.user_id}, Date: ${row.date}`);
        console.log(`    entry_time: ${row.entry_time} (${typeof row.entry_time})`);
        console.log(`    lunch_start_time: ${row.lunch_start_time} (${typeof row.lunch_start_time})`);
        console.log(`    lunch_end_time: ${row.lunch_end_time} (${typeof row.lunch_end_time})`);
        console.log(`    exit_time: ${row.exit_time} (${typeof row.exit_time})`);
        console.log(`    created_at: ${row.created_at} (${typeof row.created_at})`);
        console.log(`    updated_at: ${row.updated_at} (${typeof row.updated_at})`);
      });
    }

    // Verificar el registro específico id=56
    console.log('\n🔍 Registro específico ID=56:');
    const specificRecord = await db.query(`
      SELECT id, user_id, date, entry_time, lunch_start_time, lunch_end_time, exit_time,
             entry_location, lunch_start_location, lunch_end_location, exit_location,
             created_at, updated_at
      FROM user_attendance_records
      WHERE id = 56;
    `);

    if (specificRecord.rows.length === 0) {
      console.log('  ❌ No se encontró el registro con ID=56');
    } else {
      const row = specificRecord.rows[0];
      console.log(`    ID: ${row.id}, User: ${row.user_id}, Date: ${row.date}`);
      console.log(`    entry_time: ${row.entry_time} (${typeof row.entry_time})`);
      console.log(`    lunch_start_time: ${row.lunch_start_time} (${typeof row.lunch_start_time})`);
      console.log(`    lunch_end_time: ${row.lunch_end_time} (${typeof row.lunch_end_time})`);
      console.log(`    exit_time: ${row.exit_time} (${typeof row.exit_time})`);
      console.log(`    created_at: ${row.created_at} (${typeof row.created_at})`);
      console.log(`    updated_at: ${row.updated_at} (${typeof row.updated_at})`);
    }

    // Verificar registros del usuario 5
    console.log('\n👤 Registros del usuario 5 (últimos 5):');
    const userRecords = await db.query(`
      SELECT id, user_id, date, entry_time, lunch_start_time, lunch_end_time, exit_time,
             created_at, updated_at
      FROM user_attendance_records
      WHERE user_id = 5
      ORDER BY id DESC
      LIMIT 5;
    `);

    if (userRecords.rows.length === 0) {
      console.log('  ❌ No hay registros para el usuario 5');
    } else {
      userRecords.rows.forEach((row, index) => {
        console.log(`\n  Registro ${index + 1}:`);
        console.log(`    ID: ${row.id}, Date: ${row.date}`);
        console.log(`    entry_time: ${row.entry_time} (${typeof row.entry_time})`);
        console.log(`    lunch_start_time: ${row.lunch_start_time} (${typeof row.lunch_start_time})`);
        console.log(`    lunch_end_time: ${row.lunch_end_time} (${typeof row.lunch_end_time})`);
        console.log(`    exit_time: ${row.exit_time} (${typeof row.exit_time})`);
        console.log(`    created_at: ${row.created_at} (${typeof row.created_at})`);
        console.log(`    updated_at: ${row.updated_at} (${typeof row.updated_at})`);
      });
    }

    // Verificar total de registros
    console.log('\n📊 Total de registros de attendance:');
    const totalCount = await db.query('SELECT COUNT(*) as total FROM user_attendance_records;');
    console.log(`  Total registros: ${totalCount.rows[0].total}`);

  } catch (err) {
    console.error('❌ Error verificando datos:', err);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

checkAttendanceData();