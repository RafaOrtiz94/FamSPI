require("dotenv").config();

const crypto = require("crypto");
const { Client } = require("pg");

function normText(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function isGenericOdooClientName(name) {
  const normalized = normText(name)?.toUpperCase() || "";
  if (!normalized) return true;
  return /^CLIENTE( ID)?\s+[0-9]{1,13}$/.test(normalized);
}

async function main() {
  const source = new Client({
    host: process.env.ODOO_DB_HOST || "localhost",
    port: Number.parseInt(process.env.ODOO_DB_PORT || "5433", 10),
    user: process.env.ODOO_DB_USER || "odoo",
    password: process.env.ODOO_DB_PASSWORD || "odoo123",
    database: process.env.ODOO_DB_NAME || "OdooFAM",
    ssl: false,
  });

  const target = new Client({
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:
      String(process.env.DB_SSL || "").toLowerCase() === "true"
        ? { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "").toLowerCase() === "true" }
        : false,
  });

  const maxRows = Math.max(1, Number.parseInt(process.env.ODOO_DIRECT_MAX_ROWS || "5000", 10));

  await source.connect();
  await target.connect();

  await target.query(`
    ALTER TABLE public.client_requests
      ADD COLUMN IF NOT EXISTS external_source TEXT,
      ADD COLUMN IF NOT EXISTS external_id TEXT,
      ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ
  `);

  const { rows: partners } = await source.query(
    `
      SELECT
        rp.id,
        rp.name,
        rp.write_date,
        rp.vat,
        rp.email,
        rp.phone,
        rp.street,
        rp.street2,
        rp.city,
        rcs.name AS state_name
      FROM res_partner rp
      LEFT JOIN res_country_state rcs ON rcs.id = rp.state_id
      WHERE COALESCE(rp.active, TRUE) = TRUE
        AND COALESCE(rp.customer_rank, 0) > 0
      ORDER BY rp.id ASC
      LIMIT $1
    `,
    [maxRows],
  );

  let inserted = 0;
  let updated = 0;

  for (const partner of partners) {
    const externalId = String(partner.id);
    const rawName = normText(partner.name);
    const email = normText(partner.email) || `odoo-client-${externalId}@spi.local`;
    const vat = normText(partner.vat) || `ODOO-${externalId}`;
    const name = !isGenericOdooClientName(rawName)
      ? rawName
      : `RUC ${vat}`;
    const shippingAddress =
      normText([partner.street, partner.street2].filter(Boolean).join(" ").trim()) ||
      "Direccion no registrada";
    const city = normText(partner.city) || "Ciudad no especificada";
    const province = normText(partner.state_name) || "Provincia no especificada";
    const phone = normText(partner.phone);

    const updateResult = await target.query(
      `
        UPDATE client_requests
        SET
          status = 'approved',
          approved_at = COALESCE(approved_at, NOW()),
          external_updated_at = COALESCE($2::timestamptz, external_updated_at),
          last_synced_at = NOW(),
          commercial_name = COALESCE(NULLIF($3, ''), commercial_name),
          ruc_cedula = COALESCE(NULLIF($4, ''), ruc_cedula),
          client_email = COALESCE(NULLIF($5, ''), client_email),
          consent_recipient_email = COALESCE(NULLIF($6, ''), consent_recipient_email),
          shipping_contact_name = COALESCE(NULLIF($7, ''), shipping_contact_name),
          shipping_address = COALESCE(NULLIF($8, ''), shipping_address),
          shipping_city = COALESCE(NULLIF($9, ''), shipping_city),
          shipping_province = COALESCE(NULLIF($10, ''), shipping_province),
          shipping_phone = COALESCE(NULLIF($11, ''), shipping_phone),
          shipping_cellphone = COALESCE(NULLIF($12, ''), shipping_cellphone)
        WHERE LOWER(COALESCE(external_source, '')) = 'odoo'
          AND external_id = $1
        RETURNING id
      `,
      [
        externalId,
        partner.write_date || null,
        name,
        vat,
        email,
        email,
        name,
        shippingAddress,
        city,
        province,
        phone,
        null,
      ],
    );

    if (updateResult.rowCount > 0) {
      updated += 1;
      continue;
    }

    await target.query(
      `
        INSERT INTO client_requests (
          created_by,
          status,
          approved_at,
          external_source,
          external_id,
          external_updated_at,
          last_synced_at,
          lopdp_token,
          client_type,
          data_processing_consent,
          lopdp_consent_status,
          consent_capture_method,
          consent_capture_details,
          lopdp_consent_method,
          lopdp_consent_details,
          lopdp_consent_at,
          client_sector,
          commercial_name,
          ruc_cedula,
          client_email,
          consent_recipient_email,
          shipping_contact_name,
          shipping_address,
          shipping_city,
          shipping_province,
          shipping_phone,
          shipping_cellphone
        )
        VALUES (
          'odoo_sync@spi.local',
          'approved',
          NOW(),
          'odoo',
          $1,
          $2::timestamptz,
          NOW(),
          $3,
          'persona_juridica',
          TRUE,
          'granted',
          'odoo_sync',
          'Cliente importado automaticamente desde Odoo DB',
          'odoo_sync',
          'Consentimiento heredado de Odoo DB',
          NOW(),
          'privado',
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
      `,
      [
        externalId,
        partner.write_date || null,
        crypto.randomBytes(24).toString("hex"),
        name,
        vat,
        email,
        email,
        name,
        shippingAddress,
        city,
        province,
        phone,
        null,
      ],
    );
    inserted += 1;
  }

  const { rows: totals } = await target.query(
    `
      SELECT COUNT(*)::int AS total
      FROM client_requests
      WHERE LOWER(COALESCE(external_source, '')) = 'odoo'
    `,
  );

  console.log(`Procesados desde Odoo DB: ${partners.length}`);
  console.log(`Insertados: ${inserted}`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Total Odoo en SPI: ${totals[0]?.total || 0}`);

  await source.end();
  await target.end();
}

main().catch((error) => {
  console.error("Fallo backfill directo Odoo DB:", error?.message || error);
  process.exit(1);
});
