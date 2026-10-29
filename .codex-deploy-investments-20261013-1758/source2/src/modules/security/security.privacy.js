function getExposureMode() {
  return process.env.SECURITY_IP_EXPOSURE || 'masked';
}

const SENSITIVE_KEYS = new Set(['ip', 'ip_address', 'remote_ip', 'client_ip']);
const UA_KEYS = new Set(['user_agent', 'ua', 'useragent']);

function maskIPv4InString(str) {
  if (typeof str !== 'string') return str;
  // Enmascara cualquier IPv4 dentro del string (incluye casos con puerto)
  return str.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\b/g, '$1.xxx');
}

function truncateUA(str) {
  if (typeof str !== 'string') return str;
  return str.length > 80 ? str.slice(0, 80) + '...' : str;
}

function deepSanitize(value, { isExport = false } = {}) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(v => deepSanitize(v, { isExport }));
  }

  if (typeof value !== 'object') {
    // ✅ Máscara IPv4 en cualquier string si debe enmascarar
    const mode = getExposureMode();
    const shouldMaskAnywhere = isExport || mode !== 'full';
    if (typeof value === 'string' && shouldMaskAnywhere) {
      return maskIPv4InString(value);
    }
    return value;
  }

  const out = {};
  for (const [rawKey, rawVal] of Object.entries(value)) {
    const key = String(rawKey);
    const keyLower = key.toLowerCase();

    // Recursión primero
    let v = deepSanitize(rawVal, { isExport });

    // Reglas adicionales por clave
    if (SENSITIVE_KEYS.has(keyLower)) {
      const mode = getExposureMode();
      if (isExport || mode !== 'full') v = maskIPv4InString(v);
    }

    if (UA_KEYS.has(keyLower)) {
      v = truncateUA(v);
    }

    out[key] = v;
  }
  return out;
}

// Export SIEMPRE masked (independiente de SECURITY_IP_EXPOSURE)
function sanitizeForExportRow(row) {
  return deepSanitize(row, { isExport: true });
}

module.exports = {
  deepSanitize,
  sanitizeForExportRow,
  maskIPv4InString,
  truncateUA,
};