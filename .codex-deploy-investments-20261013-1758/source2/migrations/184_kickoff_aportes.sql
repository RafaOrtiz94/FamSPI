-- Migration: 184_kickoff_aportes.sql
-- Module: Kick Off 2026 — Add 'aporte' type to questions + aporte ratings for ranking

-- Add type column to distinguish questions from contributions (aportes)
ALTER TABLE kickoff_questions
  ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'question'
  CHECK (type IN ('question', 'aporte'));

-- Ratings for aportes — used for the event-wide contribution ranking
CREATE TABLE IF NOT EXISTS kickoff_aporte_ratings (
    id         SERIAL PRIMARY KEY,
    aporte_id  INTEGER  NOT NULL REFERENCES kickoff_questions(id) ON DELETE CASCADE,
    user_id    INTEGER  NOT NULL REFERENCES users(id),
    rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(aporte_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kar_aporte ON kickoff_aporte_ratings(aporte_id);
