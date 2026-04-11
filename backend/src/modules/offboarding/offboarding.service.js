const fs = require("fs");
const path = require("path");

const db = require("../../config/db");
const logger = require("../../config/logger");
const { drive } = require("../../config/google");
const { logAction } = require("../../utils/audit");
const { ensureFolder, copyTemplate, replaceTags, exportPdf } = require("../../utils/drive");
const { resolveExternalDriveIntegrity } = require("../../utils/documentHash");
const { computeOffboardingLiquidation } = require("../vacaciones/vacaciones.service");
const notificationManager = require("../notifications/notificationManager");

const OFFBOARDING_STAGES = {
  OPERATIONAL: "OPERATIONAL",
  FINANCIAL: "FINANCIAL",
  HR: "HR",
};

const OFFBOARDING_TASKS = [
  {
    stage: OFFBOARDING_STAGES.OPERATIONAL,
    task_key: "salida_equipos",
    label: "Entrega de equipos",
    onboarding_flag: "salida_equipos",
  },
  {
    stage: OFFBOARDING_STAGES.OPERATIONAL,
    task_key: "salida_cuentas",
    label: "Cierre de cuentas y accesos",
    onboarding_flag: "salida_cuentas",
  },
  {
    stage: OFFBOARDING_STAGES.FINANCIAL,
    task_key: "liquidacion",
    label: "Liquidacion y acta de finiquito",
    onboarding_flag: "liquidacion",
  },
  {
    stage: OFFBOARDING_STAGES.HR,
    task_key: "cierre_usuario",
    label: "Cierre de usuario",
    onboarding_flag: null,
  },
];

const TASK_MAP = OFFBOARDING_TASKS.reduce((acc, task) => {
  acc[task.task_key] = task;
  return acc;
}, {});

const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || null;
const OFFBOARDING_TEMPLATE_FILE_ID = process.env.OFFBOARDING_FINIQUITO_TEMPLATE_ID || null;
const OFFBOARDING_PASSIVE_ROLE = String(process.env.OFFBOARDING_PASSIVE_ROLE || "pasivo")
  .trim()
  .toLowerCase();
const OFFBOARDING_TEMPLATE_PATH = path.join(
  __dirname,
  "../../data/plantillas/Acta_Finiquito_Template.docx"
);
const GERENCIA_GENERAL_ROLES = new Set(["gerencia_general", "gerente_general"]);
const IMMEDIATE_ROLE_MAP = {
  comercial: "jefe_comercial",
  acp_comercial: "jefe_comercial",
  marketing: "jefe_comercial",
  backoffice_comercial: "jefe_comercial",
  financiero: "jefe_financiero",
  finanzas: "jefe_financiero",
  tecnico: "jefe_tecnico",
  tecnico_servicio: "jefe_tecnico",
  servicio_tecnico: "jefe_tecnico",
  ti: "jefe_ti",
  admin_ti: "jefe_ti",
  logistica: "jefe_logistica",
  operaciones: "jefe_operaciones",
  calidad: "jefe_calidad",
};

const roundToTwo = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === 1 ||
  value === "1" ||
  String(value || "").trim().toLowerCase() === "t";

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

function resolveImmediateApproverRole(requesterRole = "") {
  const normalized = normalizeRoleName(requesterRole);
  const isJefe = normalized.startsWith("jefe_") || normalized.startsWith("jefe");
  if (isJefe) return "gerencia_general";
  return IMMEDIATE_ROLE_MAP[normalized] || "gerencia_general";
}

function expandRoleCandidates(role) {
  const normalized = normalizeRoleName(role);
  const candidates = new Set([normalized]);
  if (normalized === "gerencia_general" || normalized === "gerente_general") {
    candidates.add("gerencia_general");
    candidates.add("gerente_general");
  }
  if (normalized === "jefe_financiero" || normalized === "jefe_finanzas") {
    candidates.add("jefe_financiero");
    candidates.add("jefe_finanzas");
  }
  return Array.from(candidates).filter(Boolean);
}

function getDisplayName(user = {}) {
  return user?.fullname || user?.name || user?.email || "";
}

function buildOffboardingRequestCode(userId) {
  const suffix = Date.now().toString(36).toUpperCase();
  return `OFF-${String(userId)}-${suffix}`;
}

async function getOffboardingRequestState(client, userId) {
  const { rows } = await client.query(
    `SELECT profile
       FROM collaborator_profiles
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  const profile = rows[0]?.profile || {};
  const onboarding = profile?.onboarding || {};
  return {
    requested: toBoolean(onboarding?.offboarding_requested),
    requestCode: String(onboarding?.offboarding_request_code || "").trim(),
  };
}

async function findActiveUsersByRoles(client, roles = []) {
  const normalizedRoles = Array.from(
    new Set(
      (roles || [])
        .flatMap((role) => expandRoleCandidates(role))
        .map(normalizeRoleName)
        .filter(Boolean)
    )
  );
  if (!normalizedRoles.length) return [];
  const { rows } = await client.query(
    `SELECT id, email, fullname, name, role
       FROM users
      WHERE active = true
        AND LOWER(COALESCE(role, '')) = ANY($1::text[])`,
    [normalizedRoles]
  );
  return rows || [];
}

async function notifyOffboardingStarted({
  targetUser,
  actor,
  immediateRole,
  reason,
  requestCode,
}) {
  const roleTargets = new Set([
    "jefe_financiero",
    "jefe_ti",
    "gerencia_general",
    immediateRole,
  ]);

  const recipients = await findActiveUsersByRoles(db, Array.from(roleTargets));
  const seenUserIds = new Set();
  const filteredRecipients = recipients.filter((recipient) => {
    const id = Number(recipient?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    if (seenUserIds.has(id)) return false;
    seenUserIds.add(id);
    return true;
  });

  if (!filteredRecipients.length) return { recipients: 0 };

  const collaboratorName = getDisplayName(targetUser) || `Colaborador #${targetUser?.id || "N/A"}`;
  const actorName = getDisplayName(actor) || "Sistema";
  const message = [
    `Se inició el proceso de desvinculación de ${collaboratorName}.`,
    targetUser?.email ? `Correo: ${targetUser.email}.` : null,
    targetUser?.role ? `Rol actual: ${targetUser.role}.` : null,
    targetUser?.department_name ? `Área: ${targetUser.department_name}.` : null,
    `Iniciado por: ${actorName}.`,
    reason ? `Motivo: ${reason}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const results = await Promise.allSettled(
    filteredRecipients.map((recipient) =>
      notificationManager.sendNotification({
        userId: recipient.id,
        customTitle: "Proceso de desvinculación iniciado",
        customMessage: message,
        type: "task",
        source: "offboarding",
        priority: 1,
        email: true,
        meta: {
          collaborator_user_id: targetUser?.id || null,
          collaborator_email: targetUser?.email || null,
          collaborator_role: targetUser?.role || null,
          collaborator_department: targetUser?.department_name || null,
          immediate_role: immediateRole || null,
          offboarding_request_code: requestCode || null,
          offboarding_request_reason: reason || null,
          initiated_by_user_id: actor?.id || null,
          initiated_by_email: actor?.email || null,
          target_path: `/dashboard/talento-humano/command-center/desvinculacion/${targetUser?.id || ""}`,
        },
      })
    )
  );

  results.forEach((result, index) => {
    if (result.status === "fulfilled") return;
    logger.warn(
      {
        notifyError: result.reason,
        targetUserId: targetUser?.id || null,
        recipient: filteredRecipients[index]?.email || null,
      },
      "No se pudo notificar inicio de offboarding"
    );
  });

  return {
    recipients: filteredRecipients.length,
    delivered: results.filter((item) => item.status === "fulfilled").length,
  };
}

async function ensureOffboardingTables(client = db) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS offboarding_tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      task_key TEXT NOT NULL,
      is_completed BOOLEAN DEFAULT false,
      completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, task_key)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS offboarding_processes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      departure_date DATE,
      salary_base NUMERIC(12,2),
      other_deductions NUMERIC(12,2) DEFAULT 0,
      liquidation_snapshot JSONB DEFAULT '{}'::jsonb,
      liquidation_total NUMERIC(12,2),
      finiquito_doc_drive_id TEXT,
      finiquito_doc_url TEXT,
      finiquito_pdf_drive_id TEXT,
      finiquito_pdf_url TEXT,
      finiquito_generated_at TIMESTAMPTZ,
      generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_closed BOOLEAN DEFAULT false,
      closed_at TIMESTAMPTZ,
      closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_offboarding_tasks_user_stage ON offboarding_tasks(user_id, stage)"
  );
}

async function ensureProcessAndTasks(client, userId) {
  await client.query(
    `INSERT INTO offboarding_processes (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  for (const task of OFFBOARDING_TASKS) {
    await client.query(
      `INSERT INTO offboarding_tasks (user_id, stage, task_key, is_completed)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (user_id, task_key) DO NOTHING`,
      [userId, task.stage, task.task_key]
    );
  }
}

async function loadOffboardingTasks(client, userId) {
  const { rows } = await client.query(
    `SELECT id, user_id, stage, task_key, is_completed, completed_by, completed_at, created_at, updated_at
       FROM offboarding_tasks
      WHERE user_id = $1
      ORDER BY
        CASE stage
          WHEN 'OPERATIONAL' THEN 1
          WHEN 'FINANCIAL' THEN 2
          WHEN 'HR' THEN 3
          ELSE 4
        END,
        id ASC`,
    [userId]
  );
  return rows || [];
}

function buildStageProgress(tasks = []) {
  const stages = Object.values(OFFBOARDING_STAGES).reduce((acc, stage) => {
    acc[stage] = { stage, total: 0, done: 0, complete: false };
    return acc;
  }, {});

  tasks.forEach((task) => {
    const stage = String(task.stage || "").toUpperCase();
    if (!stages[stage]) return;
    stages[stage].total += 1;
    if (task.is_completed) stages[stage].done += 1;
  });

  Object.values(stages).forEach((stage) => {
    stage.complete = stage.total > 0 && stage.done === stage.total;
  });

  return stages;
}

async function getOnboardingFlags(client, userId) {
  const { rows } = await client.query(
    `SELECT profile
       FROM collaborator_profiles
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  const profile = rows[0]?.profile || {};
  const onboarding = profile?.onboarding || {};
  return {
    salida_equipos: toBoolean(onboarding?.salida_equipos),
    salida_cuentas: toBoolean(onboarding?.salida_cuentas),
    salida_sri: toBoolean(onboarding?.salida_sri),
    liquidacion: toBoolean(onboarding?.liquidacion),
  };
}

async function updateOnboardingFlag(client, userId, flagKey, isCompleted, actorId = null) {
  if (!flagKey) return;
  await client.query(
    `INSERT INTO collaborator_profiles (user_id, profile, updated_by)
     VALUES (
       $1,
       jsonb_build_object('onboarding', jsonb_build_object($2::text, $3::boolean)),
       $4
     )
     ON CONFLICT (user_id) DO UPDATE
     SET profile = jsonb_set(
          COALESCE(collaborator_profiles.profile, '{}'::jsonb),
          ARRAY['onboarding', $2::text],
          to_jsonb($3::boolean),
          true
        ),
        updated_by = COALESCE($4, collaborator_profiles.updated_by),
        updated_at = now()`,
    [userId, flagKey, Boolean(isCompleted), actorId]
  );
}

async function syncOperationalTasksFromProfile(client, userId) {
  const flags = await getOnboardingFlags(client, userId);
  const operationalKeys = ["salida_equipos", "salida_cuentas"];
  for (const key of operationalKeys) {
    const expected = Boolean(flags[key]);
    await client.query(
      `UPDATE offboarding_tasks
          SET is_completed = $3,
              completed_at = CASE
                WHEN $3 = true THEN COALESCE(completed_at, now())
                ELSE NULL
              END,
              completed_by = CASE
                WHEN $3 = true THEN completed_by
                ELSE NULL
              END,
              updated_at = now()
        WHERE user_id = $1
          AND task_key = $2`,
      [userId, key, expected]
    );
  }
  return flags;
}

function assertOperationalStageCompleted(stages) {
  if (!stages?.OPERATIONAL?.complete) {
    const err = new Error(
      "No se puede avanzar: la etapa operativa requiere salida_equipos y salida_cuentas al 100%"
    );
    err.status = 409;
    throw err;
  }
}

function assertFinancialStageCompleted(stages) {
  if (!stages?.FINANCIAL?.complete) {
    const err = new Error(
      "No se puede cerrar la desvinculacion: la etapa financiera no esta completada"
    );
    err.status = 409;
    throw err;
  }
}

async function loadUser(client, userId) {
  const { rows } = await client.query(
    `SELECT
        u.id,
        u.email,
        u.fullname,
        u.name,
        u.role,
        u.active,
        u.department_id,
        d.name AS department_name
       FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function loadProcess(client, userId) {
  const { rows } = await client.query(
    `SELECT *
       FROM offboarding_processes
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function buildWorkspace(client, userId) {
  await ensureOffboardingTables(client);
  await ensureProcessAndTasks(client, userId);
  const user = await loadUser(client, userId);
  if (!user) {
    const err = new Error("Colaborador no encontrado");
    err.status = 404;
    throw err;
  }

  const onboardingFlags = await syncOperationalTasksFromProfile(client, userId);
  const process = await loadProcess(client, userId);
  const tasks = await loadOffboardingTasks(client, userId);
  const stages = buildStageProgress(tasks);

  const decoratedTasks = tasks.map((task) => ({
    ...task,
    label: TASK_MAP[task.task_key]?.label || task.task_key,
  }));

  return {
    user: {
      id: user.id,
      email: user.email,
      fullname: user.fullname || user.name || user.email,
      role: user.role,
      active: user.active,
    },
    onboarding_flags: onboardingFlags,
    stages,
    tasks: decoratedTasks,
    process: process
      ? {
          departure_date: process.departure_date,
          salary_base: process.salary_base,
          other_deductions: process.other_deductions,
          liquidation_snapshot: process.liquidation_snapshot || null,
          liquidation_total: process.liquidation_total,
          finiquito_doc_drive_id: process.finiquito_doc_drive_id,
          finiquito_doc_url: process.finiquito_doc_url,
          finiquito_pdf_drive_id: process.finiquito_pdf_drive_id,
          finiquito_pdf_url: process.finiquito_pdf_url,
          finiquito_generated_at: process.finiquito_generated_at,
          is_closed: process.is_closed,
          closed_at: process.closed_at,
        }
      : null,
  };
}

async function resolveOffboardingFolder(user) {
  const root = await ensureFolder("Talento Humano", DRIVE_ROOT_FOLDER_ID);
  const offboarding = await ensureFolder("Offboarding", root.id);
  const personFolder = await ensureFolder(
    user?.fullname || user?.name || user?.email || `Usuario-${user?.id || "NA"}`,
    offboarding.id
  );
  return personFolder.id;
}

async function createFiniquitoDocument({
  user,
  departureDate,
  liquidation,
  liquidationValue,
  netValue,
  folderId,
}) {
  const safeDepartureDate = normalizeDateOnly(departureDate) || normalizeDateOnly(new Date());
  const employeeName = user?.fullname || user?.name || user?.email || "Colaborador";
  const baseName = `Acta Finiquito - ${employeeName} - ${safeDepartureDate}`;

  let doc = null;
  if (OFFBOARDING_TEMPLATE_FILE_ID) {
    doc = await copyTemplate(OFFBOARDING_TEMPLATE_FILE_ID, baseName, folderId);
  } else if (fs.existsSync(OFFBOARDING_TEMPLATE_PATH)) {
    const media = fs.createReadStream(OFFBOARDING_TEMPLATE_PATH);
    const { data } = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: baseName,
        mimeType: "application/vnd.google-apps.document",
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: media,
      },
      fields: "id, name, webViewLink",
    });
    doc = data;
  } else {
    const err = new Error(
      "No se encontro plantilla de acta de finiquito. Configura OFFBOARDING_FINIQUITO_TEMPLATE_ID o agrega Acta_Finiquito_Template.docx."
    );
    err.status = 500;
    throw err;
  }

  await replaceTags(doc.id, {
    FECHA_SALIDA: safeDepartureDate,
    DIAS_VACACIONES: String(liquidation?.total_to_pay ?? 0),
    VALOR_LIQUIDACION: Number(netValue || 0).toFixed(2),
    VALOR_LIQUIDACION_BRUTA: Number(liquidationValue || 0).toFixed(2),
    COLABORADOR: employeeName,
  });

  const pdf = await exportPdf(doc.id, folderId, `${baseName}.pdf`);
  const integrity = await resolveExternalDriveIntegrity(pdf?.id, drive);

  return {
    doc_id: doc?.id || null,
    doc_url: doc?.webViewLink || null,
    pdf_id: pdf?.id || null,
    pdf_url: pdf?.webViewLink || null,
    integrity: integrity || null,
  };
}

async function updateTask({
  userId,
  taskKey,
  isCompleted,
  actor,
}) {
  const targetUserId = Number(userId);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    const err = new Error("Usuario invalido");
    err.status = 400;
    throw err;
  }

  const normalizedTaskKey = String(taskKey || "").trim().toLowerCase();
  const taskDef = TASK_MAP[normalizedTaskKey];
  if (!taskDef) {
    const err = new Error("Tarea de offboarding no reconocida");
    err.status = 404;
    throw err;
  }

  if (taskDef.stage !== OFFBOARDING_STAGES.OPERATIONAL) {
    const err = new Error("Solo las tareas operativas se marcan manualmente");
    err.status = 409;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await ensureOffboardingTables(client);
    await ensureProcessAndTasks(client, targetUserId);

    const { rows: existingRows } = await client.query(
      `SELECT *
         FROM offboarding_tasks
        WHERE user_id = $1
          AND task_key = $2
        LIMIT 1`,
      [targetUserId, normalizedTaskKey]
    );
    if (!existingRows[0]) {
      const err = new Error("Tarea no encontrada para el colaborador");
      err.status = 404;
      throw err;
    }

    const checked = Boolean(isCompleted);
    const { rows } = await client.query(
      `UPDATE offboarding_tasks
          SET is_completed = $3,
              completed_by = CASE WHEN $3 = true THEN $4 ELSE NULL END,
              completed_at = CASE WHEN $3 = true THEN now() ELSE NULL END,
              updated_at = now()
        WHERE user_id = $1
          AND task_key = $2
      RETURNING *`,
      [targetUserId, normalizedTaskKey, checked, actor?.id || null]
    );

    if (taskDef.onboarding_flag) {
      await updateOnboardingFlag(
        client,
        targetUserId,
        taskDef.onboarding_flag,
        checked,
        actor?.id || null
      );
    }

    await client.query("COMMIT");

    try {
      await logAction({
        user_id: actor?.id || null,
        user_email: actor?.email || "system",
        role: actor?.role || null,
        module: "offboarding",
        action: "toggle_operational_task",
        details: {
          user_id: targetUserId,
          task_key: normalizedTaskKey,
          is_completed: checked,
        },
      });
    } catch (auditError) {
      logger.warn({ auditError, userId: targetUserId }, "No se pudo registrar auditoria de task offboarding");
    }

    const workspace = await buildWorkspace(db, targetUserId);
    return { task: rows[0], workspace };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function runLiquidation({
  userId,
  departureDate,
  salaryBase,
  otherDeductions = 0,
  actor,
}) {
  const targetUserId = Number(userId);
  const departureDateOnly = normalizeDateOnly(departureDate);
  const salary = Number(salaryBase);
  const deductions = roundToTwo(otherDeductions);

  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    const err = new Error("Usuario invalido");
    err.status = 400;
    throw err;
  }
  if (!departureDateOnly) {
    const err = new Error("Fecha de salida invalida");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(salary) || salary <= 0) {
    const err = new Error("Salario base invalido");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await ensureOffboardingTables(client);
    await ensureProcessAndTasks(client, targetUserId);

    const user = await loadUser(client, targetUserId);
    if (!user) {
      const err = new Error("Colaborador no encontrado");
      err.status = 404;
      throw err;
    }

    await syncOperationalTasksFromProfile(client, targetUserId);
    const tasks = await loadOffboardingTasks(client, targetUserId);
    const stages = buildStageProgress(tasks);
    assertOperationalStageCompleted(stages);

    const liquidation = await computeOffboardingLiquidation(
      targetUserId,
      departureDateOnly,
      { client }
    );

    const liquidationValue = roundToTwo((salary / 30) * Number(liquidation.total_to_pay || 0));
    const netValue = roundToTwo(liquidationValue - deductions);

    const folderId = await resolveOffboardingFolder(user);
    const document = await createFiniquitoDocument({
      user,
      departureDate: departureDateOnly,
      liquidation,
      liquidationValue,
      netValue,
      folderId,
    });

    await client.query(
      `UPDATE offboarding_processes
          SET departure_date = $2,
              salary_base = $3,
              other_deductions = $4,
              liquidation_snapshot = $5::jsonb,
              liquidation_total = $6,
              finiquito_doc_drive_id = $7,
              finiquito_doc_url = $8,
              finiquito_pdf_drive_id = $9,
              finiquito_pdf_url = $10,
              finiquito_generated_at = now(),
              generated_by = $11,
              updated_at = now()
        WHERE user_id = $1`,
      [
        targetUserId,
        departureDateOnly,
        roundToTwo(salary),
        deductions,
        JSON.stringify({
          ...liquidation,
          liquidation_value: liquidationValue,
          net_liquidation_value: netValue,
          generated_at: new Date().toISOString(),
        }),
        netValue,
        document.doc_id,
        document.doc_url,
        document.pdf_id,
        document.pdf_url,
        actor?.id || null,
      ]
    );

    await client.query(
      `UPDATE offboarding_tasks
          SET is_completed = true,
              completed_by = $3,
              completed_at = now(),
              updated_at = now()
        WHERE user_id = $1
          AND task_key = $2`,
      [targetUserId, "liquidacion", actor?.id || null]
    );
    await updateOnboardingFlag(client, targetUserId, "liquidacion", true, actor?.id || null);

    await client.query("COMMIT");

    try {
      await logAction({
        user_id: actor?.id || null,
        user_email: actor?.email || "system",
        role: actor?.role || null,
        module: "offboarding",
        action: "generate_liquidation",
        details: {
          user_id: targetUserId,
          departure_date: departureDateOnly,
          salary_base: roundToTwo(salary),
          other_deductions: deductions,
          proportional_days: liquidation.proportional_days,
          carry_over_days: liquidation.carry_over_days,
          taken_days: liquidation.taken_days,
          total_to_pay: liquidation.total_to_pay,
          liquidation_value: liquidationValue,
          net_liquidation_value: netValue,
          finiquito_pdf_drive_id: document.pdf_id,
          integrity: document.integrity || null,
        },
      });
    } catch (auditError) {
      logger.warn({ auditError, userId: targetUserId }, "No se pudo registrar auditoria de liquidacion offboarding");
    }

    const workspace = await buildWorkspace(db, targetUserId);
    return {
      workspace,
      liquidation: {
        ...liquidation,
        salary_base: roundToTwo(salary),
        other_deductions: deductions,
        liquidation_value: liquidationValue,
        net_liquidation_value: netValue,
      },
      document,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function startOffboarding({
  userId,
  actor,
  reason,
}) {
  const targetUserId = Number(userId);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    const err = new Error("Usuario invalido");
    err.status = 400;
    throw err;
  }

  const requestReason = String(reason || "").trim();
  const requestedAtIso = new Date().toISOString();
  const requestedBy = getDisplayName(actor) || "Sistema";

  const client = await db.getClient();
  let user = null;
  let immediateRole = "gerencia_general";
  let alreadyStarted = false;
  let requestCode = "";
  try {
    await client.query("BEGIN");
    await ensureOffboardingTables(client);
    await ensureProcessAndTasks(client, targetUserId);

    user = await loadUser(client, targetUserId);
    if (!user) {
      const err = new Error("Colaborador no encontrado");
      err.status = 404;
      throw err;
    }

    const process = await loadProcess(client, targetUserId);
    const isPassiveUser =
      user.active === false ||
      normalizeRoleName(user.role) === OFFBOARDING_PASSIVE_ROLE;
    if (process?.is_closed || isPassiveUser) {
      const err = new Error("El colaborador ya está desvinculado o con proceso cerrado.");
      err.status = 409;
      throw err;
    }

    const requestState = await getOffboardingRequestState(client, targetUserId);
    alreadyStarted = requestState.requested;
    requestCode = requestState.requestCode || buildOffboardingRequestCode(targetUserId);
    immediateRole = resolveImmediateApproverRole(user.role || "");

    if (!alreadyStarted) {
      await client.query(
        `INSERT INTO collaborator_profiles (user_id, profile, updated_by)
         VALUES (
           $1,
           jsonb_build_object(
             'onboarding',
             jsonb_build_object(
               'offboarding_requested', true,
               'offboarding_request_code', $2::text,
               'offboarding_request_reason', $3::text,
               'offboarding_requested_at', $4::text,
               'offboarding_requested_by', $5::text,
               'offboarding_cancelled_at', NULL,
               'offboarding_cancelled_by', NULL
             )
           ),
           $6
         )
         ON CONFLICT (user_id) DO UPDATE
         SET profile = jsonb_set(
               COALESCE(collaborator_profiles.profile, '{}'::jsonb),
               ARRAY['onboarding'],
               COALESCE(
                 COALESCE(collaborator_profiles.profile, '{}'::jsonb)->'onboarding',
                 '{}'::jsonb
               ) || jsonb_build_object(
                 'offboarding_requested', true,
                 'offboarding_request_code', $2::text,
                 'offboarding_request_reason', $3::text,
                 'offboarding_requested_at', $4::text,
                 'offboarding_requested_by', $5::text,
                 'offboarding_cancelled_at', NULL,
                 'offboarding_cancelled_by', NULL
               ),
               true
             ),
             updated_by = COALESCE($6, collaborator_profiles.updated_by),
             updated_at = now()`,
        [
          targetUserId,
          requestCode,
          requestReason || null,
          requestedAtIso,
          requestedBy,
          actor?.id || null,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  let notifySummary = { recipients: 0, delivered: 0 };
  if (!alreadyStarted) {
    try {
      notifySummary = await notifyOffboardingStarted({
        targetUser: user,
        actor,
        immediateRole,
        reason: requestReason || null,
        requestCode,
      });
    } catch (notifyError) {
      logger.warn(
        { notifyError, userId: targetUserId },
        "No se pudo completar la notificación inicial de offboarding"
      );
    }
  }

  try {
    await logAction({
      user_id: actor?.id || null,
      user_email: actor?.email || "system",
      role: actor?.role || null,
      module: "offboarding",
      action: "start_offboarding",
      details: {
        user_id: targetUserId,
        request_code: requestCode,
        request_reason: requestReason || null,
        requested_by: requestedBy,
        immediate_role: immediateRole,
        already_started: alreadyStarted,
        notified_recipients: notifySummary?.delivered || 0,
      },
    });
  } catch (auditError) {
    logger.warn({ auditError, userId: targetUserId }, "No se pudo registrar auditoria de inicio offboarding");
  }

  const workspace = await buildWorkspace(db, targetUserId);
  return {
    workspace,
    started: !alreadyStarted,
    already_started: alreadyStarted,
    request_code: requestCode,
    immediate_role: immediateRole,
    notified_recipients: notifySummary?.delivered || 0,
  };
}

async function closeOffboarding({
  userId,
  actor,
}) {
  const targetUserId = Number(userId);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    const err = new Error("Usuario invalido");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await ensureOffboardingTables(client);
    await ensureProcessAndTasks(client, targetUserId);

    const user = await loadUser(client, targetUserId);
    if (!user) {
      const err = new Error("Colaborador no encontrado");
      err.status = 404;
      throw err;
    }

    await syncOperationalTasksFromProfile(client, targetUserId);
    const tasks = await loadOffboardingTasks(client, targetUserId);
    const stages = buildStageProgress(tasks);
    assertOperationalStageCompleted(stages);
    assertFinancialStageCompleted(stages);

    const process = await loadProcess(client, targetUserId);
    const departureDate =
      normalizeDateOnly(process?.departure_date) || normalizeDateOnly(new Date());
    const closedAtIso = new Date().toISOString();

    await client.query(
      `UPDATE users
          SET active = false,
              role = COALESCE(NULLIF($2::text, ''), role)
        WHERE id = $1`,
      [targetUserId, OFFBOARDING_PASSIVE_ROLE]
    );

    await client.query(
      `UPDATE offboarding_tasks
          SET is_completed = true,
              completed_by = $3,
              completed_at = now(),
              updated_at = now()
        WHERE user_id = $1
          AND task_key = $2`,
      [targetUserId, "cierre_usuario", actor?.id || null]
    );
    await updateOnboardingFlag(
      client,
      targetUserId,
      "cambio_estado_activo_pasivo",
      true,
      actor?.id || null
    );

    await client.query(
      `UPDATE offboarding_processes
          SET is_closed = true,
              closed_at = now(),
              closed_by = $2,
              updated_at = now()
        WHERE user_id = $1`,
      [targetUserId, actor?.id || null]
    );

    await client.query(
      `INSERT INTO collaborator_profiles (user_id, profile, updated_by)
       VALUES (
         $1,
         jsonb_build_object(
           'laboral',
           jsonb_build_object(
             'estatus_empleado', 'pasivo',
             'fecha_salida', $2
           ),
           'onboarding',
           jsonb_build_object(
             'cambio_estado_activo_pasivo', true
           ),
           'extra',
           jsonb_build_object(
             'offboarding',
             jsonb_build_object(
               'previous_role', $4::text,
               'previous_active', $5::boolean,
               'final_role', $6::text,
               'closed_at', $7::text,
               'closed_by_user_id', $8::int
             )
           )
         ),
         $3
       )
       ON CONFLICT (user_id) DO UPDATE
       SET profile = jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    COALESCE(collaborator_profiles.profile, '{}'::jsonb),
                    ARRAY['laboral', 'estatus_empleado'],
                    to_jsonb('pasivo'::text),
                    true
                  ),
                  ARRAY['laboral', 'fecha_salida'],
                  to_jsonb($2::text),
                  true
                ),
                ARRAY['onboarding', 'cambio_estado_activo_pasivo'],
                to_jsonb(true),
                true
              ),
              ARRAY['extra', 'offboarding'],
              COALESCE(
                COALESCE(collaborator_profiles.profile, '{}'::jsonb)->'extra'->'offboarding',
                '{}'::jsonb
              ) || jsonb_build_object(
                'previous_role', $4::text,
                'previous_active', $5::boolean,
                'final_role', $6::text,
                'closed_at', $7::text,
                'closed_by_user_id', $8::int
              ),
              true
            ),
            ARRAY['extra', 'offboarding_last_closed_at'],
            to_jsonb($7::text),
            true
          ),
          updated_by = COALESCE($3, collaborator_profiles.updated_by),
          updated_at = now()`,
      [
        targetUserId,
        departureDate,
        actor?.id || null,
        user.role || null,
        user.active !== false,
        OFFBOARDING_PASSIVE_ROLE,
        closedAtIso,
        actor?.id || null,
      ]
    );

    await client.query("COMMIT");

    try {
      await logAction({
        user_id: actor?.id || null,
        user_email: actor?.email || "system",
        role: actor?.role || null,
        module: "offboarding",
        action: "close_offboarding",
        details: {
          user_id: targetUserId,
          departure_date: departureDate,
          user_deactivated: true,
          previous_role: user.role || null,
          final_role: OFFBOARDING_PASSIVE_ROLE,
          previous_active: user.active !== false,
          onboarding_flag_updated: "cambio_estado_activo_pasivo",
        },
      });
    } catch (auditError) {
      logger.warn({ auditError, userId: targetUserId }, "No se pudo registrar auditoria de cierre offboarding");
    }

    const workspace = await buildWorkspace(db, targetUserId);
    return {
      workspace,
      closed: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getWorkspace(userId) {
  const targetUserId = Number(userId);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    const err = new Error("Usuario invalido");
    err.status = 400;
    throw err;
  }
  return buildWorkspace(db, targetUserId);
}

module.exports = {
  getWorkspace,
  updateTask,
  runLiquidation,
  startOffboarding,
  closeOffboarding,
};
