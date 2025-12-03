const clientsService = require("./clients.service");

const listClients = async (req, res) => {
  try {
    const { q, date } = req.query;
    const data = await clientsService.listAccessibleClients({
      user: req.user,
      q: q || null,
      visitDate: date || null,
    });

    const summary = data.reduce(
      (acc, client) => {
        acc.total += 1;
        if (client.visit_status === "visited") acc.visited += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, visited: 0, pending: 0 },
    );

    return res.json({ ok: true, data, summary });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error obteniendo clientes",
    });
  }
};

const assignClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee_email } = req.body || {};
    const result = await clientsService.assignClient({
      clientId: Number(id),
      assigneeEmail: assignee_email,
      user: req.user,
    });
    return res.json({ ok: true, data: result });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || "Error asignando cliente" });
  }
};

const setVisitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      date,
      hora_entrada,
      hora_salida,
      lat_entrada,
      lng_entrada,
      lat_salida,
      lng_salida,
      observaciones,
    } = req.body || {};
    const result = await clientsService.upsertVisitStatus({
      clientId: Number(id),
      status,
      visitDate: date || null,
      hora_entrada,
      hora_salida,
      lat_entrada,
      lng_entrada,
      lat_salida,
      lng_salida,
      observaciones,
      user: req.user,
    });
    return res.json({ ok: true, data: result });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || "Error registrando visita" });
  }
};

module.exports = {
  listClients,
  assignClient,
  setVisitStatus,
};
