const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");

const logger = require("../config/logger");
const { ensureFolder } = require("../utils/drive");
const { drive } = require("../config/google");

const BACKUP_FOLDER_NAME = String(process.env.DB_BACKUP_FOLDER_NAME || "Backup Base").trim() || "Backup Base";
const BACKUP_ROOT_FOLDER_ID = process.env.DB_BACKUP_DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID || null;
const BACKUP_TZ =
  process.env.DB_BACKUP_TIMEZONE ||
  process.env.APP_TIMEZONE ||
  process.env.GOOGLE_CALENDAR_TZ ||
  "America/Guayaquil";
const BACKUP_INTERVAL_HOURS = Math.max(1, Number(process.env.DB_BACKUP_INTERVAL_HOURS || 24));
const BACKUP_AUTO_ENABLED =
  String(process.env.DB_BACKUP_AUTO_ENABLED || "false").trim().toLowerCase() === "true";

let backupInterval = null;

function fmtBackupTimestamp(date = new Date(), timeZone = BACKUP_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    compact: `${map.year}${map.month}${map.day}_${map.hour}${map.minute}${map.second}`,
    dateOnly: `${map.year}-${map.month}-${map.day}`,
    isoLike: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`,
  };
}

function resolveDbConfig() {
  if (process.env.DATABASE_URL) {
    const parsed = new URL(process.env.DATABASE_URL);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      user: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    };
  }
  return {
    host: process.env.DB_HOST || "",
    port: String(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "",
  };
}

function validateDbConfig(config) {
  const missing = ["host", "port", "user", "password", "database"].filter((key) => !String(config[key] || "").trim());
  if (missing.length) {
    const error = new Error(
      `No se pudo ejecutar backup de BD. Variables faltantes: ${missing.join(", ")}`,
    );
    error.code = "DB_BACKUP_CONFIG_MISSING";
    throw error;
  }
}

async function runPgDumpToFile(filePath, dbConfig) {
  const args = [
    "--no-owner",
    "--no-privileges",
    "--format=plain",
    "--encoding=UTF8",
    "--host",
    dbConfig.host,
    "--port",
    String(dbConfig.port),
    "--username",
    dbConfig.user,
    "--dbname",
    dbConfig.database,
  ];

  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
    PGSSLMODE: String(process.env.DB_SSL || "").toLowerCase() === "true" ? "require" : "prefer",
  };

  const child = spawn("pg_dump", args, { env, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk || "");
  });

  const gzip = zlib.createGzip({ level: 9 });
  const out = fs.createWriteStream(filePath);
  const pipePromise = pipeline(child.stdout, gzip, out);
  const exitPromise = new Promise((resolve, reject) => {
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const stderrText = String(stderr || "").trim();
      const hasVersionMismatch = /server version mismatch/i.test(stderrText);
      const err = new Error(
        hasVersionMismatch
          ? `pg_dump incompatible con la version del servidor. ${stderrText}. Usa postgresql-client mayor o igual al servidor (actualmente recomendado: 17).`
          : `pg_dump terminó con código ${code}${stderrText ? `: ${stderrText}` : ""}`,
      );
      err.code = "PG_DUMP_FAILED";
      return reject(err);
    });
  });

  try {
    await Promise.all([pipePromise, exitPromise]);
  } catch (error) {
    if (error?.code === "ENOENT") {
      const toolError = new Error(
        "No se encontró 'pg_dump' en el contenedor. Instala postgresql-client en la imagen.",
      );
      toolError.code = "PG_DUMP_NOT_FOUND";
      throw toolError;
    }
    throw error;
  }
}

async function uploadBackupToDrive({ localPath, fileName, parentFolderId }) {
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    media: {
      mimeType: "application/gzip",
      body: fs.createReadStream(localPath),
    },
    fields: "id,name,webViewLink,webContentLink,size,createdTime",
  });
  return data;
}

async function runOnce() {
  const startedAt = new Date();
  if (!BACKUP_ROOT_FOLDER_ID) {
    const error = new Error(
      "No hay carpeta raíz para backups. Configura DB_BACKUP_DRIVE_ROOT_FOLDER_ID o DRIVE_ROOT_FOLDER_ID.",
    );
    error.code = "BACKUP_ROOT_FOLDER_MISSING";
    throw error;
  }

  const dbConfig = resolveDbConfig();
  validateDbConfig(dbConfig);

  const stamp = fmtBackupTimestamp(startedAt, BACKUP_TZ);
  const safeDbName = String(dbConfig.database).replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `db-backup-${safeDbName}-${stamp.compact}.sql.gz`;
  const localPath = path.join("/tmp", fileName);

  logger.info(
    {
      dbHost: dbConfig.host,
      dbName: dbConfig.database,
      rootFolderId: BACKUP_ROOT_FOLDER_ID,
      backupFolderName: BACKUP_FOLDER_NAME,
      tz: BACKUP_TZ,
      startedAt: stamp.isoLike,
    },
    "[DB_BACKUP] Iniciando respaldo de base de datos",
  );

  try {
    await runPgDumpToFile(localPath, dbConfig);
    const stat = await fs.promises.stat(localPath);

    const backupFolder = await ensureFolder(BACKUP_FOLDER_NAME, BACKUP_ROOT_FOLDER_ID);
    const uploaded = await uploadBackupToDrive({
      localPath,
      fileName,
      parentFolderId: backupFolder?.id || BACKUP_ROOT_FOLDER_ID,
    });

    logger.info(
      {
        backupFileName: fileName,
        localBytes: stat.size,
        driveFileId: uploaded?.id || null,
        driveLink: uploaded?.webViewLink || null,
      },
      "[DB_BACKUP] Respaldo completado y cargado en Drive",
    );

    return {
      success: true,
      folder_name: BACKUP_FOLDER_NAME,
      folder_id: backupFolder?.id || BACKUP_ROOT_FOLDER_ID,
      file_name: fileName,
      size_bytes: stat.size,
      drive_file_id: uploaded?.id || null,
      drive_file_link: uploaded?.webViewLink || uploaded?.webContentLink || null,
      created_at: startedAt.toISOString(),
    };
  } finally {
    await fs.promises.rm(localPath, { force: true }).catch(() => {});
  }
}

function startDatabaseBackupJob() {
  if (backupInterval) return;
  if (!BACKUP_AUTO_ENABLED) {
    logger.info("[DB_BACKUP] Scheduler interno deshabilitado (DB_BACKUP_AUTO_ENABLED=false)");
    return;
  }

  const intervalMs = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;
  logger.info(
    { everyHours: BACKUP_INTERVAL_HOURS, tz: BACKUP_TZ },
    "[DB_BACKUP] Scheduler interno habilitado",
  );

  runOnce().catch((error) => {
    logger.error({ error: error?.message }, "[DB_BACKUP] Error en respaldo inicial");
  });

  backupInterval = setInterval(() => {
    runOnce().catch((error) => {
      logger.error({ error: error?.message }, "[DB_BACKUP] Error en respaldo programado");
    });
  }, intervalMs);
}

module.exports = {
  runOnce,
  startDatabaseBackupJob,
};
