/**
 * Business Case Data Ownership Model
 *
 * Tracks section completion and ownership for audit and informational purposes.
 * Does NOT block editing or replace permission controls.
 *
 * Sections:
 * - general: Client and basic case information
 * - laboratory_environment: Lab setup and requirements
 * - equipment: Equipment selection and configuration
 * - lis: LIS integration details
 * - determinations: Technical determinations and validations
 * - investments: Investment calculations and approvals
 * - prices: Pricing and margin configurations
 */

const db = require("../../config/db");
const { STATES } = require('./businessCaseStates.constants');

// Canonical section definitions
const SECTIONS = {
  GENERAL: 'general',
  LABORATORY_ENVIRONMENT: 'laboratory_environment',
  EQUIPMENT: 'equipment',
  LIS: 'lis',
  DETERMINATIONS: 'determinations',
  INVESTMENTS: 'investments',
  PRICES: 'prices'
};

// Section ownership matrix: Who fills, corrects, and locks each section
const SECTION_OWNERSHIP = {
  [SECTIONS.GENERAL]: {
    primaryOwner: 'comercial', // Who fills it first
    canCorrect: ['comercial', 'jefe_comercial'], // Who can make corrections
    canLock: ['jefe_comercial'], // Who can mark as final/locked
    description: 'Información básica del cliente y caso de negocio'
  },
  [SECTIONS.LABORATORY_ENVIRONMENT]: {
    primaryOwner: 'jefe_tecnico',
    canCorrect: ['jefe_tecnico', 'jefe_comercial'],
    canLock: ['jefe_tecnico'],
    description: 'Configuración del ambiente de laboratorio'
  },
  [SECTIONS.EQUIPMENT]: {
    primaryOwner: 'comercial',
    canCorrect: ['comercial', 'acp_comercial', 'jefe_comercial'],
    canLock: ['jefe_comercial'],
    description: 'Selección y configuración de equipos'
  },
  [SECTIONS.LIS]: {
    primaryOwner: 'backoffice',
    canCorrect: ['backoffice', 'jefe_tecnico'],
    canLock: ['jefe_tecnico'],
    description: 'Integración con sistemas LIS'
  },
  [SECTIONS.DETERMINATIONS]: {
    primaryOwner: 'jefe_tecnico',
    canCorrect: ['jefe_tecnico', 'backoffice'],
    canLock: ['jefe_tecnico'],
    description: 'Determinaciones técnicas y validaciones'
  },
  [SECTIONS.INVESTMENTS]: {
    primaryOwner: 'jefe_operaciones',
    canCorrect: ['jefe_operaciones'],
    canLock: ['jefe_operaciones'],
    description: 'Cálculos de inversión y presupuestos'
  },
  [SECTIONS.PRICES]: {
    primaryOwner: 'jefe_operaciones',
    canCorrect: ['jefe_operaciones'],
    canLock: ['jefe_operaciones'],
    description: 'Configuración de precios y márgenes'
  }
};

// State-based ownership transitions
const STATE_OWNERSHIP_TRANSITIONS = {
  [STATES.DRAFT_INICIAL]: {
    [SECTIONS.GENERAL]: 'comercial',
    [SECTIONS.EQUIPMENT]: 'comercial',
    [SECTIONS.LABORATORY_ENVIRONMENT]: 'comercial'
  },
  [STATES.DATOS_BASE_COMPLETOS]: {
    [SECTIONS.DETERMINATIONS]: 'jefe_tecnico',
    [SECTIONS.LIS]: 'backoffice',
    [SECTIONS.LABORATORY_ENVIRONMENT]: 'jefe_tecnico'
  },
  [STATES.EN_EVALUACION_VIABILIDAD]: {
    [SECTIONS.INVESTMENTS]: 'jefe_operaciones',
    [SECTIONS.DETERMINATIONS]: 'jefe_tecnico',
    [SECTIONS.LIS]: 'jefe_tecnico'
  },
  [STATES.OBSERVADO_POR_VIABILIDAD]: {
    [SECTIONS.GENERAL]: 'jefe_comercial',
    [SECTIONS.EQUIPMENT]: 'jefe_comercial',
    [SECTIONS.DETERMINATIONS]: 'jefe_tecnico'
  },
  [STATES.VIABLE]: {
    [SECTIONS.INVESTMENTS]: 'jefe_operaciones',
    [SECTIONS.PRICES]: 'jefe_operaciones'
  },
  [STATES.AJUSTES_OPERATIVOS]: {
    [SECTIONS.INVESTMENTS]: 'jefe_operaciones',
    [SECTIONS.PRICES]: 'jefe_operaciones'
  },
  [STATES.CERRADO_PARA_APROBACION]: {
    // Final state - ownership locked for all sections
    [SECTIONS.GENERAL]: 'locked',
    [SECTIONS.EQUIPMENT]: 'locked',
    [SECTIONS.LABORATORY_ENVIRONMENT]: 'locked',
    [SECTIONS.LIS]: 'locked',
    [SECTIONS.DETERMINATIONS]: 'locked',
    [SECTIONS.INVESTMENTS]: 'locked',
    [SECTIONS.PRICES]: 'locked'
  }
};

class BusinessCaseDataOwnership {
  /**
   * Record section completion by a user
   * @param {string} businessCaseId - Business case UUID
   * @param {string} section - Section name
   * @param {string} userId - User who completed the section
   * @param {string} userRole - User's role
   * @param {string} canonicalState - Current canonical state
   * @param {object} metadata - Additional metadata
   */
  static async recordSectionCompletion(businessCaseId, section, userId, userRole, canonicalState, metadata = {}) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Check if section is already completed
      const existing = await client.query(
        `SELECT id, completed_by, completed_at, canonical_state
         FROM business_case_section_ownership
         WHERE business_case_id = $1 AND section_name = $2`,
        [businessCaseId, section]
      );

      const now = new Date();
      const completionData = {
        business_case_id: businessCaseId,
        section_name: section,
        completed_by: userId,
        completed_by_role: userRole,
        completed_at: now,
        canonical_state: canonicalState,
        metadata: JSON.stringify(metadata),
        updated_at: now
      };

      if (existing.rows.length > 0) {
        // Update existing record
        const existingRecord = existing.rows[0];
        completionData.created_at = existingRecord.created_at;
        completionData.first_completed_at = existingRecord.first_completed_at || existingRecord.created_at;
        completionData.first_completed_by = existingRecord.first_completed_by || existingRecord.completed_by;

        await client.query(
          `UPDATE business_case_section_ownership
           SET completed_by = $1, completed_by_role = $2, completed_at = $3,
               canonical_state = $4, metadata = $5, updated_at = $6,
               completion_count = completion_count + 1
           WHERE business_case_id = $7 AND section_name = $8`,
          [
            userId, userRole, now, canonicalState,
            JSON.stringify({
              ...JSON.parse(existingRecord.metadata || '{}'),
              ...metadata,
              last_modified: now
            }),
            now, businessCaseId, section
          ]
        );
      } else {
        // Insert new record
        completionData.first_completed_at = now;
        completionData.first_completed_by = userId;
        completionData.completion_count = 1;

        await client.query(
          `INSERT INTO business_case_section_ownership (
            business_case_id, section_name, completed_by, completed_by_role,
            completed_at, canonical_state, metadata, created_at, updated_at,
            first_completed_by, first_completed_at, completion_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            completionData.business_case_id,
            completionData.section_name,
            completionData.completed_by,
            completionData.completed_by_role,
            completionData.completed_at,
            completionData.canonical_state,
            completionData.metadata,
            completionData.created_at || now,
            completionData.updated_at,
            completionData.first_completed_by,
            completionData.first_completed_at,
            completionData.completion_count
          ]
        );
      }

      // Log ownership change in audit trail
      await client.query(
        `INSERT INTO business_case_section_ownership_audit (
          business_case_id, section_name, action, performed_by, performed_by_role,
          canonical_state, metadata, performed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          businessCaseId, section, 'completed',
          userId, userRole, canonicalState,
          JSON.stringify(metadata), now
        ]
      );

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get ownership information for a business case
   * @param {string} businessCaseId - Business case UUID
   * @returns {object} Ownership information
   */
  static async getOwnershipInfo(businessCaseId) {
    const { rows } = await db.query(
      `SELECT section_name, completed_by, completed_by_role, completed_at,
              canonical_state, first_completed_by, first_completed_at,
              completion_count, metadata
       FROM business_case_section_ownership
       WHERE business_case_id = $1
       ORDER BY section_name`,
      [businessCaseId]
    );

    const ownershipMap = {};
    rows.forEach(row => {
      ownershipMap[row.section_name] = {
        completedBy: row.completed_by,
        completedByRole: row.completed_by_role,
        completedAt: row.completed_at,
        canonicalState: row.canonical_state,
        firstCompletedBy: row.first_completed_by,
        firstCompletedAt: row.first_completed_at,
        completionCount: row.completion_count,
        metadata: JSON.parse(row.metadata || '{}')
      };
    });

    return ownershipMap;
  }

  /**
   * Get current owner for a section in a specific state
   * @param {string} section - Section name
   * @param {string} canonicalState - Current canonical state
   * @returns {string} Current owner role or null
   */
  static getCurrentSectionOwner(section, canonicalState) {
    const stateOwnership = STATE_OWNERSHIP_TRANSITIONS[canonicalState];
    if (!stateOwnership) return null;

    return stateOwnership[section] || null;
  }

  /**
   * Check if a user can complete a section
   * @param {string} section - Section name
   * @param {string} userRole - User's role
   * @param {string} canonicalState - Current canonical state
   * @returns {boolean} True if user can complete the section
   */
  static canUserCompleteSection(section, userRole, canonicalState) {
    const currentOwner = this.getCurrentSectionOwner(section, canonicalState);

    // If there's a specific owner for this state/section, check if user matches
    if (currentOwner) {
      return currentOwner === userRole || currentOwner === 'locked';
    }

    // Otherwise, check if user is in the primary owner or can-correct list
    const sectionOwnership = SECTION_OWNERSHIP[section];
    if (!sectionOwnership) return false;

    return sectionOwnership.primaryOwner === userRole ||
           sectionOwnership.canCorrect.includes(userRole);
  }

  /**
   * Check if a user can lock a section
   * @param {string} section - Section name
   * @param {string} userRole - User's role
   * @returns {boolean} True if user can lock the section
   */
  static canUserLockSection(section, userRole) {
    const sectionOwnership = SECTION_OWNERSHIP[section];
    if (!sectionOwnership) return false;

    return sectionOwnership.canLock.includes(userRole);
  }

  /**
   * Get section ownership metadata
   * @param {string} section - Section name
   * @returns {object} Ownership metadata
   */
  static getSectionOwnershipInfo(section) {
    return SECTION_OWNERSHIP[section] || null;
  }

  /**
   * Get all sections
   * @returns {object} Section constants
   */
  static getSections() {
    return { ...SECTIONS };
  }

  /**
   * Get ownership audit trail for a business case
   * @param {string} businessCaseId - Business case UUID
   * @returns {array} Audit trail entries
   */
  static async getOwnershipAuditTrail(businessCaseId) {
    const { rows } = await db.query(
      `SELECT section_name, action, performed_by, performed_by_role,
              canonical_state, metadata, performed_at
       FROM business_case_section_ownership_audit
       WHERE business_case_id = $1
       ORDER BY performed_at DESC`,
      [businessCaseId]
    );

    return rows.map(row => ({
      section: row.section_name,
      action: row.action,
      performedBy: row.performed_by,
      performedByRole: row.performed_by_role,
      canonicalState: row.canonical_state,
      metadata: JSON.parse(row.metadata || '{}'),
      performedAt: row.performed_at
    }));
  }

  /**
   * Get section completion summary
   * @param {string} businessCaseId - Business case UUID
   * @returns {object} Completion summary
   */
  static async getCompletionSummary(businessCaseId) {
    const ownershipInfo = await this.getOwnershipInfo(businessCaseId);
    const allSections = Object.values(SECTIONS);

    const summary = {
      totalSections: allSections.length,
      completedSections: 0,
      completionPercentage: 0,
      sectionDetails: {}
    };

    allSections.forEach(section => {
      const ownership = ownershipInfo[section];
      const isCompleted = !!ownership;

      summary.sectionDetails[section] = {
        completed: isCompleted,
        completedBy: ownership?.completedBy || null,
        completedAt: ownership?.completedAt || null,
        completionCount: ownership?.completionCount || 0,
        ownership: SECTION_OWNERSHIP[section]
      };

      if (isCompleted) {
        summary.completedSections++;
      }
    });

    summary.completionPercentage = Math.round((summary.completedSections / summary.totalSections) * 100);

    return summary;
  }
}

module.exports = {
  BusinessCaseDataOwnership,
  SECTIONS,
  SECTION_OWNERSHIP,
  STATE_OWNERSHIP_TRANSITIONS
};
