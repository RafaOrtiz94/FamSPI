/**
 * Reconstruye como notas del proceso el historial de un Business Case que se
 * trabajo antes de que existieran las notas automaticas (cierres de seccion,
 * cambios de estado, correos, disponibilidad, factibilidad).
 *
 * Solo LEE tablas de historial y AGREGA filas en process_notes; no modifica
 * ni borra nada. process_notes es append-only (no se puede deshacer), por eso:
 *   - sin --apply solo imprime lo que agregaria (simulacion);
 *   - se niega a correr dos veces sobre el mismo hilo;
 *   - cada nota lleva la marca "[Histórico <fecha original>]" y queda a nombre de
 *     quien hizo la accion (o de --author-email si no se puede identificar).
 *
 * Uso (credenciales de Neon por variables de entorno, ver config/db.js):
 *   node scripts/backfill_bc_process_notes.js <businessCaseId> --author-email=<correo>           # simulacion
 *   node scripts/backfill_bc_process_notes.js <businessCaseId> --author-email=<correo> --apply   # escribe
 */
const db = require("../src/config/db");
const processNotes = require("../src/modules/process-notes/processNotes.service");

const MARK = "[Histórico";
const SECTION_LABELS = {
  general: "Datos Generales",
  lab: "Entorno Laboratorio",
  requirement: "Condiciones del BC",
  equipment: "Equipamiento",
  lis: "Integración LIS",
  determinations: "Determinaciones",
  investments: "Inversiones",
  investment_values_op: "Precio operativo",
  investment_values_fin: "Precio financiero",
  dispatch_workspace: "Cantidades Máximas",
  feasibility: "Factibilidad",
};
const AUDIT_ACTIONS = {
  completed: "Sección cerrada en Business Case",
  unlocked: "Sección reabierta en Business Case",
  preflow_process_created: "Expediente de compras creado desde el Business Case",
};
const AVAILABILITY_STATUS = {
  requested: "pendiente de ACP",
  in_progress: "ACP consultando proveedores",
  confirmed: "confirmada",
  rejected: "no disponible",
  cu_pending: "disponible en CU (aprobación del cliente)",
  import_pending: "solo importación (compromiso del cliente)",
};
const SUPPLIER_RESULT = {
  available_new: "disponible nuevo",
  available_cu: "disponible CU",
  import_only: "solo importación",
  unavailable: "no disponible",
};

const fmt = (value) => new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short",
}).format(new Date(value));
const obj = (value) => (value && typeof value === "object" ? value : {});
const validDate = (value) => value && !Number.isNaN(new Date(value).getTime());

async function collectEvents(bcId, bc) {
  const meta = obj(bc.modern_bc_metadata);
  const events = [];
  const add = (at, text, actor) => { if (validDate(at)) events.push({ at: new Date(at), text, actor: actor || null }); };

  // 1. Secciones: un evento por (seccion, accion); las repeticiones se resumen.
  const { rows: audit } = await db.query(
    `SELECT section_name, action, performed_by_role, metadata, performed_at
       FROM business_case_section_ownership_audit
      WHERE business_case_id = $1 AND action = ANY($2::text[])
      ORDER BY performed_at ASC`,
    [bcId, Object.keys(AUDIT_ACTIONS)],
  );
  const bySection = new Map();
  for (const row of audit) {
    const key = `${row.section_name}:${row.action}`;
    const entry = bySection.get(key) || { first: row, count: 0, last: row };
    entry.count += 1;
    entry.last = row;
    bySection.set(key, entry);
  }
  for (const { first, count, last } of bySection.values()) {
    const label = first.action === "preflow_process_created" ? "" : `: ${SECTION_LABELS[first.section_name] || first.section_name}`;
    const repeat = count > 1 ? ` (registrado ${count} veces, última ${fmt(last.performed_at)})` : "";
    add(first.performed_at, `${AUDIT_ACTIONS[first.action]}${label}${repeat}`, obj(first.metadata).actor_email || first.performed_by_role);
  }

  // 2. Cambios de estado del BC.
  const { rows: transitions } = await db.query(
    `SELECT t.from_state, t.to_state, t.transition_reason, t.transitioned_at, u.fullname, u.email
       FROM business_case_state_transitions t
       LEFT JOIN users u ON u.id::text = t.transitioned_by::text
      WHERE t.business_case_id = $1
      ORDER BY t.transitioned_at ASC`,
    [bcId],
  );
  for (const t of transitions) {
    add(
      t.transitioned_at,
      `Business Case: ${t.from_state || "inicio"} → ${t.to_state}${t.transition_reason ? ` (${t.transition_reason})` : ""}`,
      t.fullname || t.email,
    );
  }

  // 3. Hitos guardados en los metadatos del BC.
  add(bc.created_at, `Business Case creado para ${bc.client_name || "cliente"}`, bc.created_by_name);
  add(
    meta.preflow_first_email_sent_at,
    `Correo enviado${meta.preflow_first_email_subject ? `: ${meta.preflow_first_email_subject}` : " (primer correo del proceso)"}`,
    meta.preflow_first_email_sent_by,
  );
  const feasibility = obj(meta.feasibility);
  add(obj(feasibility.export_excel).at, "Hoja oficial sincronizada: factibilidad habilitada", obj(feasibility.export_excel).by_email);
  const decision = obj(feasibility.decision);
  add(
    decision.decided_at,
    `Factibilidad registrada: ${decision.is_feasible ? "factible" : "no factible"}${decision.notes ? ` — ${decision.notes}` : ""}`,
    decision.decided_by_email,
  );
  const inspection = obj(meta.environment_inspection_request);
  add(
    inspection.requested_at || inspection.created_at,
    `Inspección de ambiente solicitada${inspection.request_id ? ` (solicitud #${inspection.request_id})` : ""}`,
    inspection.requested_by_email || inspection.created_by_email,
  );

  // 4. Disponibilidad consultada desde el BC.
  const { rows: availability } = await db.query(
    `SELECT r.id, r.equipment_name, r.status, r.result_notes, r.created_at, r.closed_at,
            ru.fullname AS requested_by_name, cu.fullname AS closed_by_name,
            COALESCE((SELECT json_agg(q ORDER BY q.sent_at) FROM bc_availability_supplier_queries q WHERE q.availability_id = r.id), '[]'::json) AS queries
       FROM bc_availability_requests r
       LEFT JOIN users ru ON ru.id = r.requested_by
       LEFT JOIN users cu ON cu.id = r.closed_by
      WHERE r.business_case_id = $1
      ORDER BY r.created_at ASC`,
    [bcId],
  );
  for (const r of availability) {
    const equipment = r.equipment_name || "equipo";
    add(r.created_at, `Disponibilidad solicitada a ACP: ${equipment}`, r.requested_by_name);
    for (const q of r.queries || []) {
      add(q.sent_at, `Correo de disponibilidad enviado a ${q.provider_email}: ${equipment}`, null);
      add(q.responded_at, `Respuesta de ${q.provider_email}: ${SUPPLIER_RESULT[q.response_result] || q.response_result}${q.response_notes ? ` — ${q.response_notes}` : ""}`, null);
    }
    add(r.closed_at, `Disponibilidad ${AVAILABILITY_STATUS[r.status] || r.status}: ${equipment}${r.result_notes ? ` — ${r.result_notes}` : ""}`, r.closed_by_name);
  }

  return events.sort((a, b) => a.at - b.at);
}

async function main() {
  const bcId = process.argv[2];
  const apply = process.argv.includes("--apply");
  const authorEmail = (process.argv.find((arg) => arg.startsWith("--author-email=")) || "").split("=")[1];
  if (!bcId || !authorEmail) throw new Error("Uso: node scripts/backfill_bc_process_notes.js <businessCaseId> --author-email=<correo> [--apply]");

  const { rows: bcRows } = await db.query(
    `SELECT b.id, b.client_name, b.created_at, b.modern_bc_metadata, u.fullname AS created_by_name
       FROM equipment_purchase_requests b
       LEFT JOIN users u ON u.id = b.created_by
      WHERE b.id = $1 AND COALESCE(b.request_type, 'purchase') = 'business_case'`,
    [bcId],
  );
  if (!bcRows[0]) throw new Error(`Business Case no encontrado: ${bcId}`);

  const { rows: authorRows } = await db.query(
    "SELECT id, fullname, email, role FROM users WHERE lower(email) = lower($1) AND active = true LIMIT 1",
    [authorEmail],
  );
  if (!authorRows[0]) throw new Error(`Usuario autor no encontrado o inactivo: ${authorEmail}`);

  // Mismo hilo que muestra el BC: el del expediente de compras si ya existe.
  const thread = await processNotes.resolveBusinessCaseThread(bcId);
  const existing = await processNotes.listNotes(thread.entityType, thread.entityId);
  if (existing.some((note) => String(note.body || "").startsWith(MARK))) {
    throw new Error("Este hilo ya tiene notas históricas: no se vuelve a ejecutar para no duplicarlas.");
  }

  const events = await collectEvents(bcId, bcRows[0]);
  console.log(`Business Case ${bcId} — ${bcRows[0].client_name}`);
  console.log(`Hilo: ${thread.entityType} ${thread.entityId} (${existing.length} notas existentes, no se tocan)`);
  console.log(`Autor de respaldo (solo si no se identifica al actor): ${authorRows[0].fullname || authorRows[0].email}`);
  console.log(`${events.length} notas a agregar:\n`);

  // Cada nota queda a nombre de quien hizo la accion (como las notas automaticas
  // nuevas). Si el historial solo guardo un rol o nada, se usa el autor del evento
  // anterior (misma sesion de trabajo) y, si no hay, --author-email.
  const { rows: users } = await db.query("SELECT id, fullname, email, role FROM users");
  const findUser = (actor) => {
    const key = String(actor || "").trim().toLowerCase();
    return key ? users.find((u) => String(u.email || "").toLowerCase() === key || String(u.fullname || "").toLowerCase() === key) : null;
  };

  let written = 0;
  let previousAuthor = null;
  for (const event of events) {
    const author = findUser(event.actor) || previousAuthor || authorRows[0];
    previousAuthor = author;
    const body = `${MARK} ${fmt(event.at)}] ${event.text}`;
    console.log(`- ${body}  →  autor: ${author.fullname || author.email}`);
    if (!apply) continue;
    const note = await processNotes.recordAutomaticNote({ ...thread, author, body });
    if (!note) throw new Error(`No se pudo insertar la nota ${written + 1}; se detiene (ya insertadas: ${written}).`);
    written += 1;
  }
  console.log(apply ? `\nListo: ${written} notas agregadas.` : "\nSimulación: no se escribió nada. Agrega --apply para insertar.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(`ERROR: ${error.message}`); process.exit(1); });
