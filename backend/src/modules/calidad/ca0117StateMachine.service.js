const FLOW_STATUS = Object.freeze({ REPORTED: "reported", INVESTIGATING: "investigating", RESOLVED: "resolved", CLOSED: "closed" });
const normalizeStatus = (v) => String(v || "").trim().toLowerCase();
const isValid = (s) => ["reported", "investigating", "resolved", "closed"].includes(normalizeStatus(s));
const validate = (s) => { if (!isValid(s)) { const e = new Error(`Estado inválido CA-01-17: ${s}`); e.status = 400; throw e; } };
module.exports = { FLOW_STATUS, normalizeStatus, isValid, validate };