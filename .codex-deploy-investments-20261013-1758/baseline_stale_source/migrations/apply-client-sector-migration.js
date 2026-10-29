/**
 * Script para aplicar la migración de client_sector
 * Ejecutar con: node backend/migrations/apply-client-sector-migration.js
 */

const db = require('../src/config/db');

async function applyMigration() {
    try {
        console.log('🔄 Aplicando migración: agregar columna client_sector...');

        // Verificar si la columna ya existe en client_requests
        const checkColumnRequests = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'client_requests' 
      AND column_name = 'client_sector'
    `);

        if (checkColumnRequests.rows.length === 0) {
            // Agregar la columna a client_requests
            await db.query(`
        ALTER TABLE client_requests 
        ADD COLUMN client_sector VARCHAR(20) DEFAULT 'privado'
      `);
            console.log('✅ Columna client_sector agregada a client_requests');

            // Actualizar registros existentes
            const updateResult = await db.query(`
        UPDATE client_requests 
        SET client_sector = 'privado' 
        WHERE client_sector IS NULL
      `);
            console.log(`✅ ${updateResult.rowCount} registros actualizados en client_requests`);

            // Agregar comentario
            await db.query(`
        COMMENT ON COLUMN client_requests.client_sector 
        IS 'Sector del cliente: publico o privado'
      `);
            console.log('✅ Comentario agregado a client_requests.client_sector');
        } else {
            console.log('✅ La columna client_sector ya existe en client_requests');
        }

        // Verificar si la columna ya existe en clients
        const checkColumnClients = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' 
      AND column_name = 'client_sector'
    `);

        if (checkColumnClients.rows.length === 0) {
            // Agregar la columna a clients
            await db.query(`
        ALTER TABLE clients 
        ADD COLUMN client_sector VARCHAR(20) DEFAULT 'privado'
      `);
            console.log('✅ Columna client_sector agregada a clients');

            // Actualizar registros existentes
            const updateResultClients = await db.query(`
        UPDATE clients 
        SET client_sector = 'privado' 
        WHERE client_sector IS NULL
      `);
            console.log(`✅ ${updateResultClients.rowCount} registros actualizados en clients`);

            // Agregar comentario
            await db.query(`
        COMMENT ON COLUMN clients.client_sector 
        IS 'Sector del cliente: publico o privado'
      `);
            console.log('✅ Comentario agregado a clients.client_sector');
        } else {
            console.log('✅ La columna client_sector ya existe en clients');
        }

        console.log('\n🎉 Migración completada exitosamente!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error al aplicar la migración:', error);
        process.exit(1);
    }
}

applyMigration();
