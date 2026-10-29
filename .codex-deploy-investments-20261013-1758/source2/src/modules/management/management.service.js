const db = require("../../config/db");

const buildRequestFilters = ({ status, area }) => {
  const filters = [];
  const params = [];

  if (status) {
    params.push(status);
    filters.push(`r.status = $${params.length}`);
  }
  if (area) {
    params.push(area);
    filters.push(`(r.payload->>'area') ILIKE '%' || $${params.length} || '%'`);
  }

  return {
    params,
    where: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
  };
};

const getStats = async () => {
  const [summary, perType] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'aprobado') AS aprobadas,
        COUNT(*) FILTER (WHERE status = 'rechazado') AS rechazadas,
        ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)
          FILTER (WHERE status = 'aprobado'), 2) AS avg_hours
      FROM requests
    `),
    db.query(`
      SELECT rt.code, rt.title, COUNT(r.id) AS total
      FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      GROUP BY rt.code, rt.title
      ORDER BY total DESC
    `),
  ]);
  const row = summary.rows[0];

  return {
    resumen: {
      total: Number(row.total),
      aprobadas: Number(row.aprobadas),
      rechazadas: Number(row.rechazadas),
      tiempo_promedio_horas: row.avg_hours || 0,
    },
    por_tipo: perType.rows,
  };
};

const listRequests = async ({ page, pageSize, status, area }) => {
  const offset = (page - 1) * pageSize;
  const { params, where } = buildRequestFilters({ status, area });
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM requests r
    ${where}
  `;
  const listParams = [...params, pageSize, offset];
  const limitParam = `$${listParams.length - 1}`;
  const offsetParam = `$${listParams.length}`;
  const query = `
    SELECT r.*, rt.title AS tipo, COALESCE(u.fullname, u.name, u.email) AS solicitante
    FROM requests r
    JOIN request_types rt ON r.request_type_id = rt.id
    JOIN users u ON u.id = r.requester_id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;
  const [countResult, data] = await Promise.all([
    db.query(countQuery, params),
    db.query(query, listParams),
  ]);
  return { rows: data.rows, total: Number(countResult.rows[0]?.total || 0) };
};

const getTrace = async (id) => {
  const normalizedId = Number(id);
  if (!Number.isInteger(normalizedId)) {
    return [];
  }

  const logs = await db.query(
    `SELECT
       id,
       usuario_id,
       usuario_email,
       rol,
       modulo,
       accion,
       descripcion,
       datos_anteriores,
       datos_nuevos,
       ip,
       user_agent,
       fecha,
       duracion_ms,
       request_id,
       mantenimiento_id,
       inventario_id,
       auto,
       creado_en
     FROM auditoria.logs
     WHERE request_id = $1
        OR ((datos_nuevos->>'request_id') ~ '^[0-9]+$' AND (datos_nuevos->>'request_id')::BIGINT = $1)
        OR ((datos_anteriores->>'request_id') ~ '^[0-9]+$' AND (datos_anteriores->>'request_id')::BIGINT = $1)
     ORDER BY creado_en ASC`,
    [normalizedId]
  );
  return logs.rows;
};

const getDocuments = async (id) => {
  const [attachments, versions] = await Promise.all([
    db.query("SELECT * FROM request_attachments WHERE request_id=$1", [id]),
    db.query("SELECT * FROM request_versions WHERE request_id=$1", [id]),
  ]);
  return { attachments: attachments.rows, versions: versions.rows };
};

module.exports = {
  getStats,
  listRequests,
  getTrace,
  getDocuments,
};
