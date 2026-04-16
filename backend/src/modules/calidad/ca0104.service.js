const repo = require("./ca0104.repository");
const stateMachine = require("./ca0104StateMachine.service");
const logger = require("../../config/logger");

/**
 * Service Core - CA-01-04 (Control de Plagas)
 * -------------------------------------------
 * Orquesta repo + state machine y deja trazabilidad GXP.
 */

const buildSnapshot = (record, flowName) => {
  const current = {
    ...record,
    status: stateMachine.normalizeStatus(record?.status || stateMachine.INITIAL_STATUS),
  };

  return {
    flowName: stateMachine.normalizeFlowName(flowName),
    id: current.id || null,
    status: current.status,
    isTerminal: stateMachine.TERMINAL_STATUS.has(current.status),
    record: current,
  };
};

const transitionRecord = async (record, { flowName, toStatus, qaNotes, userId }) => {
  const current = buildSnapshot(record, flowName).record;
  stateMachine.assertTransition({
    flowName,
    fromStatus: current.status,
    toStatus,
  });

  const normalizedFlow = stateMachine.normalizeFlowName(flowName);
  let updated = null;

  if (normalizedFlow === "traps_map") {
    updated = await repo.updateInspectionStatus(current.id, { status: toStatus, qaNotes });
  } else if (normalizedFlow === "inspections") {
    updated = await repo.updateInspectionStatus(current.id, { status: toStatus, qaNotes });
  } else if (normalizedFlow === "vendor_api") {
    updated = await repo.updateToxicityStatus(current.id, { status: toStatus, qaNotes });
  } else if (normalizedFlow === "toxicity") {
    updated = await repo.updateToxicityStatus(current.id, { status: toStatus, qaNotes });
  } else {
    const error = new Error(`Flujo CA-01-04 no soportado: ${flowName}`);
    error.status = 400;
    error.code = "CA0104_FLOW_NOT_SUPPORTED";
    throw error;
  }

  logger.info(
    {
      flowName: normalizedFlow,
      recordId: current.id || null,
      fromStatus: current.status,
      toStatus,
      userId: userId || null,
    },
    "CA-01-04: transicion de workflow validada."
  );

  return updated;
};

const registerTrapsMap = async (payload) => {
  const created = await repo.createTrapsMap(payload);
  logger.info({ trapsMapId: created.id, trapCode: created.trap_code }, "CA-01-04: trap map creado.");
  return created;
};

const registerInspection = async (payload) => {
  const inspection = await repo.createInspection(payload);
  logger.info({ inspectionId: inspection.id, trapsMapId: inspection.traps_map_id }, "CA-01-04: inspeccion creada.");
  return inspection;
};

const registerVendorApi = async (payload) => {
  const vendorApi = await repo.createVendorApi(payload);
  logger.info({ vendorApiId: vendorApi.id, vendorName: vendorApi.vendor_name }, "CA-01-04: vendor api creado.");
  return vendorApi;
};

const registerToxicity = async (payload) => {
  const toxicity = await repo.createToxicity(payload);
  logger.info({ toxicityId: toxicity.id, chemicalName: toxicity.chemical_name }, "CA-01-04: toxicidad creada.");
  return toxicity;
};

module.exports = {
  buildSnapshot,
  transitionRecord,
  registerTrapsMap,
  registerInspection,
  registerVendorApi,
  registerToxicity,
  listTrapsMaps: repo.listTrapsMaps,
  listInspections: repo.listInspections,
  listVendorApis: repo.listVendorApis,
  listToxicity: repo.listToxicity,
  softDeleteTrapsMap: repo.softDeleteTrapsMap,
  softDeleteInspection: repo.softDeleteInspection,
  softDeleteVendorApi: repo.softDeleteVendorApi,
  softDeleteToxicity: repo.softDeleteToxicity,
};
