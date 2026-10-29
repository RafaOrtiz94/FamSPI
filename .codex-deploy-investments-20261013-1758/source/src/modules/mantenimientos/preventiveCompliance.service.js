const {
  listPreventiveCompliance,
  getPreventiveCapacitySummary,
  sendPreventiveMonthlyProgressReport,
} = require("./preventivePlanning.service");

const getComplianceDashboard = async ({
  year = null,
  month = null,
  annualPlanId = null,
} = {}) =>
  listPreventiveCompliance({
    year,
    month,
    annualPlanId,
  });

const getCapacityDashboard = async ({
  annualPlanId = null,
  year = null,
} = {}) =>
  getPreventiveCapacitySummary({
    annualPlanId,
    year,
  });

const sendMonthlyProgressReport = async ({
  annualPlanId,
  month = null,
  recipients = [],
  user = null,
} = {}) =>
  sendPreventiveMonthlyProgressReport({
    annualPlanId,
    month,
    recipients,
    user,
  });

module.exports = {
  getComplianceDashboard,
  getCapacityDashboard,
  sendMonthlyProgressReport,
};
