const db = require("../../config/db");
const calculators = require("./crm.calculators");
const notificationsService = require("../notifications/notifications.service");
const { ensureFolderPath, uploadFileToDrive } = require("../../utils/drive");

const notImplemented = (name) => Promise.reject(Object.assign(new Error(`${name}: Not implemented`), { status: 501 }));

const sanitizeFileToken = (value, fallback = "documento") => {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
};

// ─── Visibility helpers ───────────────────────────────────────────────────────
const MANAGER_ROLES = new Set([
  'jefe_ti','jefe_de_ti','admin','administrador',
  'gerencia','gerencia_general','gerente_general',
  'director','gerente','jefe_comercial','jefe_de_comercial',
]);
const isManager = (user) => MANAGER_ROLES.has(user.role);

async function ensureActivityFollowupSchema() {
  await db.query(`
    ALTER TABLE crm.crm_activities
      ADD COLUMN IF NOT EXISTS visit_log_id INTEGER REFERENCES public.client_visit_logs(id) ON DELETE SET NULL
  `);
  await db.query(`
    ALTER TABLE crm.crm_documents
      ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES crm.crm_activities(id) ON DELETE SET NULL
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_activities_visit_log
      ON crm.crm_activities (visit_log_id)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_documents_activity
      ON crm.crm_documents (activity_id)
  `);
}

/**
 * Build WHERE clause for account visibility when caller is NOT a manager.
 * Returns { clause, param } where param is user.id placeholder value.
 */
const visibilityClause = (user, paramIdx) =>
  `(a.visibility = 'company' OR (a.visibility IN ('team','private') AND a.owner_user_id = $${paramIdx}))`;

// ─── Notifications + Audit helpers ───────────────────────────────────────────

// Priority map: string labels → integer values used by notifications table
const PRIORITY_MAP = { normal: 0, high: 1, urgent: 2 };
const toPriorityInt = (p) => (typeof p === 'number' ? p : (PRIORITY_MAP[p] ?? 0));

// Internal: resolve user ids by role array
async function resolveUserIdsByRole(roles) {
  const { rows } = await db.query(
    `SELECT id FROM public.users WHERE role = ANY($1) AND COALESCE(active, true) = true`,
    [roles]
  );
  return rows.map((r) => r.id);
}

// Send notification to multiple users; individual failures are swallowed
async function crmNotify(userIds, payload) {
  if (!userIds?.length) return;
  await Promise.all(
    userIds.map((uid) =>
      notificationsService.createNotification({
        user_id: uid,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'info',
        source: payload.source || 'crm-fam',
        status: payload.status || 'unread',
        priority: toPriorityInt(payload.priority),
        meta: payload.meta || {},
      }).catch(() => null)
    )
  );
}

// Insert into crm audit log; failures are swallowed — audit must not break main flow
async function crmAuditLog({ entity_name, entity_id, action, old_data, new_data, changed_fields, reason, user, req } = {}) {
  try {
    await db.query(
      `INSERT INTO crm.crm_audit_log
        (entity_name, entity_id, action, old_data, new_data, changed_fields, reason, performed_by, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entity_name || null,
        entity_id || null,
        action || null,
        old_data != null ? (typeof old_data === 'object' ? JSON.stringify(old_data) : old_data) : null,
        new_data != null ? (typeof new_data === 'object' ? JSON.stringify(new_data) : new_data) : null,
        changed_fields || null,
        reason || null,
        user?.id || null,
        req?.ip || null,
        req?.get?.('user-agent') || null,
      ]
    );
  } catch (_) { /* audit failure non-fatal */ }
}

// Blue sheet notification helpers
async function notifyBlueSheetSubmitted(blueSheet, opportunity, submitter) {
  const ids = await resolveUserIdsByRole([
    'jefe_comercial','jefe_de_comercial','gerencia','gerencia_general','jefe_ti','jefe_de_ti',
  ]);
  await crmNotify(ids, {
    title: 'Blue Sheet listo para revisión',
    message: `${opportunity.name} — enviado por ${submitter.full_name || submitter.email}`,
    type: 'info',
    priority: 'high',
    meta: { blue_sheet_id: blueSheet.id, opportunity_id: opportunity.id },
  });
}

async function notifyBlueSheetObserved(blueSheet, opportunity, reviewer) {
  await crmNotify([opportunity.owner_user_id], {
    title: 'Blue Sheet observado — requiere correcciones',
    message: `${opportunity.name} — revisado por ${reviewer.full_name || reviewer.email}`,
    type: 'warning',
    priority: 'high',
    meta: { blue_sheet_id: blueSheet.id, opportunity_id: opportunity.id },
  });
}

async function notifyBlueSheetApproved(blueSheet, opportunity, approver) {
  await crmNotify([opportunity.owner_user_id], {
    title: 'Blue Sheet aprobado',
    message: `${opportunity.name} — aprobado por ${approver.full_name || approver.email}`,
    type: 'success',
    priority: 'normal',
    meta: { blue_sheet_id: blueSheet.id, opportunity_id: opportunity.id },
  });
}

async function notifyRedFlagCritical(redFlag, blueSheet, opportunity) {
  const managerIds = await resolveUserIdsByRole([
    'jefe_comercial','jefe_de_comercial','jefe_ti','jefe_de_ti',
  ]);
  const allIds = [...new Set([opportunity.owner_user_id, ...managerIds])];
  await crmNotify(allIds, {
    title: '⚠ Red Flag crítica detectada',
    message: `${redFlag.flag_title} — ${opportunity.name}`,
    type: 'error',
    priority: 'urgent',
    meta: { red_flag_id: redFlag.id, blue_sheet_id: blueSheet.id, opportunity_id: opportunity.id },
  });
}

async function notifyAssignment(opportunity, newOwnerUserId, assigner) {
  await crmNotify([newOwnerUserId], {
    title: 'Oportunidad asignada',
    message: `${opportunity.name} ha sido asignada a ti por ${assigner.full_name || assigner.email}`,
    type: 'info',
    priority: 'high',
    meta: { opportunity_id: opportunity.id },
  });
}

// ─── Accounts ────────────────────────────────────────────────────────────────

const listAccounts = async ({ q, status, owner_user_id, limit = 50, offset = 0, user } = {}) => {
  const conditions = ['a.deleted_at IS NULL'];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(`(a.account_name ILIKE $${idx} OR a.legal_name ILIKE $${idx} OR a.ruc ILIKE $${idx})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (owner_user_id) {
    params.push(owner_user_id);
    conditions.push(`a.owner_user_id = $${params.length}`);
  }
  if (!isManager(user)) {
    params.push(user.id);
    conditions.push(visibilityClause(user, params.length));
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    SELECT a.*,
      u.fullname AS owner_name,
      COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL) AS contact_count,
      COUNT(DISTINCT o.id) FILTER (WHERE o.deleted_at IS NULL AND o.status = 'open') AS open_opportunity_count,
      COUNT(*) OVER() AS total_count
    FROM crm.crm_accounts a
    LEFT JOIN public.users u ON u.id = a.owner_user_id
    LEFT JOIN crm.crm_contacts c ON c.account_id = a.id
    LEFT JOIN crm.crm_opportunities o ON o.account_id = a.id
    WHERE ${where}
    GROUP BY a.id, u.fullname
    ORDER BY a.account_name ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await db.query(sql, params);
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const data = rows.map(({ total_count, ...r }) => r);
  return { data, total, limit: Number(limit), offset: Number(offset) };
};

const getAccountById = async (id, user) => {
  const { rows } = await db.query(
    `SELECT a.*, u.fullname AS owner_name
     FROM crm.crm_accounts a
     LEFT JOIN public.users u ON u.id = a.owner_user_id
     WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id]
  );
  if (!rows.length) { const e = new Error('Account not found'); e.status = 404; throw e; }
  const acct = rows[0];

  // visibility check
  if (!isManager(user) && acct.visibility === 'private' && acct.owner_user_id !== user.id) {
    const e = new Error('Access denied'); e.status = 403; throw e;
  }
  if (!isManager(user) && acct.visibility === 'team' && acct.owner_user_id !== user.id) {
    const e = new Error('Access denied'); e.status = 403; throw e;
  }

  const [{ rows: contacts }, { rows: opps }] = await Promise.all([
    db.query(
      `SELECT * FROM crm.crm_contacts WHERE account_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`,
      [id]
    ),
    db.query(
      `SELECT id, name, status, stage_id, estimated_amount, estimated_close_date
       FROM crm.crm_opportunities WHERE account_id = $1 AND deleted_at IS NULL AND status = 'open'
       ORDER BY estimated_close_date ASC LIMIT 3`,
      [id]
    ),
  ]);

  return { ...acct, contacts, open_opportunities: opps };
};

const createAccount = async (data, user) => {
  // RUC duplicate check (blocking)
  if (data.ruc) {
    const { rows: dup } = await db.query(
      `SELECT id, account_name, ruc FROM crm.crm_accounts WHERE ruc = $1 AND deleted_at IS NULL`,
      [data.ruc]
    );
    if (dup.length) {
      const e = new Error('RUC ya registrado');
      e.status = 409;
      e.existing = { id: dup[0].id, account_name: dup[0].account_name };
      throw e;
    }
  }

  // Similar name check (non-blocking)
  const { rows: similar } = await db.query(
    `SELECT id, account_name FROM crm.crm_accounts WHERE account_name ILIKE $1 AND deleted_at IS NULL LIMIT 3`,
    [`%${data.account_name}%`]
  );

  const owner = data.owner_user_id || user.id;
  const { rows } = await db.query(
    `INSERT INTO crm.crm_accounts
      (account_name, legal_name, ruc, account_type, industry, employee_count_range, annual_revenue_range,
       country, province, city, address, website, phone, email, linkedin_url,
       status, visibility, owner_user_id, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20)
     RETURNING *`,
    [
      data.account_name, data.legal_name || null, data.ruc || null,
      data.account_type || null, data.industry || null,
      data.employee_count_range || null, data.annual_revenue_range || null,
      data.country || null, data.province || null, data.city || null,
      data.address || null, data.website || null, data.phone || null,
      data.email || null, data.linkedin_url || null,
      data.status || 'active', data.visibility || 'company',
      owner, data.notes || null, user.id,
    ]
  );

  return { ...rows[0], similar_names: similar };
};

const updateAccount = async (id, data, user) => {
  // Existence + access
  const acct = (await getAccountById(id, user)); // throws 404/403

  // Only managers can change owner
  if (data.owner_user_id !== undefined && !isManager(user)) {
    delete data.owner_user_id;
  }

  // RUC change → re-check duplicate
  if (data.ruc && data.ruc !== acct.ruc) {
    const { rows: dup } = await db.query(
      `SELECT id, account_name FROM crm.crm_accounts WHERE ruc = $1 AND deleted_at IS NULL AND id != $2`,
      [data.ruc, id]
    );
    if (dup.length) {
      const e = new Error('RUC ya registrado'); e.status = 409;
      e.existing = { id: dup[0].id, account_name: dup[0].account_name };
      throw e;
    }
  }

  const ALLOWED = [
    'account_name','legal_name','ruc','account_type','industry',
    'employee_count_range','annual_revenue_range','country','province',
    'city','address','website','phone','email','linkedin_url',
    'status','visibility','owner_user_id','notes',
  ];

  const sets = [];
  const params = [];
  for (const field of ALLOWED) {
    if (data[field] !== undefined) {
      params.push(data[field]);
      sets.push(`${field} = $${params.length}`);
    }
  }
  if (!sets.length) return acct; // nothing to update

  params.push(user.id);
  sets.push(`updated_by = $${params.length}`);
  sets.push(`updated_at = now()`);

  params.push(id);
  const { rows } = await db.query(
    `UPDATE crm.crm_accounts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
};

const softDeleteAccount = async (id, user) => {
  // Check existence + access (reuses getAccountById visibility logic)
  const acct = await getAccountById(id, user);

  if (!isManager(user) && acct.owner_user_id !== user.id) {
    const e = new Error('Access denied'); e.status = 403; throw e;
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_accounts SET deleted_at = now(), updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, user.id]
  );
  if (!rows.length) { const e = new Error('Account not found'); e.status = 404; throw e; }
  return { id: rows[0].id, deleted: true };
};

const getAccountTimeline = async (id, user) => {
  // Access check
  await getAccountById(id, user); // throws 404/403

  const [
    { rows: leads },
    { rows: opportunities },
    { rows: activities },
    { rows: notes },
    { rows: documents },
  ] = await Promise.all([
    db.query(
      `SELECT id, lead_code, full_name, status, created_at FROM crm.crm_leads WHERE converted_account_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    ),
    db.query(
      `SELECT id, opportunity_code, name, status, estimated_amount, actual_close_date, created_at FROM crm.crm_opportunities WHERE account_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
      [id]
    ),
    db.query(
      `SELECT id, activity_type, subject, status, scheduled_at, completed_at FROM crm.crm_activities WHERE account_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
      [id]
    ),
    db.query(
      `SELECT id, note_text, visibility, created_by, created_at FROM crm.crm_notes WHERE account_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
      [id]
    ),
    db.query(
      `SELECT id, document_name, document_type, drive_file_url, created_at FROM crm.crm_documents WHERE account_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
      [id]
    ),
  ]);

  return { leads, opportunities, activities, notes, documents };
};

// ─── Contacts ────────────────────────────────────────────────────────────────

const listContacts = async ({ account_id, q, limit = 50, offset = 0, user } = {}) => {
  const conditions = ['c.deleted_at IS NULL'];
  const params = [];

  if (account_id) {
    params.push(account_id);
    conditions.push(`c.account_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(`(c.full_name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.job_title ILIKE $${idx})`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    SELECT c.*, a.account_name, COUNT(*) OVER() AS total_count
    FROM crm.crm_contacts c
    LEFT JOIN crm.crm_accounts a ON a.id = c.account_id
    WHERE ${where}
    ORDER BY c.last_name, c.first_name ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await db.query(sql, params);
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const data = rows.map(({ total_count, ...r }) => r);
  return { data, total, limit: Number(limit), offset: Number(offset) };
};

const getContactById = async (id, user) => {
  const { rows } = await db.query(
    `SELECT c.*, a.account_name FROM crm.crm_contacts c
     LEFT JOIN crm.crm_accounts a ON a.id = c.account_id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id]
  );
  if (!rows.length) { const e = new Error('Contact not found'); e.status = 404; throw e; }
  return rows[0];
};

const createContact = async (data, user) => {
  // Verify account exists if provided
  if (data.account_id) {
    const { rows } = await db.query(
      `SELECT id FROM crm.crm_accounts WHERE id = $1 AND deleted_at IS NULL`,
      [data.account_id]
    );
    if (!rows.length) { const e = new Error('Account not found'); e.status = 404; throw e; }
  }

  const { rows } = await db.query(
    `INSERT INTO crm.crm_contacts
      (first_name, last_name, job_title, department, phone, mobile, email,
       linkedin_url, is_primary_contact, decision_maker_level, notes,
       account_id, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
     RETURNING *`,
    [
      data.first_name, data.last_name || null,
      data.job_title || null, data.department || null,
      data.phone || null, data.mobile || null,
      data.email || null, data.linkedin_url || null,
      data.is_primary_contact || false,
      data.decision_maker_level || null,
      data.notes || null,
      data.account_id || null,
      user.id,
    ]
  );
  return rows[0];
};

const updateContact = async (id, data, user) => {
  // Existence check
  await getContactById(id, user);

  const ALLOWED = [
    'first_name','last_name','job_title','department','phone','mobile',
    'email','linkedin_url','is_primary_contact','decision_maker_level','notes','account_id',
  ];

  const sets = [];
  const params = [];
  for (const field of ALLOWED) {
    if (data[field] !== undefined) {
      params.push(data[field]);
      sets.push(`${field} = $${params.length}`);
    }
  }
  if (!sets.length) return getContactById(id, user);

  params.push(user.id);
  sets.push(`updated_by = $${params.length}`);
  sets.push(`updated_at = now()`);

  params.push(id);
  const { rows } = await db.query(
    `UPDATE crm.crm_contacts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
};

const softDeleteContact = async (id, user) => {
  await getContactById(id, user); // 404 if missing

  const { rows } = await db.query(
    `UPDATE crm.crm_contacts SET deleted_at = now(), updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, user.id]
  );
  if (!rows.length) { const e = new Error('Contact not found'); e.status = 404; throw e; }
  return { id: rows[0].id, deleted: true };
};

// ─── Leads ────────────────────────────────────────────────────────────────────

const mkErr = (msg, status) => Object.assign(new Error(msg), { status });
const LEAD_OWNER_ROLES = new Set([
  'comercial',
  'jefe_comercial',
  'jefe_de_comercial',
  'backoffice_comercial',
  'asesor_comercial',
  'analista_comercial',
  'acp_comercial',
  'backoffice',
]);
const normalizeRoleToken = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const canAccessLead = (lead, user) =>
  isManager(user) || Number(lead?.owner_user_id) === Number(user?.id) || Number(lead?.created_by) === Number(user?.id);

const resolveLeadOwnerId = async (client, ownerUserId, user) => {
  const fallbackOwnerId = Number(user?.id);
  const requestedOwnerId = Number(ownerUserId) || fallbackOwnerId;
  if (!requestedOwnerId) throw mkErr('No se pudo identificar el responsable del lead', 400);

  const { rows } = await client.query(
    `SELECT id, role, COALESCE(active, true) AS active
       FROM public.users
      WHERE id = $1
      LIMIT 1`,
    [requestedOwnerId],
  );
  const owner = rows[0];
  if (!owner || owner.active === false) {
    throw mkErr('El asesor seleccionado no existe o no esta activo', 400);
  }
  if (!LEAD_OWNER_ROLES.has(normalizeRoleToken(owner.role))) {
    throw mkErr('El usuario seleccionado no tiene rol comercial para recibir leads', 400);
  }
  return owner.id;
};

const listLeads = async ({ status, owner_user_id, q, priority, limit = 50, offset = 0, user } = {}) => {
  const conditions = ['l.deleted_at IS NULL'];
  const params = [];

  if (!isManager(user)) {
    params.push(user.id);
    conditions.push(`(l.owner_user_id = $${params.length} OR l.created_by = $${params.length})`);
  } else if (owner_user_id) {
    params.push(owner_user_id);
    conditions.push(`l.owner_user_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`l.status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    conditions.push(`l.priority = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    const n = params.length;
    conditions.push(`(l.full_name ILIKE $${n} OR l.company_name ILIKE $${n} OR l.email ILIKE $${n})`);
  }

  const where = conditions.join(' AND ');
  const lim = parseInt(limit, 10) || 50;
  const off = parseInt(offset, 10) || 0;

  const countRes = await db.query(`SELECT COUNT(*) FROM crm.crm_leads l WHERE ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataParams = [...params, lim, off];
  const dataRes = await db.query(
    `SELECT l.*, u.fullname as owner_name,
       a.account_name AS converted_account_name,
       a.ruc AS converted_account_ruc,
       a.account_type AS converted_account_type,
       a.city AS converted_account_city,
       cc.full_name AS converted_contact_name,
       cc.email AS converted_contact_email,
       cc.phone AS converted_contact_phone,
       COALESCE((
         SELECT COUNT(DISTINCT lc.id)
         FROM crm.crm_contacts lc
         WHERE lc.deleted_at IS NULL
           AND (
             (l.converted_account_id IS NOT NULL AND lc.account_id = l.converted_account_id)
             OR lc.id = l.converted_contact_id
           )
       ), 0) AS linked_contact_count
     FROM crm.crm_leads l
     LEFT JOIN public.users u ON u.id = l.owner_user_id
     LEFT JOIN crm.crm_accounts a ON a.id = l.converted_account_id AND a.deleted_at IS NULL
     LEFT JOIN crm.crm_contacts cc ON cc.id = l.converted_contact_id AND cc.deleted_at IS NULL
     WHERE ${where}
     GROUP BY l.id, u.fullname, a.id, cc.id
     ORDER BY l.created_at DESC
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );

  return { data: dataRes.rows, total, limit: lim, offset: off };
};

const getLeadById = async (id, user) => {
  const res = await db.query(
    `SELECT l.*, u.fullname as owner_name,
       a.account_name AS converted_account_name,
       a.ruc AS converted_account_ruc,
       a.account_type AS converted_account_type,
       a.city AS converted_account_city,
       cc.full_name AS converted_contact_name,
       cc.email AS converted_contact_email,
       cc.phone AS converted_contact_phone,
       COALESCE((
         SELECT COUNT(DISTINCT lc.id)
         FROM crm.crm_contacts lc
         WHERE lc.deleted_at IS NULL
           AND (
             (l.converted_account_id IS NOT NULL AND lc.account_id = l.converted_account_id)
             OR lc.id = l.converted_contact_id
           )
       ), 0) AS linked_contact_count
     FROM crm.crm_leads l
     LEFT JOIN public.users u ON u.id = l.owner_user_id
     LEFT JOIN crm.crm_accounts a ON a.id = l.converted_account_id AND a.deleted_at IS NULL
     LEFT JOIN crm.crm_contacts cc ON cc.id = l.converted_contact_id AND cc.deleted_at IS NULL
     WHERE l.id = $1 AND l.deleted_at IS NULL
     GROUP BY l.id, u.fullname, a.id, cc.id`,
    [id]
  );
  if (!res.rows.length) throw mkErr('Lead no encontrado', 404);
  const lead = res.rows[0];
  if (!canAccessLead(lead, user)) throw mkErr('Acceso denegado', 403);
  return lead;
};

const linkLeadAccount = async (id, data = {}, user) => {
  const lead = await getLeadById(id, user);
  if (lead.status === 'converted') throw mkErr('Lead convertido: la cuenta ya se gestiona desde la oportunidad', 409);
  if (lead.status === 'disqualified' || lead.status === 'unqualified') throw mkErr('Lead descalificado: no se puede vincular cuenta', 409);

  let accountId = data.account_id || null;
  let account = null;

  if (accountId) {
    account = await getAccountById(accountId, user);
  } else {
    const accountName = String(data.account_name || lead.company_name || '').trim();
    if (!accountName) throw mkErr('Nombre de cuenta requerido', 400);
    account = await createAccount({
      account_name: accountName,
      phone: data.phone || lead.phone || null,
      email: data.email || lead.email || null,
      city: data.city || lead.city || null,
      owner_user_id: data.owner_user_id || lead.owner_user_id || user.id,
      visibility: data.visibility || 'company',
    }, user);
    accountId = account.id;
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_leads
        SET converted_account_id = $2, updated_by = $3, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id, accountId, user.id]
  );
  if (!rows.length) throw mkErr('Lead no encontrado', 404);
  return { lead: await getLeadById(id, user), account };
};

const createLeadContact = async (id, data = {}, user) => {
  const lead = await getLeadById(id, user);
  if (lead.status === 'converted') throw mkErr('Lead convertido: los contactos se gestionan desde la oportunidad', 409);
  if (lead.status === 'disqualified' || lead.status === 'unqualified') throw mkErr('Lead descalificado: no se puede crear contacto', 409);

  const firstName = String(data.first_name || lead.first_name || '').trim();
  if (!firstName) throw mkErr('Nombre de contacto requerido', 400);

  const accountId = data.account_id || lead.converted_account_id || null;
  const contact = await createContact({
    first_name: firstName,
    last_name: data.last_name ?? lead.last_name ?? null,
    job_title: data.job_title ?? lead.job_title ?? null,
    email: data.email ?? lead.email ?? null,
    phone: data.phone ?? lead.phone ?? null,
    account_id: accountId,
    notes: data.notes || null,
  }, user);

  await db.query(
    `UPDATE crm.crm_leads
        SET converted_contact_id = $2, updated_by = $3, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL`,
    [id, contact.id, user.id]
  );

  return { lead: await getLeadById(id, user), contact };
};

const _genCode = async (client, table, codeCol, prefix) => {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const res = await client.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(${codeCol}, '-', 4) AS integer)), 0) + 1 as next_seq
     FROM ${table} WHERE ${codeCol} LIKE $1`,
    [pattern]
  );
  const seq = res.rows[0].next_seq;
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
};

const createLead = async (data, user) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const lead_code = await _genCode(client, 'crm.crm_leads', 'lead_code', 'CRM-LEAD');
    const owner_user_id = await resolveLeadOwnerId(client, data.owner_user_id, user);
    const res = await client.query(
      `INSERT INTO crm.crm_leads
         (lead_code, first_name, last_name, company_name, job_title, email, phone, source, status, priority, interest_description, estimated_value, owner_user_id, city, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new',$9,$10,$11,$12,$13,$14,$14)
       RETURNING *`,
      [
        lead_code,
        data.first_name, data.last_name || null, data.company_name || null, data.job_title || null,
        data.email || null, data.phone || null, data.source || null,
        data.priority || null, data.interest_description || null,
        data.estimated_value || null, owner_user_id, data.city || null,
        user.id,
      ]
    );
    await client.query('COMMIT');
    return res.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const LEAD_UPDATABLE = ['first_name','last_name','company_name','job_title','email','phone','source','status','priority','interest_description','estimated_value','owner_user_id','city'];

const updateLead = async (id, data, user) => {
  const lead = await getLeadById(id, user);
  if (lead.status === 'converted' && !isManager(user)) throw mkErr('Lead convertido: solo managers pueden editarlo', 403);
  const payload = { ...data };
  if (Object.prototype.hasOwnProperty.call(payload, 'owner_user_id')) {
    payload.owner_user_id = await resolveLeadOwnerId(db, payload.owner_user_id, user);
  }

  const sets = [];
  const params = [];
  for (const field of LEAD_UPDATABLE) {
    if (payload[field] !== undefined) {
      params.push(payload[field]);
      sets.push(`${field} = $${params.length}`);
    }
  }
  if (!sets.length) throw mkErr('Sin campos a actualizar', 400);

  params.push(user.id);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);

  const res = await db.query(
    `UPDATE crm.crm_leads SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
    params
  );
  if (!res.rows.length) throw mkErr('Lead no encontrado', 404);
  return res.rows[0];
};

const softDeleteLead = async (id, user) => {
  const lead = await getLeadById(id, user);
  if (lead.status === 'converted') throw mkErr('No se puede eliminar un lead convertido', 409);
  const res = await db.query(
    `UPDATE crm.crm_leads SET deleted_at=now(), updated_by=$2 WHERE id=$1 AND deleted_at IS NULL RETURNING id, status`,
    [id, user.id]
  );
  if (!res.rows.length) throw mkErr('Lead no encontrado', 404);
  return res.rows[0];
};

const convertLead = async (id, { create_account, account_data = {}, create_contact, contact_data = {}, create_opportunity, opportunity_data = {} } = {}, user) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const leadRes = await client.query('SELECT * FROM crm.crm_leads WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!leadRes.rows.length) throw mkErr('Lead no encontrado', 404);
    const lead = leadRes.rows[0];
    if (!canAccessLead(lead, user)) throw mkErr('Acceso denegado', 403);
    if (lead.status === 'converted') throw mkErr('Lead ya está convertido', 409);

    // Account
    let account_id = null;
    if (create_account) {
      if (account_data.ruc) {
        const dupRes = await client.query('SELECT id FROM crm.crm_accounts WHERE ruc = $1 AND deleted_at IS NULL LIMIT 1', [account_data.ruc]);
        if (dupRes.rows.length) account_id = dupRes.rows[0].id;
      }
      if (!account_id) {
        const accRes = await client.query(
          `INSERT INTO crm.crm_accounts (account_name, ruc, industry, website, phone, owner_user_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id`,
          [
            account_data.account_name || account_data.name || lead.company_name || null,
            account_data.ruc || null,
            account_data.industry || null,
            account_data.website || null,
            account_data.phone || lead.phone || null,
            account_data.owner_user_id || lead.owner_user_id || user.id,
            user.id,
          ]
        );
        account_id = accRes.rows[0].id;
      }
    } else if (account_data && account_data.existing_id) {
      account_id = account_data.existing_id;
    }

    // Contact
    let contact_id = null;
    if (create_contact) {
      const conRes = await client.query(
        `INSERT INTO crm.crm_contacts (account_id, first_name, last_name, job_title, email, phone, owner_user_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
        [
          account_id,
          contact_data.first_name || lead.first_name || null,
          contact_data.last_name || lead.last_name || null,
          contact_data.job_title || lead.job_title || null,
          contact_data.email || lead.email || null,
          contact_data.phone || lead.phone || null,
          contact_data.owner_user_id || lead.owner_user_id || user.id,
          user.id,
        ]
      );
      contact_id = conRes.rows[0].id;
    } else if (contact_data && contact_data.existing_id) {
      contact_id = contact_data.existing_id;
    }

    // Opportunity
    let opportunity_id = null;
    if (create_opportunity) {
      const opp_code = await _genCode(client, 'crm.crm_opportunities', 'opportunity_code', 'CRM-OPP');
      const oppRes = await client.query(
        `INSERT INTO crm.crm_opportunities (opportunity_code, account_id, contact_id, name, estimated_value, source, owner_user_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
        [
          opp_code,
          account_id,
          contact_id,
          opportunity_data.name || lead.company_name || null,
          opportunity_data.estimated_value || lead.estimated_value || null,
          opportunity_data.source || lead.source || null,
          opportunity_data.owner_user_id || lead.owner_user_id || user.id,
          user.id,
        ]
      );
      opportunity_id = oppRes.rows[0].id;
    }

    // Mark lead converted
    await client.query(
      `UPDATE crm.crm_leads SET status='converted', converted_at=now(), converted_account_id=$2, converted_contact_id=$3, converted_opportunity_id=$4, updated_by=$5
       WHERE id=$1`,
      [id, account_id, contact_id, opportunity_id, user.id]
    );

    await client.query('COMMIT');
    return { lead_id: id, account_id, contact_id, opportunity_id };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const disqualifyLead = async (id, { reason } = {}, user) => {
  const lead = await getLeadById(id, user);
  if (lead.status === 'converted' || lead.status === 'unqualified') throw mkErr('Lead ya está en estado convertido o no calificado', 409);
  const res = await db.query(
    `UPDATE crm.crm_leads SET status='unqualified', disqualified_at=now(), disqualify_reason=$2, updated_by=$3
     WHERE id=$1 AND deleted_at IS NULL AND status NOT IN ('converted','unqualified')
     RETURNING *`,
    [id, reason || null, user.id]
  );
  if (!res.rows.length) throw mkErr('Lead no encontrado o ya en estado final', 409);
  return res.rows[0];
};

// ─── Pipeline Stages ─────────────────────────────────────────────────────────

const listPipelineStages = async () => {
  const { rows } = await db.query(
    `SELECT * FROM crm.crm_pipeline_stages WHERE is_active = true ORDER BY order_index ASC`
  );
  return rows;
};

const createPipelineStage = async (data, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_pipeline_stages (name, description, order_index, probability_default, requires_blue_sheet, is_active)
     VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
    [data.name, data.description || null, data.order_index || 0, data.probability_default || 0, data.requires_blue_sheet || false]
  );
  return rows[0];
};

const updatePipelineStage = async (id, data, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const allowed = ['name','description','order_index','probability_default','requires_blue_sheet','is_active'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos para actualizar', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const vals = fields.map(f => data[f]);
  const { rows } = await db.query(
    `UPDATE crm.crm_pipeline_stages SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...vals]
  );
  if (!rows.length) throw mkErr('Stage no encontrado', 404);
  return rows[0];
};

// ─── Opportunities ────────────────────────────────────────────────────────────

const _checkOppAccess = async (id, user) => {
  const { rows } = await db.query(
    `SELECT o.*, s.requires_blue_sheet as stage_requires_bs FROM crm.crm_opportunities o
     LEFT JOIN crm.crm_pipeline_stages s ON s.id = o.stage_id
     WHERE o.id = $1 AND o.deleted_at IS NULL`, [id]
  );
  if (!rows.length) throw mkErr('Oportunidad no encontrada', 404);
  if (!isManager(user) && rows[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  return rows[0];
};

const _oppAuditLog = (opportunityId, action, oldData, newData, notes, userId) =>
  db.query(
    `INSERT INTO crm.crm_audit_log (entity_name, entity_id, action, old_data, new_data, changed_fields, reason, performed_by)
     VALUES ('opportunity', $1, $2, $3, $4, ARRAY['stage_id'], $5, $6)`,
    [opportunityId, action, JSON.stringify(oldData), JSON.stringify(newData), notes || null, userId]
  ).catch(() => null); // audit non-fatal

const listOpportunities = async ({ status, stage_id, owner_user_id, account_id, q, requires_blue_sheet, health_status, limit = 50, offset = 0, user } = {}) => {
  const conditions = ['o.deleted_at IS NULL'];
  const params = [];

  if (q) { params.push(`%${q}%`); conditions.push(`(o.name ILIKE $${params.length} OR o.opportunity_code ILIKE $${params.length})`); }
  if (status) { params.push(status); conditions.push(`o.status = $${params.length}`); }
  if (stage_id) { params.push(stage_id); conditions.push(`o.stage_id = $${params.length}`); }
  if (owner_user_id) { params.push(owner_user_id); conditions.push(`o.owner_user_id = $${params.length}`); }
  if (account_id) { params.push(account_id); conditions.push(`o.account_id = $${params.length}`); }
  if (requires_blue_sheet !== undefined) { params.push(requires_blue_sheet); conditions.push(`o.requires_blue_sheet = $${params.length}`); }
  if (health_status) { params.push(health_status); conditions.push(`o.health_status = $${params.length}`); }
  if (!isManager(user)) { params.push(user.id); conditions.push(`o.owner_user_id = $${params.length}`); }

  params.push(Number(limit), Number(offset));
  const limitIdx = params.length - 1, offsetIdx = params.length;
  const where = conditions.join(' AND ');

  const { rows } = await db.query(`
    SELECT o.*, a.account_name,
      s.name as stage_name, s.order_index as stage_order, s.probability_default,
      u.fullname as owner_name,
      bs.status as blue_sheet_status, bs.health_score as blue_sheet_health_score,
      COUNT(*) OVER() AS total_count
    FROM crm.crm_opportunities o
    LEFT JOIN crm.crm_accounts a ON a.id = o.account_id
    LEFT JOIN crm.crm_pipeline_stages s ON s.id = o.stage_id
    LEFT JOIN public.users u ON u.id = o.owner_user_id
    LEFT JOIN crm.crm_blue_sheets bs ON bs.opportunity_id = o.id
    WHERE ${where}
    ORDER BY o.estimated_close_date ASC NULLS LAST, o.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);

  const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
  return { data: rows.map(({ total_count, ...r }) => r), total, limit: Number(limit), offset: Number(offset) };
};

const getOpportunityById = async (id, user) => {
  const { rows } = await db.query(`
    SELECT o.*, a.account_name, a.ruc as account_ruc,
      s.name as stage_name, s.order_index, s.probability_default, s.requires_blue_sheet as stage_requires_bs,
      u.fullname as owner_name,
      bs.id as blue_sheet_id, bs.status as blue_sheet_status, bs.completeness_score, bs.health_score, bs.scorecard_score,
      lr.reason_name as lost_reason_name
    FROM crm.crm_opportunities o
    LEFT JOIN crm.crm_accounts a ON a.id = o.account_id
    LEFT JOIN crm.crm_pipeline_stages s ON s.id = o.stage_id
    LEFT JOIN public.users u ON u.id = o.owner_user_id
    LEFT JOIN crm.crm_blue_sheets bs ON bs.opportunity_id = o.id
    LEFT JOIN crm.crm_lost_reasons lr ON lr.id = o.lost_reason_id
    WHERE o.id = $1 AND o.deleted_at IS NULL`, [id]
  );
  if (!rows.length) throw mkErr('Oportunidad no encontrada', 404);
  if (!isManager(user) && rows[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);

  const [{ rows: activities }, { rows: actionItems }] = await Promise.all([
    db.query(`SELECT id, activity_type, subject, status, scheduled_at FROM crm.crm_activities WHERE opportunity_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`, [id]),
    db.query(`SELECT id, title, priority, status, due_date, owner_user_id FROM crm.crm_action_items WHERE opportunity_id=$1 AND deleted_at IS NULL AND status IN ('pending','in_progress') ORDER BY due_date ASC`, [id]),
  ]);
  return { ...rows[0], recent_activities: activities, open_action_items: actionItems };
};

const createOpportunity = async (data, user) => {
  if (data.account_id) {
    const { rows } = await db.query(`SELECT id FROM crm.crm_accounts WHERE id=$1 AND deleted_at IS NULL`, [data.account_id]);
    if (!rows.length) throw mkErr('Cuenta no encontrada', 404);
  }
  if (data.stage_id) {
    const { rows } = await db.query(`SELECT id FROM crm.crm_pipeline_stages WHERE id=$1`, [data.stage_id]);
    if (!rows.length) throw mkErr('Stage no encontrado', 404);
  }
  const year = new Date().getFullYear();
  const { rows: seqRows } = await db.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(opportunity_code, '-', 4) AS integer)), 0) + 1 AS next_seq
     FROM crm.crm_opportunities WHERE opportunity_code LIKE $1`, [`CRM-OPP-${year}-%`]
  );
  const code = `CRM-OPP-${year}-${String(seqRows[0].next_seq).padStart(6, '0')}`;
  const requiresBS = data.requires_blue_sheet || (data.estimated_amount >= 50000);
  const ownerId = data.owner_user_id || user.id;

  const { rows } = await db.query(
    `INSERT INTO crm.crm_opportunities (opportunity_code, name, account_id, primary_contact_id, stage_id, status, estimated_amount, probability_override, currency, estimated_close_date, requires_blue_sheet, owner_user_id, source, lead_id, description, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING *`,
    [code, data.name, data.account_id || null, data.primary_contact_id || null, data.stage_id || null,
     data.estimated_amount || null, data.probability_override || null, data.currency || 'USD',
     data.estimated_close_date || null, requiresBS, ownerId, data.source || null,
     data.lead_id || null, data.description || null, user.id]
  );
  return rows[0];
};

const promoteLeadToOpportunity = async (leadId, data, user) => {
  const lead = await getLeadById(leadId, user);
  if (lead.status !== 'qualified') {
    throw mkErr('El lead debe estar calificado antes de iniciar el analisis de oportunidad', 400);
  }
  const { rows: existing } = await db.query(
    `SELECT id FROM crm.crm_opportunities WHERE lead_id=$1 AND deleted_at IS NULL LIMIT 1`, [leadId]
  );
  if (existing.length) throw mkErr('Este lead ya tiene una oportunidad creada', 409);

  const { rows: stageRows } = await db.query(
    `SELECT id FROM crm.crm_pipeline_stages WHERE name='Análisis de la oportunidad' AND is_active=true LIMIT 1`
  );
  const name = (data?.name || '').trim()
    || lead.company_name
    || [lead.first_name, lead.last_name].filter(Boolean).join(' ')
    || `Oportunidad lead ${lead.lead_code}`;

  return createOpportunity(
    {
      name,
      lead_id: leadId,
      owner_user_id: lead.owner_user_id,
      stage_id: stageRows[0]?.id || null,
      account_id: data?.account_id || null,
      estimated_amount: data?.estimated_amount || null,
      probability_override: data?.probability_override || null,
      estimated_close_date: data?.estimated_close_date || null,
      source: data?.source || lead.source || null,
    },
    user,
  );
};

const getOpportunityPurchaseStatus = async (opportunityId, user) => {
  await _checkOppAccess(opportunityId, user);
  const { rows } = await db.query(
    `SELECT id, status::text AS status, offer_kind, created_at, 'private' AS purchase_type
       FROM public.private_purchase_requests
      WHERE opportunity_id = $1
     UNION ALL
     SELECT id, status::text AS status, NULL AS offer_kind, created_at, 'public' AS purchase_type
       FROM public.equipment_purchase_requests
      WHERE opportunity_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [opportunityId],
  );
  return rows[0] || null;
};

const linkPurchaseToOpportunity = async (opportunityId, { purchase_id, purchase_type } = {}, user) => {
  await _checkOppAccess(opportunityId, user);
  if (!purchase_id) throw mkErr('purchase_id requerido', 400);
  const table = purchase_type === 'public' ? 'public.equipment_purchase_requests' : 'public.private_purchase_requests';
  const { rows } = await db.query(
    `UPDATE ${table} SET opportunity_id = $1 WHERE id = $2 RETURNING id`,
    [opportunityId, purchase_id],
  );
  if (!rows.length) throw mkErr('Solicitud de compra no encontrada', 404);
  return { linked: true, purchase_id, purchase_type: purchase_type === 'public' ? 'public' : 'private' };
};

const updateOpportunity = async (id, data, user) => {
  const opp = await _checkOppAccess(id, user);
  const allowed = ['name','account_id','primary_contact_id','stage_id','estimated_amount','probability_override','currency','estimated_close_date','requires_blue_sheet','owner_user_id','source','description'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos para actualizar', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const vals = fields.map(f => data[f]);
  const { rows } = await db.query(
    `UPDATE crm.crm_opportunities SET ${sets}, updated_by=$${vals.length + 2}, updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
    [id, ...vals, user.id]
  );

  // Invalidate approved/active blue sheet if amount or date changed significantly
  const amtChanged = data.estimated_amount && opp.estimated_amount &&
    Math.abs(data.estimated_amount - opp.estimated_amount) / opp.estimated_amount > 0.2;
  const dateChanged = data.estimated_close_date && opp.estimated_close_date &&
    Math.abs(new Date(data.estimated_close_date) - new Date(opp.estimated_close_date)) > 30 * 86400000;
  if (amtChanged || dateChanged) {
    await db.query(
      `UPDATE crm.crm_blue_sheets SET status='needs_update', updated_at=now() WHERE opportunity_id=$1 AND status IN ('approved','active')`,
      [id]
    );
  }
  return rows[0];
};

const changeOpportunityStage = async (id, { stage_id, notes } = {}, user) => {
  const opp = await _checkOppAccess(id, user);
  const { rows: stageRows } = await db.query(`SELECT * FROM crm.crm_pipeline_stages WHERE id=$1`, [stage_id]);
  if (!stageRows.length) throw mkErr('Stage no encontrado', 404);

  let warning = null;
  if (stageRows[0].requires_blue_sheet) {
    const { rows: bsRows } = await db.query(
      `SELECT id FROM crm.crm_blue_sheets WHERE opportunity_id=$1 AND status IN ('approved','active') AND deleted_at IS NULL`, [id]
    );
    if (!bsRows.length) warning = 'Esta etapa requiere Blue Sheet aprobado';
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_opportunities SET stage_id=$2, updated_by=$3, updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
    [id, stage_id, user.id]
  );
  await _oppAuditLog(id, 'stage_changed', { stage_id: opp.stage_id }, { stage_id }, notes, user.id);
  return { ...rows[0], warning };
};

const closeWon = async (id, { won_amount, notes, actual_close_date } = {}, user) => {
  const opp = await _checkOppAccess(id, user);
  if (['won','lost','cancelled'].includes(opp.status)) throw mkErr('La oportunidad ya está cerrada', 409);

  let warning = null;
  if (opp.requires_blue_sheet) {
    const { rows: bsRows } = await db.query(
      `SELECT id FROM crm.crm_blue_sheets WHERE opportunity_id=$1 AND status IN ('approved','active') AND deleted_at IS NULL`, [id]
    );
    if (!bsRows.length) warning = 'Blue Sheet no aprobado — se recomienda aprobarlo antes de cerrar';
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_opportunities SET status='won', won_amount=COALESCE($2, estimated_amount), actual_close_date=COALESCE($3::date, now()::date), updated_by=$4, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, won_amount || null, actual_close_date || null, user.id]
  );
  await Promise.all([
    _oppAuditLog(id, 'closed_won', { status: opp.status }, { status: 'won' }, notes, user.id),
    db.query(
      `INSERT INTO crm.crm_integration_outbox (event_type, entity_name, entity_id, payload, target_module, status) VALUES ('opportunity.won','opportunity',$1::uuid,$2::jsonb,'erp','pending')`,
      [id, JSON.stringify({ opportunity_id: id, won_amount: won_amount || opp.estimated_amount })]
    ),
  ]);
  return { ...rows[0], warning };
};

const closeLost = async (id, { lost_reason_id, lost_reason_detail, lost_to_competitor_id, lesson_learned } = {}, user) => {
  if (!lost_reason_id) throw mkErr('lost_reason_id es obligatorio', 400);
  await _checkOppAccess(id, user);
  const { rows: lrRows } = await db.query(`SELECT id FROM crm.crm_lost_reasons WHERE id=$1 AND is_active=true`, [lost_reason_id]);
  if (!lrRows.length) throw mkErr('Motivo de pérdida no válido', 400);
  const { rows } = await db.query(
    `UPDATE crm.crm_opportunities SET status='lost', lost_reason_id=$2, lost_reason_detail=$3, lost_to_competitor_id=$4, lesson_learned=$5, actual_close_date=now()::date, updated_by=$6, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, lost_reason_id, lost_reason_detail || null, lost_to_competitor_id || null, lesson_learned || null, user.id]
  );
  await _oppAuditLog(id, 'closed_lost', { status: 'open' }, { status: 'lost', lost_reason_id }, null, user.id);
  return rows[0];
};

const suspendOpportunity = async (id, { notes } = {}, user) => {
  const opp = await _checkOppAccess(id, user);
  if (!isManager(user) && opp.owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  const { rows } = await db.query(
    `UPDATE crm.crm_opportunities SET status='suspended', updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, user.id]
  );
  await _oppAuditLog(id, 'suspended', { status: opp.status }, { status: 'suspended' }, notes, user.id);
  return rows[0];
};

const getOpportunityHealth = async (id, user) => {
  await _checkOppAccess(id, user);
  const { rows: bsRows } = await db.query(
    `SELECT id, scorecard_score, completeness_score FROM crm.crm_blue_sheets WHERE opportunity_id=$1 AND deleted_at IS NULL`, [id]
  );
  if (!bsRows.length) return { health_score: null, health_status: 'gray', message: 'Sin Blue Sheet', opportunity_id: id };
  const bs = bsRows[0];
  const [{ rows: actionItems }, { rows: redFlags }] = await Promise.all([
    db.query(`SELECT status, due_date FROM crm.crm_action_items WHERE blue_sheet_id=$1 AND deleted_at IS NULL`, [bs.id]),
    db.query(`SELECT severity, status FROM crm.crm_red_flags WHERE blue_sheet_id=$1 AND deleted_at IS NULL`, [bs.id]),
  ]);
  const health_score = calculators.calculateHealthScore({
    scorecardScore: Number(bs.scorecard_score) || 0,
    completenessScore: Number(bs.completeness_score) || 0,
    actionItems,
    redFlags,
  });
  return { health_score, health_status: calculators.getHealthStatus(health_score), opportunity_id: id, blue_sheet_id: bs.id };
};

// Blue Sheets

const EDITABLE_STATES = ['draft', 'in_progress', 'needs_update', 'observed'];

// Helper: fetch BS + verify user has access via the opportunity owner
async function _getBsWithAccess(id, user) {
  const { rows } = await db.query(
    `SELECT bs.*, o.owner_user_id, o.name as opportunity_name, o.id as opp_id
     FROM crm.crm_blue_sheets bs
     JOIN crm.crm_opportunities o ON o.id = bs.opportunity_id
     WHERE bs.id = $1 AND bs.deleted_at IS NULL`,
    [id]
  );
  if (!rows.length) throw mkErr('Blue Sheet no encontrado', 404);
  const bs = rows[0];
  if (!isManager(user) && bs.owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  return bs;
}

// Helper: dynamic UPDATE for blue sheet sections; handles draft→in_progress transition
async function _updateBsFields(id, allowed, data, user) {
  const bs = await _getBsWithAccess(id, user);
  if (!EDITABLE_STATES.includes(bs.status)) throw mkErr(`Blue Sheet en estado '${bs.status}' no es editable`, 409);

  const sets = [];
  const params = [];
  for (const field of allowed) {
    if (data[field] !== undefined) {
      params.push(data[field]);
      sets.push(`${field} = $${params.length}`);
    }
  }
  if (!sets.length) return bs;

  // draft → in_progress when content arrives
  sets.push(`status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END`);
  params.push(user.id);
  sets.push(`updated_by = $${params.length}`);
  sets.push(`updated_at = now()`);
  params.push(id);

  const { rows } = await db.query(
    `UPDATE crm.crm_blue_sheets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
}

const createBlueSheet = async (opportunityId, data, user) => {
  // 1. Opportunity exists
  const { rows: oppRows } = await db.query(
    `SELECT id, owner_user_id FROM crm.crm_opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );
  if (!oppRows.length) throw mkErr('Oportunidad no encontrada', 404);
  const opp = oppRows[0];

  // 2. Access
  if (!isManager(user) && opp.owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);

  // 3. No existing BS
  const { rows: existing } = await db.query(
    `SELECT id FROM crm.crm_blue_sheets WHERE opportunity_id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );
  if (existing.length) throw mkErr('Ya existe un Blue Sheet para esta oportunidad', 409);

  // 4. INSERT
  const { rows } = await db.query(
    `INSERT INTO crm.crm_blue_sheets (opportunity_id, version_number, status, created_by, updated_by)
     VALUES ($1, 1, 'draft', $2, $2) RETURNING *`,
    [opportunityId, user.id]
  );

  // 5. Mark opportunity health gray
  await db.query(
    `UPDATE crm.crm_opportunities SET health_status = 'gray' WHERE id = $1`,
    [opportunityId]
  );

  return rows[0];
};

const getBlueSheetByOpportunity = async (opportunityId, user) => {
  // Access via opportunity
  await _checkOppAccess(opportunityId, user);

  const { rows } = await db.query(
    `SELECT bs.*, o.name as opportunity_name, o.owner_user_id, o.requires_blue_sheet
     FROM crm.crm_blue_sheets bs
     JOIN crm.crm_opportunities o ON o.id = bs.opportunity_id
     WHERE bs.opportunity_id = $1 AND bs.deleted_at IS NULL`,
    [opportunityId]
  );
  if (!rows.length) throw mkErr('Blue Sheet no encontrado', 404);
  return rows[0];
};

const getBlueSheetById = async (id, user) => {
  const { rows } = await db.query(
    `SELECT bs.*, o.name as opportunity_name, o.owner_user_id, a.account_name
     FROM crm.crm_blue_sheets bs
     JOIN crm.crm_opportunities o ON o.id = bs.opportunity_id
     LEFT JOIN crm.crm_accounts a ON a.id = o.account_id
     WHERE bs.id = $1 AND bs.deleted_at IS NULL`,
    [id]
  );
  if (!rows.length) throw mkErr('Blue Sheet no encontrado', 404);
  const bs = rows[0];
  if (!isManager(user) && bs.owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  return bs;
};

const updateBlueSheetGeneral = (id, data, user) => _updateBsFields(id, [
  'sales_objective_text','sales_objective_specificity','sales_objective_measurable',
  'sales_objective_timebound','sales_objective_validated',
  'customer_situation_current','customer_situation_desired',
  'urgency_level','urgency_source',
  'budget_status','budget_amount','budget_confirmed_by',
], data, user);

const updateBlueSheetBuyingProcess = (id, data, user) => _updateBsFields(id, [
  'buying_process_description','buying_process_maturity',
  'decision_timeline','procurement_involved','legal_involved','buying_process_notes',
], data, user);

const updateBlueSheetStrategy = (id, data, user) => _updateBsFields(id, [
  'strategy_approach','strategy_summary','strategy_key_themes',
  'differentiation_factors','strategy_risks',
], data, user);

const submitBlueSheetForReview = async (id, user) => {
  const bs = await _getBsWithAccess(id, user);

  if (!['draft', 'in_progress', 'needs_update'].includes(bs.status)) {
    throw mkErr(`No se puede enviar a revisión desde estado '${bs.status}'`, 409);
  }

  // Validaciones mínimas
  const missing = [];
  if (!bs.sales_objective_text || bs.sales_objective_text.length <= 20) {
    missing.push('sales_objective_text (mínimo 20 caracteres)');
  }

  const [{ rows: biRows }, { rows: aiRows }] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM crm.crm_buying_influences WHERE blue_sheet_id = $1 AND deleted_at IS NULL`, [id]),
    db.query(`SELECT COUNT(*) FROM crm.crm_action_items WHERE blue_sheet_id = $1 AND deleted_at IS NULL`, [id]),
  ]);

  if (parseInt(biRows[0].count, 10) < 1) missing.push('Al menos 1 influencia de compra');
  if (!(Number(bs.scorecard_score) > 0)) missing.push('Scorecard iniciado (score > 0)');
  if (parseInt(aiRows[0].count, 10) < 1) missing.push('Al menos 1 action item');

  if (missing.length) {
    const e = Object.assign(new Error('Blue Sheet incompleto para enviar a revisión'), { status: 400, missing });
    throw e;
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_blue_sheets SET status='ready_for_review', submitted_at=now(), submitted_by=$2, updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, user.id]
  );
  const updated = rows[0];

  // Notification — fetch opportunity
  const { rows: oppRows } = await db.query(
    `SELECT id, name, owner_user_id FROM crm.crm_opportunities WHERE id = $1`,
    [updated.opportunity_id]
  );
  await notifyBlueSheetSubmitted(updated, oppRows[0], user).catch(() => null);

  return updated;
};

const approveBlueSheet = async (id, { notes } = {}, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado: solo managers pueden aprobar', 403);

  const bs = await _getBsWithAccess(id, user);
  if (!['ready_for_review', 'observed'].includes(bs.status)) {
    throw mkErr(`No se puede aprobar desde estado '${bs.status}'`, 409);
  }

  // Blocking: red flags críticas abiertas
  const { rows: rfRows } = await db.query(
    `SELECT COUNT(*) FROM crm.crm_red_flags WHERE blue_sheet_id=$1 AND severity='critical' AND status='open' AND deleted_at IS NULL`,
    [id]
  );
  if (parseInt(rfRows[0].count, 10) > 0) {
    throw Object.assign(new Error('Existen Red Flags críticas abiertas'), { status: 409, blocking: true });
  }

  // Blocking: strategy_summary mínimo 50 chars
  if (!bs.strategy_summary || bs.strategy_summary.length < 50) {
    throw mkErr('strategy_summary debe tener al menos 50 caracteres', 409);
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_blue_sheets SET status='approved', approved_at=now(), approved_by=$2, approval_notes=$3, updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, user.id, notes || null]
  );
  const approved = rows[0];

  // Snapshot version
  await db.query(
    `INSERT INTO crm.crm_blue_sheet_versions (blue_sheet_id, version_number, snapshot_data, reason, created_by)
     VALUES ($1, $2, $3::jsonb, 'approved', $4)`,
    [id, approved.version_number, JSON.stringify(approved), user.id]
  );

  // Increment version_number
  await db.query(
    `UPDATE crm.crm_blue_sheets SET version_number = version_number + 1 WHERE id = $1`,
    [id]
  );

  // Fetch opportunity for notification + health update
  const { rows: oppRows } = await db.query(
    `SELECT id, name, owner_user_id FROM crm.crm_opportunities WHERE id = $1`,
    [approved.opportunity_id]
  );
  const opp = oppRows[0];

  await Promise.all([
    notifyBlueSheetApproved(approved, opp, user).catch(() => null),
    db.query(
      `UPDATE crm.crm_opportunities SET health_status = CASE WHEN $2::numeric > 0 THEN 'green' ELSE health_status END WHERE id = $1`,
      [opp.id, Number(approved.scorecard_score) || 0]
    ),
  ]);

  return approved;
};

const observeBlueSheet = async (id, { comments = [] } = {}, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado: solo managers pueden observar', 403);

  const bs = await _getBsWithAccess(id, user);
  if (bs.status !== 'ready_for_review') {
    throw mkErr(`No se puede observar desde estado '${bs.status}'`, 409);
  }

  // Insert each review comment
  if (comments.length) {
    await Promise.all(
      comments.map((c) =>
        db.query(
          `INSERT INTO crm.crm_review_comments (blue_sheet_id, section_name, comment_text, severity, requires_correction, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, c.section_name || null, c.comment_text || null, c.severity || null, c.requires_correction || false, user.id]
        )
      )
    );
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_blue_sheets SET status='observed', observed_at=now(), observed_by=$2, updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, user.id]
  );
  const observed = rows[0];

  const { rows: oppRows } = await db.query(
    `SELECT id, name, owner_user_id FROM crm.crm_opportunities WHERE id = $1`,
    [observed.opportunity_id]
  );
  await notifyBlueSheetObserved(observed, oppRows[0], user).catch(() => null);

  return observed;
};

const reopenBlueSheet = async (id, { reason } = {}, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado: solo managers pueden reabrir', 403);

  const bs = await _getBsWithAccess(id, user);
  if (!['approved', 'observed'].includes(bs.status)) {
    throw mkErr(`No se puede reabrir desde estado '${bs.status}'`, 409);
  }

  const { rows } = await db.query(
    `UPDATE crm.crm_blue_sheets SET status='needs_update', reopened_at=now(), reopened_by=$2, reopen_reason=$3, updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, user.id, reason || null]
  );
  return rows[0];
};

const getBlueSheetVersions = async (id, user) => {
  await _getBsWithAccess(id, user);

  const { rows } = await db.query(
    `SELECT v.*, u.fullname as created_by_name
     FROM crm.crm_blue_sheet_versions v
     LEFT JOIN public.users u ON u.id = v.created_by
     WHERE v.blue_sheet_id = $1 ORDER BY v.version_number DESC`,
    [id]
  );
  return rows;
};

const getBlueSheetCompleteness = async (id, user) => {
  const bs = await _getBsWithAccess(id, user);

  const [
    { rows: buyingInfluences },
    { rows: winResults },
    { rows: competitors },
    { rows: strengths },
    { rows: redFlags },
    { rows: scorecardAnswers },
  ] = await Promise.all([
    db.query(`SELECT * FROM crm.crm_buying_influences WHERE blue_sheet_id=$1 AND deleted_at IS NULL`, [id]),
    db.query(`SELECT * FROM crm.crm_win_results WHERE blue_sheet_id=$1 AND deleted_at IS NULL`, [id]),
    db.query(`SELECT * FROM crm.crm_competitors WHERE blue_sheet_id=$1 AND deleted_at IS NULL`, [id]),
    db.query(`SELECT * FROM crm.crm_strengths WHERE blue_sheet_id=$1 AND deleted_at IS NULL`, [id]),
    db.query(`SELECT * FROM crm.crm_red_flags WHERE blue_sheet_id=$1 AND deleted_at IS NULL`, [id]),
    db.query(`SELECT * FROM crm.crm_scorecard_answers WHERE blue_sheet_id=$1`, [id]),
  ]);

  const score = calculators.calculateCompletenessScore({
    blueSheet: bs,
    buyingInfluences,
    winResults,
    competitors,
    strengths,
    redFlags,
    scorecardAnswers,
  });

  await db.query(
    `UPDATE crm.crm_blue_sheets SET completeness_score = $2, updated_at = now() WHERE id = $1`,
    [id, score]
  );

  return { completeness_score: score, blue_sheet_id: id };
};

// ─── BS child-entity access helper ───────────────────────────────────────────
const _bsAccess = async (blueSheetId, user) => {
  const { rows } = await db.query(
    `SELECT bs.id, o.owner_user_id FROM crm.crm_blue_sheets bs JOIN crm.crm_opportunities o ON o.id=bs.opportunity_id WHERE bs.id=$1 AND bs.deleted_at IS NULL`, [blueSheetId]
  );
  if (!rows.length) throw mkErr('Blue Sheet no encontrado', 404);
  if (!isManager(user) && rows[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  return rows[0];
};

// ─── Buying Influences ────────────────────────────────────────────────────────

const listBuyingInfluences = async (blueSheetId, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `SELECT bi.*, u.fullname as contact_name FROM crm.crm_buying_influences bi LEFT JOIN public.users u ON u.id=bi.user_id WHERE bi.blue_sheet_id=$1 AND bi.deleted_at IS NULL ORDER BY bi.created_at ASC`, [blueSheetId]
  );
  return rows;
};

const createBuyingInfluence = async (blueSheetId, data, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_buying_influences (blue_sheet_id, contact_id, user_id, full_name, job_title, influence_role, receptivity, access_level, priority_weight, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,
    [blueSheetId, data.contact_id||null, data.user_id||null, data.full_name||null, data.job_title||null,
     data.influence_role||null, data.receptivity||null, data.access_level||null,
     data.priority_weight||1, data.notes||null, user.id]
  );
  return rows[0];
};

const updateBuyingInfluence = async (id, data, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_buying_influences WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Buying Influence no encontrado', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  const allowed = ['full_name','job_title','influence_role','receptivity','access_level','priority_weight','notes','contact_id','user_id'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_buying_influences SET ${sets}, updated_by=$${fields.length+2}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f]), user.id]
  );
  return rows[0];
};

const softDeleteBuyingInfluence = async (id, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_buying_influences WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Buying Influence no encontrado', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  await db.query(`UPDATE crm.crm_buying_influences SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Win-Results ──────────────────────────────────────────────────────────────

const listWinResults = async (blueSheetId, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `SELECT wr.*, bi.full_name as buying_influence_name FROM crm.crm_win_results wr JOIN crm.crm_buying_influences bi ON bi.id=wr.buying_influence_id WHERE bi.blue_sheet_id=$1 AND wr.deleted_at IS NULL ORDER BY wr.created_at ASC`, [blueSheetId]
  );
  return rows;
};

const createWinResult = async (buyingInfluenceId, data, user) => {
  const { rows: bi } = await db.query(`SELECT id, blue_sheet_id FROM crm.crm_buying_influences WHERE id=$1 AND deleted_at IS NULL`, [buyingInfluenceId]);
  if (!bi.length) throw mkErr('Buying Influence no encontrado', 404);
  await _bsAccess(bi[0].blue_sheet_id, user);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_win_results (blue_sheet_id, buying_influence_id, result_type, description, importance_level, our_position, gap_to_fill, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
    [bi[0].blue_sheet_id, buyingInfluenceId, data.result_type, data.description, data.importance_level||'medium', data.our_position||null, data.gap_to_fill||null, user.id]
  );
  return rows[0];
};

const updateWinResult = async (id, data, user) => {
  const { rows: wr } = await db.query(`SELECT wr.*, bi.blue_sheet_id FROM crm.crm_win_results wr JOIN crm.crm_buying_influences bi ON bi.id=wr.buying_influence_id WHERE wr.id=$1 AND wr.deleted_at IS NULL`, [id]);
  if (!wr.length) throw mkErr('Win-Result no encontrado', 404);
  await _bsAccess(wr[0].blue_sheet_id, user);
  const allowed = ['result_type','description','importance_level','our_position','gap_to_fill'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_win_results SET ${sets}, updated_by=$${fields.length+2}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f]), user.id]
  );
  return rows[0];
};

const softDeleteWinResult = async (id, user) => {
  const { rows: wr } = await db.query(`SELECT wr.*, bi.blue_sheet_id FROM crm.crm_win_results wr JOIN crm.crm_buying_influences bi ON bi.id=wr.buying_influence_id WHERE wr.id=$1 AND wr.deleted_at IS NULL`, [id]);
  if (!wr.length) throw mkErr('Win-Result no encontrado', 404);
  await _bsAccess(wr[0].blue_sheet_id, user);
  await db.query(`UPDATE crm.crm_win_results SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Competitors ──────────────────────────────────────────────────────────────

const listCompetitors = async (blueSheetId, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `SELECT * FROM crm.crm_competitors WHERE blue_sheet_id=$1 AND deleted_at IS NULL ORDER BY created_at ASC`, [blueSheetId]
  );
  return rows;
};

const createCompetitor = async (blueSheetId, data, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_competitors (blue_sheet_id, competitor_name, threat_level, known_strengths, known_weaknesses, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
    [blueSheetId, data.competitor_name, data.threat_level||'medium', data.known_strengths||null, data.known_weaknesses||null, data.notes||null, user.id]
  );
  return rows[0];
};

const updateCompetitor = async (id, data, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_competitors WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Competidor no encontrado', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  const allowed = ['competitor_name','threat_level','known_strengths','known_weaknesses','notes'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_competitors SET ${sets}, updated_by=$${fields.length+2}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f]), user.id]
  );
  return rows[0];
};

const softDeleteCompetitor = async (id, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_competitors WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Competidor no encontrado', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  await db.query(`UPDATE crm.crm_competitors SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Competitive Preferences ──────────────────────────────────────────────────

const listCompetitivePreferences = async (blueSheetId, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `SELECT cp.*, bi.full_name as buying_influence_name, c.competitor_name
     FROM crm.crm_competitive_preferences cp
     JOIN crm.crm_buying_influences bi ON bi.id=cp.buying_influence_id
     JOIN crm.crm_competitors c ON c.id=cp.competitor_id
     WHERE cp.blue_sheet_id=$1 ORDER BY bi.created_at, c.created_at`, [blueSheetId]
  );
  return rows;
};

const upsertCompetitivePreference = async (blueSheetId, biId, compId, data, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_competitive_preferences (blue_sheet_id, buying_influence_id, competitor_id, preference, strength_of_preference, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     ON CONFLICT (blue_sheet_id, buying_influence_id, competitor_id)
     DO UPDATE SET preference=EXCLUDED.preference, strength_of_preference=EXCLUDED.strength_of_preference, notes=EXCLUDED.notes, updated_by=EXCLUDED.updated_by, updated_at=now()
     RETURNING *`,
    [blueSheetId, biId, compId, data.preference||null, data.strength_of_preference||null, data.notes||null, user.id]
  );
  return rows[0];
};

// ─── Strengths ────────────────────────────────────────────────────────────────

const listStrengths = async (blueSheetId, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(`SELECT * FROM crm.crm_strengths WHERE blue_sheet_id=$1 AND deleted_at IS NULL ORDER BY created_at ASC`, [blueSheetId]);
  return rows;
};

const createStrength = async (blueSheetId, data, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_strengths (blue_sheet_id, strength_category, strength_description, relevance_score, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$5) RETURNING *`,
    [blueSheetId, data.strength_category||null, data.strength_description, data.relevance_score||null, user.id]
  );
  return rows[0];
};

const updateStrength = async (id, data, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_strengths WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Fortaleza no encontrada', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  const allowed = ['strength_category','strength_description','relevance_score'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_strengths SET ${sets}, updated_by=$${fields.length+2}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f]), user.id]
  );
  return rows[0];
};

const softDeleteStrength = async (id, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_strengths WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Fortaleza no encontrada', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  await db.query(`UPDATE crm.crm_strengths SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Red Flags ────────────────────────────────────────────────────────────────

const listRedFlags = async (blueSheetId, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `SELECT rf.*, u.fullname as accepted_by_name FROM crm.crm_red_flags rf LEFT JOIN public.users u ON u.id=rf.accepted_by WHERE rf.blue_sheet_id=$1 AND rf.deleted_at IS NULL ORDER BY rf.severity DESC, rf.created_at ASC`, [blueSheetId]
  );
  return rows;
};

const createRedFlag = async (blueSheetId, data, user) => {
  await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_red_flags (blue_sheet_id, flag_description, severity, mitigation_plan, status, created_by, updated_by) VALUES ($1,$2,$3,$4,'open',$5,$5) RETURNING *`,
    [blueSheetId, data.flag_description, data.severity||'medium', data.mitigation_plan||null, user.id]
  );
  if (rows[0].severity === 'critical') {
    const { rows: opp } = await db.query(`SELECT o.id, o.name, o.owner_user_id FROM crm.crm_opportunities o JOIN crm.crm_blue_sheets bs ON bs.opportunity_id=o.id WHERE bs.id=$1`, [blueSheetId]);
    if (opp.length) await notifyRedFlagCritical(rows[0], opp[0], user).catch(() => null);
  }
  return rows[0];
};

const updateRedFlag = async (id, data, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_red_flags WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Red Flag no encontrada', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  const allowed = ['flag_description','severity','mitigation_plan','status'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_red_flags SET ${sets}, updated_by=$${fields.length+2}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f]), user.id]
  );
  return rows[0];
};

const softDeleteRedFlag = async (id, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id FROM crm.crm_red_flags WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Red Flag no encontrada', 404);
  await _bsAccess(cur[0].blue_sheet_id, user);
  await db.query(`UPDATE crm.crm_red_flags SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

const acceptRedFlag = async (id, { mitigation_plan } = {}, user) => {
  if (!isManager(user)) throw mkErr('Solo managers pueden aceptar Red Flags', 403);
  const { rows: cur } = await db.query(`SELECT id FROM crm.crm_red_flags WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Red Flag no encontrada', 404);
  const { rows } = await db.query(
    `UPDATE crm.crm_red_flags SET status='accepted', accepted_by=$2, accepted_at=now(), mitigation_plan=COALESCE($3, mitigation_plan), updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, user.id, mitigation_plan||null]
  );
  return rows[0];
};

// ─── Scorecard ────────────────────────────────────────────────────────────────

const listScorecardCriteria = async () => {
  const { rows } = await db.query(`SELECT * FROM crm.crm_scorecard_criteria WHERE is_active=true ORDER BY display_order ASC`);
  return rows;
};

const createScorecardCriterion = async (data, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_scorecard_criteria (criterion_name, criterion_description, weight, display_order, is_active) VALUES ($1,$2,$3,$4,true) RETURNING *`,
    [data.criterion_name, data.criterion_description||null, data.weight||1, data.display_order||0]
  );
  return rows[0];
};

const updateScorecardCriterion = async (id, data, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const allowed = ['criterion_name','criterion_description','weight','display_order','is_active'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_scorecard_criteria SET ${sets} WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f])]
  );
  if (!rows.length) throw mkErr('Criterio no encontrado', 404);
  return rows[0];
};

const getBlueSheetScorecard = async (blueSheetId, user) => {
  await _bsAccess(blueSheetId, user);
  const [{ rows: criteria }, { rows: answers }] = await Promise.all([
    db.query(`SELECT * FROM crm.crm_scorecard_criteria WHERE is_active=true ORDER BY display_order ASC`),
    db.query(`SELECT sa.*, sc.criterion_name, sc.weight FROM crm.crm_scorecard_answers sa JOIN crm.crm_scorecard_criteria sc ON sc.id=sa.criterion_id WHERE sa.blue_sheet_id=$1`, [blueSheetId]),
  ]);
  const score = calculators.calculateScorecardScore(criteria, answers);
  return { criteria, answers, score };
};

const saveBlueSheetScorecard = async (blueSheetId, answers, user) => {
  await _bsAccess(blueSheetId, user);
  for (const { criterion_id, score, notes } of answers) {
    await db.query(
      `INSERT INTO crm.crm_scorecard_answers (blue_sheet_id, criterion_id, score, notes, scored_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (blue_sheet_id, criterion_id) DO UPDATE SET score=EXCLUDED.score, notes=EXCLUDED.notes, scored_by=EXCLUDED.scored_by, updated_at=now()`,
      [blueSheetId, criterion_id, score, notes||null, user.id]
    );
  }
  const [{ rows: criteria }, { rows: savedAnswers }] = await Promise.all([
    db.query(`SELECT * FROM crm.crm_scorecard_criteria WHERE is_active=true`),
    db.query(`SELECT * FROM crm.crm_scorecard_answers WHERE blue_sheet_id=$1`, [blueSheetId]),
  ]);
  const newScore = calculators.calculateScorecardScore(criteria, savedAnswers);
  await db.query(`UPDATE crm.crm_blue_sheets SET scorecard_score=$2, updated_at=now() WHERE id=$1`, [blueSheetId, newScore]);
  return { score: newScore, answers: savedAnswers };
};

// ─── Action Items ─────────────────────────────────────────────────────────────

const listActionItems = async (blueSheetId, { status, limit = 50, offset = 0 } = {}) => {
  const conditions = ['ai.blue_sheet_id=$1', 'ai.deleted_at IS NULL'];
  const params = [blueSheetId];
  if (status) { params.push(status); conditions.push(`ai.status=$${params.length}`); }
  params.push(Number(limit), Number(offset));
  const { rows } = await db.query(
    `SELECT ai.*, u.fullname as owner_name FROM crm.crm_action_items ai LEFT JOIN public.users u ON u.id=ai.owner_user_id WHERE ${conditions.join(' AND ')} ORDER BY ai.due_date ASC NULLS LAST LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return rows;
};

const createActionItem = async (blueSheetId, opportunityId, data, user) => {
  if (blueSheetId) await _bsAccess(blueSheetId, user);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_action_items (blue_sheet_id, opportunity_id, title, description, owner_user_id, due_date, priority, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$8) RETURNING *`,
    [blueSheetId||null, opportunityId||null, data.title, data.description||null,
     data.owner_user_id||user.id, data.due_date||null, data.priority||'medium', user.id]
  );
  return rows[0];
};

const updateActionItem = async (id, data, user) => {
  const { rows: cur } = await db.query(`SELECT blue_sheet_id, owner_user_id FROM crm.crm_action_items WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Action Item no encontrado', 404);
  if (!isManager(user) && cur[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  const allowed = ['title','description','owner_user_id','due_date','priority','status'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_action_items SET ${sets}, updated_by=$${fields.length+2}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f]), user.id]
  );
  return rows[0];
};

const completeActionItem = async (id, { notes } = {}, user) => {
  const { rows: cur } = await db.query(`SELECT owner_user_id FROM crm.crm_action_items WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Action Item no encontrado', 404);
  if (!isManager(user) && cur[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  const { rows } = await db.query(
    `UPDATE crm.crm_action_items SET status='completed', completed_at=now(), completion_notes=$2, updated_by=$3, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, notes||null, user.id]
  );
  return rows[0];
};

const softDeleteActionItem = async (id, user) => {
  const { rows: cur } = await db.query(`SELECT owner_user_id FROM crm.crm_action_items WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Action Item no encontrado', 404);
  if (!isManager(user) && cur[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  await db.query(`UPDATE crm.crm_action_items SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Activities ───────────────────────────────────────────────────────────────

const listActivities = async ({ opportunity_id, account_id, owner_user_id, activity_type, status, limit = 50, offset = 0, user } = {}) => {
  await ensureActivityFollowupSchema();
  const conditions = ['a.deleted_at IS NULL'];
  const params = [];
  if (opportunity_id) { params.push(opportunity_id); conditions.push(`a.opportunity_id=$${params.length}`); }
  if (account_id) { params.push(account_id); conditions.push(`a.account_id=$${params.length}`); }
  if (owner_user_id) { params.push(owner_user_id); conditions.push(`a.owner_user_id=$${params.length}`); }
  if (activity_type) { params.push(activity_type); conditions.push(`a.activity_type=$${params.length}`); }
  if (status) { params.push(status); conditions.push(`a.status=$${params.length}`); }
  if (!isManager(user)) { params.push(user.id); conditions.push(`a.owner_user_id=$${params.length}`); }
  params.push(Number(limit), Number(offset));
  const { rows } = await db.query(
    `SELECT
       a.*,
       u.fullname as owner_name,
       o.name as opportunity_name,
       acc.account_name as account_name,
       vl.visit_date,
       vl.hora_entrada,
       vl.hora_salida,
       vl.client_request_id,
       cr.commercial_name AS visit_client_name,
       scheduled_visit.scheduled_visit_id,
       (scheduled_visit.scheduled_visit_id IS NOT NULL) AS is_scheduled_visit,
       COALESCE(doc_stats.documents_count, 0)::int AS documents_count,
       COALESCE(doc_stats.documents, '[]'::json) AS documents,
       CASE
         WHEN a.status = 'visited_pending_followup' THEN 'pending_followup'
         WHEN a.status = 'completed'
          AND NULLIF(TRIM(COALESCE(a.outcome_notes, '')), '') IS NOT NULL
          AND NULLIF(TRIM(COALESCE(a.outcome, '')), '') IS NOT NULL
            THEN 'completed'
         WHEN a.status = 'completed' THEN 'incomplete_followup'
         ELSE 'not_applicable'
       END AS followup_status
     FROM crm.crm_activities a
     LEFT JOIN public.users u ON u.id=a.owner_user_id
     LEFT JOIN crm.crm_opportunities o ON o.id=a.opportunity_id
     LEFT JOIN crm.crm_accounts acc ON acc.id=a.account_id
     LEFT JOIN public.client_visit_logs vl ON vl.id=a.visit_log_id
     LEFT JOIN public.client_requests cr ON cr.id=vl.client_request_id
     LEFT JOIN LATERAL (
       SELECT sv.id AS scheduled_visit_id
       FROM public.scheduled_visits sv
       WHERE sv.crm_activity_id = a.id
       ORDER BY sv.id DESC
       LIMIT 1
     ) scheduled_visit ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) AS documents_count,
         COALESCE(json_agg(
           json_build_object(
             'id', d.id,
             'document_name', d.document_name,
             'document_type', d.document_type,
             'drive_file_url', d.drive_file_url,
             'drive_file_id', d.drive_file_id,
             'created_at', d.created_at
           )
           ORDER BY d.created_at DESC
         ), '[]'::json) AS documents
       FROM crm.crm_documents d
       WHERE d.activity_id = a.id
         AND d.deleted_at IS NULL
     ) doc_stats ON TRUE
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.scheduled_at DESC NULLS LAST, a.updated_at DESC
     LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return rows;
};

const createActivity = async (data, user) => {
  await ensureActivityFollowupSchema();
  const { rows } = await db.query(
    `INSERT INTO crm.crm_activities (opportunity_id, account_id, contact_id, activity_type, subject, description, scheduled_at, duration_minutes, owner_user_id, status, visit_log_id, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled',$10,$11,$11) RETURNING *`,
    [data.opportunity_id||null, data.account_id||null, data.contact_id||null, data.activity_type,
     data.subject, data.description||null, data.scheduled_at||null, data.duration_minutes||null,
     data.owner_user_id||user.id, data.visit_log_id || null, user.id]
  );
  return rows[0];
};

const updateActivity = async (id, data, user) => {
  await ensureActivityFollowupSchema();
  const { rows: cur } = await db.query(
    `SELECT
       a.owner_user_id,
       a.activity_type,
       EXISTS (
         SELECT 1 FROM public.scheduled_visits sv WHERE sv.crm_activity_id = a.id
       ) AS is_scheduled_visit
     FROM crm.crm_activities a
     WHERE a.id=$1 AND a.deleted_at IS NULL`,
    [id],
  );
  if (!cur.length) throw mkErr('Actividad no encontrada', 404);
  if (!isManager(user) && cur[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  if (data.status === 'cancelled' && cur[0].activity_type === 'visita' && cur[0].is_scheduled_visit) {
    throw mkErr('Las visitas del cronograma no se pueden cancelar desde el CRM', 400);
  }
  const allowed = ['subject','description','scheduled_at','duration_minutes','owner_user_id','status','activity_type','outcome','outcome_notes','next_step','visit_log_id'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_activities SET ${sets}, updated_by=$${fields.length+2}, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f]), user.id]
  );
  return rows[0];
};

const completeActivity = async (id, { outcome_notes, outcome_rating, outcome, next_step } = {}, user) => {
  await ensureActivityFollowupSchema();
  const { rows: cur } = await db.query(
    `SELECT
       a.owner_user_id,
       a.activity_type,
       a.status,
       a.visit_log_id,
       EXISTS (
         SELECT 1
         FROM public.scheduled_visits sv
         WHERE sv.crm_activity_id = a.id
       ) AS is_scheduled_visit
     FROM crm.crm_activities a
     WHERE a.id=$1 AND a.deleted_at IS NULL`,
    [id]
  );
  if (!cur.length) throw mkErr('Actividad no encontrada', 404);
  if (!isManager(user) && cur[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  if (
    cur[0].activity_type === 'visita' &&
    cur[0].is_scheduled_visit &&
    cur[0].status !== 'visited_pending_followup'
  ) {
    throw mkErr('Las visitas del cronograma solo se marcan como realizadas desde Asistencia', 400);
  }
  const { rows } = await db.query(
    `UPDATE crm.crm_activities
        SET status='completed',
            completed_at=COALESCE(completed_at, now()),
            outcome_notes=$2,
            outcome_rating=$3,
            outcome=$4,
            next_step=$5,
            updated_by=$6,
            updated_at=now()
      WHERE id=$1
      RETURNING *`,
    [id, outcome_notes||null, outcome_rating||null, outcome||null, next_step||null, user.id]
  );
  return rows[0];
};

const softDeleteActivity = async (id, user) => {
  await ensureActivityFollowupSchema();
  const { rows: cur } = await db.query(`SELECT owner_user_id FROM crm.crm_activities WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Actividad no encontrada', 404);
  if (!isManager(user) && cur[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  await db.query(`UPDATE crm.crm_activities SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Documents ────────────────────────────────────────────────────────────────

const listDocuments = async ({ opportunity_id, account_id, activity_id, limit = 50, offset = 0, user } = {}) => {
  await ensureActivityFollowupSchema();
  const conditions = ['d.deleted_at IS NULL'];
  const params = [];
  if (opportunity_id) { params.push(opportunity_id); conditions.push(`d.opportunity_id=$${params.length}`); }
  if (account_id) { params.push(account_id); conditions.push(`d.account_id=$${params.length}`); }
  if (activity_id) { params.push(activity_id); conditions.push(`d.activity_id=$${params.length}`); }
  if (!isManager(user)) { params.push(user.id); conditions.push(`d.created_by=$${params.length}`); }
  params.push(Number(limit), Number(offset));
  const { rows } = await db.query(
    `SELECT d.*, u.fullname as uploader_name FROM crm.crm_documents d LEFT JOIN public.users u ON u.id=d.created_by WHERE ${conditions.join(' AND ')} ORDER BY d.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return rows;
};

const createDocument = async (data, user) => {
  await ensureActivityFollowupSchema();
  if (data.activity_id) {
    const { rows: activityRows } = await db.query(
      `SELECT owner_user_id FROM crm.crm_activities WHERE id=$1 AND deleted_at IS NULL`,
      [data.activity_id],
    );
    if (!activityRows.length) throw mkErr('Actividad no encontrada', 404);
    if (!isManager(user) && activityRows[0].owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);
  }
  const { rows } = await db.query(
    `INSERT INTO crm.crm_documents (opportunity_id, account_id, activity_id, document_name, document_type, description, drive_file_id, drive_file_url, file_size_bytes, mime_type, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [data.opportunity_id||null, data.account_id||null, data.activity_id||null, data.document_name, data.document_type||null,
     data.description||null, data.drive_file_id||null, data.drive_file_url||data.drive_url||null, data.file_size_bytes||null, data.mime_type||null, user.id]
  );
  return rows[0];
};

const uploadDocumentFile = async ({ file, body = {}, user } = {}) => {
  await ensureActivityFollowupSchema();
  if (!file) throw mkErr('Debes adjuntar un documento', 400);

  const activityId = body.activity_id || null;
  if (!activityId) throw mkErr('Actividad requerida para adjuntar evidencia', 400);

  const { rows: activityRows } = await db.query(
    `SELECT a.id, a.owner_user_id, a.account_id, a.opportunity_id, a.subject,
            acc.account_name,
            o.name AS opportunity_name
       FROM crm.crm_activities a
       LEFT JOIN crm.crm_accounts acc ON acc.id = a.account_id
       LEFT JOIN crm.crm_opportunities o ON o.id = a.opportunity_id
      WHERE a.id=$1 AND a.deleted_at IS NULL`,
    [activityId],
  );
  if (!activityRows.length) throw mkErr('Actividad no encontrada', 404);
  const activity = activityRows[0];
  if (!isManager(user) && activity.owner_user_id !== user.id) throw mkErr('Acceso denegado', 403);

  const originalName = String(file.originalname || 'documento').trim() || 'documento';
  const extension = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : '';
  const baseName = sanitizeFileToken(originalName.replace(/\.[^.]+$/, ''), 'evidencia-visita');
  const fileName = `${baseName}-${Date.now()}${extension ? `.${extension}` : ''}`;
  const rootFolderId = process.env.DRIVE_CRM_FOLDER_ID
    || process.env.DRIVE_CRM_PROSPECTS_FOLDER_ID
    || process.env.DRIVE_ROOT_FOLDER_ID
    || process.env.DRIVE_FOLDER_ID
    || null;

  let folderId = null;
  if (rootFolderId) {
    const folder = await ensureFolderPath(
      [
        'CRM',
        'Actividades',
        sanitizeFileToken(activity.account_name || activity.opportunity_name || 'sin-cliente', 'sin-cliente'),
        sanitizeFileToken(activity.id, 'actividad'),
      ],
      rootFolderId,
    );
    folderId = folder?.id || null;
  }

  const uploaded = await uploadFileToDrive(file, fileName, folderId || undefined, { makeAnyoneReader: true });
  const driveUrl = uploaded?.webViewLink || uploaded?.webContentLink || null;

  return createDocument({
    account_id: body.account_id || activity.account_id || null,
    opportunity_id: body.opportunity_id || activity.opportunity_id || null,
    activity_id: activityId,
    document_name: body.document_name || originalName,
    document_type: body.document_type || 'evidencia_visita',
    description: body.description || null,
    drive_file_id: uploaded?.id || null,
    drive_file_url: driveUrl,
    file_size_bytes: Number(file.size || 0) || null,
    mime_type: file.mimetype || 'application/octet-stream',
  }, user);
};

const softDeleteDocument = async (id, user) => {
  await ensureActivityFollowupSchema();
  const { rows: cur } = await db.query(`SELECT created_by FROM crm.crm_documents WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Documento no encontrado', 404);
  if (!isManager(user) && cur[0].created_by !== user.id) throw mkErr('Acceso denegado', 403);
  await db.query(`UPDATE crm.crm_documents SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Notes ────────────────────────────────────────────────────────────────────

const listNotes = async ({ opportunity_id, account_id, limit = 50, offset = 0, user } = {}) => {
  const conditions = ['n.deleted_at IS NULL'];
  const params = [];
  if (opportunity_id) { params.push(opportunity_id); conditions.push(`n.opportunity_id=$${params.length}`); }
  if (account_id) { params.push(account_id); conditions.push(`n.account_id=$${params.length}`); }
  if (!isManager(user)) { params.push(user.id); conditions.push(`n.created_by=$${params.length}`); }
  params.push(Number(limit), Number(offset));
  const { rows } = await db.query(
    `SELECT n.*, u.fullname as author_name FROM crm.crm_notes n LEFT JOIN public.users u ON u.id=n.created_by WHERE ${conditions.join(' AND ')} ORDER BY n.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return rows;
};

const createNote = async (data, user) => {
  const { rows } = await db.query(
    `INSERT INTO crm.crm_notes (opportunity_id, account_id, content, is_private, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.opportunity_id||null, data.account_id||null, data.content, data.is_private||false, user.id]
  );
  return rows[0];
};

const updateNote = async (id, { content, is_private } = {}, user) => {
  const { rows: cur } = await db.query(`SELECT created_by FROM crm.crm_notes WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Nota no encontrada', 404);
  if (!isManager(user) && cur[0].created_by !== user.id) throw mkErr('Acceso denegado', 403);
  const { rows } = await db.query(
    `UPDATE crm.crm_notes SET content=COALESCE($2,content), is_private=COALESCE($3,is_private), updated_at=now() WHERE id=$1 RETURNING *`,
    [id, content||null, is_private != null ? is_private : null]
  );
  return rows[0];
};

const softDeleteNote = async (id, user) => {
  const { rows: cur } = await db.query(`SELECT created_by FROM crm.crm_notes WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!cur.length) throw mkErr('Nota no encontrada', 404);
  if (!isManager(user) && cur[0].created_by !== user.id) throw mkErr('Acceso denegado', 403);
  await db.query(`UPDATE crm.crm_notes SET deleted_at=now() WHERE id=$1`, [id]);
  return { deleted: true };
};

// ─── Lost Reasons ─────────────────────────────────────────────────────────────

const listLostReasons = async () => {
  const { rows } = await db.query(`SELECT * FROM crm.crm_lost_reasons WHERE is_active=true ORDER BY display_order ASC, reason_name ASC`);
  return rows;
};

const createLostReason = async (data, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const { rows } = await db.query(
    `INSERT INTO crm.crm_lost_reasons (reason_name, reason_description, display_order, is_active) VALUES ($1,$2,$3,true) RETURNING *`,
    [data.reason_name, data.reason_description||null, data.display_order||0]
  );
  return rows[0];
};

const updateLostReason = async (id, data, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const allowed = ['reason_name','reason_description','display_order','is_active'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (!fields.length) throw mkErr('Sin campos', 400);
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `UPDATE crm.crm_lost_reasons SET ${sets} WHERE id=$1 RETURNING *`,
    [id, ...fields.map(f => data[f])]
  );
  if (!rows.length) throw mkErr('Motivo no encontrado', 404);
  return rows[0];
};

// ─── Dashboard / Reports ──────────────────────────────────────────────────────

const getDashboardSummary = async (user) => {
  const managed = isManager(user);
  const [{ rows: oppStats }, { rows: bsStats }, { rows: myActions }] = await Promise.all([
    managed
      ? db.query(`SELECT status, COUNT(*)::int as count, COALESCE(SUM(estimated_amount), 0)::numeric as total_amount FROM crm.crm_opportunities WHERE deleted_at IS NULL GROUP BY status`)
      : db.query(`SELECT status, COUNT(*)::int as count, COALESCE(SUM(estimated_amount), 0)::numeric as total_amount FROM crm.crm_opportunities WHERE deleted_at IS NULL AND owner_user_id=$1 GROUP BY status`, [user.id]),
    managed
      ? db.query(`SELECT bs.status, COUNT(*) as count FROM crm.crm_blue_sheets bs JOIN crm.crm_opportunities o ON o.id=bs.opportunity_id WHERE bs.deleted_at IS NULL GROUP BY bs.status`)
      : db.query(`SELECT bs.status, COUNT(*) as count FROM crm.crm_blue_sheets bs JOIN crm.crm_opportunities o ON o.id=bs.opportunity_id WHERE bs.deleted_at IS NULL AND o.owner_user_id=$1 GROUP BY bs.status`, [user.id]),
    db.query(`SELECT COUNT(*) as count FROM crm.crm_action_items WHERE owner_user_id=$1 AND status IN ('pending','in_progress') AND deleted_at IS NULL`, [user.id]),
  ]);
  return { opportunities: oppStats, blue_sheets: bsStats, my_open_actions: Number(myActions[0]?.count||0) };
};

const getPipelineByStage = async (user) => {
  const managed = isManager(user);
  const joinFilter = managed ? '' : 'AND o.owner_user_id=$1';
  const params = managed ? [] : [user.id];
  const { rows } = await db.query(`
    SELECT s.id, s.name, s.order_index, s.probability_default,
      COUNT(o.id)::int as opportunity_count,
      COALESCE(SUM(o.estimated_amount), 0)::numeric as total_amount,
      COALESCE(SUM(o.estimated_amount * COALESCE(o.probability_override, s.probability_default, 0) / 100), 0)::numeric as weighted_amount
    FROM crm.crm_pipeline_stages s
    LEFT JOIN crm.crm_opportunities o ON o.stage_id=s.id AND o.status='open' AND o.deleted_at IS NULL ${joinFilter}
    WHERE s.is_active=true
    GROUP BY s.id, s.name, s.order_index, s.probability_default
    ORDER BY s.order_index ASC
  `, params);
  return rows;
};

const getForecast = async ({ period = 'quarter', year, month } = {}, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const now = new Date();
  let dateStart, dateEnd;
  if (period === 'month') {
    const y = year || now.getFullYear(), m = (month || (now.getMonth()+1)) - 1;
    dateStart = new Date(y, m, 1);
    dateEnd = new Date(y, m+1, 0);
  } else {
    const q = Math.floor(now.getMonth() / 3);
    dateStart = new Date(now.getFullYear(), q*3, 1);
    dateEnd = new Date(now.getFullYear(), q*3+3, 0);
  }
  const { rows } = await db.query(`
    SELECT o.status, COUNT(*) as count,
      SUM(o.estimated_amount) as pipeline_total,
      SUM(o.estimated_amount * COALESCE(o.probability_override, s.probability_default, 0) / 100) as weighted_total,
      SUM(o.won_amount) as won_total
    FROM crm.crm_opportunities o
    LEFT JOIN crm.crm_pipeline_stages s ON s.id=o.stage_id
    WHERE o.estimated_close_date BETWEEN $1 AND $2 AND o.deleted_at IS NULL
    GROUP BY o.status
  `, [dateStart.toISOString().split('T')[0], dateEnd.toISOString().split('T')[0]]);
  return { period, date_start: dateStart, date_end: dateEnd, breakdown: rows };
};

const getBlueSheetKpis = async (user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const { rows } = await db.query(`
    SELECT bs.status, bs.health_status,
      AVG(bs.completeness_score) as avg_completeness,
      AVG(bs.scorecard_score) as avg_scorecard,
      AVG(bs.health_score) as avg_health,
      COUNT(*) as count
    FROM crm.crm_blue_sheets bs
    WHERE bs.deleted_at IS NULL
    GROUP BY bs.status, bs.health_status
    ORDER BY bs.status, bs.health_status
  `);
  return rows;
};

const getLostReasonsReport = async ({ date_from, date_to } = {}, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const conditions = [`o.status='lost'`, `o.deleted_at IS NULL`];
  const params = [];
  if (date_from) { params.push(date_from); conditions.push(`o.actual_close_date >= $${params.length}`); }
  if (date_to) { params.push(date_to); conditions.push(`o.actual_close_date <= $${params.length}`); }
  const { rows } = await db.query(`
    SELECT lr.reason_name, COUNT(o.id) as count, SUM(o.estimated_amount) as total_pipeline_lost
    FROM crm.crm_opportunities o
    LEFT JOIN crm.crm_lost_reasons lr ON lr.id=o.lost_reason_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY lr.id, lr.reason_name ORDER BY count DESC
  `, params);
  return rows;
};

const getRedFlagsReport = async ({ severity, status: rfStatus } = {}, user) => {
  if (!isManager(user)) throw mkErr('Acceso denegado', 403);
  const conditions = [`rf.deleted_at IS NULL`];
  const params = [];
  if (severity) { params.push(severity); conditions.push(`rf.severity=$${params.length}`); }
  if (rfStatus) { params.push(rfStatus); conditions.push(`rf.status=$${params.length}`); }
  const { rows } = await db.query(`
    SELECT rf.*, o.name as opportunity_name, o.owner_user_id, u.fullname as owner_name
    FROM crm.crm_red_flags rf
    JOIN crm.crm_blue_sheets bs ON bs.id=rf.blue_sheet_id
    JOIN crm.crm_opportunities o ON o.id=bs.opportunity_id
    LEFT JOIN public.users u ON u.id=o.owner_user_id
    WHERE ${conditions.join(' AND ')} ORDER BY rf.severity DESC, rf.created_at DESC
  `, params);
  return rows;
};

module.exports = {
  // Accounts
  listAccounts, getAccountById, createAccount, updateAccount, softDeleteAccount, getAccountTimeline,
  // Contacts
  listContacts, getContactById, createContact, updateContact, softDeleteContact,
  // Leads
  listLeads, getLeadById, createLead, updateLead, softDeleteLead, convertLead, disqualifyLead,
  linkLeadAccount, createLeadContact,
  // Pipeline
  listPipelineStages, createPipelineStage, updatePipelineStage,
  // Opportunities
  listOpportunities, getOpportunityById, createOpportunity, updateOpportunity,
  changeOpportunityStage, closeWon, closeLost, suspendOpportunity, getOpportunityHealth,
  promoteLeadToOpportunity, getOpportunityPurchaseStatus, linkPurchaseToOpportunity,
  // Notifications + Audit
  crmNotify, crmAuditLog,
  notifyBlueSheetSubmitted, notifyBlueSheetObserved, notifyBlueSheetApproved,
  notifyRedFlagCritical, notifyAssignment,
  // Blue Sheets
  createBlueSheet, getBlueSheetByOpportunity, getBlueSheetById,
  updateBlueSheetGeneral, updateBlueSheetBuyingProcess, updateBlueSheetStrategy,
  submitBlueSheetForReview, approveBlueSheet, observeBlueSheet, reopenBlueSheet,
  getBlueSheetVersions, getBlueSheetCompleteness,
  // Buying Influences
  listBuyingInfluences, createBuyingInfluence, updateBuyingInfluence, softDeleteBuyingInfluence,
  // Win-Results
  listWinResults, createWinResult, updateWinResult, softDeleteWinResult,
  // Competitors
  listCompetitors, createCompetitor, updateCompetitor, softDeleteCompetitor,
  // Competitive Preferences
  listCompetitivePreferences, upsertCompetitivePreference,
  // Strengths
  listStrengths, createStrength, updateStrength, softDeleteStrength,
  // Red Flags
  listRedFlags, createRedFlag, updateRedFlag, softDeleteRedFlag, acceptRedFlag,
  // Scorecard
  listScorecardCriteria, createScorecardCriterion, updateScorecardCriterion,
  getBlueSheetScorecard, saveBlueSheetScorecard,
  // Action Items
  listActionItems, createActionItem, updateActionItem, completeActionItem, softDeleteActionItem,
  // Activities
  listActivities, createActivity, updateActivity, completeActivity, softDeleteActivity,
  // Documents
  listDocuments, createDocument, uploadDocumentFile, softDeleteDocument,
  // Notes
  listNotes, createNote, updateNote, softDeleteNote,
  // Lost Reasons
  listLostReasons, createLostReason, updateLostReason,
  // Dashboard
  getDashboardSummary, getPipelineByStage, getForecast, getBlueSheetKpis,
  getLostReasonsReport, getRedFlagsReport,
};
