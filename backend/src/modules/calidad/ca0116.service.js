const sm = require("./ca0116StateMachine.service");
const repo = require("./ca0116.repository");
const normalizeRecord = (r) => ({ ...r, status: sm.normalizeStatus(r.status || "sampling") });
const getDashboardMetrics = async () => {
  const batches = await repo.listBatches();
  return { total: batches.length, approved: batches.filter(b => b.status === 'approved').length, released: batches.filter(b => b.status === 'released').length };
};
module.exports = { normalizeRecord, getDashboardMetrics, repo };