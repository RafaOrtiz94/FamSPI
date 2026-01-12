const db = require("../../config/db");

const getStats = async () => {
  const [countAll, countApproved, countRejected, avgTime] = await Promise.all([
    db.query("SELECT COUNT(*) FROM requests"),
    db.query("SELECT COUNT(*) FROM requests WHERE status='approved'"),
    db.query("SELECT COUNT(*) FROM requests WHERE status='rejected'"),
    db.query("SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600),2) AS avg_hours FROM requests WHERE status IN ('approved','completed')"),
  ]);

  const perType = await db.query(`
    SELECT rt.code, rt.title, COUNT(r.id) AS total
    FROM requests r
    JOIN request_types rt ON r.request_type_id = rt.id
    GROUP BY rt.code, rt.title
    ORDER BY total DESC
  `);

  return {
    resumen: {
      total: Number(countAll.rows[0].count),
      aprobadas: Number(countApproved.rows[0].count),
      rechazadas: Number(countRejected.rows[0].count),
      tiempo_promedio_horas: avgTime.rows[0].avg_hours || 0,
    },
    por_tipo: perType.rows,
  };
};

const listRequests = async ({ page, pageSize, status, area }) => {
  const offset = (page - 1) * pageSize;
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

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const query = `
    SELECT r.*, rt.title AS tipo, u.nombre_completo AS solicitante
    FROM requests r
    JOIN request_types rt ON r.request_type_id = rt.id
    JOIN users u ON u.id = r.requester_id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const data = await db.query(query, params);
  return { rows: data.rows, total: data.rowCount };
};

const getTrace = async (id) => {
  const logs = await db.query(
    `SELECT * FROM audit_logs WHERE (data->>'request_id')::INT = $1 ORDER BY created_at ASC`,
    [id]
  );
  return logs.rows;
};

const getDocuments = async (id) => {
  const [attachments, versions] = await Promise.all([
    db.query("SELECT * FROM attachments WHERE request_id=$1", [id]),
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
