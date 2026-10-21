#!/usr/bin/env node
 
const { Client } = require("pg");

const TZ = process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags = {};
  for (const raw of args) {
    if (!raw.startsWith("--")) continue;
    const [k, v] = raw.replace(/^--/, "").split("=");
    flags[k] = v === undefined ? true : v;
  }
  return flags;
};

const createClient = () => {
  if (process.env.DATABASE_URL) {
    const useSsl = /sslmode=require/i.test(process.env.DATABASE_URL);
    return new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "spi_fam",
    ssl:
      String(process.env.DB_SSL || "").toLowerCase() === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
};

const resolveDefaultCutoff = async (client) => {
  const { rows } = await client.query(
    `SELECT ((NOW() AT TIME ZONE $1)::date - INTERVAL '2 day')::date AS cutoff`,
    [TZ],
  );
  return rows[0].cutoff;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
};

const jsonLog = (payload) => {
  console.log(JSON.stringify(payload, null, 2));
};

const GEO_TEXT_TARGETS = [
  ["user_attendance_records", "entry_location", "date"],
  ["user_attendance_records", "lunch_start_location", "date"],
  ["user_attendance_records", "lunch_end_location", "date"],
  ["user_attendance_records", "exit_location", "date"],
  ["attendance_exceptions", "start_location", "date"],
  ["attendance_exceptions", "arrival_location", "date"],
  ["attendance_exceptions", "departure_location", "date"],
  ["attendance_exceptions", "return_location", "date"],
];

const GEO_NUMERIC_TARGETS = [
  ["client_visit_logs", "lat_entrada", "lng_entrada", "visit_date"],
  ["client_visit_logs", "lat_salida", "lng_salida", "visit_date"],
  ["prospect_visits", "check_in_lat", "check_in_lng", "visit_date"],
  ["prospect_visits", "check_out_lat", "check_out_lng", "visit_date"],
];

const PURGE_TARGETS = [
  ["attendance_late_justifications", "attendance_date"],
  ["attendance_overtime", "date"],
  ["attendance_exceptions", "date"],
  ["user_attendance_records", "date"],
  ["client_visit_logs", "visit_date"],
  ["prospect_visits", "visit_date"],
];

const sanitizeGeo = async ({ client, apply, cutoff }) => {
  const report = {
    action: "geo-sanitize",
    apply,
    timezone: TZ,
    cutoff,
    textTargets: [],
    numericTargets: [],
  };

  for (const [table, column, dateColumn] of GEO_TEXT_TARGETS) {
    const countSql = `
      WITH parsed AS (
        SELECT
          id,
          regexp_match(
            btrim(${column}),
            '^([+-]?\\d+(?:\\.\\d+)?)\\s*,\\s*([+-]?\\d+(?:\\.\\d+)?)$'
          ) AS m
        FROM ${table}
        WHERE ${dateColumn} <= $1::date
          AND ${column} IS NOT NULL
          AND btrim(${column}) <> ''
      )
      SELECT COUNT(*)::int AS c
      FROM parsed
      WHERE m IS NULL
         OR abs((m)[1]::double precision) > 90
         OR abs((m)[2]::double precision) > 180
         OR (
              abs((m)[1]::double precision) <= 0.0005
          AND abs((m)[2]::double precision) <= 0.0005
         )
    `;

    const { rows } = await client.query(countSql, [cutoff]);
    const invalidCount = Number(rows[0].c || 0);
    let updated = 0;

    if (apply && invalidCount > 0) {
      const updateSql = `
        WITH invalid_rows AS (
          SELECT
            id
          FROM (
            SELECT
              id,
              regexp_match(
                btrim(${column}),
                '^([+-]?\\d+(?:\\.\\d+)?)\\s*,\\s*([+-]?\\d+(?:\\.\\d+)?)$'
              ) AS m
            FROM ${table}
            WHERE ${dateColumn} <= $1::date
              AND ${column} IS NOT NULL
              AND btrim(${column}) <> ''
          ) s
          WHERE m IS NULL
             OR abs((m)[1]::double precision) > 90
             OR abs((m)[2]::double precision) > 180
             OR (
                  abs((m)[1]::double precision) <= 0.0005
              AND abs((m)[2]::double precision) <= 0.0005
             )
        )
        UPDATE ${table} t
           SET ${column} = NULL,
               updated_at = NOW()
          FROM invalid_rows i
         WHERE t.id = i.id
      `;
      const res = await client.query(updateSql, [cutoff]);
      updated = res.rowCount || 0;
    }

    report.textTargets.push({ table, column, invalidCount, updated });
  }

  for (const [table, lat, lng, dateColumn] of GEO_NUMERIC_TARGETS) {
    const countSql = `
      SELECT COUNT(*)::int AS c
      FROM ${table}
      WHERE ${dateColumn} <= $1::date
        AND ${lat} IS NOT NULL
        AND ${lng} IS NOT NULL
        AND (
          abs(${lat}) > 90
          OR abs(${lng}) > 180
          OR (abs(${lat}) <= 0.0005 AND abs(${lng}) <= 0.0005)
        )
    `;
    const { rows } = await client.query(countSql, [cutoff]);
    const invalidCount = Number(rows[0].c || 0);
    let updated = 0;

    if (apply && invalidCount > 0) {
      const updateSql = `
        UPDATE ${table}
           SET ${lat} = NULL,
               ${lng} = NULL,
               updated_at = NOW()
         WHERE ${dateColumn} <= $1::date
           AND ${lat} IS NOT NULL
           AND ${lng} IS NOT NULL
           AND (
             abs(${lat}) > 90
             OR abs(${lng}) > 180
             OR (abs(${lat}) <= 0.0005 AND abs(${lng}) <= 0.0005)
           )
      `;
      const res = await client.query(updateSql, [cutoff]);
      updated = res.rowCount || 0;
    }

    report.numericTargets.push({ table, lat, lng, invalidCount, updated });
  }

  return report;
};

const purgeRange = async ({ client, apply, startDate, endDate }) => {
  const report = {
    action: "purge-range",
    apply,
    timezone: TZ,
    startDate,
    endDate,
    tables: [],
  };

  for (const [table, dateColumn] of PURGE_TARGETS) {
    const before = await client.query(
      `SELECT COUNT(*)::int AS c FROM ${table} WHERE ${dateColumn} BETWEEN $1::date AND $2::date`,
      [startDate, endDate],
    );
    const beforeCount = Number(before.rows[0].c || 0);
    let deleted = 0;

    if (apply && beforeCount > 0) {
      const del = await client.query(
        `DELETE FROM ${table} WHERE ${dateColumn} BETWEEN $1::date AND $2::date`,
        [startDate, endDate],
      );
      deleted = del.rowCount || 0;
    }

    const after = await client.query(
      `SELECT COUNT(*)::int AS c FROM ${table} WHERE ${dateColumn} BETWEEN $1::date AND $2::date`,
      [startDate, endDate],
    );
    const afterCount = Number(after.rows[0].c || 0);
    report.tables.push({ table, dateColumn, before: beforeCount, deleted, after: afterCount });
  }

  return report;
};

const main = async () => {
  const args = parseArgs();
  const action = String(args.action || "").trim().toLowerCase() || "geo-sanitize";
  const apply = String(args.apply || "").toLowerCase() === "true";

  const client = createClient();
  await client.connect();

  try {
    const cutoff = normalizeDate(args.cutoffDate) || (await resolveDefaultCutoff(client));
    const endDate = normalizeDate(args.endDate) || cutoff;
    const startDate = normalizeDate(args.startDate) || "1900-01-01";

    await client.query("BEGIN");
    let report;

    if (action === "geo-sanitize") {
      report = await sanitizeGeo({ client, apply, cutoff });
    } else if (action === "purge-range") {
      report = await purgeRange({ client, apply, startDate, endDate });
    } else {
      throw new Error(`Unsupported action: ${action}`);
    }

    if (apply) {
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }

    jsonLog({
      ok: true,
      executedAt: new Date().toISOString(),
      action,
      apply,
      timezone: TZ,
      report,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    jsonLog({
      ok: false,
      executedAt: new Date().toISOString(),
      action,
      apply,
      error: error.message || String(error),
    });
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

main();
