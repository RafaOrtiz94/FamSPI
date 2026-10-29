
const { Pool } = require("pg");
require("dotenv").config();

// Config similar to backend/src/config/db.js but without extra deps if possible
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spi_fam",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const STATE_MAPPINGS = {
    bc: {
        active: ['draft', 'waiting_proforma', 'new'],
        completed: ['completed', 'approved'],
    },
    requests: {
        pending: ['pendiente'],
    }
};

async function run() {
    console.log("Connecting to DB...");
    const client = await pool.connect();
    console.log("Connected.");

    try {
        console.log("Running queries...");
        
        // 1. bc_master
        console.time("bc_master");
        try {
            const bcStatusResult = await client.query(`
                SELECT current_stage as status, COUNT(*) as total
                FROM bc_master
                GROUP BY current_stage
                ORDER BY total DESC
                LIMIT 10
            `);
            console.log("bc_master result:", bcStatusResult.rows);
        } catch (e) {
            console.error("bc_master error:", e.message);
        }
        console.timeEnd("bc_master");

        // 2. requests
        console.time("requests");
        try {
            const requestsStatusResult = await client.query(`
                SELECT status, COUNT(*) as total
                FROM requests
                GROUP BY status
                ORDER BY total DESC
                LIMIT 10
            `);
            console.log("requests result:", requestsStatusResult.rows);
        } catch (e) {
            console.error("requests error:", e.message);
        }
        console.timeEnd("requests");

        // 3. clients
        console.time("clients");
        try {
            const newClientsResult = await client.query(`
                SELECT COUNT(*) as nuevos_30d
                FROM clients
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `);
            console.log("clients result:", newClientsResult.rows);
        } catch (e) {
            console.error("clients error:", e.message);
        }
        console.timeEnd("clients");

        // 4. monthlyTrend
        console.time("monthlyTrend");
        try {
            const monthlyTrendResult = await client.query(`
                SELECT
                  to_char(date_trunc('month', created_at), 'YYYY-MM') as mes,
                  COUNT(*) as total
                FROM requests
                WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
                GROUP BY 1
                ORDER BY 1
                LIMIT 6
            `);
            console.log("monthlyTrend result:", monthlyTrendResult.rows);
        } catch (e) {
            console.error("monthlyTrend error:", e.message);
        }
        console.timeEnd("monthlyTrend");

    } catch (error) {
        console.error("General error:", error);
    } finally {
        client.release();
        pool.end();
    }
}

run();
