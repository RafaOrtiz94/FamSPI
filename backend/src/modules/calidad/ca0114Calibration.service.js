const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const CALIBRATION_SCHEMA = Joi.object({
  equipmentId: Joi.string().uuid().required(),
  equipmentName: Joi.string().required(),
  equipmentType: Joi.string().valid(
    'TERMOMETRO', 'TERMOHIGROMETRO', 'DATALOGGER', 'SITRAD', 'Balanza'
  ).required(),
  calibrationDate: Joi.date().required(),
  calibrationDueDate: Joi.date().required(),
  certificateNumber: Joi.string().allow('', null),
  certificateUrl: Joi.string().allow('', null),
  provider: Joi.string().allow('', null),
  result: Joi.string().valid('APROBADO', 'RECHAZADO', 'AJUSTE').required(),
  error_readings: Joi.number().allow(null),
  notes: Joi.string().allow('', null),
});

const MAINTENANCE_SCHEMA = Joi.object({
  equipmentId: Joi.string().uuid().required(),
  maintenanceType: Joi.string().valid(
    'PREVENTIVO', 'CORRECTIVO', 'CALIBRACION', 'CUALIFICACION'
  ).required(),
  scheduledDate: Joi.date().required(),
  completedDate: Joi.date().allow(null),
  provider: Joi.string().allow('', null),
  cost: Joi.number().allow(null),
  result: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  nextMaintenanceDate: Joi.date().allow(null),
});

class CalibrationService {
  constructor(pool) {
    this.pool = pool;
  }

  async getEquipment() {
    const result = await this.pool.query(`
      SELECT 
        e.*,
        c.id as current_calibration_id,
        c.calibration_date,
        c.calibration_due_date,
        c.certificate_number,
        c.result as calibration_result,
        m.id as last_maintenance_id,
        m.maintenance_type as last_maintenance_type,
        m.completed_date as last_maintenance_date
      FROM public.ca0114_equipment e
      LEFT JOIN LATERAL (
        SELECT * FROM public.ca0114_calibrations
        WHERE equipment_id = e.id
        ORDER BY calibration_date DESC
        LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT * FROM public.ca0114_maintenance
        WHERE equipment_id = e.id
        ORDER BY scheduled_date DESC
        LIMIT 1
      ) m ON true
      WHERE e.deleted_at IS NULL
      ORDER BY e.name
    `);
    return result.rows;
  }

  async getEquipmentById(id) {
    const result = await this.pool.query(`
      SELECT * FROM public.ca0114_equipment
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    return result.rows[0];
  }

  async createEquipment(data) {
    const { error, value } = Joi.object({
      name: Joi.string().required(),
      code: Joi.string().required(),
      type: Joi.string().required(),
      location: Joi.string().required(),
      calibrationFrequency: Joi.number().integer().default(365),
    }).validate(data);

    if (error) throw error;

    const result = await this.pool.query(`
      INSERT INTO public.ca0114_equipment (
        name, code, type, location, calibration_frequency_days,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [value.name, value.code, value.type, value.location, 
       value.calibrationFrequency, data.userId]);

    return result.rows[0];
  }

  async recordCalibration(data) {
    const { error, value } = CALIBRATION_SCHEMA.validate({
      ...data,
      calibrationDate: new Date(data.calibrationDate),
      calibrationDueDate: new Date(data.calibrationDueDate),
    });

    if (error) throw error;

    const result = await this.pool.query(`
      INSERT INTO public.ca0114_calibrations (
        equipment_id, calibration_date, calibration_due_date,
        certificate_number, certificate_url, provider, result,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      value.equipmentId,
      value.calibrationDate,
      value.calibrationDueDate,
      value.certificateNumber,
      value.certificateUrl,
      value.provider,
      value.result,
      value.notes,
      data.userId,
    ]);

    if (value.calibrationDate) {
      await this.pool.query(`
        UPDATE public.ca0114_equipment
        SET calibration_date = $1, calibration_due_date = $2, updated_at = NOW()
        WHERE id = $3
      `, [value.calibrationDate, value.calibrationDueDate, value.equipmentId]);
    }

    return result.rows[0];
  }

  async getDueCalibrations(daysAhead = 30) {
    const result = await this.pool.query(`
      SELECT 
        e.*,
        c.calibration_date,
        c.calibration_due_date,
        c.calibration_due_date - NOW() as days_until_due
      FROM public.ca0114_equipment e
      JOIN public.ca0114_calibrations c ON c.equipment_id = e.id
      WHERE e.deleted_at IS NULL
        AND c.calibration_due_date <= NOW() + ($1 || ' days')::INTERVAL
        AND c.calibration_due_date >= NOW()
      ORDER BY c.calibration_due_date
    `, [daysAhead]);

    return result.rows;
  }

  async getOverdueCalibrations() {
    const result = await this.pool.query(`
      SELECT 
        e.*,
        c.calibration_date,
        c.calibration_due_date
      FROM public.ca0114_equipment e
      JOIN public.ca0114_calibrations c ON c.equipment_id = e.id
      WHERE e.deleted_at IS NULL
        AND c.calibration_due_date < NOW()
      ORDER BY c.calibration_due_date
    `);

    return result.rows;
  }

  async scheduleMaintenance(data) {
    const { error, value } = MAINTENANCE_SCHEMA.validate({
      ...data,
      scheduledDate: new Date(data.scheduledDate),
      completedDate: data.completedDate ? new Date(data.completedDate) : null,
      nextMaintenanceDate: data.nextMaintenanceDate 
        ? new Date(data.nextMaintenanceDate) 
        : null,
    });

    if (error) throw error;

    const result = await this.pool.query(`
      INSERT INTO public.ca0114_maintenance (
        equipment_id, maintenance_type, scheduled_date, completed_date,
        provider, cost, result, notes, next_maintenance_date,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      value.equipmentId,
      value.maintenanceType,
      value.scheduledDate,
      value.completedDate,
      value.provider,
      value.cost,
      value.result,
      value.notes,
      value.nextMaintenanceDate,
      data.userId,
    ]);

    return result.rows[0];
  }

  async getUpcomingMaintenance(daysAhead = 30) {
    const result = await this.pool.query(`
      SELECT 
        m.*,
        e.name as equipment_name,
        e.code as equipment_code,
        e.location as equipment_location
      FROM public.ca0114_maintenance m
      JOIN public.ca0114_equipment e ON e.id = m.equipment_id
      WHERE e.deleted_at IS NULL
        AND m.completed_date IS NULL
        AND m.scheduled_date <= NOW() + ($1 || ' days')::INTERVAL
        AND m.scheduled_date >= NOW()
      ORDER BY m.scheduled_date
    `, [daysAhead]);

    return result.rows;
  }

  async generateCertificateReport(equipmentId) {
    const calibrations = await this.pool.query(`
      SELECT * FROM public.ca0114_calibrations
      WHERE equipment_id = $1
      ORDER BY calibration_date DESC
      LIMIT 10
    `, [equipmentId]);

    const equipment = await this.getEquipmentById(equipmentId);

    return {
      equipment,
      calibrations: calibrations.rows,
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = CalibrationService;
