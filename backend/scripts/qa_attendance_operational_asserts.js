#!/usr/bin/env node
"use strict";

const { Client } = require("pg");

const DB_HOST = process.env.DB_HOST || "ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech";
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USER = process.env.DB_USER || "neondb_owner";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "FamSPI";
const DB_SSL = String(process.env.DB_SSL || "true") === "true";
const DB_SSL_REJECT_UNAUTHORIZED = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false") === "true";

const ATTENDANCE_LUNCH_START = process.env.ATTENDANCE_LUNCH_START || "13:00";
const ATTENDANCE_WORKING_DAY_END = process.env.ATTENDANCE_WORKING_DAY_END || "18:00";

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const lunchStartMinutes = toMinutes(ATTENDANCE_LUNCH_START);
const workEndMinutes = toMinutes(ATTENDANCE_WORKING_DAY_END);

const printHeader = (title) => {
  console.log("");
  console.log("=".repeat(90));
  console.log(title);
  console.log("=".repeat(90));
};

async function main() {
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: DB_SSL ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED } : undefined,
  });

  await client.connect();

  try {
    printHeader("QA Attendance Assertions (operacional/imprevista) - today");
    console.log(
      JSON.stringify(
        {
          dbHost: DB_HOST,
          dbName: DB_NAME,
          lunchStart: ATTENDANCE_LUNCH_START,
          workDayEnd: ATTENDANCE_WORKING_DAY_END,
        },
        null,
        2
      )
    );

    const colRes = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'attendance_exceptions'
      `
    );
    const availableCols = new Set(colRes.rows.map((r) => String(r.column_name)));
    const closeCandidates = ["return_time", "end_time", "departure_time"];
    const presentCloseCols = closeCandidates.filter((c) => availableCols.has(c));
    const closeExpr =
      presentCloseCols.length > 0
        ? `COALESCE(${presentCloseCols.map((c) => `ae.${c}`).join(", ")})`
        : "NULL::timestamptz";

    const { rows } = await client.query(
      `
      WITH ex AS (
        SELECT
          ae.id AS exception_id,
          ae.user_id,
          ae.date::date AS business_date,
          LOWER(COALESCE(ae.type, '')) AS exception_type,
          ae.status,
          ae.start_time,
          ${closeExpr} AS flow_close_time
        FROM attendance_exceptions ae
        WHERE ae.date::date = CURRENT_DATE
          AND LOWER(COALESCE(ae.type, '')) IN ('operacion_campo', 'imprevisto')
      )
      SELECT
        ex.exception_id,
        ex.user_id,
        ex.business_date,
        ex.exception_type,
        ex.status,
        ex.start_time,
        ex.flow_close_time,
        uar.entry_time,
        uar.lunch_start_time,
        uar.lunch_end_time,
        uar.exit_time
      FROM ex
      LEFT JOIN user_attendance_records uar
        ON uar.user_id = ex.user_id
       AND uar.date::date = ex.business_date
      ORDER BY ex.user_id, ex.start_time NULLS LAST, ex.exception_id;
      `
    );

    if (!rows.length) {
      console.log("No hay excepciones operacionales/imprevistas hoy. Sin muestra para evaluar.");
      return;
    }

    let total = 0;
    let passed = 0;

    for (const r of rows) {
      const start = r.start_time ? new Date(r.start_time) : null;
      const close = r.flow_close_time ? new Date(r.flow_close_time) : null;

      const startMin = start ? start.getUTCHours() * 60 + start.getUTCMinutes() : null;
      const closeMin = close ? close.getUTCHours() * 60 + close.getUTCMinutes() : null;

      const shouldLunchSeed =
        lunchStartMinutes != null && startMin != null && startMin < lunchStartMinutes;
      const shouldExitMirror = workEndMinutes != null && closeMin != null && closeMin >= workEndMinutes;

      const hasLunchWindow = Boolean(r.lunch_start_time && r.lunch_end_time);
      const hasExit = Boolean(r.exit_time);

      const checks = [];

      if (shouldLunchSeed) {
        total += 1;
        if (hasLunchWindow) {
          passed += 1;
          checks.push("PASS lunch_autofill_before_lunch");
        } else {
          checks.push("FAIL lunch_autofill_before_lunch");
        }
      } else {
        checks.push("SKIP lunch_autofill_before_lunch");
      }

      if (shouldExitMirror) {
        total += 1;
        if (hasExit) {
          passed += 1;
          checks.push("PASS normal_exit_autoclose_after_work_end");
        } else {
          checks.push("FAIL normal_exit_autoclose_after_work_end");
        }
      } else {
        checks.push("SKIP normal_exit_autoclose_after_work_end");
      }

      console.log(
        [
          `exception_id=${r.exception_id}`,
          `user_id=${r.user_id}`,
          `date=${String(r.business_date).slice(0, 10)}`,
          `type=${r.exception_type}`,
          `status=${r.status}`,
          `entry=${r.entry_time || "null"}`,
          `lunch_start=${r.lunch_start_time || "null"}`,
          `lunch_end=${r.lunch_end_time || "null"}`,
          `exit=${r.exit_time || "null"}`,
          `=> ${checks.join(" | ")}`,
        ].join(" | ")
      );
    }

    printHeader("Resumen");
    console.log(`Checks ejecutados: ${total}`);
    console.log(`Checks PASS: ${passed}`);
    console.log(`Checks FAIL: ${total - passed}`);
    console.log(`Resultado global: ${total === passed ? "PASS" : "FAIL"}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("QA script failed:", err.message);
  process.exit(1);
});
