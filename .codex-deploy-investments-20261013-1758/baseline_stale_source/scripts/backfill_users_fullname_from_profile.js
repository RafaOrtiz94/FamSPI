#!/usr/bin/env node
/**
 * backfill_users_fullname_from_profile.js
 * Recalcula users.fullname en MAYUSCULAS desde collaborator_profiles.profile.personal
 * (apellidos + nombres), igual que collaborators.service.js al guardar un expediente.
 * Repara los nombres que quedaron mal (minusculas/truncados) por el bug de
 * auth.controller.js que sobrescribia fullname con el nombre crudo de Google en cada login.
 *
 * Uso:
 *   node scripts/backfill_users_fullname_from_profile.js --dry-run
 *   node scripts/backfill_users_fullname_from_profile.js
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const db = require("../src/config/db");

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const preview = await db.query(`
    SELECT u.id, u.fullname AS old_fullname,
      TRIM(CONCAT_WS(' ', UPPER(TRIM(cp.profile->'personal'->>'apellidos')), UPPER(TRIM(cp.profile->'personal'->>'nombres')))) AS new_fullname
    FROM users u
    JOIN collaborator_profiles cp ON cp.user_id = u.id
    WHERE COALESCE(TRIM(cp.profile->'personal'->>'apellidos'), '') <> ''
       OR COALESCE(TRIM(cp.profile->'personal'->>'nombres'), '') <> ''
  `);

  const changed = preview.rows.filter((r) => r.old_fullname !== r.new_fullname);
  console.log(`[BACKFILL] ${preview.rows.length} colaboradores con expediente. ${changed.length} requieren correccion.`);
  changed.slice(0, 20).forEach((r) => console.log(`  id=${r.id}: "${r.old_fullname}" -> "${r.new_fullname}"`));
  if (changed.length > 20) console.log(`  ... y ${changed.length - 20} mas`);

  if (DRY_RUN) {
    console.log("[BACKFILL] --dry-run: no se aplico ningun cambio.");
    return;
  }

  const result = await db.query(`
    UPDATE users u
    SET fullname = TRIM(CONCAT_WS(' ', UPPER(TRIM(cp.profile->'personal'->>'apellidos')), UPPER(TRIM(cp.profile->'personal'->>'nombres')))),
        updated_at = NOW()
    FROM collaborator_profiles cp
    WHERE cp.user_id = u.id
      AND (COALESCE(TRIM(cp.profile->'personal'->>'apellidos'), '') <> '' OR COALESCE(TRIM(cp.profile->'personal'->>'nombres'), '') <> '')
      AND u.fullname IS DISTINCT FROM TRIM(CONCAT_WS(' ', UPPER(TRIM(cp.profile->'personal'->>'apellidos')), UPPER(TRIM(cp.profile->'personal'->>'nombres'))))
  `);

  console.log(`[BACKFILL] Filas actualizadas: ${result.rowCount}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[BACKFILL] ERROR:", err);
    process.exit(1);
  });
