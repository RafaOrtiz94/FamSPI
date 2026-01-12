const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "FamDb",
  database: "FamSPI"
});

async function applyParts() {
  try {
    console.log("Applying PART 1: Add new fields...");

    // Part 1: Add new fields
    const part1 = `
      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS client_registration_requested_at TIMESTAMPTZ;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS manager_contract_decision TEXT CHECK (manager_contract_decision IN ('approved', 'rejected', 'pending'));

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS manager_contract_decision_reason TEXT;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS manager_contract_decision_at TIMESTAMPTZ;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS manager_contract_decision_by INTEGER REFERENCES users(id);

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS delivery_dates_json JSONB DEFAULT '{}'::jsonb;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS delivery_start_at TIMESTAMPTZ;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS delivery_end_at TIMESTAMPTZ;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS contract_document_id VARCHAR(255);

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS delivery_act_document_id VARCHAR(255);

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS business_case_id UUID;

      ALTER TABLE private_purchase_requests
      ADD COLUMN IF NOT EXISTS comodato_business_case_id UUID;
    `;

    await pool.query(part1);
    console.log("PART 1 applied successfully!");

    console.log("Applying PART 2: Create corrections table...");

    // Part 2: Create corrections table
    const part2 = `
      CREATE TABLE IF NOT EXISTS purchase_corrections (
        id SERIAL PRIMARY KEY,
        private_purchase_id UUID NOT NULL,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        correction_details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        status TEXT DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'resolved', 'rejected'))
      );

      CREATE INDEX IF NOT EXISTS idx_purchase_corrections_purchase_id ON purchase_corrections(private_purchase_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_corrections_created_by ON purchase_corrections(created_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_corrections_status ON purchase_corrections(status);
      CREATE INDEX IF NOT EXISTS idx_purchase_corrections_created_at ON purchase_corrections(created_at DESC);
    `;

    await pool.query(part2);
    console.log("PART 2 applied successfully!");

    // Add foreign key constraint separately
    console.log("Adding FK constraint...");
    try {
      await pool.query(`
        ALTER TABLE purchase_corrections
        ADD CONSTRAINT fk_purchase_corrections_private_purchase
        FOREIGN KEY (private_purchase_id) REFERENCES private_purchase_requests(id) ON DELETE CASCADE;
      `);
      console.log("FK constraint added!");
    } catch (fkError) {
      console.log("FK constraint may already exist or issue:", fkError.message);
    }

    console.log("Applying PART 3: Update defaults...");

    // Part 4: Update defaults
    const part4 = `
      UPDATE private_purchase_requests
      SET
        manager_contract_decision = 'pending',
        delivery_dates_json = '{}'::jsonb
      WHERE manager_contract_decision IS NULL;
    `;

    await pool.query(part4);
    console.log("PART 4 applied successfully!");

    console.log("Migration applied successfully!");

    // Verify
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests'
        AND column_name IN (
          'client_registration_requested_at',
          'client_approved_at',
          'manager_contract_decision',
          'contract_document_id'
        )
    `);
    console.log('Key new columns added:', result.rows.map(r => r.column_name));

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

applyParts();