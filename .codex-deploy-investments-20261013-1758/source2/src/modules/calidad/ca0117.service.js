const repo = require("./ca0117.repository");
const getDashboardMetrics = async () => { const reports = await repo.listReports(); return { total: reports.length, critical: reports.filter(r => r.severity === 'critical').length, closed: reports.filter(r => r.status === 'closed').length }; };
module.exports = { getDashboardMetrics, repo };