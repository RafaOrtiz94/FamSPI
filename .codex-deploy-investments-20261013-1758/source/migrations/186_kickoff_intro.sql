-- Migration: 186_kickoff_intro.sql
-- Module: Kick Off 2026 — Presentación de tipo introducción
-- Una presentación marcada como introducción no exige aportes ni preguntas
-- en el progress gate, y sus aportes quedan excluidos del ranking y de los ganadores.

ALTER TABLE kickoff_presentations
  ADD COLUMN IF NOT EXISTS is_intro BOOLEAN NOT NULL DEFAULT FALSE;
