const { pool } = require('./backend/src/config/db');

async function checkDateColumns() {
    try {
        console.log('=== IDENTIFICANDO COLUMNAS DE FECHA/TIMESTAMP ===');

        // List all timestamp/date columns
        const res = await pool.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone')
            ORDER BY table_name, ordinal_position
        `);

        console.table(res.rows);

        console.log('\n=== ANALIZANDO DATOS EN COLUMNAS DE FECHA ===');

        // For each table with date columns, check for nulls and invalid values
        const tables = [...new Set(res.rows.map(row => row.table_name))];

        for (const table of tables) {
            console.log(`\n--- TABLA: ${table} ---`);

            const dateColumns = res.rows.filter(row => row.table_name === table);

            for (const col of dateColumns) {
                try {
                    const stats = await pool.query(`
                        SELECT
                            COUNT(*) as total,
                            SUM(CASE WHEN ${col.column_name} IS NULL THEN 1 ELSE 0 END) as nulls,
                            MIN(${col.column_name}) as min_date,
                            MAX(${col.column_name}) as max_date
                        FROM ${table}
                    `);

                    console.log(`  ${col.column_name} (${col.data_type}):`);
                    console.log(`    Total registros: ${stats.rows[0].total}`);
                    console.log(`    Nulos: ${stats.rows[0].nulls}`);
                    console.log(`    Fecha mínima: ${stats.rows[0].min_date || 'N/A'}`);
                    console.log(`    Fecha máxima: ${stats.rows[0].max_date || 'N/A'}`);

                } catch (err) {
                    console.log(`  ${col.column_name}: Error analizando - ${err.message}`);
                }
            }
        }

        console.log('\n=== BUSCANDO COLUMNAS VARCHAR/TEXT QUE PUEDAN CONTENER FECHAS ===');

        const textCols = await pool.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND data_type IN ('character varying', 'text', 'varchar')
            ORDER BY table_name, ordinal_position
        `);

        for (const col of textCols.rows.slice(0, 10)) { // Check first 10 text columns
            try {
                const sample = await pool.query(`
                    SELECT ${col.column_name}
                    FROM ${col.table_name}
                    WHERE ${col.column_name} IS NOT NULL
                    AND ${col.column_name} != ''
                    LIMIT 5
                `);

                const values = sample.rows.map(r => r[col.column_name]).filter(v => v);
                if (values.length > 0) {
                    console.log(`${col.table_name}.${col.column_name} (muestra): ${values.join(', ')}`);
                }
            } catch (err) {
                // Ignore errors for text columns
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkDateColumns();