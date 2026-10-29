// Red flags sobre los CAMPOS del Blue Sheet (los elementos de lista usan toggleElementRedFlag):
//  - automaticas: el sistema las marca al guardar segun el valor del campo (urgencia critica,
//    presupuesto desconocido...). Si el vendedor quita una, no vuelve a marcarse mientras el valor
//    no cambie; si el valor deja de ser de riesgo, la bandera se resuelve sola.
//  - manuales: el vendedor marca con un icono un campo de texto (p. ej. "tarda 6 meses en pagar").
// Se guardan en crm.crm_red_flags con related_entity_type='field', related_entity_id = id del Blue
// Sheet y flag_category = clave del campo.
const db = require("../../config/db");

const FIELD_TYPE = "field";

// Reglas automaticas: campo -> valores de riesgo.
const AUTO_RULES = [
  { field: "urgency_level", when: (bs) => bs.urgency_level === "critical", title: "Urgencia del cliente crítica", severity: "high" },
  { field: "budget_status", when: (bs) => bs.budget_status === "unknown", title: "Presupuesto desconocido", severity: "medium" },
  { field: "budget_status", when: (bs) => bs.budget_status === "constrained", title: "Presupuesto limitado", severity: "medium" },
  { field: "buying_process_maturity", when: (bs) => bs.buying_process_maturity === "unknown", title: "No conocemos el proceso de compra del cliente", severity: "medium" },
];
const AUTO_FIELDS = [...new Set(AUTO_RULES.map((r) => r.field))];

// Campos de texto que el vendedor puede marcar a mano.
const MANUAL_FIELDS = {
  sales_objective_text: "Objetivo de venta",
  customer_situation_current: "Situación actual del cliente",
  customer_situation_desired: "Situación deseada del cliente",
  urgency_source: "Qué genera la urgencia",
  budget_confirmed_by: "Quién confirmó el presupuesto",
  buying_process_description: "Cómo compra el cliente",
  decision_timeline: "Plazo de decisión",
  buying_process_notes: "Notas del proceso de compra",
  strategy_summary: "Resumen de la estrategia",
  strategy_key_themes: "Mensajes clave",
  differentiation_factors: "Qué nos diferencia",
  strategy_risks: "Riesgos de la estrategia",
};

// Regla pura: que banderas automaticas corresponden al estado actual del Blue Sheet.
const autoFlagsFor = (bs) => AUTO_RULES.filter((rule) => rule.when(bs)).map(({ field, title, severity }) => ({ field, title, severity }));

// Reconcilia las banderas automaticas tras guardar el Blue Sheet. Devuelve las claves activas.
const syncAutoFieldFlags = async (bs, userId) => {
  const wanted = new Map(autoFlagsFor(bs).map((f) => [f.field, f]));
  const { rows: existing } = await db.query(
    `SELECT id, flag_category AS field, flag_title, status, deleted_at
       FROM crm.crm_red_flags
      WHERE blue_sheet_id = $1 AND related_entity_type = $2 AND is_auto_generated = true AND flag_category = ANY($3::text[])
        AND (deleted_at IS NULL OR status = 'dismissed')`,
    [bs.id, FIELD_TYPE, AUTO_FIELDS],
  );
  for (const row of existing) {
    const rule = wanted.get(row.field);
    // El valor ya no es de riesgo, o cambio a otro riesgo del mismo campo: la bandera anterior se cierra.
    if (!rule || rule.title !== row.flag_title) {
      await db.query(
        `UPDATE crm.crm_red_flags SET status = 'resolved', deleted_at = COALESCE(deleted_at, now()), updated_by = $2, updated_at = now() WHERE id = $1`,
        [row.id, userId],
      );
    } else {
      wanted.delete(row.field); // sigue vigente (activa, o descartada por el vendedor)
    }
  }
  for (const rule of wanted.values()) {
    await db.query(
      `INSERT INTO crm.crm_red_flags
         (blue_sheet_id, flag_title, flag_category, severity, status, related_entity_type, related_entity_id, is_auto_generated, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'open', $5, $1, true, $6, $6)`,
      [bs.id, rule.title, rule.field, rule.severity, FIELD_TYPE, userId],
    );
  }
};

// Marcar/desmarcar a mano. En un campo con regla automatica, desmarcar la descarta (no reaparece
// mientras el valor no cambie) y volver a marcar la reactiva.
const toggleFieldFlag = async ({ blueSheetId, field, text, bs }, userId) => {
  const isAuto = AUTO_FIELDS.includes(field);
  if (!isAuto && !MANUAL_FIELDS[field]) throw Object.assign(new Error("Campo no válido para red flag"), { status: 400 });

  const { rows: active } = await db.query(
    `SELECT id FROM crm.crm_red_flags
      WHERE blue_sheet_id = $1 AND related_entity_type = $2 AND flag_category = $3 AND deleted_at IS NULL
      LIMIT 1`,
    [blueSheetId, FIELD_TYPE, field],
  );
  if (active.length) {
    await db.query(
      `UPDATE crm.crm_red_flags SET deleted_at = now(), status = CASE WHEN is_auto_generated THEN 'dismissed' ELSE 'resolved' END, updated_by = $2, updated_at = now() WHERE id = $1`,
      [active[0].id, userId],
    );
    return { active: false };
  }

  if (isAuto) {
    const rule = autoFlagsFor(bs).find((f) => f.field === field);
    if (!rule) throw Object.assign(new Error("Ese valor no es un riesgo; cámbialo o usa una red flag manual"), { status: 400 });
    await db.query(
      `UPDATE crm.crm_red_flags SET status = 'resolved', updated_at = now()
        WHERE blue_sheet_id = $1 AND related_entity_type = $2 AND flag_category = $3 AND status = 'dismissed'`,
      [blueSheetId, FIELD_TYPE, field],
    );
    const { rows } = await db.query(
      `INSERT INTO crm.crm_red_flags
         (blue_sheet_id, flag_title, flag_category, severity, status, related_entity_type, related_entity_id, is_auto_generated, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'open', $5, $1, true, $6, $6) RETURNING id, severity`,
      [blueSheetId, rule.title, field, rule.severity, FIELD_TYPE, userId],
    );
    return { active: true, id: rows[0].id, severity: rows[0].severity };
  }

  const detail = String(text || "").trim().slice(0, 1000) || null;
  const { rows } = await db.query(
    `INSERT INTO crm.crm_red_flags
       (blue_sheet_id, flag_title, flag_description, flag_category, severity, status, related_entity_type, related_entity_id, is_auto_generated, created_by, updated_by)
     VALUES ($1, $2, $3, $4, 'medium', 'open', $5, $1, false, $6, $6) RETURNING id, severity`,
    [blueSheetId, MANUAL_FIELDS[field], detail, field, FIELD_TYPE, userId],
  );
  return { active: true, id: rows[0].id, severity: rows[0].severity };
};

module.exports = { FIELD_TYPE, AUTO_FIELDS, MANUAL_FIELDS, autoFlagsFor, syncAutoFieldFlags, toggleFieldFlag };
