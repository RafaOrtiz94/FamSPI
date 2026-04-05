const {
  createPreventiveOffer,
  decidePreventiveOffer,
} = require("./preventivePlanning.service");

const issuePreventiveOffer = async ({
  planItemId,
  validUntil = null,
  offerPayload = {},
  notes = null,
  user = null,
} = {}) =>
  createPreventiveOffer({
    planItemId,
    validUntil,
    offerPayload,
    notes,
    user,
  });

const decideOffer = async ({
  planItemId,
  decision,
  reason = null,
  user = null,
} = {}) =>
  decidePreventiveOffer({
    planItemId,
    decision,
    reason,
    user,
  });

module.exports = {
  issuePreventiveOffer,
  decideOffer,
};
