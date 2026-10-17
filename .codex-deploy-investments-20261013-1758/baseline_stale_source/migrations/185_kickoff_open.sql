-- Migration: 185_kickoff_open.sql
-- Module: Kick Off 2026 — Add is_open flag to control public access

ALTER TABLE kickoff_events
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT FALSE;
