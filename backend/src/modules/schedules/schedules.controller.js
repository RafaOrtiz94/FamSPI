const service = require("./schedules.service");

const respond = (res, fn) =>
  fn
    .then((data) => res.json({ ok: true, data }))
    .catch((error) => {
      const status = error.status || 500;
      res.status(status).json({ ok: false, message: error.message || "Error procesando solicitud" });
    });

const listMySchedules = (req, res) => respond(res, service.listMySchedules(req.user));
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
      clientRequestId: Number(req.body.client_request_id),
      plannedDate: req.body.planned_date,
      city: req.body.city,
      priority: req.body.priority,
      notes: req.body.notes || null,
      user: req.user,
    }),
  );

const updateVisit = (req, res) =>
  respond(
    res,
    service.updateVisit({
      scheduleId: Number(req.params.id),
      visitId: Number(req.params.visitId),
      city: req.body.city,
      plannedDate: req.body.planned_date,
      priority: req.body.priority,
      notes: req.body.notes || null,
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
  respond(res, service.approveSchedule({ id: Number(req.params.id), user: req.user }));

const rejectSchedule = (req, res) =>
  respond(
    res,
    service.rejectSchedule({ id: Number(req.params.id), reason: req.body.reason, user: req.user }),
  );

const analytics = (req, res) => respond(res, service.getAnalytics(req.user));

module.exports = {
  listMySchedules,
  listPendingApproval,
  listTeamSchedules,
  getScheduleDetail,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  submitForApproval,
  addVisit,
  updateVisit,
  deleteVisit,
  approveSchedule,
  rejectSchedule,
  analytics,
};
