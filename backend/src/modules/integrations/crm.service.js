const axios = require("axios");
const logger = require("../../config/logger");
const db = require("../../config/db");

// EspoCRM agrega prefijo 'c' a todos los campos custom
// Nombres reales en la API:
//   Contact:     cFamspiId, cBuyingRole, cInfluenceLevel
//   Account:     cFamspiClientId, cFamspiRuc, cClientType, cAssignedAdvisorEmail
//   Opportunity: cFamspiOpportunityId, cSingularObjective, cTotalScore,
//                cCompetitivePosition, cBcStatus, cPurchaseType,
//                cFlagCountOpen, cFlagCountCritical

const isCrmSyncEnabled = () =>
  String(process.env.CRM_SYNC_ENABLED || "false").toLowerCase() === "true";

const getCrmBaseUrl = () =>
  String(process.env.CRM_BASE_URL || "").replace(/\/+$/, "");

const getCrmApiKey = () => process.env.CRM_API_KEY || "";

const crmRequest = async (method, path, data = null) => {
  const baseUrl = getCrmBaseUrl();
  const apiKey  = getCrmApiKey();

  if (!baseUrl || !apiKey) {
    logger.warn("[CRM_SERVICE] CRM_BASE_URL o CRM_API_KEY no configurados — evento omitido");
    return { skipped: true, reason: "missing_config" };
  }

  const config = {
    method,
    url: `${baseUrl}/api/v1/${path}`,
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    timeout: parseInt(process.env.CRM_TIMEOUT_MS || "8000", 10),
  };
  if (data) config.data = data;

  const response = await axios(config);
  return response.data;
};

const findByFamspiId = async (entity, famspiField, famspiValue, selectFields = null) => {
  let qs = `where[0][type]=equals&where[0][attribute]=${famspiField}&where[0][value]=${encodeURIComponent(String(famspiValue))}&maxSize=1`;
  if (selectFields) qs += `&select=${encodeURIComponent(selectFields)}`;
  const result = await crmRequest("GET", `${entity}?${qs}`);
  return result?.list?.[0] || null;
};

const getHealth = async () => {
  if (!isCrmSyncEnabled()) {
    return { provider: "espocrm", status: "disabled", enabled: false };
  }
  try {
    const result = await crmRequest("GET", "App/user");
    return { provider: "espocrm", status: "ready", enabled: true, user: result?.userName };
  } catch (err) {
    return { provider: "espocrm", status: "unreachable", enabled: true, error: err?.message };
  }
};

const buildContactName = (cr) => {
  if (cr.client_type === "natural") {
    const first = (cr.natural_person_firstname || "").trim();
    const last  = (cr.natural_person_lastname  || "").trim();
    if (first || last) return `${first} ${last}`.trim();
  }
  return (
    cr.legal_person_business_name ||
    cr.commercial_name            ||
    cr.ruc_cedula                 ||
    "Sin nombre"
  );
};

// ─── Pipeline comercial: 12 etapas ───────────────────────────────────────────
//
// FamSPI tiene 7 macro-stages. EspoCRM tiene 12 etapas granulares.
// Las etapas "solo EspoCRM" las mueve el asesor manualmente — FamSPI nunca las pisa.
//
//  FamSPI macro  │  EspoCRM etapa de entrada  │  Sub-etapas solo EspoCRM
//  ─────────────┼───────────────────────────┼──────────────────────────────
//  prospect     │  Prospeccion               │  Asignado
//  qualify      │  En Seguimiento            │  Lead Calificado
//  pursue       │  Analisis de Necesidades   │  Desarrollo de Oferta
//  close        │  Presentacion de Propuesta │  Negociacion, Contratos
//  won          │  Cerrado Ganado            │
//  lost         │  Cerrado Perdido           │
//  archived     │  Archivado                 │

const STAGE_TO_MACRO = {
  "Prospeccion":               "prospect",
  "Asignado":                  "prospect",   // sub-etapa solo EspoCRM
  "En Seguimiento":            "qualify",
  "Lead Calificado":           "qualify",    // sub-etapa solo EspoCRM
  "Analisis de Necesidades":   "pursue",
  "Desarrollo de Oferta":      "pursue",     // sub-etapa solo EspoCRM
  "Presentacion de Propuesta": "close",
  "Negociacion":               "close",      // sub-etapa solo EspoCRM
  "Contratos":                 "close",      // sub-etapa solo EspoCRM
  "Cerrado Ganado":            "won",
  "Cerrado Perdido":           "lost",
  "Archivado":                 "archived",
};

const stageToMacro = (espoStage) => STAGE_TO_MACRO[espoStage] || null;

// ─── Cache de deduplicación para acciones Google ──────────────────────────────
// Evita acciones duplicadas si el outbox reintenta el mismo evento.
const _googleActionCache = new Map();
const GOOGLE_ACTION_TTL = 30 * 60 * 1000; // 30 min

function _isGoogleActionDuplicate(oppId, stage) {
  const key = `${oppId}:${stage}`;
  const ts = _googleActionCache.get(key);
  if (ts && Date.now() - ts < GOOGLE_ACTION_TTL) return true;
  _googleActionCache.set(key, Date.now());
  if (_googleActionCache.size > 500) {
    const cutoff = Date.now() - GOOGLE_ACTION_TTL;
    for (const [k, v] of _googleActionCache) {
      if (v < cutoff) _googleActionCache.delete(k);
    }
  }
  return false;
}

function _daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function _getNotifyEmails(envKey) {
  return (process.env[envKey] || "").split(",").map((e) => e.trim()).filter(Boolean);
}

async function _getOwnerEmail(ownerId) {
  if (!ownerId) return null;
  try {
    const { rows } = await db.query("SELECT email FROM users WHERE id = $1 LIMIT 1", [ownerId]);
    return rows[0]?.email || null;
  } catch {
    return null;
  }
}

// Acciones Google disparadas por cambios de stage en FamSPI (outbox)
async function triggerGoogleActionsForFamStage(funnel_stage, opp, isNew) {
  if (_isGoogleActionDuplicate(opp.famspi_opportunity_id, funnel_stage)) {
    logger.info({ opp_id: opp.famspi_opportunity_id, stage: funnel_stage }, "[CRM_GOOGLE] Accion duplicada — skip");
    return;
  }

  // Lazy require — solo se carga si se necesita
  const { sendMail } = require("../../utils/mailer");
  const { createAllDayEvent } = require("../../utils/calendar");
  const { ensureFolder, copyTemplate, replaceTags } = require("../../utils/drive");

  const title = opp.title || "Oportunidad";
  const accountName = opp.account_name || title;
  const famspiOppId = String(opp.famspi_opportunity_id);
  const closeDate = opp.target_close_date || _daysFromNow(90);
  const ownerEmail = await _getOwnerEmail(opp.owner_id);
  const jefeEmails = _getNotifyEmails("CRM_NOTIFY_JEFE_COMERCIAL");
  const gerenciaEmails = _getNotifyEmails("CRM_NOTIFY_GERENCIA");
  const rootFolderId = process.env.DRIVE_CRM_PROSPECTS_FOLDER_ID || null;
  const templateOfertaId = process.env.DRIVE_TEMPLATE_OFERTA_ID || null;

  const folderName = `${accountName}_${famspiOppId}`.slice(0, 200);

  try {
    switch (funnel_stage) {
      case "prospect":
        if (isNew && rootFolderId) {
          const folder = await ensureFolder(folderName, rootFolderId);
          logger.info({ opp_id: famspiOppId, folder_id: folder.id }, "[CRM_GOOGLE] Carpeta Drive prospecto creada");
        }
        break;

      case "pursue": {
        // Evento Calendar: reunión interna de análisis
        const attendees = ownerEmail ? [ownerEmail] : [];
        await createAllDayEvent({
          summary: `Analisis de Necesidades: ${title}`,
          description: `Reunión interna para análisis de la oportunidad "${title}" (${accountName}).\nEtapa alcanzada: Análisis de Necesidades.`,
          date: _daysFromNow(1),
          reminderMinutesBefore: 480,
          attendees,
        });
        logger.info({ opp_id: famspiOppId }, "[CRM_GOOGLE] Evento Calendar análisis creado");
        break;
      }

      case "close": {
        const attendees = ownerEmail ? [ownerEmail, ...jefeEmails] : [...jefeEmails];

        // Evento Calendar con la fecha de cierre estimada
        await createAllDayEvent({
          summary: `Presentacion de Propuesta: ${title}`,
          description: `Presentar propuesta comercial para "${title}" (${accountName}).\nFecha estimada de cierre: ${closeDate}.`,
          date: closeDate,
          reminderMinutesBefore: 1440,
          attendees,
        });

        // Gmail: notificación a jefe_comercial
        if (jefeEmails.length) {
          await sendMail({
            to: jefeEmails,
            subject: `Propuesta lista: ${title}`,
            html: `
              <h2>Oportunidad en Presentacion de Propuesta</h2>
              <p>La oportunidad <strong>${title}</strong> (${accountName}) ha avanzado a la etapa de presentación de propuesta.</p>
              <p><b>Fecha estimada de cierre:</b> ${closeDate}</p>
              <p><b>Asesor:</b> ${opp.owner_name || ownerEmail || "-"}</p>
              <p><b>Monto estimado:</b> ${opp.estimated_amount ? "$" + Number(opp.estimated_amount).toLocaleString("es-EC") : "-"}</p>
              <p><a href="${process.env.CRM_BASE_URL || "#"}">Ver en FAM CRM</a></p>
            `,
            source: "crm_famspi_stage",
          });
        }
        logger.info({ opp_id: famspiOppId }, "[CRM_GOOGLE] Evento Calendar + Gmail propuesta creados");
        break;
      }

      case "won": {
        const toWon = [...jefeEmails, ...gerenciaEmails].filter(Boolean);

        // Gmail: notificación interna de cierre ganado
        if (toWon.length) {
          await sendMail({
            to: toWon,
            subject: `GANADO: ${title}`,
            html: `
              <h2 style="color:#28a745">Oportunidad Cerrada — GANADO</h2>
              <p>La oportunidad <strong>${title}</strong> fue cerrada exitosamente.</p>
              <p><b>Cliente:</b> ${accountName}</p>
              <p><b>Asesor:</b> ${opp.owner_name || ownerEmail || "-"}</p>
              <p><b>Monto:</b> ${opp.estimated_amount ? "$" + Number(opp.estimated_amount).toLocaleString("es-EC") : "-"}</p>
              <p><a href="${process.env.CRM_BASE_URL || "#"}">Ver en FAM CRM</a></p>
            `,
            source: "crm_famspi_stage",
          });
        }

        // Evento Calendar: kickoff
        const kickoffAttendees = [ownerEmail, ...jefeEmails].filter(Boolean);
        await createAllDayEvent({
          summary: `Kickoff: ${title}`,
          description: `Reunión de inicio de proyecto para "${title}" (${accountName}).\nOportunidad cerrada exitosamente.`,
          date: _daysFromNow(7),
          reminderMinutesBefore: 1440,
          attendees: kickoffAttendees,
        });

        // Drive: subcarpeta Proyecto
        if (rootFolderId) {
          const prospectFolder = await ensureFolder(folderName, rootFolderId);
          await ensureFolder("Proyecto", prospectFolder.id);
          logger.info({ opp_id: famspiOppId }, "[CRM_GOOGLE] Carpeta Proyecto creada en Drive");
        }

        // Drive: doc oferta desde template si aplica
        if (rootFolderId && templateOfertaId) {
          const prospectFolder = await ensureFolder(folderName, rootFolderId);
          const docName = `Oferta_${title}`.slice(0, 200);
          const existing = await require("../../utils/drive").findFolder(docName, prospectFolder.id);
          if (!existing) {
            const doc = await copyTemplate(templateOfertaId, docName, prospectFolder.id);
            await replaceTags(doc.id, {
              CLIENTE: accountName,
              OPORTUNIDAD: title,
              MONTO: opp.estimated_amount ? "$" + Number(opp.estimated_amount).toLocaleString("es-EC") : "",
              FECHA: closeDate,
              ASESOR: opp.owner_name || "",
            });
          }
        }
        logger.info({ opp_id: famspiOppId }, "[CRM_GOOGLE] Acciones WON completadas");
        break;
      }

      case "lost": {
        const toLost = [...jefeEmails].filter(Boolean);
        if (toLost.length) {
          await sendMail({
            to: toLost,
            subject: `PERDIDO: ${title}`,
            html: `
              <h2 style="color:#dc3545">Oportunidad Cerrada — PERDIDO</h2>
              <p>La oportunidad <strong>${title}</strong> fue marcada como perdida.</p>
              <p><b>Cliente:</b> ${accountName}</p>
              <p><b>Asesor:</b> ${opp.owner_name || ownerEmail || "-"}</p>
              <p><b>Objetivo singular:</b> ${opp.singular_objective || "-"}</p>
              <p>Se recomienda agendar una llamada de retroalimentación con el cliente.</p>
              <p><a href="${process.env.CRM_BASE_URL || "#"}">Ver en FAM CRM</a></p>
            `,
            source: "crm_famspi_stage",
          });
        }

        const lostAttendees = ownerEmail ? [ownerEmail] : [];
        await createAllDayEvent({
          summary: `Feedback: ${title} (perdido)`,
          description: `Llamada de retroalimentación con el cliente "${accountName}".\nOportunidad cerrada como perdida.`,
          date: _daysFromNow(3),
          reminderMinutesBefore: 480,
          attendees: lostAttendees,
        });
        logger.info({ opp_id: famspiOppId }, "[CRM_GOOGLE] Acciones LOST completadas");
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.warn(
      { err: err?.message, opp_id: famspiOppId, stage: funnel_stage },
      "[CRM_GOOGLE] Error en accion Google — no afecta sync CRM"
    );
  }
}

// ─── Envío de eventos ─────────────────────────────────────────────────────────

const sendClientApproved = async (clientRequest) => {
  const cr = clientRequest;
  const accountName = cr.legal_person_business_name || cr.commercial_name || buildContactName(cr);
  const famspiClientId = String(cr.id);

  // 1. Account (empresa)
  let accountId = null;
  try {
    const existing = await findByFamspiId("Account", "cFamspiClientId", famspiClientId);
    const accountPayload = {
      name:                    accountName,
      billingAddressCity:      cr.establishment_city    || cr.shipping_city,
      billingAddressState:     cr.establishment_province || cr.shipping_province,
      billingAddressCountry:   "Ecuador",
      cFamspiClientId:         famspiClientId,
      cFamspiRuc:              cr.ruc_cedula            || "",
      cClientType:             cr.client_type           || "",
      cAssignedAdvisorEmail:   cr.assigned_advisor_email || "",
    };

    if (existing) {
      accountId = existing.id;
      await crmRequest("PUT", `Account/${accountId}`, accountPayload);
    } else {
      const account = await crmRequest("POST", "Account", accountPayload);
      accountId = account?.id;
    }
    logger.info({ cr_id: cr.id, account_id: accountId }, "[CRM_SERVICE] Account upsert OK");
  } catch (err) {
    logger.warn({ error: err?.message, cr_id: cr.id }, "[CRM_SERVICE] Error upsert Account");
  }

  // 2. Contact
  const contactName = buildContactName(cr);
  const nameParts   = contactName.split(" ");
  const firstName   = nameParts[0] || contactName;
  const lastName    = nameParts.slice(1).join(" ") || "";

  try {
    const existing = await findByFamspiId("Contact", "cFamspiId", famspiClientId);
    const contactPayload = {
      firstName,
      lastName,
      emailAddress:     cr.client_email       || cr.legal_rep_email,
      addressCity:      cr.establishment_city  || cr.shipping_city,
      addressState:     cr.establishment_province || cr.shipping_province,
      addressCountry:   "Ecuador",
      cFamspiId:        famspiClientId,
      ...(accountId ? { accountId } : {}),
    };

    if (existing) {
      await crmRequest("PUT", `Contact/${existing.id}`, contactPayload);
      logger.info({ cr_id: cr.id, contact_id: existing.id }, "[CRM_SERVICE] Contact actualizado");
      return { ok: true, action: "updated", contactId: existing.id, accountId };
    }

    const contact = await crmRequest("POST", "Contact", contactPayload);
    logger.info({ cr_id: cr.id, contact_id: contact?.id }, "[CRM_SERVICE] Contact creado");
    return { ok: true, action: "created", contactId: contact?.id, accountId };

  } catch (err) {
    logger.error({ cr_id: cr.id, error: err?.message }, "[CRM_SERVICE] Error upsert Contact");
    throw err;
  }
};

const sendClientUpdated = async (clientRequest) => {
  const cr = clientRequest;
  const famspiClientId = String(cr.id);
  try {
    const existing = await findByFamspiId("Contact", "cFamspiId", famspiClientId);
    if (!existing) {
      logger.warn({ cr_id: cr.id }, "[CRM_SERVICE] Contact no encontrado para update — creando");
      return sendClientApproved(cr);
    }
    await crmRequest("PUT", `Contact/${existing.id}`, {
      addressCity:   cr.establishment_city     || cr.shipping_city,
      addressState:  cr.establishment_province  || cr.shipping_province,
      addressCountry:"Ecuador",
    });
    return { ok: true, action: "updated", contactId: existing.id };
  } catch (err) {
    logger.error({ cr_id: cr.id, error: err?.message }, "[CRM_SERVICE] Error update Contact");
    throw err;
  }
};

const sendOpportunitySync = async (opportunity) => {
  const opp = opportunity;
  const famspiOppId = String(opp.famspi_opportunity_id);

  // Stage de entrada en EspoCRM para cada macro-stage de FamSPI.
  // Las sub-etapas (Asignado, Lead Calificado, Desarrollo de Oferta,
  // Negociacion, Contratos) solo las mueve el asesor en EspoCRM.
  const macroToEntryStage = {
    prospect: "Prospeccion",
    qualify:  "En Seguimiento",
    pursue:   "Analisis de Necesidades",
    close:    "Presentacion de Propuesta",
    won:      "Cerrado Ganado",
    lost:     "Cerrado Perdido",
    archived: "Archivado",
  };
  const targetStage = macroToEntryStage[opp.funnel_stage] || "Prospeccion";

  let syncResult;

  try {
    const existing = await findByFamspiId(
      "Opportunity",
      "cFamspiOpportunityId",
      famspiOppId,
      "name,stage,cFamspiOpportunityId",
    );

    const payload = {
      name:                   opp.title,
      amount:                 parseFloat(opp.estimated_amount) || 0,
      closeDate:              opp.target_close_date
                                || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      cFamspiOpportunityId:   famspiOppId,
      cSingularObjective:     opp.singular_objective || "",
      cTotalScore:            opp.total_score        || 0,
      cCompetitivePosition:   opp.competitive_position || "",
      cBcStatus:              opp.bc_status          || "none",
      cPurchaseType:          opp.purchase_type      || "none",
      cFlagCountOpen:         opp.flag_count_open    || 0,
      cFlagCountCritical:     opp.flag_count_critical || 0,
    };

    if (existing) {
      // Anti-pisado: solo cambiar el stage si el macro-stage de FamSPI
      // es DISTINTO al macro-stage actual en EspoCRM.
      const currentMacro = stageToMacro(existing.stage);
      const stageChanged = currentMacro !== opp.funnel_stage;

      if (stageChanged) {
        payload.stage = targetStage;
      }
      await crmRequest("PUT", `Opportunity/${existing.id}`, payload);

      syncResult = {
        ok: true,
        action: "updated",
        opportunityId: existing.id,
        stageChanged,
        keptManualStage: stageChanged ? null : existing.stage,
      };

      // Acciones Google solo cuando el stage realmente cambió
      if (stageChanged) {
        await triggerGoogleActionsForFamStage(opp.funnel_stage, opp, false);
      }
    } else {
      payload.stage = targetStage;
      const result = await crmRequest("POST", "Opportunity", payload);

      syncResult = { ok: true, action: "created", opportunityId: result?.id, stage: targetStage };

      // Acciones Google para oportunidad nueva
      await triggerGoogleActionsForFamStage(opp.funnel_stage, opp, true);
    }

    return syncResult;

  } catch (err) {
    logger.error({ opp_id: famspiOppId, error: err?.message }, "[CRM_SERVICE] Error sync Opportunity");
    throw err;
  }
};

// ─── Sync de visita a cliente ─────────────────────────────────────────────────
// Crea o actualiza un Meeting en EspoCRM cuando un asesor registra una visita.
// Estado FamSPI → EspoCRM Meeting status:
//   visited   → Held
//   in_visit  → Planned
//   pending   → Planned
//   skipped   → Not Held

const VISIT_STATUS_MAP = {
  visited:  "Held",
  in_visit: "Planned",
  pending:  "Planned",
  skipped:  "Not Held",
};

const sendVisitSync = async (visit) => {
  const v = visit;
  const meetingName = `Visita: ${v.client_name || v.client_id}`;
  const espoStatus  = VISIT_STATUS_MAP[v.status] || "Planned";
  const dateStr     = v.visit_date || new Date().toISOString().split("T")[0];
  const dateStart   = v.hora_entrada
    ? new Date(v.hora_entrada).toISOString().replace("T", " ").slice(0, 19)
    : `${dateStr} 09:00:00`;
  const dateEnd     = v.hora_salida
    ? new Date(v.hora_salida).toISOString().replace("T", " ").slice(0, 19)
    : `${dateStr} 10:00:00`;

  const idempotencyKey = `visit_${v.client_id}_${v.user_email}_${dateStr}`;

  try {
    // Buscar meeting existente por nombre + fecha (sin campo custom, usamos textFilter)
    const qs = `where[0][type]=equals&where[0][attribute]=name&where[0][value]=${encodeURIComponent(meetingName)}&where[1][type]=equals&where[1][attribute]=dateStart&where[1][value]=${encodeURIComponent(dateStart)}&maxSize=1`;
    const existing = await crmRequest("GET", `Meeting?${qs}`);
    const found    = existing?.list?.[0] || null;

    const payload = {
      name:        meetingName,
      status:      espoStatus,
      dateStart,
      dateEnd,
      description: [
        `Cliente ID: ${v.client_id}`,
        v.client_name ? `Cliente: ${v.client_name}` : null,
        v.observaciones ? `Observaciones: ${v.observaciones}` : null,
        v.duracion_minutos ? `Duración: ${v.duracion_minutos} min` : null,
      ].filter(Boolean).join("\n"),
    };

    if (found) {
      await crmRequest("PUT", `Meeting/${found.id}`, { status: espoStatus, description: payload.description });
      logger.info({ visit: idempotencyKey, meeting_id: found.id }, "[CRM_SERVICE] Meeting visita actualizado");
      return { ok: true, action: "updated", meetingId: found.id };
    }

    const result = await crmRequest("POST", "Meeting", payload);
    logger.info({ visit: idempotencyKey, meeting_id: result?.id }, "[CRM_SERVICE] Meeting visita creado");
    return { ok: true, action: "created", meetingId: result?.id };

  } catch (err) {
    logger.error({ visit: idempotencyKey, error: err?.message }, "[CRM_SERVICE] Error sync Meeting visita");
    throw err;
  }
};

// ─── Sync de prospecto ────────────────────────────────────────────────────────
// Crea o actualiza un Lead en EspoCRM cuando se registra un prospecto en FamSPI.

const sendProspectSync = async (prospect) => {
  const p = prospect;
  const famspiProspectId = String(p.id);

  const firstName = (p.natural_person_firstname || p.commercial_name || p.legal_person_business_name || "Prospecto").trim();
  const lastName  = p.natural_person_lastname || "";

  try {
    // Buscar Lead existente por campo cFamspiId (mismo campo que Contact)
    const qs = `where[0][type]=equals&where[0][attribute]=cFamspiId&where[0][value]=${encodeURIComponent(famspiProspectId)}&maxSize=1`;
    const existing = await crmRequest("GET", `Lead?${qs}`);
    const found    = existing?.list?.[0] || null;

    const payload = {
      firstName,
      lastName,
      emailAddress:    p.client_email || p.legal_rep_email || null,
      addressCity:     p.establishment_city  || p.shipping_city,
      addressState:    p.establishment_province || p.shipping_province,
      addressCountry:  "Ecuador",
      status:          "New",
      description:     `Prospecto FamSPI. RUC/CI: ${p.ruc_cedula || "-"}. Asesor: ${p.assigned_advisor_email || "-"}`,
      cFamspiId:       famspiProspectId,
    };

    if (found) {
      await crmRequest("PUT", `Lead/${found.id}`, payload);
      logger.info({ prospect_id: famspiProspectId, lead_id: found.id }, "[CRM_SERVICE] Lead prospecto actualizado");
      return { ok: true, action: "updated", leadId: found.id };
    }

    const result = await crmRequest("POST", "Lead", payload);
    logger.info({ prospect_id: famspiProspectId, lead_id: result?.id }, "[CRM_SERVICE] Lead prospecto creado");
    return { ok: true, action: "created", leadId: result?.id };

  } catch (err) {
    logger.error({ prospect_id: famspiProspectId, error: err?.message }, "[CRM_SERVICE] Error sync Lead prospecto");
    throw err;
  }
};

module.exports = {
  isCrmSyncEnabled,
  getHealth,
  sendClientApproved,
  sendClientUpdated,
  sendOpportunitySync,
  sendVisitSync,
  sendProspectSync,
};
