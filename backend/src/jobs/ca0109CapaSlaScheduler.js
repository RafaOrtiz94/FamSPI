const cron = require("node-cron"); const logger = require("../config/logger"); const svc = require("../modules/calidad/ca0109.service");
const DEFAULT_ESCALATION_DAYS = 30; const DEFAULT_FLOW_NAMES = ["rca", "action_plan", "escalation", "effectiveness"];
const reviewRecords = async ({ records = [], now = new Date(), escalationDays = DEFAULT_ESCALATION_DAYS } = {}) => {
  const thresholdMs = escalationDays * 24 * 60 * 60 * 1000;
  const overdue = records.filter(r => { const f = String(r?.flowName || "").toLowerCase(), s = String(r?.status || "").toLowerCase(); return DEFAULT_FLOW_NAMES.includes(f) && s !== "closed" && r?.createdAt && now.getTime() - new Date(r.createdAt).getTime() > thresholdMs; });
  if (overdue.length === 0) return { escalated: 0 };
  overdue.forEach(r => { try { const snap = svc.buildWorkflowSnapshot(r, r.flowName); logger.warn({ flowName: snap.flowName, id: snap.id }, "CA-01-09 SLA: vencido."); } catch(e) { logger.error({ error: e?.message }, "CA-01-09 SLA error."); } });
  return { escalated: overdue.length };
};
const scheduleSlaReview = (opts = {}) => { cron.schedule(opts.cronExpression || "0 0 * * *", async () => { await reviewRecords(opts); }); logger.info({ module: "CA-01-09" }, "CA-01-09 SLA registrado."); return { cronExpression: opts.cronExpression || "0 0 * * *" }; };
module.exports = { DEFAULT_ESCALATION_DAYS, DEFAULT_FLOW_NAMES, reviewRecords, scheduleSlaReview };