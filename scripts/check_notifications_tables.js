// Script temporal para descubrir tablas de notificaciones
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FamDb',
    database: 'FamSPI'
});

async function discoverNotificationTables() {
    const client = await pool.connect();

    try {
        console.log('🔍 Buscando tablas relacionadas con notificaciones...\n');

        // Buscar tablas con "notification" en el nombre
        const tablesQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND (
          table_name LIKE '%notification%' 
          OR table_name LIKE '%notify%'
          OR table_name LIKE '%alert%'
          OR table_name LIKE '%message%'
        )
      ORDER BY table_name;
    `;

        const tablesResult = await client.query(tablesQuery);

        if (tablesResult.rows.length === 0) {
            console.log('⚠️  No se encontraron tablas de notificaciones');
        } else {
            console.log(`✅ Encontradas ${tablesResult.rows.length} tabla(s):\n`);

            for (const table of tablesResult.rows) {
                console.log(`📋 Tabla: ${table.table_name} (${table.column_count} columnas)`);

                // Obtener estructura de cada tabla
                const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `;

                const columnsResult = await client.query(columnsQuery, [table.table_name]);

                console.log('   Columnas:');
                columnsResult.rows.forEach(col => {
                    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                    const type = col.character_maximum_length
                        ? `${col.data_type}(${col.character_maximum_length})`
                        : col.data_type;
                    const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                    console.log(`   - ${col.column_name}: ${type} ${nullable}${defaultVal}`);
                });

                // Obtener índices
                const indexQuery = `
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE tablename = $1;
        `;

                const indexResult = await client.query(indexQuery, [table.table_name]);

                if (indexResult.rows.length > 0) {
                    console.log('   Índices:');
                    indexResult.rows.forEach(idx => {
                        console.log(`   - ${idx.indexname}`);
                    });
                }

                // Obtener foreign keys
                const fkQuery = `
          SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1;
        `;

                const fkResult = await client.query(fkQuery, [table.table_name]);

                if (fkResult.rows.length > 0) {
                    console.log('   Foreign Keys:');
                    fkResult.rows.forEach(fk => {
                        console.log(`   - ${fk.column_name} → ${fk.foreign_table_name}(${fk.foreign_column_name})`);
                    });
                }

                // Contar registros
                const countQuery = `SELECT COUNT(*) as total FROM ${table.table_name}`;
                const countResult = await client.query(countQuery);
                console.log(`   📊 Total de registros: ${countResult.rows[0].total}\n`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

discoverNotificationTables();
