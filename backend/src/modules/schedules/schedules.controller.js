const service = require("./schedules.service");

const respond = (res, fn) =>
  fn
    .then((data) => res.json({ ok: true, data }))
    .catch((error) => {
      const status = error.status || 500;
      res.status(status).json({ ok: false, message: error.message || "Error procesando solicitud" });
    });

const listMySchedules = (req, res) => respond(res, service.listMySchedules(req.user));
const getHolidays = (req, res) => respond(res, service.getHolidays(req.user));
const listPendingApproval = (req, res) => respond(res, service.listPendingApproval(req.user));
const listTeamSchedules = (req, res) => respond(res, service.listTeamSchedules(req.user));
const getScheduleDetail = (req, res) =>
  respond(res, service.getScheduleDetail({ id: Number(req.params.id), user: req.user }));
const createSchedule = (req, res) =>
  respond(
    res,
    service.createSchedule({
      month: Number(req.body.month),
      year: Number(req.body.year),
      notes: req.body.notes || null,
      user: req.user,
    }),
  );
const updateSchedule = (req, res) =>
  respond(
    res,
    service.updateSchedule({
      id: Number(req.params.id),
      notes: req.body.notes || null,
      user: req.user,
    }),
  );

const deleteSchedule = (req, res) =>
  respond(res, service.deleteSchedule({ id: Number(req.params.id), user: req.user }));

const submitForApproval = (req, res) =>
  respond(res, service.submitForApproval({ id: Number(req.params.id), user: req.user }));

const addVisit = (req, res) =>
  respond(
    res,
    service.addVisit({
      scheduleId: Number(req.params.id),
      clientRequestId: req.body.client_request_id ? Number(req.body.client_request_id) : null,
      prospectName: req.body.prospect_name,
      plannedDate: req.body.planned_date,
      city: req.body.city,
      priority: req.body.priority,
      notes: req.body.notes || null,
      user: req.user,
    }),
  );

const syncWeekCity = (req, res) =>
  respond(
    res,
    service.syncWeekCity({
      scheduleId: Number(req.params.id),
      city: req.body.city,
      dates: Array.isArray(req.body.dates) ? req.body.dates : [],
      user: req.user,
    }),
  );

const updateVisit = (req, res) =>
  respond(
    res,
    service.updateVisit({
      scheduleId: Number(req.params.id),
      visitId: Number(req.params.visitId),
      clientRequestId: req.body.client_request_id ? Number(req.body.client_request_id) : null,
      prospectName: req.body.prospect_name,
      city: req.body.city,
      plannedDate: req.body.planned_date,
      priority: req.body.priority,
      notes: req.body.notes || null,
      preserveApprovedStatus: Boolean(req.body.preserve_approved_status),
      user: req.user,
    }),
  );

const deleteVisit = (req, res) =>
  respond(
    res,
    service.deleteVisit({
      scheduleId: Number(req.params.id),
      visitId: Number(req.params.visitId),
      user: req.user,
    }),
  );

const approveSchedule = (req, res) =>
  respond(
    res,
    service.approveSchedule({
      id: Number(req.params.id),
      notes: req.body.notes || req.body.comment || req.body.comments || null,
      user: req.user,
    }),
  );

const rejectSchedule = (req, res) =>
  respond(
    res,
    service.rejectSchedule({
      id: Number(req.params.id),
      reason: req.body.rejection_reason || req.body.reason,
      notes: req.body.notes || req.body.rejection_reason || req.body.reason || null,
      user: req.user,
    }),
  );

const justifyVisit = (req, res) =>
  respond(
    res,
    service.justifyVisit({
      visitId: Number(req.params.visitId),
      justification: req.body.justification,
      user: req.user,
    }),
  );

const justifySchedule = (req, res) =>
  respond(
    res,
    service.justifySchedule({
      id: Number(req.params.id),
      justification: req.body.justification,
      user: req.user,
    }),
  );

const getApprovedSchedule = (req, res) =>
  respond(
    res,
    service.getApprovedScheduleCurrent({
      userEmail: req.query.user_email,
      month: req.query.month,
      year: req.query.year,
      user: req.user,
    }),
  );

const analytics = (req, res) => respond(res, service.getAnalytics(req.user));
const optimizeRoute = (req, res) =>
  respond(
    res,
    service.optimizeRoute({
      scheduleIds: req.body.schedule_ids || req.body.scheduleIds,
      user: req.user,
    }),
  );

const getMyCalendarIcs = async (req, res) => {
  try {
    const { stream, fileName } = await service.getMyCalendarIcsStream({ user: req.user });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store");
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({ ok: false, message: "No se pudo generar el calendario" });
        return;
      }
      res.end();
    });
    stream.pipe(res);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ ok: false, message: error.message || "Error exportando calendario" });
  }
};

module.exports = {
  listMySchedules,
  getHolidays,
  listPendingApproval,
  listTeamSchedules,
  getScheduleDetail,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  submitForApproval,
  addVisit,
  syncWeekCity,
  updateVisit,
  deleteVisit,
  approveSchedule,
  rejectSchedule,
  justifyVisit,
  justifySchedule,
  analytics,
  getApprovedSchedule,
  getMyCalendarIcs,
  optimizeRoute,
};
