const crypto = require("crypto");

const HASH_ALGORITHM = "SHA-256";

/**
 * Quita prefijo data-uri para entradas base64.
 * @param {string} rawBase64
 * @returns {string}
 */
function normalizeBase64Input(rawBase64 = "") {
  return String(rawBase64 || "").replace(/^data:[^;]+;base64,/i, "").trim();
}

/**
 * Calcula hash SHA-256 en hex desde un Buffer.
 * @param {Buffer} buffer
 * @returns {string|null}
 */
function computeSha256HexFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Calcula hash SHA-256 en hex desde un string base64.
 * @param {string} rawBase64
 * @returns {string|null}
 */
function computeSha256HexFromBase64(rawBase64 = "") {
  const normalizedBase64 = normalizeBase64Input(rawBase64);
  if (!normalizedBase64) return null;
  try {
    const buffer = Buffer.from(normalizedBase64, "base64");
    if (!buffer || buffer.length === 0) return null;
    return computeSha256HexFromBuffer(buffer);
  } catch {
    return null;
  }
}

const db = require("../config/db");

/**
 * Asegura la existencia de la tabla central de integridad.
 */
async function ensureIntegrityTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_document_integrity (
      drive_file_id TEXT PRIMARY KEY,
      content_hash_sha256 VARCHAR(64) NOT NULL,
      hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
      md5_drive VARCHAR(32),
      last_verified_at TIMESTAMPTZ DEFAULT now(),
      metadata JSONB DEFAULT '{}'::jsonb
    );
  `);
}

/**
 * Registra o actualiza la integridad de un archivo.
 */
async function registerIntegrity(fileId, { hash, algorithm, md5 }) {
  if (!fileId || !hash) return;
  await ensureIntegrityTable();
  await db.query(
    `INSERT INTO system_document_integrity (drive_file_id, content_hash_sha256, hash_algorithm, md5_drive, last_verified_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (drive_file_id) 
     DO UPDATE SET 
        content_hash_sha256 = EXCLUDED.content_hash_sha256,
        hash_algorithm = EXCLUDED.hash_algorithm,
        md5_drive = COALESCE(EXCLUDED.md5_drive, system_document_integrity.md5_drive),
        last_verified_at = now()`,
    [fileId, hash, algorithm || HASH_ALGORITHM, md5 || null]
  );
}

/**
 * Obtiene la integridad registrada para un archivo.
 */
async function getIntegrity(fileId) {
  if (!fileId) return null;
  await ensureIntegrityTable();
  const { rows } = await db.query(
    "SELECT content_hash_sha256 as hash, hash_algorithm as algorithm, md5_drive as md5 FROM system_document_integrity WHERE drive_file_id = $1",
    [fileId]
  );
  return rows[0] || null;
}

/**
 * Intenta resolver la integridad de un archivo externo en Drive.
 * @param {string} fileId 
 * @param {object} driveInstance Instancia de google.drive()
 * @returns {Promise<{hash: string, algorithm: string}|null>}
 */
async function resolveExternalDriveIntegrity(fileId, driveInstance) {
  if (!fileId || !driveInstance) return null;

  try {
    // 0. Verificar si ya existe en la tabla central
    const existing = await getIntegrity(fileId);
    if (existing) return existing;

    // 1. Intentar MD5 nativo de Drive (Instantáneo)
    const { data } = await driveInstance.files.get({
      fileId,
      fields: "md5Checksum",
      supportsAllDrives: true,
    });

    if (data.md5Checksum) {
      const result = { hash: data.md5Checksum, algorithm: "MD5-DRIVE", md5: data.md5Checksum };
      await registerIntegrity(fileId, result);
      return result;
    }

    // 2. Fallback: Calcular SHA-256 via Stream (Requiere descarga)
    const response = await driveInstance.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      response.data
        .on("data", (chunk) => hash.update(chunk))
        .on("end", async () => {
          const result = { hash: hash.digest("hex"), algorithm: "SHA-256" };
          await registerIntegrity(fileId, result);
          resolve(result);
        })
        .on("error", (err) => {
          console.error("Error streaming for hash:", err);
          resolve(null);
        });
    });
  } catch (error) {
    console.error(`Error resolving integrity for ${fileId}:`, error.message);
    return null;
  }
}

module.exports = {
  HASH_ALGORITHM,
  normalizeBase64Input,
  computeSha256HexFromBuffer,
  computeSha256HexFromBase64,
  resolveExternalDriveIntegrity,
  registerIntegrity,
  getIntegrity,
  ensureIntegrityTable,
};
