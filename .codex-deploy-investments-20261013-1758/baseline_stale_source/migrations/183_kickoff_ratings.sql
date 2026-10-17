-- Migration: 183_kickoff_ratings.sql
-- Module: Kick Off 2026 — Question answer ratings + Presentation ratings (impacto, contenido, destreza)

-- ─── kickoff_question_ratings ────────────────────────────────────────────────
-- The attendee who submitted a highlighted question can rate how well the presenter answered it verbally.
CREATE TABLE IF NOT EXISTS kickoff_question_ratings (
    id          SERIAL PRIMARY KEY,
    question_id INTEGER  NOT NULL REFERENCES kickoff_questions(id) ON DELETE CASCADE,
    user_id     INTEGER  NOT NULL REFERENCES users(id),
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, user_id)
);

-- ─── kickoff_presentation_ratings ────────────────────────────────────────────
-- Attendees rate a finished presentation on 3 axes: impacto, contenido, destreza.
CREATE TABLE IF NOT EXISTS kickoff_presentation_ratings (
    id              SERIAL PRIMARY KEY,
    presentation_id INTEGER  NOT NULL REFERENCES kickoff_presentations(id) ON DELETE CASCADE,
    user_id         INTEGER  NOT NULL REFERENCES users(id),
    impacto         SMALLINT NOT NULL CHECK (impacto BETWEEN 1 AND 5),
    contenido       SMALLINT NOT NULL CHECK (contenido BETWEEN 1 AND 5),
    destreza        SMALLINT NOT NULL CHECK (destreza BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(presentation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kqr_question       ON kickoff_question_ratings(question_id);
CREATE INDEX IF NOT EXISTS idx_kpr_presentation   ON kickoff_presentation_ratings(presentation_id);
