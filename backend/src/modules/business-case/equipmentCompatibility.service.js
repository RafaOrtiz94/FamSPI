/**
 * Equipment Compatibility Service
 *
 * Provides advanced equipment compatibility and backup selection logic
 * with graceful fallback to legacy category-based matching.
 *
 * NEW LOGIC: Implements structured compatibility rules, capacity validation,
 * and economic comparison for automatic backup equipment selection.
 *
 * LEGACY FALLBACK: Falls back to existing category-based logic when
 * compatibility data is not available.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Get compatible backup candidates for a primary equipment
 *
 * NEW FUNCTION: Advanced compatibility-based selection with ranking
 * Implements the complete compatibility logic with fallbacks to legacy behavior
 *
 * @param {number} primaryEquipmentId - ID of primary equipment
 * @param {object} options - Selection options
 * @returns {Promise<Array>} Ranked list of compatible backup equipment
 */
async function getCompatibleBackupCandidates(primaryEquipmentId, options = {}) {
  try {
    // NEW: First try advanced compatibility-based selection
    const candidates = await getAdvancedBackupCandidates(primaryEquipmentId, options);

    if (candidates && candidates.length > 0) {
      logger.info({
        primaryEquipmentId,
        candidatesCount: candidates.length,
        method: 'advanced_compatibility'
      }, 'Using advanced compatibility-based backup selection');
      return candidates;
    }

    // FALLBACK: Use legacy category-based logic when no compatibility data exists
    logger.warn({
      primaryEquipmentId,
      method: 'legacy_fallback'
    }, 'No compatibility data found, falling back to legacy category-based selection');

    return await getLegacyBackupCandidates(primaryEquipmentId, options);

  } catch (error) {
    logger.error({
      error: error.message,
      primaryEquipmentId,
      method: 'error_fallback'
    }, 'Error in compatibility selection, using legacy fallback');

    // FINAL FALLBACK: Ensure system never breaks
    return await getLegacyBackupCandidates(primaryEquipmentId, options);
  }
}

/**
 * Advanced compatibility-based backup selection
 *
 * NEW LOGIC: Uses compatibility matrix, capacity validation, and economic comparison
 * Ranks candidates by compatibility_score, backup_priority, cost_penalty, capacity_overlap
 *
 * @param {number} primaryEquipmentId - Primary equipment ID
 * @param {object} options - Selection options
 * @returns {Promise<Array>} Ranked compatible equipment
 */
async function getAdvancedBackupCandidates(primaryEquipmentId, options = {}) {
  const {
    maxCandidates = 10,
    minCompatibilityScore = 0.3,
    maxCostPenalty = 50.0,
    requireCapacityOverlap = true
  } = options;

  // Get primary equipment with compatibility metadata
  const primaryQuery = `
    SELECT
      e.*,
      e.equipment_level,
      e.parent_equipment_id,
      e.compatibility_group,
      e.compatibility_rules,
      e.capacity_unit,
      e.capacity_type,
      e.capacity_factors,
      e.lease_price,
      e.maintenance_cost_monthly,
      e.backup_priority,
      e.redundancy_type
    FROM public.equipment_models e
    WHERE e.id = $1 AND e.status = 'operativo'
  `;

  const primaryResult = await db.query(primaryQuery, [primaryEquipmentId]);
  if (!primaryResult.rows.length) {
    throw new Error(`Primary equipment ${primaryEquipmentId} not found or not operational`);
  }

  const primaryEquipment = primaryResult.rows[0];

  // Build advanced selection query
  const selectionQuery = `
    WITH compatibility_candidates AS (
      -- Explicit compatibility matrix relationships
      SELECT
        e.id,
        e.name,
        e.code,
        e.capacity_per_hour,
        e.max_daily_capacity,
        e.base_price,
        e.category_type,
        e.manufacturer,
        e.model,
        e.description,
        e.status,
        m.compatibility_score,
        m.capacity_overlap_percentage,
        m.cost_penalty_percentage,
        m.priority_score,
        m.notes,
        e.backup_priority as equipment_priority,
        e.lease_price,
        e.maintenance_cost_monthly,
        'explicit_matrix' as match_type,
        1 as match_confidence
      FROM public.equipment_compatibility_matrix m
      JOIN public.equipment_models e ON e.id = m.backup_equipment_id
      WHERE m.primary_equipment_id = $1
        AND m.is_active = true
        AND e.status = 'operativo'
        AND e.id != $1

      UNION ALL

      -- Compatibility group matches (same group, different equipment)
      SELECT
        e.id,
        e.name,
        e.code,
        e.capacity_per_hour,
        e.max_daily_capacity,
        e.base_price,
        e.category_type,
        e.manufacturer,
        e.model,
        e.description,
        e.status,
        0.7 as compatibility_score, -- Default score for group matches
        90.0 as capacity_overlap_percentage, -- Assumed overlap
        10.0 as cost_penalty_percentage, -- Default penalty
        e.backup_priority as priority_score,
        'Group match' as notes,
        e.backup_priority as equipment_priority,
        e.lease_price,
        e.maintenance_cost_monthly,
        'compatibility_group' as match_type,
        0.8 as match_confidence
      FROM public.equipment_models e
      WHERE e.compatibility_group = $2
        AND e.id != $1
        AND e.status = 'operativo'
        AND $2 IS NOT NULL

      UNION ALL

      -- Hierarchy matches (same parent equipment)
      SELECT
        e.id,
        e.name,
        e.code,
        e.capacity_per_hour,
        e.max_daily_capacity,
        e.base_price,
        e.category_type,
        e.manufacturer,
        e.model,
        e.description,
        e.status,
        0.8 as compatibility_score,
        95.0 as capacity_overlap_percentage,
        5.0 as cost_penalty_percentage,
        e.backup_priority as priority_score,
        'Hierarchy match' as notes,
        e.backup_priority as equipment_priority,
        e.lease_price,
        e.maintenance_cost_monthly,
        'equipment_hierarchy' as match_type,
        0.9 as match_confidence
      FROM public.equipment_models e
      WHERE (e.parent_equipment_id = $3 OR e.id = $3)
        AND e.id != $1
        AND e.status = 'operativo'
        AND $3 IS NOT NULL
    ),
    ranked_candidates AS (
      SELECT
        *,
        -- Calculate final ranking score
        (
          compatibility_score * 0.4 +                    -- 40% compatibility
          (priority_score / 100.0) * 0.2 +              -- 20% priority score
          (capacity_overlap_percentage / 100.0) * 0.2 + -- 20% capacity overlap
          ((100.0 - cost_penalty_percentage) / 100.0) * 0.2  -- 20% cost efficiency
        ) as final_score
      FROM compatibility_candidates
      WHERE compatibility_score >= $4
        AND cost_penalty_percentage <= $5
        AND (capacity_overlap_percentage >= 70.0 OR $6 = false)
    )
    SELECT * FROM ranked_candidates
    ORDER BY final_score DESC, compatibility_score DESC, priority_score DESC
    LIMIT $7
  `;

  const candidates = await db.query(selectionQuery, [
    primaryEquipmentId,
    primaryEquipment.compatibility_group,
    primaryEquipment.parent_equipment_id || primaryEquipmentId,
    minCompatibilityScore,
    maxCostPenalty,
    requireCapacityOverlap,
    maxCandidates
  ]);

  // Enhance results with additional metadata
  return candidates.rows.map(candidate => ({
    ...candidate,
    primary_equipment: {
      id: primaryEquipment.id,
      name: primaryEquipment.name,
      compatibility_group: primaryEquipment.compatibility_group
    },
    compatibility_metadata: {
      match_type: candidate.match_type,
      match_confidence: candidate.match_confidence,
      final_score: candidate.final_score,
      capacity_overlap_percentage: candidate.capacity_overlap_percentage,
      cost_penalty_percentage: candidate.cost_penalty_percentage
    },
    // Legacy compatibility fields
    categories: [candidate.category_type],
    raw: candidate
  }));
}

/**
 * Legacy category-based backup selection
 *
 * LEGACY LOGIC: Original implementation preserved as fallback
 * Uses simple category matching without advanced compatibility rules
 *
 * @param {number} primaryEquipmentId - Primary equipment ID
 * @param {object} options - Selection options
 * @returns {Promise<Array>} Basic category-matched equipment
 */
async function getLegacyBackupCandidates(primaryEquipmentId, options = {}) {
  const { maxCandidates = 10 } = options;

  // Get primary equipment basic info
  const primaryQuery = `
    SELECT e.category_type, e.name
    FROM public.equipment_models e
    WHERE e.id = $1 AND e.status = 'operativo'
  `;

  const primaryResult = await db.query(primaryQuery, [primaryEquipmentId]);
  if (!primaryResult.rows.length) {
    return [];
  }

  const primaryEquipment = primaryResult.rows[0];
  const primaryCategories = [primaryEquipment.category_type].filter(Boolean);

  if (!primaryCategories.length) {
    return [];
  }

  // Legacy category-based matching
  const legacyQuery = `
    SELECT
      e.id,
      e.name,
      e.code,
      e.capacity_per_hour,
      e.max_daily_capacity,
      e.base_price,
      e.category_type,
      e.manufacturer,
      e.model,
      e.description,
      e.status,
      0.5 as compatibility_score, -- Default legacy score
      80.0 as capacity_overlap_percentage,
      0.0 as cost_penalty_percentage,
      0 as priority_score,
      'Legacy category match' as notes,
      0 as equipment_priority,
      null as lease_price,
      null as maintenance_cost_monthly,
      'legacy_category' as match_type,
      0.5 as match_confidence
    FROM public.equipment_models e
    WHERE e.category_type = ANY($1)
      AND e.id != $2
      AND e.status = 'operativo'
    ORDER BY e.base_price ASC, e.name ASC
    LIMIT $3
  `;

  const result = await db.query(legacyQuery, [
    primaryCategories,
    primaryEquipmentId,
    maxCandidates
  ]);

  return result.rows.map(candidate => ({
    ...candidate,
    primary_equipment: {
      id: primaryEquipmentId,
      name: primaryEquipment.name
    },
    compatibility_metadata: {
      match_type: 'legacy_fallback',
      match_confidence: 0.5,
      note: 'Using legacy category-based matching due to missing compatibility data'
    },
    // Legacy compatibility fields
    categories: [candidate.category_type],
    raw: candidate
  }));
}

/**
 * Validate equipment compatibility for capacity and economic factors
 *
 * NEW FUNCTION: Advanced validation beyond basic category matching
 *
 * @param {number} primaryId - Primary equipment ID
 * @param {number} backupId - Backup equipment ID
 * @returns {Promise<object>} Validation results
 */
async function validateEquipmentCompatibility(primaryId, backupId) {
  try {
    const validationQuery = `
      SELECT
        p.name as primary_name,
        p.capacity_per_hour as primary_capacity,
        p.capacity_unit as primary_unit,
        p.capacity_type as primary_capacity_type,
        p.base_price as primary_price,
        p.lease_price as primary_lease_price,
        p.maintenance_cost_monthly as primary_maintenance,

        b.name as backup_name,
        b.capacity_per_hour as backup_capacity,
        b.capacity_unit as backup_unit,
        b.capacity_type as backup_capacity_type,
        b.base_price as backup_price,
        b.lease_price as backup_lease_price,
        b.maintenance_cost_monthly as backup_maintenance,

        -- Calculate compatibility metrics
        CASE
          WHEN p.capacity_unit = b.capacity_unit THEN
            LEAST(p.capacity_per_hour, b.capacity_per_hour)::FLOAT / GREATEST(p.capacity_per_hour, b.capacity_per_hour)::FLOAT
          ELSE 0.8 -- Default overlap when units differ
        END as capacity_overlap_ratio,

        CASE
          WHEN p.base_price > 0 THEN
            ((b.base_price - p.base_price) / p.base_price) * 100.0
          ELSE 0.0
        END as cost_difference_percentage,

        -- Compatibility matrix lookup
        m.compatibility_score,
        m.capacity_overlap_percentage,
        m.cost_penalty_percentage,
        m.notes as compatibility_notes

      FROM public.equipment_models p
      CROSS JOIN public.equipment_models b
      LEFT JOIN public.equipment_compatibility_matrix m ON (
        (m.primary_equipment_id = p.id AND m.backup_equipment_id = b.id) OR
        (m.primary_equipment_id = b.id AND m.backup_equipment_id = p.id)
      )
      WHERE p.id = $1 AND b.id = $2
        AND p.status = 'operativo' AND b.status = 'operativo'
    `;

    const result = await db.query(validationQuery, [primaryId, backupId]);

    if (!result.rows.length) {
      return {
        isValid: false,
        reason: 'Equipment not found or not operational',
        compatibility_score: 0
      };
    }

    const validation = result.rows[0];

    // Apply validation rules
    const isValid = (
      validation.capacity_overlap_ratio >= 0.5 && // At least 50% capacity overlap
      Math.abs(validation.cost_difference_percentage) <= 100.0 // Cost difference within reasonable bounds
    );

    return {
      isValid,
      primary_equipment: {
        id: primaryId,
        name: validation.primary_name,
        capacity: validation.primary_capacity,
        price: validation.primary_price
      },
      backup_equipment: {
        id: backupId,
        name: validation.backup_name,
        capacity: validation.backup_capacity,
        price: validation.backup_price
      },
      compatibility_metrics: {
        capacity_overlap_ratio: validation.capacity_overlap_ratio,
        capacity_overlap_percentage: validation.capacity_overlap_percentage || (validation.capacity_overlap_ratio * 100),
        cost_difference_percentage: validation.cost_difference_percentage,
        cost_penalty_percentage: validation.cost_penalty_percentage || Math.abs(validation.cost_difference_percentage)
      },
      compatibility_score: validation.compatibility_score || (isValid ? 0.7 : 0.3),
      notes: validation.compatibility_notes || 'Auto-calculated compatibility',
      validation_timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error({
      error: error.message,
      primaryId,
      backupId
    }, 'Error validating equipment compatibility');

    return {
      isValid: false,
      reason: `Validation error: ${error.message}`,
      compatibility_score: 0
    };
  }
}

/**
 * Get equipment compatibility statistics for monitoring
 *
 * NEW FUNCTION: Analytics for compatibility system health
 *
 * @returns {Promise<object>} Compatibility statistics
 */
async function getCompatibilityStatistics() {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM public.equipment_models WHERE compatibility_group IS NOT NULL) as equipment_with_groups,
        (SELECT COUNT(*) FROM public.equipment_models WHERE compatibility_rules IS NOT NULL) as equipment_with_rules,
        (SELECT COUNT(*) FROM public.equipment_compatibility_matrix WHERE is_active = true) as active_matrix_entries,
        (SELECT COUNT(*) FROM public.equipment_models WHERE backup_priority > 0) as prioritized_equipment,
        (SELECT AVG(compatibility_score) FROM public.equipment_compatibility_matrix WHERE is_active = true) as avg_compatibility_score,
        (SELECT COUNT(*) FROM public.equipment_models WHERE lease_price IS NOT NULL) as equipment_with_lease_pricing,
        (SELECT COUNT(*) FROM public.equipment_models WHERE maintenance_cost_monthly IS NOT NULL) as equipment_with_maintenance_costs
    `;

    const result = await db.query(statsQuery);
    return result.rows[0] || {};

  } catch (error) {
    logger.error({ error: error.message }, 'Error getting compatibility statistics');
    return {};
  }
}

module.exports = {
  getCompatibleBackupCandidates,
  getAdvancedBackupCandidates,
  getLegacyBackupCandidates,
  validateEquipmentCompatibility,
  getCompatibilityStatistics
};

// Export individual functions for testing
if (process.env.NODE_ENV === 'test') {
  module.exports._private = {
    getAdvancedBackupCandidates,
    getLegacyBackupCandidates,
    validateEquipmentCompatibility
  };
}
