require("dotenv").config();

const { Client } = require("pg");
const {
  repairCertificationDriveStorage,
} = require("../src/modules/user-certifications/userCertifications.service");

const parseArgs = (argv = []) =>
  argv.reduce((acc, entry) => {
    const [rawKey, ...rest] = String(entry || "").split("=");
    const key = rawKey.replace(/^--/, "").trim();
    const value = rest.join("=").trim();
    if (key) acc[key] = value || "true";
    return acc;
  }, {});

const args = parseArgs(process.argv.slice(2));

const databaseUrl =
  args["database-url"] ||
  process.env.ACTIVE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  null;

const email = String(args.email || "").trim().toLowerCase();
const certificationId = args["certification-id"]
  ? Number.parseInt(args["certification-id"], 10)
  : null;
const fileId = String(args["file-id"] || "").trim() || null;

if (!email) {
  console.error("Uso: node scripts/repair-user-certification-drive-path.js --email=<correo> [--certification-id=14] [--file-id=<driveFileId>] [--database-url=<dsn>]");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("Falta --database-url o ACTIVE_DATABASE_URL/DATABASE_URL en el entorno.");
  process.exit(1);
}

const buildWhereClause = () => {
  const clauses = ["uc.user_id = $1", "uc.drive_file_id IS NOT NULL"];
  const params = [];

  if (Number.isFinite(certificationId) && certificationId > 0) {
    params.push(certificationId);
    clauses.push(`uc.id = $${params.length + 1}`);
  }

  if (fileId) {
    params.push(fileId);
    clauses.push(`uc.drive_file_id = $${params.length + 1}`);
  }

  return { clauses, extraParams: params };
};

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const userResult = await client.query(
      `SELECT id, email, fullname
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email],
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new Error(`Usuario no encontrado para ${email}`);
    }

    const { clauses, extraParams } = buildWhereClause();
    const recordsResult = await client.query(
      `SELECT uc.id, uc.title, uc.drive_file_id, uc.drive_folder_id, uc.file_url, uc.is_active
       FROM user_certifications uc
       WHERE ${clauses.join(" AND ")}
       ORDER BY uc.created_at DESC, uc.id DESC`,
      [user.id, ...extraParams],
    );

    if (!recordsResult.rows.length) {
      console.log(
        JSON.stringify(
          { ok: true, message: "No se encontraron certificaciones con archivo para reparar", email },
          null,
          2,
        ),
      );
      return;
    }

    const results = [];
    for (const record of recordsResult.rows) {
      const repaired = await repairCertificationDriveStorage({
        certificationId: record.id,
        userEmail: user.email,
        driveFileId: record.drive_file_id,
        dbExecutor: client,
      });

      results.push({
        certification_id: record.id,
        title: record.title,
        drive_file_id: record.drive_file_id,
        previous_drive_folder_id: record.drive_folder_id,
        ...repaired,
      });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          email: user.email,
          fullname: user.fullname,
          processed: results.length,
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error.message,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
