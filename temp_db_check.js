const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'FamSPI',
  user: 'postgres',
  password: 'FamDb',
});

async function runQueries() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos FamSPI\n');

    // VALIDACIÓN OBLIGATORIA DE DATOS REALES PARA DASHBOARD
    console.log('=== VALIDACIÓN DASHBOARD: DATOS REALES vs ENDPOINT ===');

    // 1. BC_MASTER
    const bcCountQuery = await client.query(`SELECT COUNT(*) FROM bc_master;`);
    console.log(`📊 BC_MASTER total: ${bcCountQuery.rows[0].count}`);

    const bcStatusQuery = await client.query(`
      SELECT current_stage as status, COUNT(*) as total
      FROM bc_master
      GROUP BY current_stage
      ORDER BY total DESC;
    `);
    console.log('📊 BC_MASTER por estado:');
    console.table(bcStatusQuery.rows);

    // Calcular métricas como el endpoint
    const totalBC = bcStatusQuery.rows.reduce((sum, row) => sum + parseInt(row.total), 0);
    const bcActivos = bcStatusQuery.rows
      .filter(r => ['draft', 'waiting_proforma', 'new'].includes(r.status))
      .reduce((sum, row) => sum + parseInt(row.total), 0);
    console.log(`📊 Endpoint debería mostrar: totalBC=${totalBC}, bcActivos=${bcActivos}, bcCompletados=0`);

    // 2. REQUESTS
    const requestsCountQuery = await client.query(`SELECT COUNT(*) FROM requests;`);
    console.log(`📋 REQUESTS total: ${requestsCountQuery.rows[0].count}`);

    const requestsStatusQuery = await client.query(`
      SELECT status, COUNT(*) as total
      FROM requests
      GROUP BY status
      ORDER BY total DESC;
    `);
    console.log('📋 REQUESTS por estado:');
    console.table(requestsStatusQuery.rows);

    // Calcular solicitudes pendientes como el endpoint
    const solicitudesPendientes = requestsStatusQuery.rows
      .filter(r => ['pendiente'].includes(r.status))
      .reduce((sum, row) => sum + parseInt(row.total), 0);
    console.log(`📋 Endpoint debería mostrar: solicitudesPendientes=${solicitudesPendientes}`);

    // 3. CLIENTS
    const clientsCountQuery = await client.query(`SELECT COUNT(*) FROM clients;`);
    console.log(`👥 CLIENTS total: ${clientsCountQuery.rows[0].count}`);

    const newClientsQuery = await client.query(`
      SELECT COUNT(*) as nuevos_30d
      FROM clients
      WHERE created_at >= NOW() - INTERVAL '30 days';
    `);
    console.log(`👥 CLIENTS nuevos 30d: ${newClientsQuery.rows[0].nuevos_30d}`);
    console.log(`👥 Endpoint debería mostrar: clientesNuevos30d=${newClientsQuery.rows[0].nuevos_30d}`);

    // 4. REQUESTS MENSUALES
    const monthlyTrendQuery = await client.query(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') mes, COUNT(*) total
      FROM requests
      WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
      GROUP BY 1
      ORDER BY 1;
    `);
    console.log('📈 REQUESTS por mes (últimos 6 meses):');
    console.table(monthlyTrendQuery.rows);
    console.log(`📈 Endpoint debería mostrar chart con ${monthlyTrendQuery.rows.length} meses de datos`);

    // RESUMEN PARA VALIDACIÓN
    console.log('\n=== RESUMEN PARA VALIDACIÓN ENDPOINT ===');
    console.log(`totalBC: ${totalBC} (debe coincidir con COUNT(*))`);
    console.log(`bcActivos: ${bcActivos} (debe coincidir con estados activos)`);
    console.log(`bcCompletados: 0 (debe ser 0 según mapping)`);
    console.log(`solicitudesPendientes: ${solicitudesPendientes} (debe coincidir con status='pendiente')`);
    console.log(`clientesNuevos30d: ${newClientsQuery.rows[0].nuevos_30d} (debe coincidir con query)`);
    console.log(`bcStatus chart: ${JSON.stringify({ labels: bcStatusQuery.rows.map(r => r.status), data: bcStatusQuery.rows.map(r => parseInt(r.total)), hasData: true })}`);
    console.log(`requestsMonthly chart: ${JSON.stringify({ labels: monthlyTrendQuery.rows.map(r => r.mes), data: monthlyTrendQuery.rows.map(r => parseInt(r.total)), hasData: true })}`);

    // Verificar vistas dashboard
    console.log('\n=== VERIFICACIÓN DE VISTAS DASHBOARD ===');
    const dashboardViews = ['vw_dashboard_requests', 'vw_request_metrics'];
    for (const viewName of dashboardViews) {
      try {
        const viewCheckQuery = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
          LIMIT 10;
        `, [viewName]);

        if (viewCheckQuery.rows.length > 0) {
          console.log(`\n📊 Vista: ${viewName}`);
          console.table(viewCheckQuery.rows);
        }
      } catch (err) {
        console.log(`❌ Vista ${viewName} no encontrada: ${err.message}`);
      }
    }

    // Payload final sugerido
    console.log('\n=== PAYLOAD FINAL PROPUESTO PARA ENDPOINT ===');
    const payload = {
      kpis: {
        totalBC: bcStatusQuery.rows.reduce((sum, row) => sum + parseInt(row.total), 0),
        bcActivos: bcStatusQuery.rows.find(r => r.status === 'waiting_proforma' || r.status === 'new')?.total || 0,
        bcCompletados: bcStatusQuery.rows.find(r => r.status === 'completed' || r.status === 'approved')?.total || 0,
        solicitudesPendientes: requestsStatusQuery.rows.find(r => r.status === 'pendiente')?.total || 0,
        clientesNuevos30d: newClientsQuery.rows[0].nuevos_30d
      },
      charts: {
        bcStatus: {
          labels: bcStatusQuery.rows.map(r => r.status),
          data: bcStatusQuery.rows.map(r => parseInt(r.total))
        },
        requestsMonthly: {
          labels: monthlyTrendQuery.rows.map(r => r.mes),
          data: monthlyTrendQuery.rows.map(r => parseInt(r.total))
        }
      }
    };

    console.log(JSON.stringify(payload, null, 2));

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

runQueries();
