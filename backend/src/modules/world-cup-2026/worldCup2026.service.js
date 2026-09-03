const { v4: uuidv4 } = require("uuid");
const db = require("../../config/db");

const PORTAL_SCHEMA = "external_world_cup_2026";
const PARTICIPANT_HEADER = "x-world-cup-participant-token";
const SCHEMA_ERROR_CODES = new Set(["42P01", "3F000", "42703"]);

const MATCH_DEFINITIONS = [
  { key: "semi_1", label: "Semifinal 1", stage: "Semifinal", match_date: "2026-07-14", stadium: "Dallas Stadium", city: "Dallas", home_team: "France", away_team: "Spain" },
  { key: "semi_2", label: "Semifinal 2", stage: "Semifinal", match_date: "2026-07-15", stadium: "Atlanta Stadium", city: "Atlanta", home_team: "England", away_team: "Argentina" },
  { key: "final", label: "Final", stage: "Final", match_date: "2026-07-19", stadium: "New York New Jersey Stadium", city: "East Rutherford", home_team: null, away_team: null },
];

const DEFAULT_PORTAL_SUBTITLE =
  "Pronostica el torneo y participa con Famproject Cia. Ltda.";

function wrapSchemaError(error) {
  if (SCHEMA_ERROR_CODES.has(error?.code)) {
    throw Object.assign(
      new Error("La base del portal aun no esta preparada. Aplica las migraciones pendientes del Mundial 2026."),
      { status: 503 }
    );
  }
  throw error;
}

function sanitizePortalSubtitle(value) {
  const subtitle = normalizeText(value, { max: 280 });
  if (!subtitle) return DEFAULT_PORTAL_SUBTITLE;
  if (/famspi/i.test(subtitle)) return DEFAULT_PORTAL_SUBTITLE;
  return subtitle;
}

function normalizeText(value, { required = false, max = 160 } = {}) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (required && !normalized) {
    throw Object.assign(new Error("Faltan campos obligatorios del formulario"), { status: 400 });
  }
  if (normalized.length > max) {
    throw Object.assign(new Error(`Un campo excede el maximo permitido de ${max} caracteres`), { status: 400 });
  }
  return normalized || null;
}

function normalizeComparableText(value, options = {}) {
  const normalized = normalizeText(value, options);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) throw Object.assign(new Error("El correo es obligatorio"), { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("El correo no tiene un formato valido"), { status: 400 });
  }
  return email;
}

function normalizeIdentityDocument(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, "").toUpperCase();
  if (!normalized) throw Object.assign(new Error("El documento de identidad es obligatorio"), { status: 400 });
  if (normalized.length < 6 || normalized.length > 32) {
    throw Object.assign(new Error("El documento de identidad no tiene un formato valido"), { status: 400 });
  }
  return normalized;
}

function normalizeScore(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 20) {
    throw Object.assign(new Error(`${label} debe estar entre 0 y 20`), { status: 400 });
  }
  return parsed;
}

function normalizePenaltyScore(value, label, { required = false } = {}) {
  if (value === "" || value === null || value === undefined) {
    if (required) throw Object.assign(new Error(`${label} es obligatorio`), { status: 400 });
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 20) {
    throw Object.assign(new Error(`${label} debe estar entre 0 y 20`), { status: 400 });
  }
  return parsed;
}

function resolveKnockoutWinner(match, label, { strict = false } = {}) {
  if (!match.home_team || !match.away_team) return null;
  const hasMainScore = Number.isInteger(match.home_score) && Number.isInteger(match.away_score);
  if (!hasMainScore) return null;

  if (match.home_score !== match.away_score) {
    if (strict && (match.home_penalties !== null || match.away_penalties !== null)) {
      throw Object.assign(new Error(`${label} no debe registrar penales si no hay empate`), { status: 400 });
    }
    return match.home_score > match.away_score ? match.home_team : match.away_team;
  }

  if (!Number.isInteger(match.home_penalties) || !Number.isInteger(match.away_penalties)) {
    if (strict) {
      throw Object.assign(new Error(`${label} requiere resultado en penales cuando hay empate`), { status: 400 });
    }
    return null;
  }

  if (match.home_penalties === match.away_penalties) {
    if (strict) {
      throw Object.assign(new Error(`${label} no puede terminar empatado en penales`), { status: 400 });
    }
    return null;
  }

  return match.home_penalties > match.away_penalties ? match.home_team : match.away_team;
}

function buildFixtureMap(official) {
  return {
    semi_1: {
      ...MATCH_DEFINITIONS[0],
      home_team: official?.semi_1_home_team || MATCH_DEFINITIONS[0].home_team,
      away_team: official?.semi_1_away_team || MATCH_DEFINITIONS[0].away_team,
      home_score: Number.isInteger(official?.semi_1_home_score) ? official.semi_1_home_score : null,
      away_score: Number.isInteger(official?.semi_1_away_score) ? official.semi_1_away_score : null,
      home_penalties: Number.isInteger(official?.semi_1_home_penalties) ? official.semi_1_home_penalties : null,
      away_penalties: Number.isInteger(official?.semi_1_away_penalties) ? official.semi_1_away_penalties : null,
    },
    semi_2: {
      ...MATCH_DEFINITIONS[1],
      home_team: official?.semi_2_home_team || MATCH_DEFINITIONS[1].home_team,
      away_team: official?.semi_2_away_team || MATCH_DEFINITIONS[1].away_team,
      home_score: Number.isInteger(official?.semi_2_home_score) ? official.semi_2_home_score : null,
      away_score: Number.isInteger(official?.semi_2_away_score) ? official.semi_2_away_score : null,
      home_penalties: Number.isInteger(official?.semi_2_home_penalties) ? official.semi_2_home_penalties : null,
      away_penalties: Number.isInteger(official?.semi_2_away_penalties) ? official.semi_2_away_penalties : null,
    },
    final: {
      ...MATCH_DEFINITIONS[2],
      home_team: official?.final_home_team || null,
      away_team: official?.final_away_team || null,
      home_score: Number.isInteger(official?.final_home_score) ? official.final_home_score : null,
      away_score: Number.isInteger(official?.final_away_score) ? official.final_away_score : null,
      home_penalties: Number.isInteger(official?.final_home_penalties) ? official.final_home_penalties : null,
      away_penalties: Number.isInteger(official?.final_away_penalties) ? official.final_away_penalties : null,
    },
  };
}

function getSemifinalTeams(fixtures) {
  return [fixtures.semi_1.home_team, fixtures.semi_1.away_team, fixtures.semi_2.home_team, fixtures.semi_2.away_team].filter(Boolean);
}

function normalizeTeamSelection(value, label, allowedTeams) {
  const normalized = normalizeText(value, { required: true, max: 120 });
  const allowedSet = new Set(allowedTeams.map((team) => String(team || "").trim().toLowerCase()));
  if (!allowedSet.has(normalized.toLowerCase())) {
    throw Object.assign(new Error(`${label} debe ser uno de los 4 semifinalistas habilitados`), { status: 400 });
  }
  return normalized;
}

function getMatchTeams(entry, fixtures, key) {
  if (key === "semi_1") return { home_team: fixtures.semi_1.home_team, away_team: fixtures.semi_1.away_team };
  if (key === "semi_2") return { home_team: fixtures.semi_2.home_team, away_team: fixtures.semi_2.away_team };
  return { home_team: entry.final_home_team || fixtures.final.home_team, away_team: entry.final_away_team || fixtures.final.away_team };
}

function getEntryMatch(entry, fixtures, key) {
  const teams = getMatchTeams(entry, fixtures, key);
  return {
    key,
    ...teams,
    home_score: Number.isInteger(entry?.[`${key}_home_score`]) ? entry[`${key}_home_score`] : null,
    away_score: Number.isInteger(entry?.[`${key}_away_score`]) ? entry[`${key}_away_score`] : null,
    home_penalties: Number.isInteger(entry?.[`${key}_home_penalties`]) ? entry[`${key}_home_penalties`] : null,
    away_penalties: Number.isInteger(entry?.[`${key}_away_penalties`]) ? entry[`${key}_away_penalties`] : null,
  };
}

function buildPredictionView(entry, fixtures) {
  const semi1 = getEntryMatch(entry, fixtures, "semi_1");
  const semi2 = getEntryMatch(entry, fixtures, "semi_2");
  const finalMatch = getEntryMatch(entry, fixtures, "final");
  const predictedChampion = normalizeText(entry?.champion_team, { max: 120 });

  return {
    semi_1: semi1,
    semi_2: semi2,
    final: finalMatch,
    positions: {
      champion_team: normalizeText(entry?.champion_team, { max: 120 }),
      runner_up_team: normalizeText(entry?.runner_up_team, { max: 120 }),
      third_place_team: normalizeText(entry?.third_place_team, { max: 120 }),
      fourth_place_team: normalizeText(entry?.fourth_place_team, { max: 120 }),
    },
    predicted_champion_team: predictedChampion || resolveKnockoutWinner(finalMatch, "La final"),
  };
}

function scorePrediction(entry, official) {
  const fixtures = buildFixtureMap(official);
  const checks = ["semi_1", "semi_2", "final"].map((key) => ({
    key,
    official: fixtures[key],
  }));

  let totalPoints = 0;
  let exactScoreHits = 0;
  let matchWinnerHits = 0;
  let completedMatches = 0;
  let aggregateGoalDiff = 0;
  let positionHits = 0;

  checks.forEach(({ key, official: officialMatch }) => {
    const predicted = getEntryMatch(entry, fixtures, key);
    const officialWinner = resolveKnockoutWinner(officialMatch, key);
    const officialReady =
      officialMatch.home_team &&
      officialMatch.away_team &&
      Number.isInteger(officialMatch.home_score) &&
      Number.isInteger(officialMatch.away_score) &&
      officialWinner;

    if (!officialReady) return;
    completedMatches += 1;

    const predictedWinner = resolveKnockoutWinner(predicted, key);
    const exactMainScore =
      predicted.home_team === officialMatch.home_team &&
      predicted.away_team === officialMatch.away_team &&
      predicted.home_score === officialMatch.home_score &&
      predicted.away_score === officialMatch.away_score;
    const officialWentToPenalties = officialMatch.home_score === officialMatch.away_score;
    const exactPenalties = !officialWentToPenalties
      ? predicted.home_penalties === null && predicted.away_penalties === null
      : predicted.home_penalties === officialMatch.home_penalties && predicted.away_penalties === officialMatch.away_penalties;
    const exactScore = exactMainScore && exactPenalties;

    if (exactScore) {
      totalPoints += 100;
      exactScoreHits += 1;
      matchWinnerHits += 1;
    } else if (predictedWinner && officialWinner && predictedWinner.toLowerCase() === officialWinner.toLowerCase()) {
      totalPoints += 50;
      matchWinnerHits += 1;
    }

    if (Number.isInteger(predicted.home_score) && Number.isInteger(predicted.away_score)) {
      aggregateGoalDiff += Math.abs(predicted.home_score - officialMatch.home_score) + Math.abs(predicted.away_score - officialMatch.away_score);
      if (officialWentToPenalties) {
        const predictedHomePens = Number.isInteger(predicted.home_penalties) ? predicted.home_penalties : 0;
        const predictedAwayPens = Number.isInteger(predicted.away_penalties) ? predicted.away_penalties : 0;
        const officialHomePens = Number.isInteger(officialMatch.home_penalties) ? officialMatch.home_penalties : 0;
        const officialAwayPens = Number.isInteger(officialMatch.away_penalties) ? officialMatch.away_penalties : 0;
        aggregateGoalDiff += Math.abs(predictedHomePens - officialHomePens) + Math.abs(predictedAwayPens - officialAwayPens);
      }
    } else {
      aggregateGoalDiff += 99;
    }
  });

  [["champion_team", official?.champion_team], ["runner_up_team", official?.runner_up_team], ["third_place_team", official?.third_place_team], ["fourth_place_team", official?.fourth_place_team]].forEach(([field, officialValue]) => {
    const predictedValue = normalizeText(entry?.[field], { max: 120 });
    const normalizedOfficial = normalizeText(officialValue, { max: 120 });
    if (predictedValue && normalizedOfficial && predictedValue.toLowerCase() === normalizedOfficial.toLowerCase()) {
      totalPoints += 50;
      positionHits += 1;
    }
  });

  return { total_points: totalPoints, exact_score_hits: exactScoreHits, match_winner_hits: matchWinnerHits, position_hits: positionHits, aggregate_goal_diff: aggregateGoalDiff, completed_matches: completedMatches };
}

async function getPortalConfig() {
  let rows;
  try {
    ({ rows } = await db.query(`SELECT id, slug, title, subtitle, participation_open, starts_at, ends_at FROM ${PORTAL_SCHEMA}.portal_config WHERE id = 1`));
  } catch (error) {
    wrapSchemaError(error);
  }
  if (!rows[0]) throw Object.assign(new Error("La configuracion del portal no esta disponible"), { status: 503 });
  const config = rows[0];
  const now = new Date();
  const startsAt = config.starts_at ? new Date(config.starts_at) : null;
  const endsAt = config.ends_at ? new Date(config.ends_at) : null;
  const isWithinWindow = (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
  return {
    slug: config.slug,
    title: config.title,
    subtitle: sanitizePortalSubtitle(config.subtitle),
    participation_open: Boolean(config.participation_open) && isWithinWindow,
    starts_at: config.starts_at,
    ends_at: config.ends_at,
  };
}

async function getOfficialResults() {
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT id,
              champion_team, runner_up_team, third_place_team, fourth_place_team,
              semi_1_home_team, semi_1_away_team, semi_1_home_score, semi_1_away_score, semi_1_home_penalties, semi_1_away_penalties,
              semi_2_home_team, semi_2_away_team, semi_2_home_score, semi_2_away_score, semi_2_home_penalties, semi_2_away_penalties,
              final_home_team, final_away_team, final_home_score, final_away_score, final_home_penalties, final_away_penalties,
              updated_at
         FROM ${PORTAL_SCHEMA}.official_results
        WHERE id = 1`
    ));
  } catch (error) {
    wrapSchemaError(error);
  }
  return rows[0] || null;
}

async function getParticipantByToken(token) {
  if (!token) return null;
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT id, participant_token, participant_name, identity_document, email, company_name,
              champion_team, runner_up_team, third_place_team, fourth_place_team,
              semi_1_home_score, semi_1_away_score, semi_1_home_penalties, semi_1_away_penalties,
              semi_2_home_score, semi_2_away_score, semi_2_home_penalties, semi_2_away_penalties,
              final_home_team, final_away_team, final_home_score, final_away_score, final_home_penalties, final_away_penalties,
              created_at
         FROM ${PORTAL_SCHEMA}.prediction_entries
        WHERE participant_token = $1`,
      [token]
    ));
  } catch (error) {
    wrapSchemaError(error);
  }
  return rows[0] || null;
}

async function getParticipantProfile(token) {
  const participant = await getParticipantByToken(token);
  if (!participant) throw Object.assign(new Error("Participante no encontrado"), { status: 404 });
  const official = await getOfficialResults();
  const fixtures = buildFixtureMap(official);
  const score = scorePrediction(participant, official);
  return {
    id: participant.id,
    participant_token: participant.participant_token,
    reference_code: `WC26-${String(participant.id).padStart(6, "0")}`,
    participant_name: participant.participant_name,
    identity_document: participant.identity_document,
    email: participant.email,
    company_name: participant.company_name,
    created_at: participant.created_at,
    prediction: buildPredictionView(participant, fixtures),
    score: {
      total_points: score.total_points,
      exact_score_hits: score.exact_score_hits,
      match_winner_hits: score.match_winner_hits,
      position_hits: score.position_hits,
      aggregate_goal_diff: score.aggregate_goal_diff,
      completed_matches: score.completed_matches,
      results_loaded: score.completed_matches > 0 || Boolean(official?.champion_team || official?.runner_up_team || official?.third_place_team || official?.fourth_place_team),
      official_results_updated_at: official?.updated_at || null,
    },
  };
}

async function getLiveBoard() {
  let official;
  let participantsResult;
  try {
    [official, participantsResult] = await Promise.all([
      getOfficialResults(),
      db.query(
        `SELECT id, participant_token, participant_name, company_name,
                champion_team, runner_up_team, third_place_team, fourth_place_team,
                semi_1_home_score, semi_1_away_score, semi_1_home_penalties, semi_1_away_penalties,
                semi_2_home_score, semi_2_away_score, semi_2_home_penalties, semi_2_away_penalties,
                final_home_team, final_away_team, final_home_score, final_away_score, final_home_penalties, final_away_penalties,
                created_at
           FROM ${PORTAL_SCHEMA}.prediction_entries
          ORDER BY created_at DESC`
      ),
    ]);
  } catch (error) {
    wrapSchemaError(error);
  }

  const fixtures = buildFixtureMap(official);
  const participants = participantsResult.rows.map((row) => ({ ...row, prediction: buildPredictionView(row, fixtures), ...scorePrediction(row, official) }));
  const emptyScore = scorePrediction({}, official);

  const leaderboard = [...participants]
    .sort((left, right) => {
      if (right.total_points !== left.total_points) return right.total_points - left.total_points;
      if (right.exact_score_hits !== left.exact_score_hits) return right.exact_score_hits - left.exact_score_hits;
      if (right.position_hits !== left.position_hits) return right.position_hits - left.position_hits;
      if (right.match_winner_hits !== left.match_winner_hits) return right.match_winner_hits - left.match_winner_hits;
      if (left.aggregate_goal_diff !== right.aggregate_goal_diff) return left.aggregate_goal_diff - right.aggregate_goal_diff;
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    })
    .slice(0, 10)
    .map((row, index) => ({
      rank: index + 1,
      participant_token: row.participant_token,
      participant_name: row.participant_name,
      company_name: row.company_name,
      predicted_champion_team: row.champion_team || row.prediction.predicted_champion_team,
      total_points: row.total_points,
      exact_score_hits: row.exact_score_hits,
      match_winner_hits: row.match_winner_hits,
      position_hits: row.position_hits,
      aggregate_goal_diff: row.aggregate_goal_diff,
      created_at: row.created_at,
    }));

  const latestParticipants = participants.slice(0, 10).map((row) => ({
    participant_token: row.participant_token,
    participant_name: row.participant_name,
    company_name: row.company_name,
    predicted_champion_team: row.champion_team || row.prediction.predicted_champion_team,
    created_at: row.created_at,
  }));

  return {
    stats: {
      total_participants: participants.length,
      winning_rule: "Ganador correcto: 50 puntos. Marcador exacto: 100 puntos. Si hay empate, el ganador se define por penales. Cada posicion final correcta vale 50 puntos.",
      max_points: 500,
      completed_matches: emptyScore.completed_matches,
      results_loaded: emptyScore.completed_matches > 0 || Boolean(official?.champion_team || official?.runner_up_team || official?.third_place_team || official?.fourth_place_team),
      official_results_updated_at: official?.updated_at || null,
    },
    fixtures: { semi_1: fixtures.semi_1, semi_2: fixtures.semi_2, final: fixtures.final },
    leaderboard,
    latest_participants: latestParticipants,
  };
}

async function getPortalSnapshot(participantToken = null) {
  const [portal, official, board, participant] = await Promise.all([
    getPortalConfig(),
    getOfficialResults(),
    getLiveBoard(),
    participantToken ? getParticipantProfile(participantToken).catch(() => null) : Promise.resolve(null),
  ]);
  return { ...portal, fixtures: buildFixtureMap(official), participant_team_options: getSemifinalTeams(buildFixtureMap(official)), board, participant, participant_header_name: PARTICIPANT_HEADER };
}

function buildValidatedMatch(payload, fixtures, key, label) {
  const teams = key === "final"
    ? { home_team: payload.final_home_team, away_team: payload.final_away_team }
    : { home_team: fixtures[key].home_team, away_team: fixtures[key].away_team };

  const home_score = normalizeScore(payload[`${key}_home_score`], `El marcador local de ${label}`);
  const away_score = normalizeScore(payload[`${key}_away_score`], `El marcador visitante de ${label}`);
  const requirePenalties = home_score === away_score;
  const home_penalties = normalizePenaltyScore(payload[`${key}_home_penalties`], `Los penales locales de ${label}`, { required: requirePenalties });
  const away_penalties = normalizePenaltyScore(payload[`${key}_away_penalties`], `Los penales visitantes de ${label}`, { required: requirePenalties });
  const match = { ...teams, home_score, away_score, home_penalties, away_penalties };
  resolveKnockoutWinner(match, label, { strict: true });
  return match;
}

async function createSubmission(payload, meta = {}) {
  const portal = await getPortalConfig();
  if (!portal.participation_open) throw Object.assign(new Error("El portal de predicciones no esta habilitado en este momento"), { status: 409 });

  const official = await getOfficialResults();
  const fixtures = buildFixtureMap(official);
  const allowedTeams = getSemifinalTeams(fixtures);

  const participantName = normalizeText(payload.participant_name, { required: true, max: 180 });
  const identityDocument = normalizeIdentityDocument(payload.identity_document);
  const email = normalizeText(payload.email, { required: true, max: 180 });
  const emailNormalized = normalizeEmail(payload.email);
  const companyName = normalizeText(payload.company_name, { required: true, max: 180 });
  const consentAccepted = payload.consent_accepted === true;
  const thirdPlaceTeam = normalizeTeamSelection(payload.third_place_team, "El tercer lugar", allowedTeams);
  const fourthPlaceTeam = normalizeTeamSelection(payload.fourth_place_team, "El cuarto lugar", allowedTeams);

  if (!consentAccepted) throw Object.assign(new Error("Debes aceptar el tratamiento de datos para participar"), { status: 400 });

  const semi1 = buildValidatedMatch(payload, fixtures, "semi_1", "la semifinal 1");
  const semi2 = buildValidatedMatch(payload, fixtures, "semi_2", "la semifinal 2");
  const semifinal1Winner = resolveKnockoutWinner(semi1, "La semifinal 1", { strict: true });
  const semifinal2Winner = resolveKnockoutWinner(semi2, "La semifinal 2", { strict: true });

  const finalPayload = {
    ...payload,
    final_home_team: semifinal1Winner,
    final_away_team: semifinal2Winner,
  };
  const finalMatch = buildValidatedMatch(finalPayload, fixtures, "final", "la final");
  const championTeam = resolveKnockoutWinner(finalMatch, "La final", { strict: true });
  const runnerUpTeam = championTeam === finalMatch.home_team ? finalMatch.away_team : finalMatch.home_team;

  const uniquePositionTeams = new Set([championTeam, runnerUpTeam, thirdPlaceTeam, fourthPlaceTeam].map((team) => team.toLowerCase()));
  if (uniquePositionTeams.size !== 4) {
    throw Object.assign(new Error("Campeon, vicecampeon, tercer y cuarto lugar deben ser equipos distintos"), { status: 400 });
  }

  const participantToken = uuidv4();

  try {
    const { rows } = await db.query(
      `INSERT INTO ${PORTAL_SCHEMA}.prediction_entries (
         participant_token, participant_name, identity_document, identity_document_normalized, email, email_normalized,
         phone, company_name, city, country,
         champion_team, runner_up_team, third_place_team, fourth_place_team,
         top_scorer_name, best_player_name, total_goals_tiebreaker, favorite_team, notes, consent_accepted,
         semi_1_home_score, semi_1_away_score, semi_1_home_penalties, semi_1_away_penalties,
         semi_2_home_score, semi_2_away_score, semi_2_home_penalties, semi_2_away_penalties,
         final_home_team, final_away_team, final_home_score, final_away_score, final_home_penalties, final_away_penalties,
         source_path, ip_address, user_agent
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,
         $35,$36,$37
       )
       RETURNING id, participant_token, participant_name, identity_document, email, company_name, created_at,
                 champion_team, runner_up_team, third_place_team, fourth_place_team,
                 semi_1_home_score, semi_1_away_score, semi_1_home_penalties, semi_1_away_penalties,
                 semi_2_home_score, semi_2_away_score, semi_2_home_penalties, semi_2_away_penalties,
                 final_home_team, final_away_team, final_home_score, final_away_score, final_home_penalties, final_away_penalties`,
      [
        participantToken, participantName, identityDocument, identityDocument, email, emailNormalized,
        null, companyName, null, null,
        championTeam, runnerUpTeam, thirdPlaceTeam, fourthPlaceTeam,
        normalizeComparableText("No aplica", { required: true, max: 120 }), null, 0, null, null, consentAccepted,
        semi1.home_score, semi1.away_score, semi1.home_penalties, semi1.away_penalties,
        semi2.home_score, semi2.away_score, semi2.home_penalties, semi2.away_penalties,
        finalMatch.home_team, finalMatch.away_team, finalMatch.home_score, finalMatch.away_score, finalMatch.home_penalties, finalMatch.away_penalties,
        meta.sourcePath || null, meta.ipAddress || null, meta.userAgent || null,
      ]
    );
    const row = rows[0];
    return {
      id: row.id,
      participant_token: row.participant_token,
      participant_name: row.participant_name,
      identity_document: row.identity_document,
      email: row.email,
      company_name: row.company_name,
      created_at: row.created_at,
      reference_code: `WC26-${String(row.id).padStart(6, "0")}`,
      prediction: buildPredictionView(row, fixtures),
    };
  } catch (error) {
    if (SCHEMA_ERROR_CODES.has(error?.code)) {
      throw Object.assign(new Error("La base del portal aun no esta preparada. Aplica las migraciones pendientes del Mundial 2026."), { status: 503 });
    }
    if (error?.code === "23505") {
      if (String(error?.constraint || "").includes("identity")) {
        throw Object.assign(new Error("Ya existe una participacion registrada con este documento de identidad"), { status: 409 });
      }
      throw Object.assign(new Error("Ya existe una participacion registrada con este correo electronico"), { status: 409 });
    }
    throw error;
  }
}

module.exports = { PARTICIPANT_HEADER, getPortalConfig, getPortalSnapshot, getParticipantProfile, getLiveBoard, createSubmission };
