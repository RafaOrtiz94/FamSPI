/**
 * Business Case State Readiness Validation
 *
 * Validates data completeness requirements for state transitions.
 * Ensures business cases meet minimum criteria before advancing states.
 *
 * Rules:
 * - DRAFT_INICIAL → DATOS_BASE_COMPLETOS requires: client, client_type, primary_equipment
 * - DATOS_BASE_COMPLETOS → EN_EVALUACION_VIABILIDAD requires: determinations, base investment
 * - OBSERVADO_POR_VIABILIDAD → EN_EVALUACION_VIABILIDAD requires: resolution_notes
 */

const { STATES } = require('./businessCaseStates.constants');

// Helper function to determine if business case is public or private
function getBusinessCaseFlowType(businessCase) {
  const bcType = businessCase.business_case_type || businessCase.bc_purchase_type;
  return bcType === 'comodato_publico' ? 'PUBLIC' : 'PRIVATE';
}

// Transition readiness requirements with branching logic
const STATE_READINESS_REQUIREMENTS = {
  // DRAFT_INICIAL → DATOS_BASE_COMPLETOS
  [`${STATES.DRAFT_INICIAL}:${STATES.DATOS_BASE_COMPLETOS}`]: {
    name: 'Transición a Datos Básicos Completos',
    description: 'Se requieren datos básicos del cliente y equipo principal',
    requirements: [
      {
        field: 'client_name',
        section: 'general',
        friendlyName: 'Nombre del cliente',
        validator: (bc) => bc.client_name && bc.client_name.trim().length > 0,
        errorMessage: 'El nombre del cliente es obligatorio'
      },
      {
        field: 'client_id',
        section: 'general',
        friendlyName: 'ID del cliente',
        validator: (bc) => bc.client_id && bc.client_id > 0,
        errorMessage: 'Debe seleccionar un cliente válido'
      },
      {
        field: 'business_case_type',
        section: 'general',
        friendlyName: 'Tipo de caso de negocio',
        validator: (bc) => bc.business_case_type && ['comodato_publico', 'comodato_privado', 'venta_privada'].includes(bc.business_case_type),
        errorMessage: 'Debe seleccionar un tipo de caso de negocio válido'
      },
      {
        field: 'primary_equipment',
        section: 'equipment',
        friendlyName: 'Equipo principal',
        validator: (bc) => {
          // Check if equipment is selected (this would need to be queried from related tables)
          // For now, check if we have equipment cost as proxy
          return bc.bc_equipment_cost && bc.bc_equipment_cost > 0;
        },
        errorMessage: 'Debe seleccionar y configurar el equipo principal'
      },
      // Branching requirements based on business case type
      {
        field: 'flow_specific_data',
        section: 'general',
        friendlyName: 'Datos específicos del flujo',
        validator: (bc) => {
          const flowType = getBusinessCaseFlowType(bc);

          if (flowType === 'PUBLIC') {
            // PUBLIC flow: Check for SERCOF code and contracting object
            const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
            return extra && extra.sercof_code && extra.sercof_code.trim().length > 0 &&
                   extra.contracting_object && extra.contracting_object.trim().length > 0;
          } else {
            // PRIVATE flow: Check for backoffice client data
            const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
            return extra && extra.backoffice_client_data &&
                   extra.backoffice_client_data.client_code &&
                   extra.backoffice_client_data.client_code.trim().length > 0;
          }
        },
        errorMessage: (bc) => {
          const flowType = getBusinessCaseFlowType(bc);
          if (flowType === 'PUBLIC') {
            return 'Para casos públicos se requiere código SERCOF y objeto contractual';
          } else {
            return 'Para casos privados se requieren datos del cliente en backoffice';
          }
        }
      }
    ]
  },

  // DATOS_BASE_COMPLETOS → EN_EVALUACION_VIABILIDAD
  [`${STATES.DATOS_BASE_COMPLETOS}:${STATES.EN_EVALUACION_VIABILIDAD}`]: {
    name: 'Transición a Evaluación de Viabilidad',
    description: 'Se requieren determinaciones y inversión base configuradas',
    requirements: [
      {
        field: 'determinations',
        section: 'determinations',
        friendlyName: 'Determinaciones',
        validator: async (bc) => {
          // This would check if determinations are configured
          // For now, we'll assume this passes - actual implementation would query determinations table
          return true; // Placeholder
        },
        errorMessage: 'Debe configurar al menos una determinación'
      },
      {
        field: 'base_investment',
        section: 'investments',
        friendlyName: 'Inversión base',
        validator: (bc) => {
          // Check if there's at least a base investment configured
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.investments && extra.investments.length > 0;
        },
        errorMessage: 'Debe configurar al menos una inversión base'
      },
      {
        field: 'economic_data',
        section: 'equipment',
        friendlyName: 'Datos económicos',
        validator: (bc) => {
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.economic_data;
        },
        errorMessage: 'Debe completar la configuración económica del equipo'
      },
      // Branching requirements based on business case type
      {
        field: 'flow_specific_evaluation_data',
        section: 'general',
        friendlyName: 'Datos específicos de evaluación',
        validator: (bc) => {
          const flowType = getBusinessCaseFlowType(bc);
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;

          if (flowType === 'PUBLIC') {
            // PUBLIC flow: Check for reservation image and contracting validation
            return extra && extra.reservation_image_url &&
                   extra.contracting_validation_complete === true;
          } else {
            // PRIVATE flow: Check for internal approval and backoffice validation
            return extra && extra.internal_approval_required === false || // No approval needed
                   (extra.internal_approval_obtained === true); // Or approval obtained
          }
        },
        errorMessage: (bc) => {
          const flowType = getBusinessCaseFlowType(bc);
          if (flowType === 'PUBLIC') {
            return 'Para casos públicos se requiere imagen de reserva y validación contractual';
          } else {
            return 'Para casos privados se requiere aprobación interna o confirmación de no requerimiento';
          }
        }
      }
    ]
  },

  // EN_EVALUACION_VIABILIDAD → OBSERVADO_POR_VIABILIDAD
  [`${STATES.EN_EVALUACION_VIABILIDAD}:${STATES.OBSERVADO_POR_VIABILIDAD}`]: {
    name: 'Transición a Observado por Viabilidad',
    description: 'Requiere observaciones documentadas de evaluación',
    requirements: [
      {
        field: 'viability_evaluation',
        section: 'determinations',
        friendlyName: 'Evaluación de viabilidad',
        validator: async (bc) => {
          // Check if viability evaluation has been performed
          // This would check evaluation results/status
          return true; // Placeholder - actual implementation would check evaluation status
        },
        errorMessage: 'Debe completar la evaluación de viabilidad antes de marcar como observado'
      }
    ]
  },

  // EN_EVALUACION_VIABILIDAD → VIABLE
  [`${STATES.EN_EVALUACION_VIABILIDAD}:${STATES.VIABLE}`]: {
    name: 'Transición a Viable',
    description: 'Requiere evaluación de viabilidad positiva',
    requirements: [
      {
        field: 'viability_assessment',
        section: 'determinations',
        friendlyName: 'Evaluación de viabilidad',
        validator: async (bc) => {
          // Check if viability assessment passed
          // This would check evaluation results
          return true; // Placeholder - actual implementation would check assessment results
        },
        errorMessage: 'La evaluación de viabilidad debe ser positiva para marcar como viable'
      },
      {
        field: 'roi_calculation',
        section: 'determinations',
        friendlyName: 'Cálculo de ROI',
        validator: async (bc) => {
          // Check if ROI calculation is complete and positive
          return true; // Placeholder - actual implementation would check ROI results
        },
        errorMessage: 'Debe completar el cálculo de ROI con resultado positivo'
      }
    ]
  },

  // OBSERVADO_POR_VIABILIDAD → EN_EVALUACION_VIABILIDAD
  [`${STATES.OBSERVADO_POR_VIABILIDAD}:${STATES.EN_EVALUACION_VIABILIDAD}`]: {
    name: 'Reingreso a Evaluación de Viabilidad',
    description: 'Requiere notas de resolución de observaciones',
    requirements: [
      {
        field: 'resolution_notes',
        section: 'determinations',
        friendlyName: 'Notas de resolución',
        validator: (bc) => {
          // Check if resolution notes are provided
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.resolution_notes && extra.resolution_notes.trim().length > 0;
        },
        errorMessage: 'Debe proporcionar notas de resolución de las observaciones encontradas'
      },
      {
        field: 'issue_resolution',
        section: 'determinations',
        friendlyName: 'Resolución de problemas',
        validator: (bc) => {
          // Check if identified issues have been addressed
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.issues_resolved === true;
        },
        errorMessage: 'Debe resolver todos los problemas identificados antes de reingresar a evaluación'
      }
    ]
  },

  // VIABLE → AJUSTES_OPERATIVOS
  [`${STATES.VIABLE}:${STATES.AJUSTES_OPERATIVOS}`]: {
    name: 'Transición a Ajustes Operativos',
    description: 'Requiere aprobación de viabilidad y plan operativo básico',
    requirements: [
      {
        field: 'operational_plan',
        section: 'investments',
        friendlyName: 'Plan operativo básico',
        validator: (bc) => {
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.operational_plan && Object.keys(extra.operational_plan).length > 0;
        },
        errorMessage: 'Debe crear un plan operativo básico antes de pasar a ajustes'
      },
      {
        field: 'viability_approval',
        section: 'determinations',
        friendlyName: 'Aprobación de viabilidad',
        validator: (bc) => {
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.viability_approved === true;
        },
        errorMessage: 'Requiere aprobación formal de la evaluación de viabilidad'
      }
    ]
  },

  // AJUSTES_OPERATIVOS → CERRADO_PARA_APROBACION
  [`${STATES.AJUSTES_OPERATIVOS}:${STATES.CERRADO_PARA_APROBACION}`]: {
    name: 'Transición a Cerrado para Aprobación',
    description: 'Requiere documentación completa y aprobación final',
    requirements: [
      {
        field: 'final_documentation',
        section: 'general',
        friendlyName: 'Documentación final',
        validator: (bc) => {
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.final_documentation_complete === true;
        },
        errorMessage: 'Debe completar toda la documentación final'
      },
      {
        field: 'contract_ready',
        section: 'investments',
        friendlyName: 'Contrato preparado',
        validator: (bc) => {
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.contract_ready === true;
        },
        errorMessage: 'El contrato debe estar preparado y revisado'
      },
      {
        field: 'final_approval_check',
        section: 'general',
        friendlyName: 'Verificación final',
        validator: (bc) => {
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;
          return extra && extra.final_approval_check_passed === true;
        },
        errorMessage: 'Debe pasar la verificación final de aprobación'
      },
      // Branching requirements based on business case type for final approval
      {
        field: 'flow_specific_final_approval',
        section: 'general',
        friendlyName: 'Aprobaciones específicas del flujo',
        validator: (bc) => {
          const flowType = getBusinessCaseFlowType(bc);
          const extra = typeof bc.extra === 'string' ? JSON.parse(bc.extra) : bc.extra;

          if (flowType === 'PUBLIC') {
            // PUBLIC flow: Check for public tender approval and legal review
            return extra && extra.public_tender_approval_obtained === true &&
                   extra.legal_review_completed === true &&
                   extra.sercof_registration_complete === true;
          } else {
            // PRIVATE flow: Check for management approval and backoffice signoff
            return extra && extra.management_approval_obtained === true &&
                   extra.backoffice_signoff_complete === true;
          }
        },
        errorMessage: (bc) => {
          const flowType = getBusinessCaseFlowType(bc);
          if (flowType === 'PUBLIC') {
            return 'Para casos públicos se requiere aprobación de licitación, revisión legal y registro SERCOF';
          } else {
            return 'Para casos privados se requiere aprobación gerencial y visto bueno de backoffice';
          }
        }
      }
    ]
  }
};

class BusinessCaseStateReadiness {
  /**
   * Validate if a business case is ready to transition to a target state
   * @param {object} businessCase - Complete business case object
   * @param {string} targetState - Target canonical state
   * @returns {object} Validation result
   */
  static async validateStateReadiness(businessCase, targetState) {
    const currentState = businessCase.canonical_state;
    const transitionKey = `${currentState}:${targetState}`;

    // Check if this transition has readiness requirements
    const transitionRequirements = STATE_READINESS_REQUIREMENTS[transitionKey];

    if (!transitionRequirements) {
      // No specific requirements for this transition
      return {
        isReady: true,
        transitionKey,
        requirements: []
      };
    }

    const validationResults = [];
    let allPassed = true;

    // Validate each requirement
    for (const requirement of transitionRequirements.requirements) {
      try {
        const passed = await requirement.validator(businessCase);

        validationResults.push({
          field: requirement.field,
          section: requirement.section,
          friendlyName: requirement.friendlyName,
          passed,
          errorMessage: passed ? null : requirement.errorMessage
        });

        if (!passed) {
          allPassed = false;
        }
      } catch (error) {
        validationResults.push({
          field: requirement.field,
          section: requirement.section,
          friendlyName: requirement.friendlyName,
          passed: false,
          errorMessage: `Error validando ${requirement.friendlyName}: ${error.message}`
        });
        allPassed = false;
      }
    }

    return {
      isReady: allPassed,
      transitionKey,
      transitionName: transitionRequirements.name,
      description: transitionRequirements.description,
      requirements: validationResults,
      failedRequirements: validationResults.filter(r => !r.passed),
      summary: allPassed
        ? 'Todos los requisitos cumplidos'
        : `${validationResults.filter(r => !r.passed).length} requisito(s) pendiente(s)`
    };
  }

  /**
   * Get readiness requirements for a specific transition
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {object|null} Requirements or null if none
   */
  static getTransitionRequirements(fromState, toState) {
    const transitionKey = `${fromState}:${toState}`;
    return STATE_READINESS_REQUIREMENTS[transitionKey] || null;
  }

  /**
   * Get all readiness requirements
   * @returns {object} Complete requirements matrix
   */
  static getAllRequirements() {
    return { ...STATE_READINESS_REQUIREMENTS };
  }

  /**
   * Check if a transition has readiness requirements
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} True if requirements exist
   */
  static hasRequirements(fromState, toState) {
    const transitionKey = `${fromState}:${toState}`;
    return transitionKey in STATE_READINESS_REQUIREMENTS;
  }

  /**
   * Get user-friendly readiness summary for a business case
   * @param {object} businessCase - Business case object
   * @param {string} targetState - Target state to check
   * @returns {object} User-friendly summary
   */
  static async getReadinessSummary(businessCase, targetState) {
    const validation = await this.validateStateReadiness(businessCase, targetState);

    return {
      canTransition: validation.isReady,
      transitionName: validation.transitionName,
      description: validation.description,
      summary: validation.summary,
      blockingIssues: validation.failedRequirements.map(req => ({
        section: req.section,
        field: req.friendlyName,
        issue: req.errorMessage
      })),
      nextSteps: validation.isReady
        ? ['Listo para avanzar al siguiente estado']
        : validation.failedRequirements.map(req =>
            `Completar: ${req.friendlyName} (${req.section})`
          )
    };
  }
}

module.exports = {
  BusinessCaseStateReadiness,
  STATE_READINESS_REQUIREMENTS
};
