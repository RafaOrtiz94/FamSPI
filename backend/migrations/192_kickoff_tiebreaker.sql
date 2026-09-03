-- Kick Off 2026: sistema de desempate por votación pública
-- Se activa cuando 2+ aportes empatan en el primer lugar del ranking.

CREATE TABLE IF NOT EXISTS kickoff_tiebreaker_rounds (
  id               SERIAL PRIMARY KEY,
  event_id         INTEGER      NOT NULL REFERENCES kickoff_events(id) ON DELETE CASCADE,
  round_number     INTEGER      NOT NULL DEFAULT 1,
  status           TEXT         NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'finished')),
  winner_aporte_id INTEGER      REFERENCES kickoff_questions(id),
  created_by       INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  finished_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);

-- Aportes que compiten en cada ronda
CREATE TABLE IF NOT EXISTS kickoff_tiebreaker_candidates (
  id        SERIAL PRIMARY KEY,
  round_id  INTEGER NOT NULL REFERENCES kickoff_tiebreaker_rounds(id) ON DELETE CASCADE,
  aporte_id INTEGER NOT NULL REFERENCES kickoff_questions(id)          ON DELETE CASCADE,
  UNIQUE (round_id, aporte_id)
);

-- Un voto por usuario por ronda (UNIQUE garantiza esto en BD)
CREATE TABLE IF NOT EXISTS kickoff_tiebreaker_votes (
  id         SERIAL PRIMARY KEY,
  round_id   INTEGER     NOT NULL REFERENCES kickoff_tiebreaker_rounds(id) ON DELETE CASCADE,
  aporte_id  INTEGER     NOT NULL REFERENCES kickoff_questions(id)          ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id)                      ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, user_id)
);
