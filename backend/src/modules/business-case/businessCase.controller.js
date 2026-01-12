const Joi = require("joi");
const logger = require("../../config/logger");
const businessCaseService = require("./businessCase.service");
const equipmentSelectionService = require("./equipmentSelection.service");
const determinationsService = require("./determinations.service");
const investmentsService = require("./investments.service");
const bcLabEnvironmentService = require("./bcLabEnvironment.service");
const bcEquipmentDetailsService = require("./bcEquipmentDetails.service");
const bcLisIntegrationService = require("./bcLisIntegration.service");
const bcRequirementsService = require("./bcRequirements.service");
const bcDeliveriesService = require("./bcDeliveries.service");
const orchestrator = require("./BusinessCaseOrchestrator.service");
const pdfGenerator = require("./pdfGenerator.service");
const excelExporter = require("./excelExporter.service");
const equipmentCompatibilityService = require("./equipmentCompatibility.service");

const createSchema = Joi.object({
  client_name: Joi.string().required(),
  client_id: Joi.number().integer().optional(),
  status: Joi.string().default("draft"),
  bc_stage: Joi.string().optional(),
  bc_progress: Joi.object().default({}),
  assigned_to_email: Joi.string().email().optional(),
  assigned_to_name: Joi.string().optional(),
  extra: Joi.object().default({}),
  modern_bc_metadata: Joi.object().default({}),
});

const updateSchema = Joi.object({
  client_name: Joi.string().optional(),
  client_id: Joi.number().integer().optional(),
  status: Joi.string().optional(),
  bc_stage: Joi.string().optional(),
  bc_progress: Joi.object().optional(),
  assigned_to_email: Joi.string().email().optional(),
  assigned_to_name: Joi.string().optional(),
  extra: Joi.object().optional(),
  modern_bc_metadata: Joi.object().optional(),
});

const equipmentSchema = Joi.object({
  equipmentId: Joi.number().integer().required(),
  isPrimary: Joi.boolean().default(true),
});

const determinationSchema = Joi.object({
  determinationId: Joi.number().integer().required(),
  monthlyQty: Joi.number().integer().positive(),
  annualQty: Joi.number().integer().positive(),
}).or("monthlyQty", "annualQty");

async function list(req, res) {
  try {
    logger.info('[WORKSPACE_DEBUG] business-case list handler hit', { versionTag: 'TOISO_V1', ts: new Date().toISOString() });

    const { page, pageSize, status, client_name, q } = req.query;
    const result = await businessCaseService.listBusinessCases({ page, pageSize, status, client_name, q });

    // Log sample data transformation
    if (result.items && result.items.length > 0) {
      logger.info('[WORKSPACE_DEBUG] sample created_at before/after', {
        raw: result.items[0].created_at,
        rawType: typeof result.items[0].created_at,
        mapped: result.items[0].created_at,
        mappedType: typeof result.items[0].created_at
      });
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error(error);
    res.status(error.status || 500).json({ ok: false, message: error.message || "Error listando Business Cases" });
  }
}

async function create(req, res) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const bc = await businessCaseService.createBusinessCase(value, req.user);
    res.status(201).json({ ok: true, data: bc });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error creando Business Case" });
  }
}

async function getById(req, res) {
  try {
    const bc = await businessCaseService.getBusinessCaseById(req.params.id);
    res.json({ ok: true, data: bc });
  } catch (error) {
    logger.error(error);
    res.status(error.status || 500).json({ ok: false, message: error.message || "No se pudo obtener el Business Case" });
  }
}

async function update(req, res) {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const bc = await businessCaseService.updateBusinessCase(req.params.id, value);
    res.json({ ok: true, data: bc });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando Business Case" });
  }
}

async function remove(req, res) {
  try {
    await businessCaseService.deleteBusinessCase(req.params.id);
    res.status(204).send();
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error eliminando Business Case" });
  }
}

async function selectEquipment(req, res) {
  try {
    const { error, value } = equipmentSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const selection = await equipmentSelectionService.selectEquipment(
      req.params.id,
      value.equipmentId,
      value.isPrimary,
      req.user,
    );
    res.status(201).json({ ok: true, data: selection });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error seleccionando equipo" });
  }
}

async function addDetermination(req, res) {
  try {
    const { error, value } = determinationSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const determination = await determinationsService.addDetermination(
      req.params.id,
      value.determinationId,
      { monthlyQty: value.monthlyQty, annualQty: value.annualQty },
      req.user,
    );
    res.status(201).json({ ok: true, data: determination, warnings: res.locals.warnings || [] });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error agregando determinación" });
  }
}

async function updateDetermination(req, res) {
  try {
  const { error, value } = Joi.object({
    monthlyQty: Joi.number().integer().positive(),
    annualQty: Joi.number().integer().positive(),
  }).or("monthlyQty", "annualQty").validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const determination = await determinationsService.updateDeterminationQuantity(
      req.params.id,
      req.params.detId,
      { monthlyQty: value.monthlyQty, annualQty: value.annualQty },
    );
    res.json({ ok: true, data: determination, warnings: res.locals.warnings || [] });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando determinación" });
  }
}

async function removeDetermination(req, res) {
  try {
    await determinationsService.removeDetermination(req.params.id, req.params.detId);
    res.status(204).send();
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error eliminando determinación" });
  }
}

async function getDeterminations(req, res) {
  try {
    const dets = await determinationsService.getDeterminations(req.params.id);
    res.json({ ok: true, data: dets });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error obteniendo determinaciones" });
  }
}

async function getCalculations(req, res) {
  try {
    const calculations = await businessCaseService.getCalculations(req.params.id);
    res.json({ ok: true, data: calculations });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error obteniendo cálculos" });
  }
}

async function recalculate(req, res) {
  try {
    const calculations = await businessCaseService.recalculateBusinessCase(req.params.id);
    res.json({ ok: true, data: calculations });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error recalculando Business Case" });
  }
}

async function exportPdf(req, res) {
  try {
    const buffer = await pdfGenerator.generateBusinessCasePdf(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=business-case-${req.params.id}.pdf`);
    res.send(buffer);
  } catch (err) {
    logger.error(err);
    res
      .status(err.status || 500)
      .json({ ok: false, message: err.message || "No se pudo generar el PDF del Business Case" });
  }
}

async function exportExcel(req, res) {
  try {
    const buffer = await excelExporter.generateBusinessCaseExcel(req.params.id);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=business-case-${req.params.id}.xlsx`);
    res.send(buffer);
  } catch (err) {
    logger.error(err);
    res
      .status(err.status || 500)
      .json({ ok: false, message: err.message || "No se pudo generar el Excel del Business Case" });
  }
}

async function updateEconomicData(req, res) {
  try {
    const schema = Joi.object({
      equipment_id: Joi.number().integer().required(),
      equipment_name: Joi.string().trim().required(),
      equipment_cost: Joi.number().min(0).required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, message: error.message });
    }

    const bc = await businessCaseService.updateEconomicData(req.params.id, value);
    res.json({ ok: true, data: bc });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando datos económicos" });
  }
}

// ===== INVESTMENT ENDPOINTS =====

async function addInvestment(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);

    const investment = await investmentsService.addInvestment(id, req.body);
    res.json({ ok: true, data: investment });
  } catch (error) {
    logger.error({ error: error.message }, "Error adding investment");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
}

async function getInvestments(req, res) {
  try {
    const { id } = req.params;
    const investments = await investmentsService.getInvestments(id);
    res.json({ ok: true, data: investments });
  } catch (error) {
    logger.error({ error: error.message }, "Error getting investments");
    res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
}

async function updateInvestment(req, res) {
  try {
    const { invId } = req.params;
    const investment = await investmentsService.updateInvestment(invId, req.body);
    res.json({ ok: true, data: investment });
  } catch (error) {
    logger.error({ error: error.message }, "Error updating investment");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
}

async function deleteInvestment(req, res) {
  try {
    const { invId } = req.params;
    await investmentsService.deleteInvestment(invId);
    res.json({ ok: true, message: "Investment deleted" });
  } catch (error) {
    logger.error({ error: error.message }, "Error deleting investment");
    res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
}

// ===== MANUAL BC FORM ENDPOINTS =====

// Lab Environment
async function saveLabEnvironment(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const result = await bcLabEnvironmentService.createLabEnvironment(id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving lab environment');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getLabEnvironment(req, res) {
  try {
    const { id } = req.params;
    const result = await bcLabEnvironmentService.getLabEnvironment(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting lab environment');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Equipment Details
async function saveEquipmentDetails(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const result = await bcEquipmentDetailsService.createEquipmentDetails(id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving equipment details');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getEquipmentDetails(req, res) {
  try {
    const { id } = req.params;
    const result = await bcEquipmentDetailsService.getEquipmentDetails(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting equipment details');
    res.status(500).json({ success: false, message: error.message });
  }
}

// LIS Integration
async function saveLisIntegration(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const result = await bcLisIntegrationService.createLisIntegration(id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving LIS integration');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getLisIntegration(req, res) {
  try {
    const { id } = req.params;
    const result = await bcLisIntegrationService.getLisIntegration(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting LIS integration');
    res.status(500).json({ success: false, message: error.message });
  }
}

async function addLisEquipmentInterface(req, res) {
  try {
    const { id } = req.params;
    const lis = await bcLisIntegrationService.getLisIntegration(id);
    if (!lis) {
      return res.status(404).json({ success: false, message: 'LIS integration not found' });
    }
    const result = await bcLisIntegrationService.addEquipmentInterface(lis.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error adding equipment interface');
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getLisEquipmentInterfaces(req, res) {
  try {
    const { id } = req.params;
    const lis = await bcLisIntegrationService.getLisIntegration(id);
    if (!lis) {
      return res.json({ success: true, data: [] });
    }
    const result = await bcLisIntegrationService.getEquipmentInterfaces(lis.id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting equipment interfaces');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Requirements
async function saveRequirements(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const result = await bcRequirementsService.createRequirements(id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving requirements');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getRequirements(req, res) {
  try {
    const { id } = req.params;
    const result = await bcRequirementsService.getRequirements(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting requirements');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Deliveries
async function saveDeliveries(req, res) {
  try {
    const { id } = req.params;
    await businessCaseService.assertModernBusinessCase(id);
    const result = await bcDeliveriesService.createDeliveries(id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error saving deliveries');
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
}

async function getDeliveries(req, res) {
  try {
    const { id } = req.params;
    const result = await bcDeliveriesService.getDeliveries(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting deliveries');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get complete BC with all sections
async function getComplete(req, res) {
  try {
    const { id } = req.params;
    const bc = await businessCaseService.getBusinessCaseById(id);
    const labEnvironment = await bcLabEnvironmentService.getLabEnvironment(id);
    const equipmentDetails = await bcEquipmentDetailsService.getEquipmentDetails(id);
    const lisIntegration = await bcLisIntegrationService.getLisIntegration(id);
    const requirements = await bcRequirementsService.getRequirements(id);
    const deliveries = await bcDeliveriesService.getDeliveries(id);

    let lisInterfaces = [];
    if (lisIntegration) {
      lisInterfaces = await bcLisIntegrationService.getEquipmentInterfaces(lisIntegration.id);
    }

    res.json({
      success: true,
      data: {
        ...bc,
        labEnvironment,
        equipmentDetails,
        lisIntegration: lisIntegration ? { ...lisIntegration, equipmentInterfaces: lisInterfaces } : null,
        requirements,
        deliveries
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting complete BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// ===== ORCHESTRATOR ENDPOINTS (UNIFIED BC WORKFLOW) =====

// FASE 1: Crear BC Económico
async function createEconomicBC(req, res) {
  try {
    const bc = await orchestrator.createEconomicBC({
      ...req.body,
      created_by: req.user?.email || 'system'
    });
    res.json({ success: true, data: bc });
  } catch (error) {
    logger.error({ error: error.message }, 'Error creating economic BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 2: Calcular ROI Inicial
async function calculateROI(req, res) {
  try {
    const { id } = req.params;
    const results = await orchestrator.calculateInitialROI(id);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error: error.message }, 'Error calculating ROI');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 3: Evaluar Aprobación Económica
async function evaluateEconomicApproval(req, res) {
  try {
    const { id } = req.params;
    const result = await orchestrator.evaluateEconomicApproval(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error evaluating approval');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 4: Adjuntar Datos Operativos
async function attachOperationalData(req, res) {
  try {
    const { id } = req.params;
    await orchestrator.attachOperationalData(id, req.body);
    res.json({ success: true, message: 'Operational data attached' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error attaching operational data');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 4: Adjuntar Datos LIS
async function attachLISData(req, res) {
  try {
    const { id } = req.params;
    await orchestrator.attachLISData(id, req.body);
    res.json({ success: true, message: 'LIS data attached' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error attaching LIS data');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 5: Recalcular con Datos Operativos
async function recalculateWithOperational(req, res) {
  try {
    const { id } = req.params;
    const result = await orchestrator.recalculateWithOperationalData(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error: error.message }, 'Error recalculating');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 6: Validar Coherencia
async function validateBC(req, res) {
  try {
    const { id } = req.params;
    const validations = await orchestrator.validateCoherence(id);
    res.json({ success: true, data: validations });
  } catch (error) {
    logger.error({ error: error.message }, 'Error validating BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// FASE 7: Promover Etapa
async function promoteStage(req, res) {
  try {
    const { id } = req.params;
    const { stage, notes } = req.body;
    await orchestrator.promoteStage(id, stage, req.user?.email || 'system', notes);
    res.json({ success: true, message: 'Stage promoted' });
  } catch (error) {
    logger.error({ error: error.message }, 'Error promoting stage');
    res.status(500).json({ success: false, message: error.message });
  }
}

// Obtener BC Completo (con todos los módulos)
async function getCompleteBCMaster(req, res) {
  try {
    const { id } = req.params;

    const bc = await orchestrator.getBCMaster(id);
    const economicData = await orchestrator.getEconomicData(id);
    const operationalData = await orchestrator.getOperationalData(id);
    const determinations = await orchestrator.getDeterminations(id);
    const investments = await orchestrator.getInvestments(id);

    // LIS data
    const { rows: lisRows } = await require('../../config/db').query(
      'SELECT * FROM bc_lis_data WHERE bc_master_id = $1', [id]
    );
    const lisData = lisRows[0];

    let lisInterfaces = [];
    if (lisData) {
      const { rows: ifaceRows } = await require('../../config/db').query(
        'SELECT * FROM bc_lis_equipment_interfaces WHERE bc_lis_data_id = $1', [lisData.id]
      );
      lisInterfaces = ifaceRows;
    }

    // Workflow history
    const { rows: historyRows } = await require('../../config/db').query(
      'SELECT * FROM bc_workflow_history WHERE bc_master_id = $1 ORDER BY changed_at DESC', [id]
    );

    // Validations
    const { rows: validationRows } = await require('../../config/db').query(
      'SELECT * FROM bc_validations WHERE bc_master_id = $1 AND NOT resolved ORDER BY created_at DESC', [id]
    );

    res.json({
      success: true,
      data: {
        ...bc,
        economicData,
        operationalData,
        lisData: lisData ? { ...lisData, equipmentInterfaces: lisInterfaces } : null,
        determinations,
        investments,
        workflowHistory: historyRows,
        validations: validationRows
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting complete BC');
    res.status(500).json({ success: false, message: error.message });
  }
}

// ===== UI GUIDANCE ENDPOINTS (WORKSPACE) =====

/**
 * Get UI guidance data for workspace
 */
async function getUIGuidance(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get business case basic info
    const bc = await businessCaseService.getBusinessCaseById(id);
    if (!bc) {
      return res.status(404).json({ ok: false, message: "Business Case not found" });
    }

    // Get ownership data (simplified - assuming empty for now)
    const ownership = {
      rules: {
        general: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        lab: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        equipment: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        lis: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        determinations: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        investments: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        prices: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        calculations: { canUserEdit: true, canUserComplete: true, isCompleted: false },
        rentability: { canUserEdit: true, canUserComplete: true, isCompleted: false }
      }
    };

    // Get section completion status (simplified)
    const sectionOwnership = {
      rules: ownership.rules
    };

    // Get permissions based on user role
    const permissions = {
      canEdit: true,
      canCompleteSections: true,
      canPromoteStage: true,
      canAddObservations: true
    };

    // Build UI guidance response
    const uiGuidance = {
      businessCase: bc,
      sectionOwnership,
      permissions,
      observationData: null, // No observations for now
      workflowState: {
        currentStage: bc.current_stage || 'draft',
        availableTransitions: ['promote', 'observe']
      }
    };

    res.json({ ok: true, data: uiGuidance });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting UI guidance');
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo datos de UI guidance"
    });
  }
}

/**
 * Get data ownership information
 */
async function getDataOwnership(req, res) {
  try {
    const { id } = req.params;

    // Helper function to normalize dates (reuse from service if available)
    function toIso(input) {
      if (!input) return null;
      if (input instanceof Date && !isNaN(input)) return input.toISOString();
      if (typeof input === 'string') {
        try {
          const parsed = new Date(input);
          if (!isNaN(parsed)) return parsed.toISOString();
          return null;
        } catch { return null; }
      }
      if (typeof input === 'number') {
        const timestamp = input < 1e12 ? input * 1000 : input;
        const date = new Date(timestamp);
        if (!isNaN(date)) return date.toISOString();
        return null;
      }
      // dayjs/moment objects
      if (input && typeof input === 'object' && input.$d instanceof Date) {
        return input.$d.toISOString();
      }
      if (input && typeof input === 'object' && typeof input.toDate === 'function') {
        const date = input.toDate();
        if (date instanceof Date && !isNaN(date)) return date.toISOString();
        return null;
      }
      // Objeto vacío {} -> null (problema actual)
      if (input && typeof input === 'object' && Object.keys(input).length === 0) {
        return null;
      }
      return null;
    }

    const now = new Date();

    // Simplified ownership data - in production this would check actual ownership tables
    const ownership = {
      businessCaseId: id,
      owner: req.user?.email || 'system',
      sections: {
        general: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        lab: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        equipment: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        lis: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        determinations: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        investments: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        prices: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        calculations: { owner: req.user?.email || 'system', lastModified: toIso(now) },
        rentability: { owner: req.user?.email || 'system', lastModified: toIso(now) }
      }
    };

    res.json({ ok: true, data: ownership });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting data ownership');
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo información de ownership"
    });
  }
}

/**
 * Record section completion
 */
async function recordSectionCompletion(req, res) {
  try {
    const { id } = req.params;
    const { section, reason } = req.body;
    const user = req.user;

    // Validate section exists
    const validSections = ['general', 'lab', 'equipment', 'lis', 'determinations', 'investments', 'prices', 'calculations', 'rentability'];
    if (!validSections.includes(section)) {
      return res.status(400).json({ ok: false, message: "Invalid section name" });
    }

    // Record completion (simplified - in production would update ownership table)
    logger.info({
      businessCaseId: id,
      section,
      reason,
      user: user?.email
    }, 'Section completion recorded');

    // For now, just return success
    res.json({
      ok: true,
      data: {
        section,
        completed: true,
        completedAt: new Date(),
        completedBy: user?.email || 'system',
        reason
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error recording section completion');
    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error registrando completitud de sección"
    });
  }
}

// ===== EQUIPMENT COMPATIBILITY ENDPOINTS =====

/**
 * Get compatible backup candidates for equipment
 *
 * NEW ENDPOINT: Advanced compatibility-based backup selection
 * Falls back to legacy category-based logic when compatibility data is missing
 */
async function getCompatibleBackupCandidates(req, res) {
  try {
    const { equipmentId } = req.params;
    const {
      maxCandidates = 10,
      minCompatibilityScore = 0.3,
      maxCostPenalty = 50.0,
      requireCapacityOverlap = true
    } = req.query;

    const options = {
      maxCandidates: parseInt(maxCandidates),
      minCompatibilityScore: parseFloat(minCompatibilityScore),
      maxCostPenalty: parseFloat(maxCostPenalty),
      requireCapacityOverlap: requireCapacityOverlap === 'true'
    };

    const candidates = await equipmentCompatibilityService.getCompatibleBackupCandidates(
      parseInt(equipmentId),
      options
    );

    res.json({
      ok: true,
      data: candidates,
      meta: {
        equipmentId: parseInt(equipmentId),
        options,
        totalCandidates: candidates.length,
        hasCompatibilityData: candidates.some(c => c.compatibility_metadata?.match_type !== 'legacy_fallback')
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      equipmentId: req.params.equipmentId
    }, 'Error getting compatible backup candidates');

    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo candidatos de respaldo compatibles"
    });
  }
}

/**
 * Validate compatibility between two equipment items
 *
 * NEW ENDPOINT: Advanced validation beyond basic category matching
 */
async function validateEquipmentCompatibility(req, res) {
  try {
    const { primaryId, backupId } = req.params;

    const validation = await equipmentCompatibilityService.validateEquipmentCompatibility(
      parseInt(primaryId),
      parseInt(backupId)
    );

    res.json({
      ok: true,
      data: validation
    });
  } catch (error) {
    logger.error({
      error: error.message,
      primaryId: req.params.primaryId,
      backupId: req.params.backupId
    }, 'Error validating equipment compatibility');

    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error validando compatibilidad de equipos"
    });
  }
}

/**
 * Get compatibility system statistics
 *
 * NEW ENDPOINT: Analytics for monitoring compatibility system health
 */
async function getCompatibilityStatistics(req, res) {
  try {
    const stats = await equipmentCompatibilityService.getCompatibilityStatistics();

    res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Error getting compatibility statistics');

    res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error obteniendo estadísticas de compatibilidad"
    });
  }
}

module.exports = {
  list,
  create,
  getById,
  update,
  remove,
  selectEquipment,
  getDeterminations,
  addDetermination,
  updateDetermination,
  removeDetermination,
  getCalculations,
  recalculate,
  exportPdf,
  exportExcel,
  updateEconomicData,
  addInvestment,
  getInvestments,
  updateInvestment,
  deleteInvestment,
  // UI Guidance endpoints (Workspace)
  getUIGuidance,
  getDataOwnership,
  recordSectionCompletion,
  // Manual BC Form endpoints
  saveLabEnvironment,
  getLabEnvironment,
  saveEquipmentDetails,
  getEquipmentDetails,
  saveLisIntegration,
  getLisIntegration,
  addLisEquipmentInterface,
  getLisEquipmentInterfaces,
  saveRequirements,
  getRequirements,
  saveDeliveries,
  getDeliveries,
  getComplete,
  // Orchestrator endpoints
  createEconomicBC,
  calculateROI,
  evaluateEconomicApproval,
  attachOperationalData,
  attachLISData,
  recalculateWithOperational,
  validateBC,
  promoteStage,
  getCompleteBCMaster,
  // Equipment compatibility endpoints
  getCompatibleBackupCandidates,
  validateEquipmentCompatibility,
  getCompatibilityStatistics
};
