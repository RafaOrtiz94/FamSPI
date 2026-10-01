#!/usr/bin/env node
"use strict";

/**
 * Limpia datos de pruebas E2E del usuario Rafael Ortiz.
 *
 * Alcance:
 * - Entregas a colaboradores: sesiones, entregas, actas, items, eventos, renovaciones.
 * - TI: actas, items, asignaciones, eventos y docs financieros de prueba asociados al usuario.
 * - Estado actual de activos TI asignados al usuario.
 * - Tareas de offboarding derivadas de pruebas.
 * - Flags de onboarding afectados por entregas / TI.
 *
 * Mantiene:
 * - Catálogos.
 * - Usuarios.
 * - Activos TI reales; solo revierte su asignación actual si apunta al usuario objetivo.
 */

const { Pool } = require("pg");
const { getDbConfig } = require("./scripts/dbConnection");

const TARGET_EMAIL = process.env.CLEANUP_USER_EMAIL || "rafael.ortiz@fam-project.com";
const RESET_ONBOARDING_FLAGS = [
  "uniformes_entregados",
  "epp_entregados",
  "herramientas_trabajo_entregadas",
  "logistica_entregada",
  "acta_entrega_equipos_comunicacion",
  "computadora_entregada",
  "celular_entregado",
  "acta_descargo_herramientas",
];

const pool = new Pool(getDbConfig());

function toInt(value) {
  return Number.parseInt(value, 10) || 0;
}

async function fetchUser(client) {
  const { rows } = await client.query(
    `SELECT id, email, fullname
       FROM public.users
      WHERE email = $1
      LIMIT 1`,
    [TARGET_EMAIL],
  );
  return rows[0] || null;
}

async function fetchCleanupScope(client, userId) {
  const collabSessions = await client.query(
    `SELECT id
       FROM public.collab_delivery_sessions
      WHERE user_id = $1 OR created_by = $1
      ORDER BY id`,
    [userId],
  );

  const collabDeliveries = await client.query(
    `SELECT id
       FROM public.collab_deliveries
      WHERE user_id = $1 OR created_by = $1
      ORDER BY id`,
    [userId],
  );

  const collabActas = await client.query(
    `SELECT id
       FROM public.collab_delivery_actas
      WHERE recipient_user_id = $1
         OR generated_by = $1
         OR delivery_id IN (
              SELECT id FROM public.collab_deliveries WHERE user_id = $1 OR created_by = $1
            )
         OR session_id IN (
              SELECT id FROM public.collab_delivery_sessions WHERE user_id = $1 OR created_by = $1
            )
      ORDER BY id`,
    [userId],
  );

  const tiAssignments = await client.query(
    `SELECT id, asset_id
       FROM public.ti_asset_assignments
      WHERE assigned_to_user_id = $1
         OR previous_user_id = $1
         OR created_by = $1
      ORDER BY id`,
    [userId],
  );

  const tiActas = await client.query(
    `SELECT id, asset_id
       FROM public.ti_asset_actas
      WHERE recipient_user_id = $1
         OR previous_user_id = $1
         OR generated_by = $1
      ORDER BY id`,
    [userId],
  );

  const tiCurrentAssets = await client.query(
    `SELECT id
       FROM public.ti_assets
      WHERE assigned_to_user_id = $1
        AND active = true
      ORDER BY id`,
    [userId],
  );

  const tiFinancialDocs = await client.query(
    `SELECT id
       FROM public.ti_asset_financial_docs
      WHERE assigned_user_id = $1
         OR uploaded_by = $1
      ORDER BY id`,
    [userId],
  );

  const assetIds = new Set();
  tiAssignments.rows.forEach((row) => row.asset_id && assetIds.add(Number(row.asset_id)));
  tiActas.rows.forEach((row) => row.asset_id && assetIds.add(Number(row.asset_id)));
  tiCurrentAssets.rows.forEach((row) => row.id && assetIds.add(Number(row.id)));

  return {
    collabSessionIds: collabSessions.rows.map((row) => Number(row.id)),
    collabDeliveryIds: collabDeliveries.rows.map((row) => Number(row.id)),
    collabActaIds: collabActas.rows.map((row) => Number(row.id)),
    tiAssignmentIds: tiAssignments.rows.map((row) => Number(row.id)),
    tiActaIds: tiActas.rows.map((row) => Number(row.id)),
    tiAssetIds: [...assetIds],
    tiFinancialDocIds: tiFinancialDocs.rows.map((row) => Number(row.id)),
  };
}

async function deleteByIds(client, table, idColumn, ids) {
  if (!ids.length) return 0;
  const { rowCount } = await client.query(
    `DELETE FROM ${table} WHERE ${idColumn} = ANY($1::bigint[])`,
    [ids],
  );
  return rowCount;
}

async function cleanupRafaelData() {
  const client = await pool.connect();
  try {
    console.log(`Buscando usuario objetivo: ${TARGET_EMAIL}`);
    const user = await fetchUser(client);
    if (!user) {
      console.log("Usuario no encontrado. No se realizó ninguna limpieza.");
      return;
    }

    const userId = Number(user.id);
    console.log(`Usuario encontrado: ${user.fullname || user.email} (ID: ${userId})`);

    const scope = await fetchCleanupScope(client, userId);
    console.log("Resumen previo:");
    console.log(JSON.stringify({
      collab_sessions: scope.collabSessionIds.length,
      collab_deliveries: scope.collabDeliveryIds.length,
      collab_actas: scope.collabActaIds.length,
      ti_assignments: scope.tiAssignmentIds.length,
      ti_actas: scope.tiActaIds.length,
      ti_assets_to_release: scope.tiAssetIds.length,
      ti_financial_docs: scope.tiFinancialDocIds.length,
    }, null, 2));

    await client.query("BEGIN");

    const summary = {};

    summary.collab_delivery_docs = scope.collabDeliveryIds.length
      ? (await client.query(
          `DELETE FROM public.collab_delivery_docs
            WHERE delivery_id = ANY($1::bigint[])`,
          [scope.collabDeliveryIds],
        )).rowCount
      : 0;

    summary.collab_renewal_schedule = scope.collabDeliveryIds.length
      ? (await client.query(
          `DELETE FROM public.collab_renewal_schedule
            WHERE delivery_id = ANY($1::bigint[])`,
          [scope.collabDeliveryIds],
        )).rowCount
      : 0;

    summary.collab_delivery_events = scope.collabDeliveryIds.length
      ? (await client.query(
          `DELETE FROM public.collab_delivery_events
            WHERE delivery_id = ANY($1::bigint[])`,
          [scope.collabDeliveryIds],
        )).rowCount
      : 0;

    summary.collab_delivery_actas_items = await deleteByIds(
      client,
      "public.collab_delivery_actas_items",
      "acta_id",
      scope.collabActaIds,
    );

    summary.collab_delivery_actas = await deleteByIds(
      client,
      "public.collab_delivery_actas",
      "id",
      scope.collabActaIds,
    );

    summary.collab_deliveries = await deleteByIds(
      client,
      "public.collab_deliveries",
      "id",
      scope.collabDeliveryIds,
    );

    summary.collab_delivery_sessions = await deleteByIds(
      client,
      "public.collab_delivery_sessions",
      "id",
      scope.collabSessionIds,
    );

    summary.offboarding_tasks = (
      await client.query(
        `DELETE FROM public.offboarding_tasks
          WHERE user_id = $1
            AND (
              task_key LIKE 'collab\_%' ESCAPE '\'
              OR task_key IN ('ti_assets_returned', 'salida_equipos')
            )`,
        [userId],
      )
    ).rowCount;

    summary.ti_asset_actas_items = await deleteByIds(
      client,
      "public.ti_asset_actas_items",
      "acta_id",
      scope.tiActaIds,
    );

    summary.ti_asset_financial_docs = await deleteByIds(
      client,
      "public.ti_asset_financial_docs",
      "id",
      scope.tiFinancialDocIds,
    );

    summary.ti_asset_actas = await deleteByIds(
      client,
      "public.ti_asset_actas",
      "id",
      scope.tiActaIds,
    );

    summary.ti_asset_assignments = await deleteByIds(
      client,
      "public.ti_asset_assignments",
      "id",
      scope.tiAssignmentIds,
    );

    summary.ti_asset_events = (
      await client.query(
        `DELETE FROM public.ti_asset_events
          WHERE created_by = $1`,
        [userId],
      )
    ).rowCount;

    summary.ti_assets_released = (
      await client.query(
        `UPDATE public.ti_assets
            SET status = 'available',
                assigned_to_user_id = NULL,
                assigned_at = NULL,
                updated_at = now()
          WHERE assigned_to_user_id = $1`,
        [userId],
      )
    ).rowCount;

    if (RESET_ONBOARDING_FLAGS.length) {
      const profileResult = await client.query(
        `SELECT profile
           FROM public.collaborator_profiles
          WHERE user_id = $1
          LIMIT 1`,
        [userId],
      );

      if (profileResult.rows.length) {
        const profile = profileResult.rows[0].profile || {};
        const onboarding = { ...(profile.onboarding || {}) };
        RESET_ONBOARDING_FLAGS.forEach((flag) => {
          onboarding[flag] = false;
        });
        profile.onboarding = onboarding;

        await client.query(
          `UPDATE public.collaborator_profiles
              SET profile = $2::jsonb,
                  updated_at = now()
            WHERE user_id = $1`,
          [userId, JSON.stringify(profile)],
        );
        summary.collaborator_profile_flags_reset = RESET_ONBOARDING_FLAGS.length;
      } else {
        summary.collaborator_profile_flags_reset = 0;
      }
    }

    await client.query("COMMIT");

    console.log("Limpieza completada.");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error durante la limpieza:", error.message);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupRafaelData().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
