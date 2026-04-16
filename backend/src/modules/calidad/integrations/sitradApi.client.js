const axios = require('axios');

const SITRAD_CONFIG = {
  baseUrl: process.env.SITRAD_BASE_URL || 'http://localhost:8080/api',
  apiKey: process.env.SITRAD_API_KEY,
  timeout: parseInt(process.env.SITRAD_TIMEOUT || '30000'),
};

class SitradApiClient {
  constructor(config = {}) {
    this.config = { ...SITRAD_CONFIG, ...config };
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
      },
    });
  }

  async getDevices() {
    try {
      const response = await this.client.get('/devices');
      return response.data;
    } catch (error) {
      console.error('[SitradApi] Error fetching devices:', error.message);
      return { devices: [], error: error.message };
    }
  }

  async getDeviceTemperatures(deviceId, options = {}) {
    const { startDate, endDate, limit = 1000 } = options;
    try {
      const params = { limit };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const response = await this.client.get(`/devices/${deviceId}/temperatures`, { params });
      return response.data;
    } catch (error) {
      console.error('[SitradApi] Error fetching temperatures:', error.message);
      return { readings: [], error: error.message };
    }
  }

  async getAlarms(options = {}) {
    const { status, startDate, limit = 100 } = options;
    try {
      const params = { limit };
      if (status) params.status = status;
      if (startDate) params.startDate = startDate;
      
      const response = await this.client.get('/alarms', { params });
      return response.data;
    } catch (error) {
      console.error('[SitradApi] Error fetching alarms:', error.message);
      return { alarms: [], error: error.message };
    }
  }

  async acknowledgeAlarm(alarmId, userId, comment) {
    try {
      const response = await this.client.post(`/alarms/${alarmId}/acknowledge`, {
        userId,
        comment,
        acknowledgedAt: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('[SitradApi] Error acknowledging alarm:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getCurrentTemperature(deviceId) {
    try {
      const response = await this.client.get(`/devices/${deviceId}/current`);
      return response.data;
    } catch (error) {
      console.error('[SitradApi] Error fetching current temp:', error.message);
      return { temperature: null, error: error.message };
    }
  }

  async getDeviceStatus(deviceId) {
    try {
      const response = await this.client.get(`/devices/${deviceId}/status`);
      return response.data;
    } catch (error) {
      console.error('[SitradApi] Error fetching device status:', error.message);
      return { status: 'unknown', error: error.message };
    }
  }

  parseTemperatureReading(reading) {
    return {
      deviceId: reading.deviceId || reading.device_id,
      temperature: parseFloat(reading.temperature || reading.temp),
      humidity: reading.humidity ? parseFloat(reading.humidity) : null,
      timestamp: reading.timestamp || reading.datetime || reading.date,
      status: reading.status || 'normal',
    };
  }

  isExcursion(temp, minThreshold = 2, maxThreshold = 8) {
    return temp < minThreshold || temp > maxThreshold;
  }

  isDeviation(temp, minThreshold = 3, maxThreshold = 7) {
    return temp < minThreshold || temp > maxThreshold;
  }
}

module.exports = SitradApiClient;
module.exports.SITRAD_CONFIG = SITRAD_CONFIG;