/*
 * Backfill idempotente de notas para bloqueos automáticos históricos de BC.
 *
 * Uso:
 *   node scripts/backfill_business_case_auto_lock_notes.js --dry-run
 *   node scripts/backfill_business_case_auto_lock_notes.js --apply
 */
const db = require("../src/config/db");
const processNotesService = require("../src/modules/process-notes/processNotes.service");

const APPLY = process.argv.includes("--apply");
const LABELS = {
  general: "Datos Generales",
  lab: "Entorno Laboratorio",
  requirement: "Condiciones del BC",
  equipment: "Equipamiento",
  lis: "Integración LIS",
};

async function loadPendingEvents() {
  const { rows } = await db.query(`
    SELECT
      audit.id AS audit_id,
      audit.business_case_id::text AS business_case_id,
      audit.section_name,
      audit.performed_at,
      COALESCE(ownership.locked_by, business_case.created_by) AS author_id,
      COALESCE(lock_user.fullname, creator.fullname) AS author_name,
      COALESCE(lock_user.email, creator.email) AS author_email,
      COALESCE(ownership.locked_by_role, audit.performed_by_role, creator.role) AS author_role
    FROM business_case_section_ownership_audit audit
    JOIN equipment_purchase_requests business_case
      ON business_case.id = audit.business_case_id
    LEFT JOIN business_case_section_ownership ownership
      ON ownership.business_case_id = audit.business_case_id
      AND ownership.section_name = audit.section_name
      AND ownership.locked_at = audit.performed_at
    LEFT JOIN users lock_user ON lock_user.id = ownership.locked_by
    LEFT JOIN users creator ON creator.id = business_case.created_by
    WHERE audit.action = 'locked'
      AND audit.metadata->>'source' = 'auto_lock_after_comercial_save'
      AND NOT EXISTS (
        SELECT 1
        FROM process_notes note
        WHERE note.entity_type = 'business_case'
          AND note.entity_id = audit.business_case_id::text
          AND note.body LIKE '%' || '[Backfill auto-lock audit #' || audit.id::text || ']%'
      )
    ORDER BY audit.performed_at ASC, audit.id ASC
  `);
  return rows;
}

function buildBody(event) {
  const label = LABELS[event.section_name];
  if (!label) return null;
  const occurredAt = new Date(event.performed_at).toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return [
    `Sección bloqueada automáticamente tras guardar información comercial: ${label}.`,
    `Registro histórico sincronizado del bloqueo ocurrido el ${occurredAt}.`,
    `[Backfill auto-lock audit #${event.audit_id}]`,
  ].join("\n");
}

async function main() {
  const events = await loadPendingEvents();
  const invalid = events.filter((event) => !event.author_id || !buildBody(event));
  const eligible = events.filter((event) => event.author_id && buildBody(event));

  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", pending: events.length, eligible: eligible.length, skipped: invalid.length }));

  if (!APPLY) return;
  if (invalid.length) {
    throw new Error(`Hay ${invalid.length} bloqueos sin autor o sección soportada; no se ejecutó el backfill parcial.`);
  }

  let inserted = 0;
  for (const event of eligible) {
    const note = await processNotesService.recordAutomaticNote({
      entityType: "business_case",
      entityId: event.business_case_id,
      author: {
        id: event.author_id,
        fullname: event.author_name || event.author_email || "Usuario histórico",
        email: event.author_email || null,
        role: event.author_role || "comercial",
      },
      body: buildBody(event),
    });
    if (!note) throw new Error(`No se pudo registrar la nota del audit #${event.audit_id}.`);
    inserted += 1;
  }

  console.log(JSON.stringify({ mode: "apply", inserted }));
}

main()
  .catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
