const crypto = require("crypto");
const path = require("path");

const XLSX = require("xlsx");
const { Client } = require("pg");

const EXCEL_PATH = path.resolve(__dirname, "../../docs/Clientes/clientes.xlsx");
const MIGRATION_USER = "erp_clientes_migration@spi.local";
const EXTERNAL_SOURCE = "erp";
const ASSIGNED_BY = "jefe_operaciones@migration.spi.local";

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function upper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeKey(value) {
  return upper(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeId(value) {
  return String(value ?? "").trim().replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function firstValidEmail(values, legacyId) {
  const list = Array.isArray(values) ? values : String(values || "").split(/[;,]/);
  const email = list.map(normalizeEmail).find(isValidEmail);
  return email || `sin-correo+${legacyId}@clientes.famproject.local`;
}

function firstPhone(values) {
  const list = Array.isArray(values) ? values : String(values || "").split(/[;,]/);
  return list.map((item) => String(item || "").trim()).find(Boolean) || null;
}

function clientType(value) {
  const normalized = upper(value);
  return normalized.includes("NATURAL") ? "persona_natural" : "persona_juridica";
}

function parseAddress(rawAddress, city) {
  const raw = normalizeText(rawAddress);
  const parts = raw.split("/").map((part) => normalizeText(part)).filter(Boolean);
  if (parts.length >= 3 && normalizeKey(parts[0]) === normalizeKey(city)) {
    return parts.slice(2).join(" / ") || raw;
  }
  if (parts.length >= 2 && normalizeKey(parts[0]) === normalizeKey(city)) {
    return parts.slice(1).join(" / ") || raw;
  }
  return raw || "DIRECCION NO REGISTRADA";
}

function loadRows() {
  const workbook = XLSX.readFile(EXCEL_PATH, { raw: false });
  const sheet = workbook.Sheets.JSON || workbook.Sheets.Clientes;
  if (!sheet) {
    throw new Error("El Excel no contiene hoja JSON ni Clientes");
  }

  if (workbook.Sheets.JSON) {
    return XLSX.utils.sheet_to_json(sheet, { defval: "" })
      .map((row, index) => {
        const raw = row.linea_json;
        if (!raw) return null;
        return { row_number: index + 2, ...JSON.parse(raw) };
      })
      .filter(Boolean);
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: "" })
    .map((row, index) => ({ row_number: index + 2, ...row }));
}

function normalizeRow(row) {
  const legacyId = String(row.id_legacy || "").trim();
  const identification = normalizeId(row.identificacion);
  const city = upper(row.canton || row.ciudad || "");
  const province = upper(row.provincia || "");
  const name = upper(row.razon_social || row.nombre || "");
  const address = parseAddress(row.direccion, city);
  const type = clientType(row.tipo_persona);
  const phone = firstPhone(row.telefonos);
  const email = firstValidEmail(row.emails, legacyId || identification || row.row_number);

  return {
    row_number: row.row_number,
    legacy_id: legacyId,
    identification,
    type,
    name,
    city: city || "CIUDAD NO ESPECIFICADA",
    province: province || "PROVINCIA NO ESPECIFICADA",
    address,
    email,
    phone,
    vendor_code: upper(row.vendedor_codigo || ""),
    vendor_name: upper(row.vendedor_nombre || ""),
    vendor_assigned: row.vendedor_asignado === true || upper(row.vendedor_asignado) === "SI",
    raw: row,
  };
}

function buildVendorMap(users) {
  const byName = new Map();
  const byCode = new Map([
    ["AFARINO", "alex.farino@fam-project.com"],
    ["JMORALES", "jose.morales@fam-project.com"],
    ["PALTAMIRAN", "pamela.altamirano@fam-project.com"],
    ["LVIRACOCHA", "lidia.viracocha@fam-project.com"],
    ["GLEON", "galo.leon@fam-project.com"],
    ["EROJAS", "evelyn.rojas@fam-project.com"],
    ["KBARBERAN", "karen.barberan@fam-project.com"],
  ]);

  for (const user of users) {
    byName.set(normalizeKey(user.fullname), user.email);
  }

  return { byName, byCode };
}

function resolveVendor(row, vendorMap, activeUsersByEmail) {
  if (!row.vendor_assigned) return null;
  const byCode = vendorMap.byCode.get(row.vendor_code);
  const byName = vendorMap.byName.get(normalizeKey(row.vendor_name));
  const email = normalizeEmail(byCode || byName || "");
  return activeUsersByEmail.has(email) ? email : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = loadRows().map(normalizeRow);
  const duplicateIds = new Map();
  for (const row of rows) {
    if (!row.identification) continue;
    duplicateIds.set(row.identification, (duplicateIds.get(row.identification) || 0) + 1);
  }
  const duplicateCount = [...duplicateIds.values()].filter((count) => count > 1).length;
  if (duplicateCount > 0) {
    throw new Error(`El Excel contiene ${duplicateCount} identificaciones duplicadas. Corrige antes de migrar.`);
  }

  const client = new Client({
    host: process.env.DB_HOST || "ep-muddy-sun-ah5um48r.c-3.us-east-1.aws.neon.tech",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "neondb_owner",
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || "neondb",
    ssl: { rejectUnauthorized: false },
  });

  if (!process.env.DB_PASS) {
    throw new Error("DB_PASS es obligatorio. Obtén el secret desde GCP Secret Manager.");
  }

  await client.connect();
  try {
    const usersResult = await client.query(`
      SELECT LOWER(email) AS email, COALESCE(fullname, name, email) AS fullname, role, active
      FROM users
      WHERE active IS DISTINCT FROM FALSE
    `);
    const activeUsersByEmail = new Map(usersResult.rows.map((user) => [user.email, user]));
    const vendorMap = buildVendorMap(usersResult.rows);

    const existingResult = await client.query(`
      SELECT id, ruc_cedula, external_source, external_id
      FROM client_requests
    `);
    const existingById = new Map(existingResult.rows.map((row) => [normalizeId(row.ruc_cedula), row]));

    const summary = {
      mode: apply ? "apply" : "dry-run",
      total_rows: rows.length,
      created: 0,
      updated: 0,
      assigned: 0,
      without_vendor_assignment: 0,
      unresolved_vendor_assignment: 0,
      missing_email_placeholders: 0,
      unresolved_vendors: {},
      created_samples: [],
      updated_samples: [],
    };

    if (apply) await client.query("BEGIN");

    for (const row of rows) {
      if (!row.identification) {
        throw new Error(`Fila ${row.row_number}: identificacion obligatoria`);
      }
      if (!row.name) {
        throw new Error(`Fila ${row.row_number}: razon_social obligatoria`);
      }
      if (row.email.startsWith("sin-correo+")) summary.missing_email_placeholders += 1;

      const existing = existingById.get(row.identification);
      let clientId = existing?.id;

      if (!existing) {
        summary.created += 1;
        if (summary.created_samples.length < 10) {
          summary.created_samples.push({ legacy_id: row.legacy_id, identification: row.identification, name: row.name });
        }

        if (apply) {
          const token = crypto.randomBytes(32).toString("hex");
          const insertResult = await client.query(
            `
              INSERT INTO client_requests (
                created_by, status, approval_status, approved_at, lopdp_token,
                lopdp_consent_status, data_processing_consent, consent_capture_method,
                consent_capture_details, client_email, consent_recipient_email,
                client_type, legal_person_business_name, natural_person_firstname,
                commercial_name, establishment_name, ruc_cedula, client_sector,
                establishment_province, establishment_city, establishment_address,
                establishment_phone, establishment_cellphone, shipping_contact_name,
                shipping_address, shipping_city, shipping_province, shipping_phone,
                shipping_cellphone, shipping_reference, shipping_delivery_hours,
                external_source, external_id, last_synced_at, created_at, updated_at
              )
              VALUES (
                $1, 'approved', 'aprobado', NOW(), $2,
                'granted', TRUE, 'erp_migration',
                $3, $4, $4,
                $5, $6, $7,
                $8, $8, $9, 'privado',
                $10, $11, $12,
                $13, $13, $8,
                $12, $11, $10, $13,
                $13, $14, 'NO REGISTRADO',
                $15, $16, NOW(), NOW(), NOW()
              )
              RETURNING id
            `,
            [
              MIGRATION_USER,
              token,
              `Migracion clientes ERP legacy ${row.legacy_id || "N/D"}`,
              row.email,
              row.type,
              row.type === "persona_juridica" ? row.name : null,
              row.type === "persona_natural" ? row.name : null,
              row.name,
              row.identification,
              row.province,
              row.city,
              row.address,
              row.phone,
              row.raw.direccion || null,
              EXTERNAL_SOURCE,
              row.legacy_id || row.identification,
            ],
          );
          clientId = insertResult.rows[0].id;
          existingById.set(row.identification, { id: clientId, ruc_cedula: row.identification });
        }
      } else {
        summary.updated += 1;
        if (summary.updated_samples.length < 10) {
          summary.updated_samples.push({
            db_id: existing.id,
            legacy_id: row.legacy_id,
            identification: row.identification,
            name: row.name,
          });
        }

        if (apply) {
          await client.query(
            `
              UPDATE client_requests
              SET
                commercial_name = $2,
                legal_person_business_name = CASE WHEN $3 = 'persona_juridica' THEN $2 ELSE legal_person_business_name END,
                natural_person_firstname = CASE WHEN $3 = 'persona_natural' THEN COALESCE(NULLIF(natural_person_firstname, ''), $2) ELSE natural_person_firstname END,
                client_type = $3,
                client_email = CASE WHEN $4 LIKE 'sin-correo+%' THEN client_email ELSE $4 END,
                consent_recipient_email = CASE WHEN $4 LIKE 'sin-correo+%' THEN consent_recipient_email ELSE $4 END,
                establishment_province = $5,
                establishment_city = $6,
                establishment_address = $7,
                establishment_phone = COALESCE($8, establishment_phone),
                establishment_cellphone = COALESCE($8, establishment_cellphone),
                shipping_contact_name = $2,
                shipping_address = $7,
                shipping_city = $6,
                shipping_province = $5,
                shipping_phone = COALESCE($8, shipping_phone),
                shipping_cellphone = COALESCE($8, shipping_cellphone),
                shipping_reference = COALESCE($9, shipping_reference),
              created_by = $10,
              consent_capture_method = 'erp_migration',
              consent_capture_details = $12,
              external_source = $11,
              external_id = $13,
              last_synced_at = NOW(),
              updated_at = NOW()
              WHERE id = $1
            `,
            [
              clientId,
              row.name,
              row.type,
              row.email,
              row.province,
              row.city,
              row.address,
              row.phone,
              row.raw.direccion || null,
              MIGRATION_USER,
              EXTERNAL_SOURCE,
              `Migracion clientes ERP legacy ${row.legacy_id || "N/D"}`,
              row.legacy_id || row.identification,
            ],
          );
        }
      }

      if (!row.vendor_assigned) {
        summary.without_vendor_assignment += 1;
        continue;
      }

      const assigneeEmail = resolveVendor(row, vendorMap, activeUsersByEmail);
      if (!assigneeEmail) {
        summary.unresolved_vendor_assignment += 1;
        const key = `${row.vendor_code || "SIN_CODIGO"} | ${row.vendor_name || "SIN_NOMBRE"}`;
        summary.unresolved_vendors[key] = (summary.unresolved_vendors[key] || 0) + 1;
        continue;
      }

      summary.assigned += 1;
      if (apply) {
        await client.query(
          `
            INSERT INTO client_assignments (
              client_request_id, assigned_to_email, assigned_by_email,
              assignment_type, is_temporary, starts_at, ends_at,
              is_active, reason, created_at
            )
            VALUES ($1, $2, $3, 'manual', FALSE, NOW(), NULL, TRUE, $4, NOW())
            ON CONFLICT (client_request_id, assigned_to_email) DO UPDATE
              SET assigned_by_email = EXCLUDED.assigned_by_email,
                  assignment_type = EXCLUDED.assignment_type,
                  is_temporary = FALSE,
                  starts_at = EXCLUDED.starts_at,
                  ends_at = NULL,
                  is_active = TRUE,
                  reason = EXCLUDED.reason,
                  created_at = NOW()
          `,
          [
            clientId,
            assigneeEmail,
            ASSIGNED_BY,
            `Asignacion migrada desde Excel clientes. Vendedor ERP: ${row.vendor_code} - ${row.vendor_name}`,
          ],
        );
      }
    }

    if (apply) await client.query("COMMIT");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (apply) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // ignore rollback failure
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
