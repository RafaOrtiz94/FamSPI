"use strict";
/**
 * Restaura un dump plano de pg_dump (.sql o .sql.gz) contra un host/base
 * destino, sin depender de psql (no siempre esta instalado localmente).
 * Soporta bloques `COPY ... FROM stdin;` via pg-copy-streams.
 *
 * Uso:
 *   DB_HOST=... DB_PORT=5432 DB_USER=neondb_owner DB_PASSWORD=... DB_NAME=neondb \
 *   node backend/scripts/restore_pg_dump.js /ruta/al/dump.sql.gz
 *
 * Requiere pg-copy-streams instalado (npm install pg-copy-streams --no-save
 * si no esta ya en node_modules).
 *
 * Ver: .agents/skills/neon-compute-quota-failover-skill.md
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { Client } = require("pg");
const { from: copyFrom } = require("pg-copy-streams");
const { Readable } = require("stream");

function parseDump(text) {
  const lines = text.split("\n");
  const actions = [];
  let sqlBuf = [];
  let i = 0;

  const flushSql = () => {
    const chunk = sqlBuf.join("\n").trim();
    if (chunk) actions.push({ type: "sql", sql: chunk });
    sqlBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    // \restrict / \unrestrict son meta-comandos de psql (pg_dump 17+),
    // no son SQL valido -- se descartan.
    if (line.startsWith("\\restrict") || line.startsWith("\\unrestrict")) {
      i++;
      continue;
    }
    const copyMatch = line.match(/^COPY\s+.+\s+FROM\s+stdin;\s*$/i);
    if (copyMatch) {
      flushSql();
      const copySql = line.trim();
      i++;
      const dataLines = [];
      while (i < lines.length && lines[i] !== "\\.") {
        dataLines.push(lines[i]);
        i++;
      }
      i++; // skip \.
      actions.push({
        type: "copy",
        sql: copySql,
        data: dataLines.join("\n") + (dataLines.length ? "\n" : ""),
      });
      continue;
    }
    sqlBuf.push(line);
    i++;
  }
  flushSql();
  return actions;
}

async function runCopy(client, action) {
  return new Promise((resolve, reject) => {
    const stream = client.query(copyFrom(action.sql));
    stream.on("error", reject);
    stream.on("finish", resolve);
    Readable.from([action.data]).pipe(stream);
  });
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error("Uso: node restore_pg_dump.js /ruta/al/dump.sql[.gz]");
    process.exit(1);
  }
  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("Faltan variables de entorno:", missing.join(", "));
    process.exit(1);
  }

  console.log("Leyendo dump...");
  const raw = fs.readFileSync(dumpPath);
  const text = dumpPath.endsWith(".gz") ? zlib.gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  console.log(`Dump: ${(text.length / 1024 / 1024).toFixed(1)} MB de texto`);

  console.log("Parseando...");
  const actions = parseDump(text);
  const copyCount = actions.filter((a) => a.type === "copy").length;
  const sqlCount = actions.filter((a) => a.type === "sql").length;
  console.log(`Acciones: ${sqlCount} bloques SQL, ${copyCount} bloques COPY`);

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 0,
    query_timeout: 0,
  });
  await client.connect();
  console.log(`Conectado a ${process.env.DB_HOST}/${process.env.DB_NAME}. Iniciando restore...`);

  let done = 0;
  const total = actions.length;
  const errors = [];
  for (const action of actions) {
    try {
      if (action.type === "sql") {
        await client.query(action.sql);
      } else {
        await runCopy(client, action);
      }
    } catch (err) {
      errors.push({ type: action.type, sqlPreview: action.sql.slice(0, 200), error: err.message });
      console.error(`ERROR en accion ${done + 1}/${total} (${action.type}):`, err.message);
      console.error("SQL preview:", action.sql.slice(0, 300));
    }
    done++;
    if (done % 50 === 0 || done === total) {
      console.log(`Progreso: ${done}/${total}`);
    }
  }

  console.log(`\nRESTORE TERMINADO. Errores: ${errors.length}`);
  if (errors.length) {
    const errPath = path.join(path.dirname(dumpPath), "restore_errors.json");
    fs.writeFileSync(errPath, JSON.stringify(errors, null, 2));
    console.log("Detalle de errores en", errPath);
  }

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
