const db = require("../../config/db");
const { ensureFolderPath, uploadFileToDrive } = require("../../utils/drive");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = new Set([
  "jefe_ti",
  "jefe_de_ti",
  "admin",
  "administrador",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "gerente",
  "jefe_comercial",
  "jefe_de_comercial",
]);

function mkErr(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

function isManager(user) {
  return MANAGER_ROLES.has(String(user?.role || "").trim().toLowerCase());
}

function sanitizeFileToken(value, fallback = "archivo") {
  const safe = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}

function normalizeUserIds(values = []) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ];
}

function normalizeChecklistTitle(value) {
  return String(value || "").trim().slice(0, 220);
}

function normalizeCommentBody(value) {
  return String(value || "").trim().slice(0, 2000);
}

async function assertWorkspaceAssigneeIds(projectId, assigneeIds) {
  if (!assigneeIds.length) return;

  const { rows } = await db.query(
    `SELECT DISTINCT u.id
       FROM work_management.projects p
       JOIN public.users u ON COALESCE(u.active, true) = true
       LEFT JOIN work_management.workspace_members wm
         ON wm.workspace_id = p.workspace_id
        AND wm.user_id = u.id
        AND wm.is_active = true
      WHERE p.id = $1
        AND u.id = ANY($2::int[])
        AND (
          u.id = p.owner_user_id
          OR wm.user_id IS NOT NULL
        )`,
    [projectId, assigneeIds]
  );

  const allowed = new Set(rows.map((row) => Number(row.id)));
  const invalidIds = assigneeIds.filter((id) => !allowed.has(id));
  if (invalidIds.length) {
    throw mkErr("Solo puedes asignar responsables que pertenezcan al workspace", 400);
  }
}

async function ensureDefaultChecklist(client, itemId, userId) {
  const { rows: existingRows } = await client.query(
    `SELECT *
       FROM work_management.checklists
      WHERE item_id = $1
      ORDER BY position ASC, created_at ASC
      LIMIT 1`,
    [itemId]
  );

  if (existingRows.length) return existingRows[0];

  const { rows } = await client.query(
    `INSERT INTO work_management.checklists
      (item_id, title, position, created_by)
     VALUES ($1, 'Checklist', 0, $2)
     RETURNING *`,
    [itemId, userId]
  );

  return rows[0];
}

async function recalculateChecklistProgress(client, itemId) {
  const { rows } = await client.query(
    `SELECT COUNT(ci.id)::int AS total,
            COUNT(ci.id) FILTER (WHERE ci.is_done = true)::int AS done
       FROM work_management.checklists c
       LEFT JOIN work_management.checklist_items ci ON ci.checklist_id = c.id
      WHERE c.item_id = $1`,
    [itemId]
  );

  const total = Number(rows[0]?.total || 0);
  const done = Number(rows[0]?.done || 0);
  const completionPct = total ? Math.round((done / total) * 100) : 0;

  await client.query(
    `UPDATE work_management.items
        SET completion_pct = $1,
            updated_at = NOW()
      WHERE id = $2`,
    [completionPct, itemId]
  );

  return { total, done, completion_pct: completionPct };
}

async function getChecklistForItem(itemId, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }
  await assertItemAccess(itemId, userId);

  const { rows } = await db.query(
    `SELECT c.id,
            c.item_id,
            c.title,
            c.position,
            c.created_by,
            c.created_at,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', ci.id,
                    'title', ci.title,
                    'is_done', ci.is_done,
                    'done_at', ci.done_at,
                    'done_by', ci.done_by,
                    'done_by_name', COALESCE(NULLIF(done_user.fullname, ''), NULLIF(done_user.name, ''), done_user.email),
                    'position', ci.position,
                    'created_by', ci.created_by,
                    'created_by_name', COALESCE(NULLIF(created_user.fullname, ''), NULLIF(created_user.name, ''), created_user.email),
                    'created_at', ci.created_at
                  )
                  ORDER BY ci.position ASC, ci.created_at ASC
                )
                  FROM work_management.checklist_items ci
                  LEFT JOIN public.users done_user ON done_user.id = ci.done_by
                  LEFT JOIN public.users created_user ON created_user.id = ci.created_by
                 WHERE ci.checklist_id = c.id
              ),
              '[]'::json
            ) AS items,
            (
              SELECT COUNT(*)::int
                FROM work_management.checklist_items ci
               WHERE ci.checklist_id = c.id
            ) AS total_items,
            (
              SELECT COUNT(*)::int
                FROM work_management.checklist_items ci
               WHERE ci.checklist_id = c.id
                 AND ci.is_done = true
            ) AS done_items
       FROM work_management.checklists c
      WHERE c.item_id = $1
      ORDER BY c.position ASC, c.created_at ASC
      LIMIT 1`,
    [itemId]
  );

  return rows[0] || {
    id: null,
    item_id: itemId,
    title: "Checklist",
    position: 0,
    items: [],
    total_items: 0,
    done_items: 0,
  };
}

async function assertChecklistItemAccess(checklistItemId, userId) {
  if (!isUuid(checklistItemId)) {
    throw mkErr("checklistItemId invalido", 400);
  }

  const { rows } = await db.query(
    `SELECT ci.*,
            c.item_id,
            i.project_id,
            i.board_id
       FROM work_management.checklist_items ci
       JOIN work_management.checklists c ON c.id = ci.checklist_id
       JOIN work_management.items i ON i.id = c.item_id
      WHERE ci.id = $1
      LIMIT 1`,
    [checklistItemId]
  );

  if (!rows.length) {
    throw mkErr("Elemento de checklist no encontrado", 404);
  }

  await assertItemAccess(rows[0].item_id, userId);
  return rows[0];
}

async function logActivity(client, payload) {
  await client.query(
    `INSERT INTO work_management.work_activity_log
      (workspace_id, project_id, board_id, item_id, event_type, old_data, new_data, actor_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      payload.workspace_id || null,
      payload.project_id || null,
      payload.board_id || null,
      payload.item_id || null,
      payload.event_type,
      payload.old_data ? JSON.stringify(payload.old_data) : null,
      payload.new_data ? JSON.stringify(payload.new_data) : null,
      payload.actor_user_id || null,
    ]
  );
}

async function addLink(client, payload) {
  if (!payload.source_module || !payload.source_entity_type || !payload.source_entity_id) {
    return;
  }

  await client.query(
    `INSERT INTO work_management.spi_links
      (entity_type, entity_id, source_module, source_entity_type, source_entity_id, relation_type, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (entity_type, entity_id, source_module, source_entity_type, source_entity_id, relation_type)
     DO NOTHING`,
    [
      payload.entity_type,
      payload.entity_id,
      payload.source_module,
      payload.source_entity_type,
      String(payload.source_entity_id),
      payload.relation_type || "origin",
      payload.created_by || null,
    ]
  );
}

async function assertWorkspaceAccess(workspaceId, userId) {
  const { rows } = await db.query(
    `SELECT w.*,
            wm.member_role,
            wm.is_active AS membership_active
       FROM work_management.workspaces w
       LEFT JOIN work_management.workspace_members wm
         ON wm.workspace_id = w.id
        AND wm.user_id = $2
      WHERE w.id = $1
      LIMIT 1`,
    [workspaceId, userId]
  );

  if (!rows.length) {
    throw mkErr("Workspace no encontrado", 404);
  }

  const workspace = rows[0];
  const canAccess =
    workspace.owner_user_id === userId ||
    (workspace.membership_active && workspace.member_role);

  if (!canAccess) {
    throw mkErr("Acceso denegado al workspace", 403);
  }

  return workspace;
}

async function assertProjectAccess(projectId, userId) {
  const { rows } = await db.query(
    `SELECT p.*,
            pm.member_role,
            pm.is_active AS membership_active
       FROM work_management.projects p
       LEFT JOIN work_management.project_members pm
         ON pm.project_id = p.id
        AND pm.user_id = $2
      WHERE p.id = $1
      LIMIT 1`,
    [projectId, userId]
  );

  if (!rows.length) {
    throw mkErr("Proyecto no encontrado", 404);
  }

  const project = rows[0];
  const workspace = await assertWorkspaceAccess(project.workspace_id, userId);
  const canAccess =
    project.owner_user_id === userId ||
    (project.membership_active && project.member_role) ||
    workspace.owner_user_id === userId ||
    (workspace.membership_active && workspace.member_role);

  if (!canAccess) {
    throw mkErr("Acceso denegado al proyecto", 403);
  }

  return project;
}

async function assertBoardAccess(boardId, userId) {
  const { rows } = await db.query(
    `SELECT b.*
       FROM work_management.boards b
      WHERE b.id = $1
      LIMIT 1`,
    [boardId]
  );
  if (!rows.length) {
    throw mkErr("Board no encontrado", 404);
  }
  const board = rows[0];
  await assertProjectAccess(board.project_id, userId);
  return board;
}

async function assertGroupAccess(groupId, userId) {
  const { rows } = await db.query(
    `SELECT g.*, b.project_id
       FROM work_management.board_groups g
       JOIN work_management.boards b ON b.id = g.board_id
      WHERE g.id = $1
      LIMIT 1`,
    [groupId]
  );
  if (!rows.length) {
    throw mkErr("Grupo no encontrado", 404);
  }
  const group = rows[0];
  await assertProjectAccess(group.project_id, userId);
  return group;
}

async function assertItemAccess(itemId, userId) {
  const { rows } = await db.query(
    `SELECT i.*,
            g.name AS group_name,
            b.name AS board_name
       FROM work_management.items i
       LEFT JOIN work_management.board_groups g ON g.id = i.group_id
       LEFT JOIN work_management.boards b ON b.id = i.board_id
      WHERE i.id = $1
      LIMIT 1`,
    [itemId]
  );
  if (!rows.length) {
    throw mkErr("Item no encontrado", 404);
  }
  const item = rows[0];
  await assertProjectAccess(item.project_id, userId);
  return item;
}

async function getNextItemSortOrder(client, groupId, projectId) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
       FROM work_management.items
      WHERE (
        ($1::uuid IS NOT NULL AND group_id = $1)
        OR ($1::uuid IS NULL AND group_id IS NULL AND project_id = $2)
      )`,
    [groupId || null, projectId]
  );

  return Number(rows[0]?.next_sort_order || 0);
}

async function rewriteItemSortOrders(client, { groupId, projectId, orderedItemIds }) {
  for (let index = 0; index < orderedItemIds.length; index += 1) {
    await client.query(
      `UPDATE work_management.items
          SET sort_order = $1,
              updated_at = NOW()
        WHERE id = $2
          AND (
            ($3::uuid IS NOT NULL AND group_id = $3)
            OR ($3::uuid IS NULL AND group_id IS NULL AND project_id = $4)
          )`,
      [index, orderedItemIds[index], groupId || null, projectId]
    );
  }
}

async function createDefaultBoard(client, { projectId, userId, boardName = "General" }) {
  const { rows: boardRows } = await client.query(
    `INSERT INTO work_management.boards
      (project_id, name, board_type, position, is_default, created_by, updated_by)
     VALUES ($1,$2,'kanban',0,true,$3,$3)
     RETURNING *`,
    [projectId, boardName, userId]
  );
  const board = boardRows[0];

  await insertDefaultGroups(client, board.id, userId);

  await logActivity(client, {
    project_id: projectId,
    board_id: board.id,
    actor_user_id: userId,
    event_type: "board.created_default",
    new_data: { name: board.name, board_type: board.board_type },
  });

  return board;
}

async function insertDefaultGroups(client, boardId, userId) {
  const groups = [
    { name: "General", color: "#CBD5E1", position: 0 },
  ];

  for (const group of groups) {
    await client.query(
      `INSERT INTO work_management.board_groups
        (board_id, name, color, position, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$5)`,
      [boardId, group.name, group.color, group.position, userId]
    );
  }
}

async function getHealth(userId) {
  const { rows } = await db.query(
    `SELECT
        (SELECT COUNT(*)::int FROM work_management.workspaces w
          LEFT JOIN work_management.workspace_members wm
            ON wm.workspace_id = w.id
           AND wm.user_id = $1
         WHERE w.owner_user_id = $1
            OR (wm.user_id = $1 AND wm.is_active = true)) AS workspace_count,
        (SELECT COUNT(*)::int FROM work_management.projects p
          LEFT JOIN work_management.project_members pm
            ON pm.project_id = p.id
           AND pm.user_id = $1
         WHERE p.owner_user_id = $1
            OR (pm.user_id = $1 AND pm.is_active = true)) AS project_count,
        (SELECT COUNT(*)::int
           FROM work_management.items i
           JOIN work_management.item_assignees ia ON ia.item_id = i.id
          WHERE ia.user_id = $1) AS assigned_item_count`,
    [userId]
  );

  return rows[0] || {
    workspace_count: 0,
    project_count: 0,
    assigned_item_count: 0,
  };
}

async function listMyWork(userId) {
  const { rows } = await db.query(
    `SELECT i.id,
            i.title,
            i.description,
            i.item_type,
            i.status,
            i.priority,
            i.completion_pct,
            i.planned_start_at,
            i.planned_end_at,
            i.created_at,
            p.id AS project_id,
            p.name AS project_name,
            p.status AS project_status,
            p.priority AS project_priority,
            w.id AS workspace_id,
            w.name AS workspace_name,
            b.id AS board_id,
            b.name AS board_name,
            g.id AS group_id,
            g.name AS group_name
       FROM work_management.item_assignees ia
       JOIN work_management.items i ON i.id = ia.item_id
       JOIN work_management.projects p ON p.id = i.project_id
       JOIN work_management.workspaces w ON w.id = p.workspace_id
       LEFT JOIN work_management.boards b ON b.id = i.board_id
       LEFT JOIN work_management.board_groups g ON g.id = i.group_id
      WHERE ia.user_id = $1
        AND p.is_archived = false
      ORDER BY
        CASE
          WHEN i.planned_end_at IS NULL THEN 1
          ELSE 0
        END ASC,
        i.planned_end_at ASC,
        i.created_at DESC
      LIMIT 100`,
    [userId]
  );

  const summary = rows.reduce(
    (acc, item) => {
      acc.total_items += 1;
      if (item.status === "done") acc.done_items += 1;
      if (item.status === "blocked") acc.blocked_items += 1;
      if (item.status === "in_progress") acc.in_progress_items += 1;
      if (
        item.planned_end_at &&
        item.status !== "done" &&
        new Date(item.planned_end_at).getTime() < Date.now()
      ) {
        acc.overdue_items += 1;
      }
      return acc;
    },
    {
      total_items: 0,
      done_items: 0,
      blocked_items: 0,
      in_progress_items: 0,
      overdue_items: 0,
    }
  );

  return { summary, items: rows };
}

async function getPortfolioSummary(user) {
  const managerScope = isManager(user);
  const scopedParams = managerScope ? [] : [user.id];
  const scopeSql = managerScope
    ? `SELECT p.id
         FROM work_management.projects p
        WHERE p.is_archived = false`
    : `SELECT DISTINCT p.id
         FROM work_management.projects p
         LEFT JOIN work_management.project_members pm
           ON pm.project_id = p.id
          AND pm.user_id = $1
          AND pm.is_active = true
         LEFT JOIN work_management.workspaces w
           ON w.id = p.workspace_id
         LEFT JOIN work_management.workspace_members wm
           ON wm.workspace_id = w.id
          AND wm.user_id = $1
          AND wm.is_active = true
        WHERE p.is_archived = false
          AND (
            p.owner_user_id = $1
            OR pm.user_id = $1
            OR w.owner_user_id = $1
            OR wm.user_id = $1
          )`;

  const { rows } = await db.query(
    `WITH accessible_projects AS (
       ${scopeSql}
     ),
     project_base AS (
       SELECT p.*
         FROM work_management.projects p
         JOIN accessible_projects ap ON ap.id = p.id
     ),
     item_base AS (
       SELECT i.*
         FROM work_management.items i
         JOIN accessible_projects ap ON ap.id = i.project_id
     )
     SELECT
       (SELECT COUNT(*)::int FROM project_base) AS project_count,
       (SELECT COUNT(DISTINCT workspace_id)::int FROM project_base) AS workspace_count,
       (SELECT COUNT(*)::int FROM item_base) AS item_count,
       (SELECT COUNT(*)::int FROM item_base WHERE status = 'in_progress') AS in_progress_items,
       (SELECT COUNT(*)::int FROM item_base WHERE status = 'blocked') AS blocked_items,
       (SELECT COUNT(*)::int FROM item_base WHERE status = 'done') AS done_items,
       (SELECT COUNT(*)::int
          FROM item_base
         WHERE planned_end_at IS NOT NULL
           AND planned_end_at < now()
           AND status <> 'done') AS overdue_items,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'status', status,
               'count', count_rows
             )
             ORDER BY status
           )
           FROM (
             SELECT status, COUNT(*)::int AS count_rows
               FROM project_base
              GROUP BY status
           ) project_statuses
         ),
         '[]'::json
       ) AS projects_by_status,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'status', status,
               'count', count_rows
             )
             ORDER BY status
           )
           FROM (
             SELECT status, COUNT(*)::int AS count_rows
               FROM item_base
              GROUP BY status
           ) item_statuses
         ),
         '[]'::json
       ) AS items_by_status`,
    scopedParams
  );

  const summary = rows[0] || {
    project_count: 0,
    workspace_count: 0,
    item_count: 0,
    in_progress_items: 0,
    blocked_items: 0,
    done_items: 0,
    overdue_items: 0,
    projects_by_status: [],
    items_by_status: [],
  };

  const { rows: attentionRows } = await db.query(
    `WITH accessible_projects AS (
       ${scopeSql}
     )
     SELECT i.id,
            i.title,
            i.status,
            i.priority,
            i.planned_end_at,
            p.id AS project_id,
            p.name AS project_name,
            w.name AS workspace_name
       FROM work_management.items i
       JOIN accessible_projects ap ON ap.id = i.project_id
       JOIN work_management.projects p ON p.id = i.project_id
       JOIN work_management.workspaces w ON w.id = p.workspace_id
      WHERE i.status <> 'done'
        AND (
          i.priority IN ('high', 'critical')
          OR (i.planned_end_at IS NOT NULL AND i.planned_end_at < now())
        )
      ORDER BY
        CASE WHEN i.planned_end_at IS NULL THEN 1 ELSE 0 END ASC,
        i.planned_end_at ASC,
        CASE i.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END ASC,
        i.created_at DESC
      LIMIT 8`,
    scopedParams
  );

  return {
    summary,
    attention_items: attentionRows,
  };
}

async function listCollaborators({ search = "", limit = 120 } = {}) {
  const normalizedSearch = String(search || "").trim().toLowerCase();
  const parsedLimit = Number(limit);
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 200)
    : 120;
  const params = [];
  const filters = ["COALESCE(u.active, true) = true"];

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    filters.push(`(
      LOWER(COALESCE(u.fullname, '')) LIKE $${params.length}
      OR LOWER(COALESCE(u.name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(u.email, '')) LIKE $${params.length}
      OR LOWER(COALESCE(u.role, '')) LIKE $${params.length}
    )`);
  }

  params.push(safeLimit);
  const { rows } = await db.query(
    `SELECT u.id,
            COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email, CONCAT('Usuario #', u.id)) AS fullname,
            u.email,
            u.role
       FROM public.users u
      WHERE ${filters.join(" AND ")}
      ORDER BY LOWER(COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email, CONCAT('Usuario #', u.id))) ASC,
               u.id ASC
      LIMIT $${params.length}`,
    params
  );

  return rows;
}

async function listWorkspaces(userId) {
  const { rows } = await db.query(
    `SELECT w.*,
            COALESCE(wm.member_role, CASE WHEN w.owner_user_id = $1 THEN 'owner' ELSE NULL END) AS access_role,
            (
              SELECT COUNT(*)::int
                FROM work_management.projects p
               WHERE p.workspace_id = w.id
                 AND p.is_archived = false
            ) AS project_count
       FROM work_management.workspaces w
       LEFT JOIN work_management.workspace_members wm
         ON wm.workspace_id = w.id
        AND wm.user_id = $1
        AND wm.is_active = true
      WHERE w.owner_user_id = $1
         OR wm.user_id = $1
      ORDER BY w.created_at DESC`
    ,
    [userId]
  );

  return rows;
}

async function createWorkspace(payload, userId) {
  if (!String(payload.name || "").trim()) {
    throw mkErr("El nombre del workspace es obligatorio", 400);
  }
  const memberUserIds = Array.isArray(payload.member_user_ids)
    ? [...new Set(
        payload.member_user_ids
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0 && value !== Number(userId))
      )]
    : [];

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO work_management.workspaces
        (name, description, visibility, color, icon, owner_user_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$6)
       RETURNING *`,
      [
        String(payload.name).trim(),
        payload.description || null,
        payload.visibility || "private",
        payload.color || null,
        payload.icon || null,
        userId,
      ]
    );
    const workspace = rows[0];

    await client.query(
      `INSERT INTO work_management.workspace_members
        (workspace_id, user_id, member_role, is_active, created_by)
       VALUES ($1,$2,'owner',true,$2)
       ON CONFLICT (workspace_id, user_id)
       DO UPDATE SET member_role = 'owner', is_active = true`,
      [workspace.id, userId]
    );

    let invitedMembers = [];
    if (memberUserIds.length) {
      const { rows: activeMembers } = await client.query(
        `SELECT id
           FROM public.users
          WHERE id = ANY($1::int[])
            AND COALESCE(active, true) = true`,
        [memberUserIds]
      );
      const activeIds = activeMembers.map((row) => Number(row.id));

      for (const memberId of activeIds) {
        await client.query(
          `INSERT INTO work_management.workspace_members
            (workspace_id, user_id, member_role, is_active, created_by)
           VALUES ($1,$2,'member',true,$3)
           ON CONFLICT (workspace_id, user_id)
           DO UPDATE SET member_role = 'member', is_active = true`,
          [workspace.id, memberId, userId]
        );
      }

      if (activeIds.length) {
        const { rows } = await client.query(
          `SELECT id,
                  COALESCE(NULLIF(fullname, ''), NULLIF(name, ''), email, CONCAT('Usuario #', id)) AS fullname,
                  email,
                  role
             FROM public.users
            WHERE id = ANY($1::int[])
            ORDER BY fullname ASC`,
          [activeIds]
        );
        invitedMembers = rows;
      }
    }

    await logActivity(client, {
      workspace_id: workspace.id,
      actor_user_id: userId,
      event_type: "workspace.created",
      new_data: {
        name: workspace.name,
        visibility: workspace.visibility,
        member_user_ids: invitedMembers.map((member) => member.id),
      },
    });

    await client.query("COMMIT");
    return { ...workspace, invited_members: invitedMembers };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listProjectsByWorkspace(workspaceId, userId) {
  if (!isUuid(workspaceId)) {
    throw mkErr("workspaceId invalido", 400);
  }
  await assertWorkspaceAccess(workspaceId, userId);

  const { rows } = await db.query(
    `SELECT p.*,
            u.fullname AS owner_name,
            (
              SELECT COUNT(*)::int
                FROM work_management.items i
               WHERE i.project_id = p.id
            ) AS item_count,
            (
              SELECT COUNT(*)::int
                FROM work_management.boards b
               WHERE b.project_id = p.id
            ) AS board_count
       FROM work_management.projects p
       LEFT JOIN public.users u ON u.id = p.owner_user_id
      WHERE p.workspace_id = $1
      ORDER BY p.created_at DESC`,
    [workspaceId]
  );
  return rows;
}

async function createProject(workspaceId, payload, userId) {
  if (!isUuid(workspaceId)) {
    throw mkErr("workspaceId invalido", 400);
  }
  await assertWorkspaceAccess(workspaceId, userId);

  if (!String(payload.name || "").trim()) {
    throw mkErr("El nombre del proyecto es obligatorio", 400);
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO work_management.projects
        (workspace_id, name, description, project_type, status, priority,
         origin_module, origin_entity_type, origin_entity_id,
         crm_account_id, crm_opportunity_id, schedule_id,
         owner_user_id, start_date, due_date, created_by, updated_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'draft'),COALESCE($6,'medium'),
               $7,$8,$9,$10,$11,$12,$13,$14,$15,$13,$13)
       RETURNING *`,
      [
        workspaceId,
        String(payload.name).trim(),
        payload.description || null,
        payload.project_type || "general",
        payload.status || "draft",
        payload.priority || "medium",
        payload.origin_module || null,
        payload.origin_entity_type || null,
        payload.origin_entity_id != null ? String(payload.origin_entity_id) : null,
        payload.crm_account_id || null,
        payload.crm_opportunity_id || null,
        payload.schedule_id || null,
        userId,
        payload.start_date || null,
        payload.due_date || null,
      ]
    );
    const project = rows[0];

    await client.query(
      `INSERT INTO work_management.project_members
        (project_id, user_id, member_role, is_active, created_by)
       VALUES ($1,$2,'owner',true,$2)
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET member_role = 'owner', is_active = true`,
      [project.id, userId]
    );

    await createDefaultBoard(client, {
      projectId: project.id,
      userId,
      boardName: payload.default_board_name || "General",
    });

    await addLink(client, {
      entity_type: "project",
      entity_id: project.id,
      source_module: payload.origin_module,
      source_entity_type: payload.origin_entity_type,
      source_entity_id: payload.origin_entity_id,
      created_by: userId,
    });

    await logActivity(client, {
      workspace_id: workspaceId,
      project_id: project.id,
      actor_user_id: userId,
      event_type: "project.created",
      new_data: {
        name: project.name,
        project_type: project.project_type,
        origin_module: project.origin_module,
        origin_entity_type: project.origin_entity_type,
        origin_entity_id: project.origin_entity_id,
      },
    });

    await client.query("COMMIT");
    return project;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createProjectFromOpportunity(opportunityId, payload, user) {
  if (!isUuid(opportunityId)) {
    throw mkErr("opportunityId invalido", 400);
  }

  const workspaceId = String(payload.workspace_id || "").trim();
  if (!isUuid(workspaceId)) {
    throw mkErr("workspace_id invalido", 400);
  }

  await assertWorkspaceAccess(workspaceId, user.id);

  const { rows: opportunityRows } = await db.query(
    `SELECT o.id, o.name, o.account_id, o.primary_contact_id, o.owner_user_id, o.status,
            o.estimated_close_date, o.description, a.account_name
       FROM crm.crm_opportunities o
       LEFT JOIN crm.crm_accounts a ON a.id = o.account_id
      WHERE o.id = $1
        AND o.deleted_at IS NULL
      LIMIT 1`,
    [opportunityId]
  );

  if (!opportunityRows.length) {
    throw mkErr("Oportunidad no encontrada", 404);
  }

  const opportunity = opportunityRows[0];
  if (!isManager(user) && Number(opportunity.owner_user_id) !== Number(user.id)) {
    throw mkErr("Acceso denegado a la oportunidad", 403);
  }

  const { rows: existingRows } = await db.query(
    `SELECT id, name
       FROM work_management.projects
      WHERE crm_opportunity_id = $1
        AND is_archived = false
      ORDER BY created_at DESC
      LIMIT 1`,
    [opportunityId]
  );

  if (existingRows.length) {
    const error = mkErr("La oportunidad ya tiene un proyecto activo en Work Management", 409);
    error.data = existingRows[0];
    throw error;
  }

  const projectName = String(payload.name || "").trim() || `WM · ${opportunity.name}`;

  return createProject(
    workspaceId,
    {
      name: projectName,
      description:
        payload.description ||
        opportunity.description ||
        `Proyecto originado desde la oportunidad ${opportunity.name}.`,
      project_type: payload.project_type || "crm",
      status: payload.status || "draft",
      priority: payload.priority || "medium",
      origin_module: "crm-fam",
      origin_entity_type: "opportunity",
      origin_entity_id: opportunity.id,
      crm_account_id: opportunity.account_id || null,
      crm_opportunity_id: opportunity.id,
      due_date: payload.due_date || opportunity.estimated_close_date || null,
      default_board_name: payload.default_board_name || "Seguimiento comercial",
    },
    user.id
  );
}

async function getProject(projectId, userId) {
  if (!isUuid(projectId)) {
    throw mkErr("projectId invalido", 400);
  }
  await assertProjectAccess(projectId, userId);

  const { rows } = await db.query(
    `SELECT p.*,
            w.name AS workspace_name,
            u.fullname AS owner_name,
            (
              SELECT json_agg(
                json_build_object(
                  'source_module', l.source_module,
                  'source_entity_type', l.source_entity_type,
                  'source_entity_id', l.source_entity_id,
                  'relation_type', l.relation_type
                )
              )
              FROM work_management.spi_links l
              WHERE l.entity_type = 'project' AND l.entity_id = p.id
            ) AS links
       FROM work_management.projects p
       JOIN work_management.workspaces w ON w.id = p.workspace_id
       LEFT JOIN public.users u ON u.id = p.owner_user_id
      WHERE p.id = $1`,
    [projectId]
  );

  return rows[0];
}

async function listBoardsByProject(projectId, userId) {
  if (!isUuid(projectId)) {
    throw mkErr("projectId invalido", 400);
  }
  await assertProjectAccess(projectId, userId);

  const { rows } = await db.query(
    `SELECT b.*,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', g.id,
                    'name', g.name,
                    'color', g.color,
                    'position', g.position,
                    'is_closed', g.is_closed,
                    'item_count', (
                      SELECT COUNT(*)::int
                        FROM work_management.items i
                       WHERE i.group_id = g.id
                    )
                  )
                  ORDER BY g.position ASC
                ),
                '[]'::json
              )
                FROM work_management.board_groups g
               WHERE g.board_id = b.id
            ) AS groups
       FROM work_management.boards b
      WHERE b.project_id = $1
      ORDER BY b.position ASC, b.created_at ASC`,
    [projectId]
  );

  return rows;
}

async function listItemsByProject(projectId, userId) {
  if (!isUuid(projectId)) {
    throw mkErr("projectId invalido", 400);
  }
  await assertProjectAccess(projectId, userId);

  const { rows } = await db.query(
    `SELECT i.*,
            g.name AS group_name,
            b.name AS board_name,
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'user_id', ia.user_id,
                  'fullname', u.fullname
                )
              ) FILTER (WHERE ia.user_id IS NOT NULL),
              '[]'::json
            ) AS assignees,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'user_id', f.user_id,
                    'fullname', COALESCE(NULLIF(su.fullname, ''), NULLIF(su.name, ''), su.email, CONCAT('Usuario #', su.id)),
                    'email', su.email,
                    'role', su.role
                  )
                  ORDER BY LOWER(COALESCE(NULLIF(su.fullname, ''), NULLIF(su.name, ''), su.email, CONCAT('Usuario #', su.id))) ASC
                )
                  FROM work_management.followers f
                  JOIN public.users su ON su.id = f.user_id
                 WHERE f.item_id = i.id
              ),
              '[]'::json
            ) AS supporters,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', a.id,
                    'file_name', a.file_name,
                    'file_url', a.file_url,
                    'drive_file_id', a.drive_file_id,
                    'mime_type', a.mime_type,
                    'file_size_bytes', a.file_size_bytes,
                    'created_at', a.created_at
                  )
                  ORDER BY a.created_at DESC
                )
                  FROM work_management.attachments a
                 WHERE a.item_id = i.id
              ),
              '[]'::json
            ) AS attachments,
            (
              SELECT COUNT(*)::int
                FROM work_management.attachments a
               WHERE a.item_id = i.id
            ) AS attachment_count,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', cmt.id,
                    'body', cmt.body,
                    'created_by', cmt.created_by,
                    'created_by_name', COALESCE(NULLIF(cu.fullname, ''), NULLIF(cu.name, ''), cu.email, CONCAT('Usuario #', cu.id)),
                    'created_at', cmt.created_at,
                    'updated_at', cmt.updated_at
                  )
                  ORDER BY cmt.created_at DESC
                )
                  FROM (
                    SELECT c.*
                      FROM work_management.comments c
                     WHERE c.item_id = i.id
                     ORDER BY c.created_at DESC
                     LIMIT 5
                  ) cmt
                  LEFT JOIN public.users cu ON cu.id = cmt.created_by
              ),
              '[]'::json
            ) AS comments,
            (
              SELECT COUNT(*)::int
                FROM work_management.comments c
               WHERE c.item_id = i.id
            ) AS comment_count,
            COALESCE(
              (
                SELECT json_build_object(
                  'id', c.id,
                  'title', c.title,
                  'items', COALESCE(
                    (
                      SELECT json_agg(
                        json_build_object(
                          'id', ci.id,
                          'title', ci.title,
                          'is_done', ci.is_done,
                          'done_at', ci.done_at,
                          'done_by', ci.done_by,
                          'done_by_name', COALESCE(NULLIF(done_user.fullname, ''), NULLIF(done_user.name, ''), done_user.email),
                          'position', ci.position,
                          'created_by', ci.created_by,
                          'created_by_name', COALESCE(NULLIF(created_user.fullname, ''), NULLIF(created_user.name, ''), created_user.email),
                          'created_at', ci.created_at
                        )
                        ORDER BY ci.position ASC, ci.created_at ASC
                      )
                        FROM work_management.checklist_items ci
                        LEFT JOIN public.users done_user ON done_user.id = ci.done_by
                        LEFT JOIN public.users created_user ON created_user.id = ci.created_by
                       WHERE ci.checklist_id = c.id
                    ),
                    '[]'::json
                  ),
                  'total_items', (
                    SELECT COUNT(*)::int
                      FROM work_management.checklist_items ci
                     WHERE ci.checklist_id = c.id
                  ),
                  'done_items', (
                    SELECT COUNT(*)::int
                      FROM work_management.checklist_items ci
                     WHERE ci.checklist_id = c.id
                       AND ci.is_done = true
                  )
                )
                  FROM work_management.checklists c
                 WHERE c.item_id = i.id
                 ORDER BY c.position ASC, c.created_at ASC
                 LIMIT 1
              ),
              json_build_object(
                'id', null,
                'title', 'Checklist',
                'items', '[]'::json,
                'total_items', 0,
                'done_items', 0
              )
            ) AS checklist
       FROM work_management.items i
       LEFT JOIN work_management.board_groups g ON g.id = i.group_id
       LEFT JOIN work_management.boards b ON b.id = i.board_id
      LEFT JOIN work_management.item_assignees ia ON ia.item_id = i.id
      LEFT JOIN public.users u ON u.id = ia.user_id
      WHERE i.project_id = $1
      GROUP BY i.id, g.name, b.name
      ORDER BY
        COALESCE(i.group_id::text, i.project_id::text) ASC,
        i.sort_order ASC,
        COALESCE(i.planned_start_at, i.created_at) ASC,
        i.created_at ASC`,
    [projectId]
  );

  return rows;
}

async function listAssigneeOptions(projectId, userId) {
  if (!isUuid(projectId)) {
    throw mkErr("projectId invalido", 400);
  }

  const project = await assertProjectAccess(projectId, userId);

  const { rows } = await db.query(
    `SELECT u.id,
            COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email, CONCAT('Usuario #', u.id)) AS fullname,
            u.email,
            u.role,
            CASE
              WHEN u.id = p.owner_user_id THEN 0
              WHEN wm.member_role = 'owner' THEN 1
              WHEN wm.user_id IS NOT NULL THEN 2
              ELSE 3
            END AS relevance_order
       FROM work_management.projects p
       JOIN public.users u ON COALESCE(u.active, true) = true
       LEFT JOIN work_management.workspace_members wm
         ON wm.workspace_id = p.workspace_id
        AND wm.user_id = u.id
        AND wm.is_active = true
      WHERE p.id = $1
        AND (
          u.id = p.owner_user_id
          OR wm.user_id IS NOT NULL
        )
      ORDER BY relevance_order ASC,
               LOWER(COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email, CONCAT('Usuario #', u.id))) ASC,
               u.id ASC
      LIMIT 200`,
    [project.id]
  );

  const unique = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }

  return unique;
}

async function updateItem(itemId, payload, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }

  const currentItem = await assertItemAccess(itemId, userId);
  let nextGroup = null;
  const sets = [];
  const values = [];
  let paramIndex = 1;

  const normalizedTitle =
    payload.title !== undefined ? String(payload.title || "").trim() : undefined;
  if (payload.title !== undefined) {
    if (!normalizedTitle) {
      throw mkErr("El titulo del item es obligatorio", 400);
    }
    sets.push(`title = $${paramIndex++}`);
    values.push(normalizedTitle);
  }

  if (payload.description !== undefined) {
    sets.push(`description = $${paramIndex++}`);
    values.push(payload.description ? String(payload.description) : null);
  }

  if (payload.status !== undefined) {
    sets.push(`status = $${paramIndex++}`);
    values.push(String(payload.status || "").trim() || "todo");
  }

  if (payload.priority !== undefined) {
    sets.push(`priority = $${paramIndex++}`);
    values.push(String(payload.priority || "").trim() || "medium");
  }

  if (payload.item_type !== undefined) {
    sets.push(`item_type = $${paramIndex++}`);
    values.push(String(payload.item_type || "").trim() || "task");
  }

  if (payload.planned_end_at !== undefined) {
    sets.push(`planned_end_at = $${paramIndex++}`);
    values.push(payload.planned_end_at || null);
  }

  if (payload.group_id !== undefined) {
    if (!payload.group_id) {
      throw mkErr("group_id invalido", 400);
    }
    nextGroup = await assertGroupAccess(payload.group_id, userId);
    if (nextGroup.project_id !== currentItem.project_id) {
      throw mkErr("El grupo destino no pertenece al mismo proyecto", 400);
    }
    sets.push(`group_id = $${paramIndex++}`);
    values.push(nextGroup.id);
    sets.push(`board_id = $${paramIndex++}`);
    values.push(nextGroup.board_id);
  }

  if (!sets.length) {
    throw mkErr("No hay cambios para aplicar al item", 400);
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    if (nextGroup) {
      const nextSortOrder = await getNextItemSortOrder(client, nextGroup.id, currentItem.project_id);
      sets.push(`sort_order = $${paramIndex++}`);
      values.push(nextSortOrder);
    }

    values.push(userId);
    values.push(itemId);
    const { rows } = await client.query(
      `UPDATE work_management.items
          SET ${sets.join(", ")},
              updated_by = $${paramIndex++},
              updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *`,
      values
    );

    const updatedItem = rows[0];

    await logActivity(client, {
      project_id: currentItem.project_id,
      board_id: currentItem.board_id,
      item_id: currentItem.id,
      actor_user_id: userId,
      event_type: "item.updated",
      old_data: {
        title: currentItem.title,
        description: currentItem.description,
        status: currentItem.status,
        priority: currentItem.priority,
        item_type: currentItem.item_type,
        planned_end_at: currentItem.planned_end_at,
        group_id: currentItem.group_id,
        board_id: currentItem.board_id,
        sort_order: currentItem.sort_order,
      },
      new_data: {
        title: updatedItem.title,
        description: updatedItem.description,
        status: updatedItem.status,
        priority: updatedItem.priority,
        item_type: updatedItem.item_type,
        planned_end_at: updatedItem.planned_end_at,
        group_id: updatedItem.group_id,
        board_id: updatedItem.board_id,
        sort_order: updatedItem.sort_order,
        group_changed: Boolean(nextGroup),
      },
    });

    await client.query("COMMIT");
    return updatedItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateItemAssignees(itemId, payload, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }

  const currentItem = await assertItemAccess(itemId, userId);
  const assigneeIds = normalizeUserIds(payload.assignee_user_ids);
  await assertWorkspaceAssigneeIds(currentItem.project_id, assigneeIds);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: existingAssignees } = await client.query(
      `SELECT user_id
         FROM work_management.item_assignees
        WHERE item_id = $1`,
      [itemId]
    );

    await client.query(`DELETE FROM work_management.item_assignees WHERE item_id = $1`, [itemId]);

    for (const assigneeId of assigneeIds) {
      await client.query(
        `INSERT INTO work_management.item_assignees
          (item_id, user_id, assigned_by)
         VALUES ($1,$2,$3)`,
        [itemId, assigneeId, userId]
      );
    }

    await logActivity(client, {
      project_id: currentItem.project_id,
      board_id: currentItem.board_id,
      item_id: currentItem.id,
      actor_user_id: userId,
      event_type: "item.assignees_updated",
      old_data: { assignee_user_ids: existingAssignees.map((row) => row.user_id) },
      new_data: { assignee_user_ids: assigneeIds },
    });

    await client.query("COMMIT");
    return { item_id: itemId, assignee_user_ids: assigneeIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateItemSupporters(itemId, payload, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }

  const currentItem = await assertItemAccess(itemId, userId);
  const supporterIds = normalizeUserIds(payload.support_user_ids || payload.supporter_user_ids);

  if (supporterIds.length) {
    const { rows: activeUsers } = await db.query(
      `SELECT id
         FROM public.users
        WHERE id = ANY($1::int[])
          AND COALESCE(active, true) = true`,
      [supporterIds]
    );
    const activeIds = new Set(activeUsers.map((row) => Number(row.id)));
    const invalidIds = supporterIds.filter((id) => !activeIds.has(id));
    if (invalidIds.length) {
      throw mkErr("Solo puedes asignar usuarios activos como apoyo", 400);
    }
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: existingSupporters } = await client.query(
      `SELECT user_id
         FROM work_management.followers
        WHERE item_id = $1`,
      [itemId]
    );

    await client.query(`DELETE FROM work_management.followers WHERE item_id = $1`, [itemId]);

    for (const supporterId of supporterIds) {
      await client.query(
        `INSERT INTO work_management.followers
          (item_id, user_id)
         VALUES ($1,$2)
         ON CONFLICT (item_id, user_id) DO NOTHING`,
        [itemId, supporterId]
      );
    }

    await logActivity(client, {
      project_id: currentItem.project_id,
      board_id: currentItem.board_id,
      item_id: currentItem.id,
      actor_user_id: userId,
      event_type: "item.supporters_updated",
      old_data: { support_user_ids: existingSupporters.map((row) => row.user_id) },
      new_data: { support_user_ids: supporterIds },
    });

    await client.query("COMMIT");
    return { item_id: itemId, support_user_ids: supporterIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createItemComment(itemId, payload, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }

  const currentItem = await assertItemAccess(itemId, userId);
  const body = normalizeCommentBody(payload.body);
  if (!body) {
    throw mkErr("El comentario no puede estar vacio", 400);
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO work_management.comments
        (item_id, body, created_by, updated_by)
       VALUES ($1, $2, $3, $3)
       RETURNING id, item_id, body, created_by, updated_by, created_at, updated_at`,
      [itemId, body, userId]
    );

    const { rows: enrichedRows } = await client.query(
      `SELECT c.id,
              c.item_id,
              c.body,
              c.created_by,
              COALESCE(NULLIF(u.fullname, ''), NULLIF(u.name, ''), u.email, CONCAT('Usuario #', u.id)) AS created_by_name,
              c.created_at,
              c.updated_at
         FROM work_management.comments c
         LEFT JOIN public.users u ON u.id = c.created_by
        WHERE c.id = $1
        LIMIT 1`,
      [rows[0].id]
    );

    await logActivity(client, {
      project_id: currentItem.project_id,
      board_id: currentItem.board_id,
      item_id: currentItem.id,
      actor_user_id: userId,
      event_type: "item.comment_created",
      new_data: {
        comment_id: rows[0].id,
        body_preview: body.slice(0, 160),
      },
    });

    await client.query("COMMIT");
    return enrichedRows[0] || rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createChecklistItem(itemId, payload, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }

  const title = normalizeChecklistTitle(payload.title);
  if (!title) {
    throw mkErr("Debes ingresar el texto del checklist", 400);
  }

  const currentItem = await assertItemAccess(itemId, userId);
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const checklist = await ensureDefaultChecklist(client, itemId, userId);
    const { rows } = await client.query(
      `INSERT INTO work_management.checklist_items
        (checklist_id, title, position, created_by)
       VALUES (
         $1,
         $2,
         COALESCE(
           (SELECT MAX(position) + 1
              FROM work_management.checklist_items
             WHERE checklist_id = $1),
           0
         ),
         $3
       )
       RETURNING *`,
      [checklist.id, title, userId]
    );

    const progress = await recalculateChecklistProgress(client, itemId);

    await logActivity(client, {
      project_id: currentItem.project_id,
      board_id: currentItem.board_id,
      item_id: currentItem.id,
      actor_user_id: userId,
      event_type: "item.checklist_item_created",
      new_data: { checklist_item_id: rows[0].id, title, progress },
    });

    await client.query("COMMIT");
    return getChecklistForItem(itemId, userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateChecklistItem(checklistItemId, payload, userId) {
  const currentChecklistItem = await assertChecklistItemAccess(checklistItemId, userId);
  const sets = [];
  const values = [];
  let paramIndex = 1;
  const newData = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    const title = normalizeChecklistTitle(payload.title);
    if (!title) {
      throw mkErr("El texto del checklist no puede estar vacio", 400);
    }
    sets.push(`title = $${paramIndex++}`);
    values.push(title);
    newData.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "is_done")) {
    const isDone = Boolean(payload.is_done);
    sets.push(`is_done = $${paramIndex++}`);
    values.push(isDone);
    sets.push(`done_at = ${isDone ? "NOW()" : "NULL"}`);
    sets.push(`done_by = $${paramIndex++}`);
    values.push(isDone ? userId : null);
    newData.is_done = isDone;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "position")) {
    const position = Number(payload.position);
    if (!Number.isInteger(position) || position < 0) {
      throw mkErr("La posicion del checklist no es valida", 400);
    }
    sets.push(`position = $${paramIndex++}`);
    values.push(position);
    newData.position = position;
  }

  if (!sets.length) {
    throw mkErr("No hay cambios para aplicar al checklist", 400);
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    values.push(checklistItemId);
    const { rows } = await client.query(
      `UPDATE work_management.checklist_items
          SET ${sets.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *`,
      values
    );

    const progress = await recalculateChecklistProgress(client, currentChecklistItem.item_id);

    await logActivity(client, {
      project_id: currentChecklistItem.project_id,
      board_id: currentChecklistItem.board_id,
      item_id: currentChecklistItem.item_id,
      actor_user_id: userId,
      event_type: "item.checklist_item_updated",
      old_data: {
        checklist_item_id: currentChecklistItem.id,
        title: currentChecklistItem.title,
        is_done: currentChecklistItem.is_done,
        position: currentChecklistItem.position,
      },
      new_data: { checklist_item_id: rows[0].id, ...newData, progress },
    });

    await client.query("COMMIT");
    return getChecklistForItem(currentChecklistItem.item_id, userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteChecklistItem(checklistItemId, userId) {
  const currentChecklistItem = await assertChecklistItemAccess(checklistItemId, userId);
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM work_management.checklist_items
        WHERE id = $1`,
      [checklistItemId]
    );

    const progress = await recalculateChecklistProgress(client, currentChecklistItem.item_id);

    await logActivity(client, {
      project_id: currentChecklistItem.project_id,
      board_id: currentChecklistItem.board_id,
      item_id: currentChecklistItem.item_id,
      actor_user_id: userId,
      event_type: "item.checklist_item_deleted",
      old_data: {
        checklist_item_id: currentChecklistItem.id,
        title: currentChecklistItem.title,
        is_done: currentChecklistItem.is_done,
        position: currentChecklistItem.position,
      },
      new_data: { progress },
    });

    await client.query("COMMIT");
    return getChecklistForItem(currentChecklistItem.item_id, userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function uploadItemAttachment(itemId, file, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }
  if (!file?.buffer) {
    throw mkErr("Debes adjuntar un documento", 400);
  }

  const currentItem = await assertItemAccess(itemId, userId);
  const rootFolderId = process.env.DRIVE_WORK_MANAGEMENT_FOLDER_ID
    || process.env.DRIVE_ROOT_FOLDER_ID
    || process.env.DRIVE_FOLDER_ID
    || null;

  let folderId = null;
  if (rootFolderId) {
    const folder = await ensureFolderPath(
      [
        "Work Management",
        sanitizeFileToken(currentItem.project_id, "proyecto"),
        sanitizeFileToken(currentItem.id, "item"),
      ],
      rootFolderId
    );
    folderId = folder?.id || null;
  }

  const originalName = String(file.originalname || "documento").trim() || "documento";
  const extension = originalName.includes(".")
    ? originalName.split(".").pop().toLowerCase()
    : "";
  const safeBaseName = sanitizeFileToken(
    originalName.replace(/\.[^.]+$/, ""),
    "documento"
  );
  const fileName = `${safeBaseName}-${Date.now()}${extension ? `.${extension}` : ""}`;
  const uploaded = await uploadFileToDrive(file, fileName, folderId || undefined, { makeAnyoneReader: true });
  const driveUrl = uploaded?.webContentLink || uploaded?.webViewLink || null;

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO work_management.attachments
        (item_id, file_name, file_url, drive_file_id, mime_type, file_size_bytes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        itemId,
        originalName.slice(0, 255),
        driveUrl,
        uploaded?.id || null,
        String(file.mimetype || "application/octet-stream").slice(0, 120),
        Number(file.size || 0) || null,
        userId,
      ]
    );
    const attachment = rows[0];

    await logActivity(client, {
      project_id: currentItem.project_id,
      board_id: currentItem.board_id,
      item_id: currentItem.id,
      actor_user_id: userId,
      event_type: "item.attachment_uploaded",
      new_data: {
        attachment_id: attachment.id,
        file_name: attachment.file_name,
        drive_file_id: attachment.drive_file_id,
      },
    });

    await client.query("COMMIT");
    return attachment;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reorderItem(itemId, payload, userId) {
  if (!isUuid(itemId)) {
    throw mkErr("itemId invalido", 400);
  }

  const currentItem = await assertItemAccess(itemId, userId);
  const targetGroupId = payload.target_group_id || currentItem.group_id || null;
  const targetIndexRaw = Number(payload.target_index);
  if (!Number.isInteger(targetIndexRaw) || targetIndexRaw < 0) {
    throw mkErr("target_index invalido", 400);
  }

  let targetGroup = null;
  if (targetGroupId) {
    targetGroup = await assertGroupAccess(targetGroupId, userId);
    if (targetGroup.project_id !== currentItem.project_id) {
      throw mkErr("El grupo destino no pertenece al mismo proyecto", 400);
    }
  }

  const sourceGroupId = currentItem.group_id || null;
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows: sourceRows } = await client.query(
      `SELECT id
         FROM work_management.items
        WHERE (
          ($1::uuid IS NOT NULL AND group_id = $1)
          OR ($1::uuid IS NULL AND group_id IS NULL AND project_id = $2)
        )
        ORDER BY sort_order ASC, created_at ASC, id ASC`,
      [sourceGroupId, currentItem.project_id]
    );

    const sourceIds = sourceRows.map((row) => row.id).filter((id) => id !== itemId);

    const sameGroup = String(sourceGroupId || "") === String(targetGroupId || "");
    const targetIds = sameGroup
      ? sourceIds
      : (
          await client.query(
            `SELECT id
               FROM work_management.items
              WHERE (
                ($1::uuid IS NOT NULL AND group_id = $1)
                OR ($1::uuid IS NULL AND group_id IS NULL AND project_id = $2)
              )
              ORDER BY sort_order ASC, created_at ASC, id ASC`,
            [targetGroupId || null, currentItem.project_id]
          )
        ).rows.map((row) => row.id);

    const boundedIndex = Math.max(0, Math.min(targetIndexRaw, targetIds.length));
    const reorderedTargetIds = [...targetIds];
    reorderedTargetIds.splice(boundedIndex, 0, itemId);

    await client.query(
      `UPDATE work_management.items
          SET group_id = $1,
              board_id = $2,
              updated_by = $3,
              updated_at = NOW()
        WHERE id = $4`,
      [targetGroupId || null, targetGroup?.board_id || currentItem.board_id || null, userId, itemId]
    );

    await rewriteItemSortOrders(client, {
      groupId: targetGroupId || null,
      projectId: currentItem.project_id,
      orderedItemIds: reorderedTargetIds,
    });

    if (!sameGroup) {
      await rewriteItemSortOrders(client, {
        groupId: sourceGroupId,
        projectId: currentItem.project_id,
        orderedItemIds: sourceIds,
      });
    }

    await logActivity(client, {
      project_id: currentItem.project_id,
      board_id: targetGroup?.board_id || currentItem.board_id,
      item_id: currentItem.id,
      actor_user_id: userId,
      event_type: "item.reordered",
      old_data: {
        group_id: sourceGroupId,
        sort_order: currentItem.sort_order,
      },
      new_data: {
        group_id: targetGroupId || null,
        target_index: boundedIndex,
      },
    });

    await client.query("COMMIT");
    return { ok: true, item_id: itemId, target_group_id: targetGroupId || null, target_index: boundedIndex };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createBoard(projectId, payload, userId) {
  if (!isUuid(projectId)) {
    throw mkErr("projectId invalido", 400);
  }
  await assertProjectAccess(projectId, userId);
  if (!String(payload.name || "").trim()) {
    throw mkErr("El nombre del board es obligatorio", 400);
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO work_management.boards
        (project_id, name, board_type, position, is_default, created_by, updated_by)
       VALUES (
         $1,$2,COALESCE($3,'kanban'),
         COALESCE((
           SELECT MAX(position) + 1 FROM work_management.boards WHERE project_id = $1
         ), 0),
         false,$4,$4
       )
       RETURNING *`,
      [projectId, String(payload.name).trim(), payload.board_type || "kanban", userId]
    );
    const board = rows[0];

    if (Array.isArray(payload.groups) && payload.groups.length) {
      let position = 0;
      for (const group of payload.groups) {
        await client.query(
          `INSERT INTO work_management.board_groups
            (board_id, name, color, position, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$5)`,
          [
            board.id,
            String(group.name || "").trim() || `Grupo ${position + 1}`,
            group.color || null,
            position,
            userId,
          ]
        );
        position += 1;
      }
    } else {
      await insertDefaultGroups(client, board.id, userId);
    }

    await logActivity(client, {
      project_id: projectId,
      board_id: board.id,
      actor_user_id: userId,
      event_type: "board.created",
      new_data: { name: board.name, board_type: board.board_type },
    });

    await client.query("COMMIT");
    return board;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createGroup(boardId, payload, userId) {
  if (!isUuid(boardId)) {
    throw mkErr("boardId invalido", 400);
  }
  const board = await assertBoardAccess(boardId, userId);
  if (!String(payload.name || "").trim()) {
    throw mkErr("El nombre del grupo es obligatorio", 400);
  }

  const { rows } = await db.query(
    `INSERT INTO work_management.board_groups
      (board_id, name, color, position, is_closed, created_by, updated_by)
     VALUES (
       $1,$2,$3,
       COALESCE((SELECT MAX(position) + 1 FROM work_management.board_groups WHERE board_id = $1), 0),
       COALESCE($4, false),
       $5,$5
     )
     RETURNING *`,
    [
      boardId,
      String(payload.name).trim(),
      payload.color || null,
      payload.is_closed === true,
      userId,
    ]
  );

  return rows[0];
}

async function createItem(groupId, payload, userId) {
  if (!isUuid(groupId)) {
    throw mkErr("groupId invalido", 400);
  }
  const group = await assertGroupAccess(groupId, userId);
  // Defensa dura contra el bug real reportado (item creado en el proyecto
  // equivocado por un group_id obsoleto en el frontend, ver
  // WorkManagementPage.jsx): si el cliente informa a que proyecto CREE que
  // esta creando el item, se valida contra el proyecto real del grupo antes
  // de insertar. Si no coinciden, se rechaza en vez de guardar en silencio
  // bajo el proyecto equivocado. expected_project_id es opcional para no
  // romper otros consumidores de este metodo que aun no lo envian.
  if (payload.expected_project_id && String(payload.expected_project_id) !== String(group.project_id)) {
    throw mkErr(
      "El grupo seleccionado ya no pertenece al proyecto actual. Vuelve a abrir el formulario e intenta de nuevo.",
      409
    );
  }
  if (!String(payload.title || "").trim()) {
    throw mkErr("El titulo del item es obligatorio", 400);
  }

  const assigneeIds = normalizeUserIds(payload.assignee_user_ids);
  await assertWorkspaceAssigneeIds(group.project_id, assigneeIds);

  const normalizedTitle = String(payload.title).trim();
  // Reintento accidental real detectado en produccion (Karen Barberan, ago
  // 2026): mismo usuario, mismo grupo, mismo titulo exacto, creados ~2 min
  // aparte -- consistente con una respuesta de red perdida/lenta despues de
  // que el INSERT ya habia hecho commit, el usuario vio error y reintento a
  // mano. No hay idempotency-key en el cliente, asi que la defensa real va
  // aqui: si el mismo usuario ya creo un item identico en este mismo grupo
  // en los ultimos 2 minutos, se devuelve ese item en vez de duplicarlo.
  const { rows: recentDuplicates } = await db.query(
    `SELECT *
       FROM work_management.items
      WHERE group_id = $1
        AND created_by = $2
        AND title = $3
        AND created_at > NOW() - INTERVAL '2 minutes'
      ORDER BY created_at DESC
      LIMIT 1`,
    [groupId, userId, normalizedTitle]
  );
  if (recentDuplicates.length) {
    return recentDuplicates[0];
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const nextSortOrder = await getNextItemSortOrder(client, groupId, group.project_id);

    const { rows } = await client.query(
      `INSERT INTO work_management.items
        (project_id, board_id, group_id, parent_item_id, title, description,
         item_type, status, priority, completion_pct,
         planned_start_at, planned_end_at, sort_order, source_module, source_entity_type, source_entity_id,
         scheduled_visit_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'task'),COALESCE($8,'todo'),COALESCE($9,'medium'),
               COALESCE($10,0),$11,$12,$13,$14,$15,$16,$17,$18,$18)
       RETURNING *`,
      [
        group.project_id,
        group.board_id,
        groupId,
        payload.parent_item_id || null,
        String(payload.title).trim(),
        payload.description || null,
        payload.item_type || "task",
        payload.status || "todo",
        payload.priority || "medium",
        payload.completion_pct || 0,
        payload.planned_start_at || null,
        payload.planned_end_at || null,
        nextSortOrder,
        payload.source_module || null,
        payload.source_entity_type || null,
        payload.source_entity_id != null ? String(payload.source_entity_id) : null,
        payload.scheduled_visit_id || null,
        userId,
      ]
    );
    const item = rows[0];

    for (const assigneeId of assigneeIds) {
      await client.query(
        `INSERT INTO work_management.item_assignees
          (item_id, user_id, assigned_by)
         VALUES ($1,$2,$3)
         ON CONFLICT (item_id, user_id) DO NOTHING`,
        [item.id, assigneeId, userId]
      );
    }

    await addLink(client, {
      entity_type: "item",
      entity_id: item.id,
      source_module: payload.source_module,
      source_entity_type: payload.source_entity_type,
      source_entity_id: payload.source_entity_id,
      created_by: userId,
    });

    await logActivity(client, {
      project_id: group.project_id,
      board_id: group.board_id,
      item_id: item.id,
      actor_user_id: userId,
      event_type: "item.created",
      new_data: {
        title: item.title,
        item_type: item.item_type,
        source_module: item.source_module,
        source_entity_id: item.source_entity_id,
        assignee_user_ids: assigneeIds,
      },
    });

    await client.query("COMMIT");
    return item;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  isUuid,
  getHealth,
  listMyWork,
  getPortfolioSummary,
  listCollaborators,
  listWorkspaces,
  createWorkspace,
  listProjectsByWorkspace,
  createProject,
  createProjectFromOpportunity,
  getProject,
  listBoardsByProject,
  listItemsByProject,
  listAssigneeOptions,
  updateItem,
  updateItemAssignees,
  updateItemSupporters,
  createItemComment,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  uploadItemAttachment,
  reorderItem,
  createBoard,
  createGroup,
  createItem,
};
