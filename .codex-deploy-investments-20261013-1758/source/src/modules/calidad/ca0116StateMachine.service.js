const FLOW_STATUS = Object.freeze({ SAMPLING: "sampling", ANALYZING: "analyzing", APPROVED: "approved", REJECTED: "rejected", RELEASED: "released" });
const normalizeStatus = (v) => String(v || "").trim().toLowerCase();
const isValid = (s) => ["sampling", "analyzing", "approved", "rejected", "released"].includes(normalizeStatus(s));
const validate = (s) => { if (!isValid(s)) { const e = new Error(`Estado inválido CA-01-16: ${s}`); e.status = 400; throw e; } };
module.exports = { FLOW_STATUS, normalizeStatus, isValid, validate };