"use strict";

const { Client } = require("pg");
const { getDbConfig } = require("./dbConnection");

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTokens(value) {
  const stopwords = new Set(["de", "del", "la", "las", "el", "los", "y"]);
  return normalize(value)
    .split(" ")
    .filter((token) => token && !stopwords.has(token));
}

function flexibleMatchScore(positionTitle, cargo) {
  const positionTokens = buildTokens(positionTitle);
  const cargoTokens = new Set(buildTokens(cargo));
  const matched = positionTokens.filter((token) => cargoTokens.has(token));
  return {
    matched,
    total: positionTokens.length,
    ok: positionTokens.length > 0 && matched.length >= Math.max(1, Math.ceil(positionTokens.length / 2)),
  };
}

async function main() {
  const client = new Client(getDbConfig());
  await client.connect();

  try {
    const requestResult = await client.query(`
      SELECT id, request_number, position_title, applicant_id
      FROM personnel_requests
      WHERE id IN (8, 14, 25, 30, 32, 33, 35, 36)
      ORDER BY id
    `);

    const applicantResult = await client.query(`
      SELECT
        a.id,
        a.fullname,
        a.email,
        a.updated_at,
        a.profile->'laboral'->>'cargo' AS cargo
      FROM applicants a
      WHERE COALESCE(a.profile->'laboral'->>'cargo', '') <> ''
      ORDER BY a.updated_at DESC
    `);

    const applicants = applicantResult.rows;

    const report = requestResult.rows.map((request) => {
      const currentMatches = applicants.filter((applicant) =>
        normalize(applicant.cargo).includes(normalize(request.position_title))
      );

      const flexibleMatches = applicants
        .map((applicant) => ({
          ...applicant,
          score: flexibleMatchScore(request.position_title, applicant.cargo),
        }))
        .filter((applicant) => applicant.score.ok)
        .slice(0, 25);

      const linkedApplicant = applicants.find((applicant) => Number(applicant.id) === Number(request.applicant_id)) || null;

      return {
        request_id: request.id,
        request_number: request.request_number,
        position_title: request.position_title,
        linked_applicant_id: request.applicant_id,
        linked_applicant_cargo: linkedApplicant?.cargo || null,
        current_match_count: currentMatches.length,
        current_match_samples: currentMatches.slice(0, 10).map((item) => ({
          id: item.id,
          cargo: item.cargo,
          fullname: item.fullname,
        })),
        flexible_match_count: flexibleMatches.length,
        flexible_match_samples: flexibleMatches.slice(0, 10).map((item) => ({
          id: item.id,
          cargo: item.cargo,
          fullname: item.fullname,
          matched_tokens: item.score.matched,
        })),
      };
    });

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
