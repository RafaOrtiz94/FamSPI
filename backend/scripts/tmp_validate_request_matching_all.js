"use strict";

const { Client } = require("pg");
const { getDbConfig } = require("./dbConnection");

function normalizeApplicantPositionText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\btcis\b/g, "tics")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildApplicantPositionTokens(value = "") {
  const stopwords = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "area"]);
  return normalizeApplicantPositionText(value)
    .split(" ")
    .filter((token) => token && !stopwords.has(token));
}

function matchesApplicantToRequestPosition(positionTitle = "", applicantCargo = "") {
  const normalizedPosition = normalizeApplicantPositionText(positionTitle);
  const normalizedCargo = normalizeApplicantPositionText(applicantCargo);

  if (!normalizedPosition || !normalizedCargo) return false;
  if (normalizedCargo.includes(normalizedPosition)) return true;

  const positionTokens = buildApplicantPositionTokens(positionTitle);
  const cargoTokens = new Set(buildApplicantPositionTokens(applicantCargo));
  return positionTokens.length > 0 && positionTokens.every((token) => cargoTokens.has(token));
}

async function main() {
  const client = new Client(getDbConfig());
  await client.connect();

  try {
    const [requestsResult, applicantsResult] = await Promise.all([
      client.query(`
        SELECT id, request_number, position_title, status, applicant_id
        FROM personnel_requests
        ORDER BY id ASC
      `),
      client.query(`
        SELECT id, fullname, email, updated_at, profile->'laboral'->>'cargo' AS cargo
        FROM applicants
        WHERE COALESCE(profile->'laboral'->>'cargo', '') <> ''
        ORDER BY updated_at DESC
      `),
    ]);

    const applicants = applicantsResult.rows;
    const rows = requestsResult.rows.map((request) => {
      const matches = applicants.filter((applicant) =>
        matchesApplicantToRequestPosition(request.position_title, applicant.cargo)
      );
      const linked = applicants.find((applicant) => Number(applicant.id) === Number(request.applicant_id));

      return {
        id: request.id,
        request_number: request.request_number,
        position_title: request.position_title,
        status: request.status,
        linked_applicant_id: request.applicant_id,
        linked_applicant_cargo: linked?.cargo || null,
        match_count: matches.length,
      };
    });

    const suspicious = rows.filter((row) => row.match_count === 0 || (row.linked_applicant_id && row.match_count === 0));
    console.log(JSON.stringify({ ok: true, total: rows.length, suspicious_count: suspicious.length, suspicious, rows }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
