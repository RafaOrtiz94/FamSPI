const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Repositorio de Datos - CA-01-01 (Control de Temperatura)
 * Maneja operaciones CRUD con PostgreSQL puro, asegurando UUIDs, soft_deletes
 * y acoplamiento GXP (created_by, updated_at).
 */

const createDevice = async ({ name, location, calibrationDate, calibrationDueDate, userId }) => {
  const query = `
    INSERT INTO public.ca0101_devices (name, location, calibration_date, calibration_due_date, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [name, location, calibrationDate, calibrationDueDate, userId];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const getDeviceById = async (id) => {
  const query = `
    SELECT * FROM public.ca0101_devices
    WHERE id = $1 AND deleted_at IS NULL;
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

const listDevices = async ({ status } = {}) => {
  let query = `
    SELECT * FROM public.ca0101_devices
    WHERE deleted_at IS NULL
  `;
  const values = [];
  if (status) {
    values.push(status);
    query += ` AND status = $1`;
  }
  query += ` ORDER BY created_at DESC;`;
  const { rows } = await db.query(query, values);
  return rows;
};

const softDeleteDevice = async (id) => {
  const query = `
    UPDATE public.ca0101_devices
    SET deleted_at = NOW(), status = 'retired'
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id;
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

const createReading = async ({ deviceId, temperature, humidity, recordedAt, isOutOfRange, userId }) => {
  const query = `
    INSERT INTO public.ca0101_readings (device_id, temperature, humidity, recorded_at, is_out_of_range, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [deviceId, temperature, humidity, recordedAt, isOutOfRange, userId];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const listReadingsByDevice = async (deviceId, { limit = 100, offset = 0 } = {}) => {
  const query = `
    SELECT * FROM public.ca0101_readings
    WHERE device_id = $1
    ORDER BY recorded_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await db.query(query, [deviceId, limit, offset]);
  return rows;
};

const createAlarm = async ({ readingId, alarmType, notes }, client = db) => {
  const query = `
    INSERT INTO public.ca0101_alarms (reading_id, alarm_type, notes)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const { rows } = await client.query(query, [readingId, alarmType, notes]);
  return rows[0];
};

const updateAlarmStatus = async (id, { status, notes, resolvedByUserId }, client = db) => {
  const query = `
    UPDATE public.ca0101_alarms
    SET 
      status = $2, 
      notes = COALESCE($3, notes),
      resolved_by = CASE WHEN $2 IN ('resolved', 'closed') THEN $4::uuid ELSE resolved_by END,
      resolved_at = CASE WHEN $2 IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;
  const { rows } = await client.query(query, [id, status, notes, resolvedByUserId]);
  return rows[0];
};

const listActiveAlarms = async () => {
  const query = `
    SELECT a.*, r.temperature, r.humidity, d.name as device_name, d.location
    FROM public.ca0101_alarms a
    JOIN public.ca0101_readings r ON a.reading_id = r.id
    JOIN public.ca0101_devices d ON r.device_id = d.id
    WHERE a.status IN ('open', 'acknowledged')
    ORDER BY a.created_at DESC;
  `;
  const { rows } = await db.query(query);
  return rows;
};

module.exports = {
  createDevice,
  getDeviceById,
  listDevices,
  softDeleteDevice,
  createReading,
  listReadingsByDevice,
  createAlarm,
  updateAlarmStatus,
  listActiveAlarms,
};
