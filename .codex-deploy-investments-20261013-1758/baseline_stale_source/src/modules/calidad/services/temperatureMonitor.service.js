const SitradApiClient = require('../integrations/sitradApi.client');
const DataloggerParser = require('../integrations/dataloggerParser');

const TEMP_THRESHOLDS = {
  CAMARA_FRIA: { min: 2, max: 8 },
  BODEGA: { min: 15, max: 30 },
  REFRIGERADOR: { min: 2, max: 8 },
  CONGELADOR: { min: -25, max: -15 },
};

class TemperatureMonitor {
  constructor() {
    this.sitrad = new SitradApiClient();
    this.datalogger = new DataloggerParser();
    this.alarms = [];
     this.lastCheck = null;
  }

  async checkAllDevices() {
    const result = await this.sitrad.getDevices();
    const devices = result.devices || [];
    
    const checks = [];
    for (const device of devices) {
      const check = await this.checkDevice(device);
      checks.push(check);
    }
    
    this.lastCheck = new Date();
    return checks;
  }

  async checkDevice(device) {
    const current = await this.sitrad.getCurrentTemperature(device.id);
    const status = await this.sitrad.getDeviceStatus(device.id);
    
    const area = device.area || device.location || 'BODEGA';
    const thresholds = TEMP_THRESHOLDS[area] || TEMP_THRESHOLDS.BODEGA;
    
    const temp = current.temperature;
    const isExcursion = this.sitrad.isExcursion(temp, thresholds.min, thresholds.max);
    const isDeviation = this.sitrad.isDeviation(temp, thresholds.min + 1, thresholds.max - 1);
    
    return {
      deviceId: device.id,
      deviceName: device.name,
      area,
      temperature: temp,
      humidity: current.humidity,
      status: status.status,
      isExcursion,
      isDeviation,
      thresholds,
      timestamp: new Date().toISOString(),
    };
  }

  async processAlarms(assignedTo = []) {
    const result = await this.sitrad.getAlarms({ status: 'active' });
    const alarms = result.alarms || [];
    
    const processed = alarms.map(alarm => ({
      alarmId: alarm.id,
      deviceId: alarm.deviceId,
      deviceName: alarm.deviceName,
      temperature: alarm.temperature,
      threshold: alarm.threshold,
      type: alarm.type,
      startedAt: alarm.startTime,
      acknowledged: false,
      assignedTo,
    }));
    
    this.alarms = processed;
    return processed;
  }

  async acknowledgeAlarm(alarmId, userId, comment) {
    return this.sitrad.acknowledgeAlarm(alarmId, userId, comment);
  }

  async importDataloggerFile(filepath, deviceId) {
    const result = this.datalogger.parseCsvFile(filepath);
    
    const excursions = this.datalogger.detectExcursions(
      result.readings,
      TEMP_THRESHOLDS.CAMARA_FRIA.min,
      TEMP_THRESHOLDS.CAMARA_FRIA.max
    );
    
    return {
      deviceId,
      readings: result.readings,
      count: result.count,
      excursions,
      report: this.datalogger.generateReport(result.readings),
    };
  }

  getLastCheck() {
    return this.lastCheck;
  }

  getActiveAlarms() {
    return this.alarms;
  }

  isHealthy() {
    if (!this.lastCheck) return false;
    
    const timeSinceCheck = Date.now() - this.lastCheck.getTime();
    const maxAge = 5 * 60 * 1000;
    
    return timeSinceCheck < maxAge;
  }
}

module.exports = TemperatureMonitor;
module.exports.TEMP_THRESHOLDS = TEMP_THRESHOLDS;