-- Migration: 243_crm_activities_missing_columns.sql
-- crm.crm_activities le faltaban columnas que crm.service.js ya referenciaba
-- (createActivity usa duration_minutes; completeActivity usa outcome_notes/outcome_rating).
-- Sin esta migracion, crear o completar una actividad fallaba con 500.

ALTER TABLE crm.crm_activities
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS outcome_notes TEXT,
  ADD COLUMN IF NOT EXISTS outcome_rating INTEGER;
