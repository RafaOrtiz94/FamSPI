const db = require("../../config/db");
const logger = require("../../config/logger");
const managementService = require("./management.service");

// ============================================================
// 📊 Obtener estadísticas globales
// ============================================================
const getGlobalStats = async (req, res) => {
  try {
    const stats = await managementService.getStats();
    return res.json(stats);
  } catch (err) {
    console.error("❌ getGlobalStats error:", err);
    logger.error(`getGlobalStats error: ${err.message}`);
    return res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
};

// ============================================================
// 🔍 Obtener trazabilidad de una solicitud
// ============================================================
const getRequestTrace = async (req, res) => {
  try {
    const trace = await managementService.getTrace(req.params.id);
    return res.json(trace);
  } catch (err) {
    console.error("❌ getRequestTrace error:", err);
    logger.error(`getRequestTrace error: ${err.message}`);
    return res.status(500).json({ error: "Error obteniendo trazabilidad" });
  }
};

// ============================================================
// 📎 Obtener documentos asociados a una solicitud
// ============================================================
const getRequestDocuments = async (req, res) => {
  try {
    const docs = await managementService.getDocuments(req.params.id);
    return res.json(docs);
  } catch (err) {
    console.error("❌ getRequestDocuments error:", err);
    logger.error(`getRequestDocuments error: ${err.message}`);
    return res.status(500).json({ error: "Error obteniendo documentos" });
  }
};

// ============================================================
// 📋 Listar todas las solicitudes (para Dashboard de Gerencia)
// ============================================================
const listAllRequests = async (req, res) => {
  try {
    const query = `
  SELECT 
    r.id,
    rt.code AS tipo,                       -- Código del formulario (F.ST-19, etc.)
    rt.title AS tipo_nombre,               -- Título del tipo de solicitud
    r.status,
    r.created_at,
    r.updated_at,
    u.name AS solicitante,
    r.payload::json ->> 'nombre_cliente' AS nombre_cliente,
    r.payload::json ->> 'persona_contacto' AS contacto,
    r.payload::json ->> 'direccion_cliente' AS direccion,
    r.payload::json ->> 'observacion' AS observacion
  FROM requests r
  LEFT JOIN users u ON u.id = r.requester_id
  LEFT JOIN request_types rt ON rt.id = r.request_type_id
  ORDER BY r.created_at DESC
  LIMIT 200;
`;

    const { rows } = await db.query(query);

    return res.json({
      success: true,
      total: rows.length,
      rows,
    });
  } catch (error) {
    console.error("❌ Error en listAllRequests:", error);
    logger.error(`listAllRequests error: ${error.message}`);
    return res.status(500).json({ error: "Error listando solicitudes" });
  }
};

// ============================================================
// 🧩 Exportación
// ============================================================
module.exports = {
  getGlobalStats,
  getRequestTrace,
  getRequestDocuments,
  listAllRequests,
};
