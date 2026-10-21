const fs = require('fs');
const path = require('path');

class DataloggerParser {
  constructor(options = {}) {
    this.separator = options.separator || ',';
    this.hasHeader = options.hasHeader !== false;
  }

  parseCsvFile(filepath) {
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return this.parseCsv(content);
    } catch (error) {
      console.error('[DataloggerParser] Error reading file:', error.message);
      return { readings: [], error: error.message };
    }
  }

  parseCsv(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const readings = [];
    
    let startIndex = this.hasHeader ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseLine(line);
      if (values.length >= 2) {
        readings.push(this.mapToReading(values));
      }
    }
    
    return { readings, count: readings.length };
  }

  parseLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === this.separator && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    return values;
  }

  mapToReading(values) {
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\d{2}-\d{2}-\d{4}/,
    ];
    
    let timestamp = values[0];
    let temperature = values[1];
    let humidity = values[2] || null;
    
    if (dateFormats.some(regex => regex.test(timestamp))) {
      try {
        timestamp = new Date(timestamp).toISOString();
      } catch {
        timestamp = new Date().toISOString();
      }
    }
    
    try {
      temperature = parseFloat(temperature);
    } catch {
      temperature = null;
    }
    
    if (humidity) {
      try {
        humidity = parseFloat(humidity);
      } catch {
        humidity = null;
      }
    }
    
    return {
      timestamp,
      temperature,
      humidity,
      source: 'datalogger',
    };
  }

  compareWithManual(dataloggerReading, manualReading, tolerance = 0.5) {
    if (!dataloggerReading || !manualReading) {
      return { valid: false, reason: 'Missing reading' };
    }
    
    const dlTime = new Date(dataloggerReading.timestamp).getTime();
    const manTime = new Date(manualReading.timestamp).getTime();
    const timeDiff = Math.abs(dlTime - manTime);
    
    const tempDiff = Math.abs(
      dataloggerReading.temperature - manualReading.temperature
    );
    
    const timeDiffMinutes = timeDiff / (1000 * 60);
    
    return {
      valid: tempDiff <= tolerance,
      temperatureDiff: tempDiff,
      timeDiffMinutes,
      status: tempDiff <= tolerance ? 'OK' : 'DISCREPANCY',
    };
  }

  detectExcursions(readings, minTemp = 2, maxTemp = 8) {
    const excursions = [];
    
    for (let i = 0; i < readings.length; i++) {
      const reading = readings[i];
      if (reading.temperature < minTemp || reading.temperature > maxTemp) {
        excursions.push({
          index: i,
          timestamp: reading.timestamp,
          temperature: reading.temperature,
          type: reading.temperature < minTemp ? 'UNDER_TEMP' : 'OVER_TEMP',
          deviation: reading.temperature < minTemp 
            ? minTemp - reading.temperature 
            : reading.temperature - maxTemp,
        });
      }
    }
    
    return excursions;
  }

  generateReport(readings, options = {}) {
    const { minTemp = 2, maxTemp = 8 } = options;
    
    const temperatures = readings
      .map(r => r.temperature)
      .filter(t => t !== null);
    
    const excursions = this.detectExcursions(readings, minTemp, maxTemp);
    
    return {
      summary: {
        totalReadings: readings.length,
        minTemperature: Math.min(...temperatures),
        maxTemperature: Math.max(...temperatures),
        avgTemperature: temperatures.reduce((a, b) => a + b, 0) / temperatures.length,
        excursionCount: excursions.length,
        startTime: readings[0]?.timestamp,
        endTime: readings[readings.length - 1]?.timestamp,
      },
      excursions: excursions.slice(0, 100),
    };
  }
}

module.exports = DataloggerParser;