const db = require('../../config/db');
const logger = require('../../config/logger');
const businessCaseCalculator = require('./businessCaseCalculator.service');

/**
 * Business Case Orchestrator
 * Coordina los dominios Economics, Operations y Governance
 * Implementa el flujo unificado del Business Case
 */

class BusinessCaseOrchestrator {

    // ============================================================================
    // FASE 1: CREACIÓN DE BC ECONÓMICO (WIZARD)
    // ============================================================================

    /**
     * Crear Business Case con datos económicos iniciales
     * @param {Object} data - Datos del wizard
     * @returns {Object} BC creado
     */
    async createEconomicBC(data) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // 1. Crear BC Master
            const bcResult = await client.query(`
        INSERT INTO bc_master (
          client_id, client_name, bc_type, 
          duration_years, target_margin_percentage,
          process_code, contract_object,
          current_stage, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
        RETURNING *
      `, [
                data.client_id,
                data.client_name,
                data.bc_type || 'comodato_publico',
                data.duration_years || 3,
                data.target_margin_percentage || 25,
                data.process_code || null,
                data.contract_object || null,
                data.created_by || 'system'
            ]);

            const bc = bcResult.rows[0];

            // 2. Crear Economic Data
            await client.query(`
        INSERT INTO bc_economic_data (
          bc_master_id, equipment_id, equipment_name, equipment_cost,
          calculation_mode, show_roi, show_margin
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
                bc.id,
                data.equipment_id || null,
                data.equipment_name || null,
                data.equipment_cost || 0,
                'annual',
                true,
                true
            ]);

            // 3. Registrar en workflow history
            await this._addWorkflowHistory(client, bc.id, null, 'draft', data.created_by, 'BC creado');

            await client.query('COMMIT');

            logger.info({ bcId: bc.id }, 'BC económico creado');
            return bc;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error({ error: error.message }, 'Error creando BC económico');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================================
    // FASE 2: CÁLCULO DE ROI INICIAL
    // ============================================================================

    /**
     * Calcular ROI inicial con datos del wizard
     * @param {String} bcId - ID del BC
     * @returns {Object} Resultados del cálculo
     */
    async calculateInitialROI(bcId) {
        try {
            // Obtener datos necesarios
            const bc = await this.getBCMaster(bcId);
            const economicData = await this.getEconomicData(bcId);
            const determinations = await this.getDeterminations(bcId);
            const investments = await this.getInvestments(bcId);

            // Calcular usando el calculator existente
            const results = await businessCaseCalculator.calculateComodatoRentability(bcId);

            // Actualizar bc_master con resultados
            await db.query(`
        UPDATE bc_master 
        SET calculated_roi_percentage = $1,
            calculated_payback_months = $2,
            calculated_monthly_margin = $3,
            calculated_annual_margin = $4,
            calculated_monthly_revenue = $5,
            calculated_annual_revenue = $6,
            calculated_monthly_cost = $7,
            calculated_annual_cost = $8,
            total_investment = $9,
            equipment_investment = $10,
            economic_data_complete = true,
            updated_at = now()
        WHERE id = $11
      `, [
                results.roi_percentage,
                results.payback_months,
                results.monthly_margin,
                results.annual_margin,
                results.monthly_revenue,
                results.annual_revenue,
                results.monthly_cost,
                results.annual_cost,
                results.total_investment,
                economicData.equipment_cost,
                bcId
            ]);

            logger.info({ bcId, roi: results.roi_percentage }, 'ROI inicial calculado');
            return results;

        } catch (error) {
            logger.error({ error: error.message, bcId }, 'Error calculando ROI inicial');
            throw error;
        }
    }

    // ============================================================================
    // FASE 3: EVALUACIÓN DE APROBACIÓN ECONÓMICA
    // ============================================================================

    /**
     * Evaluar si el BC cumple con el margen objetivo
     * @param {String} bcId - ID del BC
     * @returns {Object} Resultado de la evaluación
     */
    async evaluateEconomicApproval(bcId) {
        try {
            const bc = await this.getBCMaster(bcId);

            if (!bc.calculated_roi_percentage) {
                throw new Error('BC no tiene ROI calculado');
            }

            const approved = bc.calculated_roi_percentage >= bc.target_margin_percentage;

            if (approved) {
                await this.promoteStage(bcId, 'pending_operational_data', 'system',
                    `ROI ${bc.calculated_roi_percentage}% cumple objetivo ${bc.target_margin_percentage}%`);

                return {
                    approved: true,
                    message: 'BC aprobado económicamente',
                    roi: bc.calculated_roi_percentage,
                    target: bc.target_margin_percentage
                };
            } else {
                await this.promoteStage(bcId, 'rejected', 'system',
                    `ROI ${bc.calculated_roi_percentage}% no cumple objetivo ${bc.target_margin_percentage}%`);

                return {
                    approved: false,
                    message: 'ROI insuficiente',
                    roi: bc.calculated_roi_percentage,
                    target: bc.target_margin_percentage
                };
            }

        } catch (error) {
            logger.error({ error: error.message, bcId }, 'Error evaluando aprobación económica');
            throw error;
        }
    }

    // ============================================================================
    // FASE 4: ADJUNTAR DATOS OPERATIVOS (MANUAL BC)
    // ============================================================================

    /**
     * Guardar datos operativos del cliente
     * @param {String} bcId - ID del BC
     * @param {Object} operationalData - Datos operativos
     */
    async attachOperationalData(bcId, operationalData) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Guardar datos operativos
            await client.query(`
        INSERT INTO bc_operational_data (
          bc_master_id,
          work_days_per_week, shifts_per_day, hours_per_shift,
          quality_controls_per_shift, control_levels,
          routine_qc_frequency, special_tests, special_qc_frequency,
          equipment_status, ownership_status, reservation_image_url,
          backup_equipment_name, backup_status, backup_manufacture_year,
          install_with_primary, installation_location,
          allows_provisional, requires_complementary, complementary_test_purpose,
          deadline_months, projected_deadline_months,
          delivery_type, effective_determination
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        ON CONFLICT (bc_master_id) DO UPDATE SET
          work_days_per_week = EXCLUDED.work_days_per_week,
          shifts_per_day = EXCLUDED.shifts_per_day,
          hours_per_shift = EXCLUDED.hours_per_shift,
          quality_controls_per_shift = EXCLUDED.quality_controls_per_shift,
          control_levels = EXCLUDED.control_levels,
          routine_qc_frequency = EXCLUDED.routine_qc_frequency,
          special_tests = EXCLUDED.special_tests,
          special_qc_frequency = EXCLUDED.special_qc_frequency,
          equipment_status = EXCLUDED.equipment_status,
          ownership_status = EXCLUDED.ownership_status,
          reservation_image_url = EXCLUDED.reservation_image_url,
          backup_equipment_name = EXCLUDED.backup_equipment_name,
          backup_status = EXCLUDED.backup_status,
          backup_manufacture_year = EXCLUDED.backup_manufacture_year,
          install_with_primary = EXCLUDED.install_with_primary,
          installation_location = EXCLUDED.installation_location,
          allows_provisional = EXCLUDED.allows_provisional,
          requires_complementary = EXCLUDED.requires_complementary,
          complementary_test_purpose = EXCLUDED.complementary_test_purpose,
          deadline_months = EXCLUDED.deadline_months,
          projected_deadline_months = EXCLUDED.projected_deadline_months,
          delivery_type = EXCLUDED.delivery_type,
          effective_determination = EXCLUDED.effective_determination,
          updated_at = now()
      `, [
                bcId,
                operationalData.work_days_per_week,
                operationalData.shifts_per_day,
                operationalData.hours_per_shift,
                operationalData.quality_controls_per_shift,
                operationalData.control_levels,
                operationalData.routine_qc_frequency,
                operationalData.special_tests,
                operationalData.special_qc_frequency,
                operationalData.equipment_status,
                operationalData.ownership_status,
                operationalData.reservation_image_url,
                operationalData.backup_equipment_name,
                operationalData.backup_status,
                operationalData.backup_manufacture_year,
                operationalData.install_with_primary,
                operationalData.installation_location,
                operationalData.allows_provisional,
                operationalData.requires_complementary,
                operationalData.complementary_test_purpose,
                operationalData.deadline_months,
                operationalData.projected_deadline_months,
                operationalData.delivery_type,
                operationalData.effective_determination
            ]);

            // Marcar como completo
            await client.query(`
        UPDATE bc_master 
        SET operational_data_complete = true,
            delivery_plan_complete = true,
            updated_at = now()
        WHERE id = $1
      `, [bcId]);

            await client.query('COMMIT');

            logger.info({ bcId }, 'Datos operativos adjuntados');

            // El trigger automáticamente marcará para recálculo

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error({ error: error.message, bcId }, 'Error adjuntando datos operativos');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Guardar datos LIS
     */
    async attachLISData(bcId, lisData) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Guardar datos LIS
            const result = await client.query(`
        INSERT INTO bc_lis_data (
          bc_master_id, includes_lis, lis_provider, includes_hardware,
          monthly_patients, current_system_name, current_system_provider,
          current_system_hardware
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (bc_master_id) DO UPDATE SET
          includes_lis = EXCLUDED.includes_lis,
          lis_provider = EXCLUDED.lis_provider,
          includes_hardware = EXCLUDED.includes_hardware,
          monthly_patients = EXCLUDED.monthly_patients,
          current_system_name = EXCLUDED.current_system_name,
          current_system_provider = EXCLUDED.current_system_provider,
          current_system_hardware = EXCLUDED.current_system_hardware,
          updated_at = now()
        RETURNING id
      `, [
                bcId,
                lisData.includes_lis,
                lisData.lis_provider,
                lisData.includes_hardware,
                lisData.monthly_patients,
                lisData.current_system_name,
                lisData.current_system_provider,
                lisData.current_system_hardware
            ]);

            const lisDataId = result.rows[0].id;

            // Guardar interfaces si existen
            if (lisData.equipment_interfaces && lisData.equipment_interfaces.length > 0) {
                for (const iface of lisData.equipment_interfaces) {
                    await client.query(`
            INSERT INTO bc_lis_equipment_interfaces (bc_lis_data_id, model, provider)
            VALUES ($1, $2, $3)
          `, [lisDataId, iface.model, iface.provider]);
                }
            }

            // Marcar como completo
            await client.query(`
        UPDATE bc_master 
        SET lis_data_complete = true,
            updated_at = now()
        WHERE id = $1
      `, [bcId]);

            await client.query('COMMIT');

            logger.info({ bcId }, 'Datos LIS adjuntados');

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error({ error: error.message, bcId }, 'Error adjuntando datos LIS');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================================
    // FASE 5: RECÁLCULO CON DATOS OPERATIVOS REALES
    // ============================================================================

    /**
     * Recalcular BC con datos operativos reales
     * @param {String} bcId - ID del BC
     * @returns {Object} Nuevos resultados y validaciones
     */
    async recalculateWithOperationalData(bcId) {
        try {
            // 1. Obtener datos operativos
            const operational = await this.getOperationalData(bcId);

            if (!operational) {
                throw new Error('No hay datos operativos para recalcular');
            }

            // 2. Ajustar determinaciones según realidad operativa
            await this.adjustDeterminationsToReality(bcId, operational);

            // 3. Recalcular ROI con datos ajustados
            const newROI = await this.calculateInitialROI(bcId);

            // 4. Validar coherencia
            const validations = await this.validateCoherence(bcId);

            // 5. Determinar siguiente etapa
            if (validations.hasErrors) {
                await this.promoteStage(bcId, 'pending_technical_review', 'system',
                    'Validaciones con errores - requiere revisión técnica');
            } else if (validations.hasWarnings) {
                await this.promoteStage(bcId, 'pending_manager_approval', 'system',
                    'Validaciones con advertencias - requiere aprobación gerencial');
            } else {
                await this.promoteStage(bcId, 'pending_manager_approval', 'system',
                    'BC recalculado y validado correctamente');
            }

            return { newROI, validations };

        } catch (error) {
            logger.error({ error: error.message, bcId }, 'Error recalculando con datos operativos');
            throw error;
        }
    }

    /**
     * Ajustar determinaciones según capacidad operativa real
     */
    async adjustDeterminationsToReality(bcId, operational) {
        try {
            const determinations = await this.getDeterminations(bcId);

            if (!determinations || determinations.length === 0) {
                return;
            }

            // Calcular capacidad operativa anual
            const hoursPerWeek = operational.work_days_per_week *
                operational.shifts_per_day *
                operational.hours_per_shift;
            const weeksPerYear = 52;
            const totalOperationalHours = hoursPerWeek * weeksPerYear;

            // Ajustar cada determinación si excede capacidad
            for (const det of determinations) {
                // Asumiendo 60 pruebas/hora promedio (ajustar según equipo)
                const testsPerHour = 60;
                const maxAnnualTests = totalOperationalHours * testsPerHour;

                if (det.annual_quantity > maxAnnualTests) {
                    await db.query(`
            UPDATE bc_determinations
            SET annual_quantity = $1,
                notes = $2
            WHERE id = $3
          `, [
                        maxAnnualTests,
                        `Ajustado automáticamente: excedía capacidad operativa (${det.annual_quantity} → ${maxAnnualTests})`,
                        det.id
                    ]);

                    logger.warn({ bcId, detId: det.id }, 'Determinación ajustada por capacidad');
                }
            }

        } catch (error) {
            logger.error({ error: error.message, bcId }, 'Error ajustando determinaciones');
            throw error;
        }
    }

    // ============================================================================
    // FASE 6: VALIDACIONES DE COHERENCIA
    // ============================================================================

    /**
     * Validar coherencia del BC
     * @param {String} bcId - ID del BC
     * @returns {Object} Resultados de validación
     */
    async validateCoherence(bcId) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Limpiar validaciones anteriores
            await client.query(`
        DELETE FROM bc_validations WHERE bc_master_id = $1
      `, [bcId]);

            const bc = await this.getBCMaster(bcId);
            const operational = await this.getOperationalData(bcId);
            const economicData = await this.getEconomicData(bcId);
            const determinations = await this.getDeterminations(bcId);

            const validations = [];

            // Validación 1: Controles de calidad excesivos
            if (operational && determinations.length > 0) {
                const totalAnnualTests = determinations.reduce((sum, d) => sum + (d.annual_quantity || 0), 0);
                const qcPercentage = (operational.quality_controls_per_shift *
                    operational.control_levels *
                    operational.shifts_per_day *
                    operational.work_days_per_week * 52) / totalAnnualTests * 100;

                if (qcPercentage > 15) {
                    validations.push({
                        type: 'coherence',
                        severity: 'warning',
                        message: `Controles de calidad representan ${qcPercentage.toFixed(1)}% del volumen (recomendado: <15%)`
                    });
                }
            }

            // Validación 2: Ambiente operativo vs volumen
            if (operational && determinations.length > 0) {
                const hoursPerWeek = operational.work_days_per_week *
                    operational.shifts_per_day *
                    operational.hours_per_shift;
                const totalAnnualTests = determinations.reduce((sum, d) => sum + (d.annual_quantity || 0), 0);

                if (hoursPerWeek < 40 && totalAnnualTests > 50000) {
                    validations.push({
                        type: 'coherence',
                        severity: 'warning',
                        message: `Volumen alto (${totalAnnualTests} pruebas/año) con pocas horas operativas (${hoursPerWeek}h/semana)`
                    });
                }
            }

            // Validación 3: ROI después de ajustes
            if (bc.calculated_roi_percentage < bc.target_margin_percentage) {
                validations.push({
                    type: 'roi',
                    severity: 'error',
                    message: `ROI ${bc.calculated_roi_percentage}% no cumple objetivo ${bc.target_margin_percentage}%`
                });
            }

            // Guardar validaciones
            for (const val of validations) {
                await client.query(`
          INSERT INTO bc_validations (bc_master_id, validation_type, severity, message)
          VALUES ($1, $2, $3, $4)
        `, [bcId, val.type, val.severity, val.message]);
            }

            // Actualizar bc_master
            const riskLevel = this._calculateRiskLevel(validations);
            await client.query(`
        UPDATE bc_master 
        SET has_inconsistencies = $1,
            inconsistency_details = $2,
            risk_level = $3,
            updated_at = now()
        WHERE id = $4
      `, [
                validations.length > 0,
                JSON.stringify(validations),
                riskLevel,
                bcId
            ]);

            await client.query('COMMIT');

            return {
                hasErrors: validations.some(v => v.severity === 'error'),
                hasWarnings: validations.some(v => v.severity === 'warning'),
                validations
            };

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error({ error: error.message, bcId }, 'Error validando coherencia');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================================
    // FASE 7: GESTIÓN DE WORKFLOW
    // ============================================================================

    /**
     * Promover BC a siguiente etapa
     */
    async promoteStage(bcId, newStage, user, notes) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            const bc = await this.getBCMaster(bcId);

            // Registrar en historial
            await this._addWorkflowHistory(client, bcId, bc.current_stage, newStage, user, notes);

            // Actualizar etapa
            await client.query(`
        UPDATE bc_master 
        SET current_stage = $1,
            updated_at = now()
        WHERE id = $2
      `, [newStage, bcId]);

            await client.query('COMMIT');

            logger.info({ bcId, from: bc.current_stage, to: newStage }, 'Etapa promovida');

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error({ error: error.message, bcId }, 'Error promoviendo etapa');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    async _addWorkflowHistory(client, bcId, fromStage, toStage, user, notes) {
        await client.query(`
      INSERT INTO bc_workflow_history (bc_master_id, from_stage, to_stage, changed_by, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [bcId, fromStage, toStage, user, notes]);
    }

    _calculateRiskLevel(validations) {
        const hasErrors = validations.some(v => v.severity === 'error');
        const warningCount = validations.filter(v => v.severity === 'warning').length;

        if (hasErrors) return 'high';
        if (warningCount >= 2) return 'medium';
        if (warningCount === 1) return 'low';
        return 'low';
    }

    async getBCMaster(bcId) {
        const { rows } = await db.query('SELECT * FROM bc_master WHERE id = $1', [bcId]);
        return rows[0];
    }

    async getEconomicData(bcId) {
        const { rows } = await db.query('SELECT * FROM bc_economic_data WHERE bc_master_id = $1', [bcId]);
        return rows[0];
    }

    async getOperationalData(bcId) {
        const { rows } = await db.query('SELECT * FROM bc_operational_data WHERE bc_master_id = $1', [bcId]);
        return rows[0];
    }

    async getDeterminations(bcId) {
        const { rows } = await db.query('SELECT * FROM bc_determinations WHERE bc_master_id = $1', [bcId]);
        return rows;
    }

    async getInvestments(bcId) {
        const { rows } = await db.query('SELECT * FROM bc_investments WHERE bc_master_id = $1', [bcId]);
        return rows;
    }
}

module.exports = new BusinessCaseOrchestrator();
