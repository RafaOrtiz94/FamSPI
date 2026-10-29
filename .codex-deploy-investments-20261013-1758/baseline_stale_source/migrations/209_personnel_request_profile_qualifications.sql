-- Migration: 209_personnel_request_profile_qualifications.sql
-- Objetivo:
-- 1. Separar las credenciales academicas temporales del perfil JSONB de solicitud
-- 2. Permitir que contratacion migre titulos al expediente central sin contaminar collaborator_profiles
-- 3. Mantener compatibilidad con el formulario legacy de solicitudes mientras se completa la transicion

BEGIN;

ALTER TABLE personnel_request_profiles
  ADD COLUMN IF NOT EXISTS qualifications JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN personnel_request_profiles.qualifications IS
  'Coleccion temporal de credenciales academicas/certificaciones capturadas durante la solicitud antes de migrarse al expediente central del colaborador';

COMMIT;
