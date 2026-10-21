function isInvestmentFlowClosed(metadata) {
  const investments = metadata?.investments;
  return Boolean(
    investments
    && typeof investments === "object"
    && !Array.isArray(investments)
    && investments.no_additional_investments === true,
  );
}

module.exports = {
  isInvestmentFlowClosed,
};
