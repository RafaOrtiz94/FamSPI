const clientsService = require("./clients.service");

const listClients = async (req, res) => {
  try {
    const {
      q,
      date,
      include_schedule_info,
      filter_by_schedule,
      include_all_for_business_case,
      schedule_scope,
      schedule_window,
    } = req.query;
    const { clients, prospects, leads, scheduleMeta } = await clientsService.listAccessibleClients({
      user: req.user,
      q: q || null,
      visitDate: date || null,
      includeScheduleInfo: include_schedule_info === "true", // keep backward compatible casing
      filterBySchedule: filter_by_schedule === "true",
      includeAllForBusinessCase: include_all_for_business_case === "true",
      scheduleScope: schedule_scope || null,
      scheduleWindow: schedule_window || null,
    });

    const summary = scheduleMeta || { total: clients.length, visited: 0, pending: clients.length };

    return res.json({ ok: true, data: clients, prospects, leads, summary });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error obteniendo clientes",
    });
  }
};

const getClientDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await clientsService.getClientDetail({
      clientId: Number(id),
      user: req.user,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error obteniendo cliente",
    });
  }
};

const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await clientsService.updateClient({
      clientId: Number(id),
      user: req.user,
      rawData: req.body,
      rawFiles: req.files,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error actualizando cliente",
    });
  }
};

const assignClient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      assignee_email,
      temporary,
      starts_at,
      ends_at,
      reason,
      unassign,
    } = req.body || {};
    const result = await clientsService.assignClient({
      clientId: Number(id),
      assigneeEmail: assignee_email,
      temporary,
      startsAt: starts_at,
      endsAt: ends_at,
      reason,
      unassign,
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
    console.error("Error in setVisitStatus:", error);
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || "Error registrando visita" });
  }
};

const registerProspectVisit = async (req, res) => {
  try {
    const {
      prospect_name,
      check_in_time,
      check_out_time,
      check_in_lat,
      check_in_lng,
      check_out_lat,
      check_out_lng,
      observations,
      visit_date,
      visit_id
    } = req.body || {};

    const result = await clientsService.upsertProspectVisit({
      user: req.user,
      prospectName: prospect_name,
      checkInTime: check_in_time,
      checkOutTime: check_out_time,
      checkInLat: check_in_lat,
      checkInLng: check_in_lng,
      checkOutLat: check_out_lat,
      checkOutLng: check_out_lng,
      observations,
      visitDate: visit_date,
      visitId: visit_id
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error("Error in registerProspectVisit:", error);
    const status = error.status || 500;
    return res.status(status).json({ ok: false, message: error.message || "Error registrando visita a prospecto" });
  }
};

const registerInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, notes } = req.body || {};
    const data = await clientsService.registerInteraction({
      clientId: Number(id),
      user: req.user,
      type,
      notes,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error registrando interacción CRM",
    });
  }
};

const getClientHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit } = req.query || {};
    const data = await clientsService.getClientHistory({
      clientId: Number(id),
      user: req.user,
      limit,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error obteniendo historial del cliente",
    });
  }
};

const listClientLocations = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await clientsService.listClientLocations({
      clientId: Number(id),
      user: req.user,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error obteniendo sedes del cliente",
    });
  }
};

const addClientLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await clientsService.addLocation({
      clientId: Number(id),
      user: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error creando sede del cliente",
    });
  }
};

const updateClientLocation = async (req, res) => {
  try {
    const { id, locationId } = req.params;
    const data = await clientsService.updateLocation({
      clientId: Number(id),
      locationId: Number(locationId),
      user: req.user,
      payload: req.body || {},
    });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error actualizando sede del cliente",
    });
  }
};

const removeClientLocation = async (req, res) => {
  try {
    const { id, locationId } = req.params;
    const data = await clientsService.removeLocation({
      clientId: Number(id),
      locationId: Number(locationId),
      user: req.user,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      message: error.message || "Error eliminando sede del cliente",
    });
  }
};

module.exports = {
  listClients,
  getClientDetail,
  updateClient,
  assignClient,
  setVisitStatus,
  registerProspectVisit,
  registerInteraction,
  getClientHistory,
  listClientLocations,
  addClientLocation,
  updateClientLocation,
  removeClientLocation,
};
