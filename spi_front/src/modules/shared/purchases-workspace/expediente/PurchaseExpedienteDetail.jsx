import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FiBriefcase, FiCheckCircle, FiGlobe, FiFileText,
  FiPackage, FiTool, FiBookOpen, FiGrid, FiClock,
  FiRefreshCw, FiAlertCircle, FiTrendingUp, FiLock,
  FiZap, FiArrowRight, FiActivity,
  FiShield,
} from 'react-icons/fi';

import { useAuth } from '../../../../core/auth/AuthContext';
import usePurchaseExpediente from '../hooks/usePurchaseExpediente';

import CommercialTab        from './tabs/CommercialTab';
import PrivateFlowTab       from './tabs/PrivateFlowTab';
import AvailabilityTab      from './tabs/AvailabilityTab';
import PublicAcpTab         from './tabs/PublicAcpTab';
import ContractTab          from './tabs/ContractTab';
import EquipmentLogisticsTab from './tabs/EquipmentLogisticsTab';
import TechnicalTab         from './tabs/TechnicalTab';
import TrainingTab          from './tabs/TrainingTab';
import SupplyControlTab     from './tabs/SupplyControlTab';
import ExpedienteTimelineTab from './tabs/ExpedienteTimelineTab';
import ExpedienteAuditTab   from './tabs/ExpedienteAuditTab';

const EASE_OUT = [0.23, 1, 0.32, 1];

const purchaseInspectionHandledByBusinessCase = (purchase, type) => {
  if (type === 'public' || purchase?.purchase_type === 'public') return true;
  const linkedBusinessCaseId = purchase?.extra?.auto_business_case_id || purchase?.business_case_id || null;
  return String(purchase?.offer_kind || '').toLowerCase() === 'comodato' && Boolean(linkedBusinessCaseId);
};

/* ─────────────────────────────────────────────────────────────────────────
   computePendingTabs
   Returns a Set of tab IDs that have a pending action FOR THE CURRENT USER.
   Role-aware: a dot only appears on tabs where the user's role has an action
   to take in the current purchase state.

   Tab IDs (public):  comercial | disponibilidad | acp | contrato | logistica | tecnica
   Tab IDs (private): comercial | flujo_comercial | disponibilidad | contrato | logistica | tecnica
───────────────────────────────────────────────────────────────────────── */
function computePendingTabs(purchase, type, userRoles = []) {
  const pending = new Set();
  if (!purchase) return pending;

  const roles    = new Set(userRoles);
  const status   = purchase.status || '';
  const serialSt = purchase.serial_status || '';
  const inspectionHandledByBc = purchaseInspectionHandledByBusinessCase(purchase, type);

  // ── Role helpers ────────────────────────────────────────────────────────
  const isComercial  = roles.has('comercial') || roles.has('asesor_comercial') || roles.has('analista_comercial');
  const isBackoffice = roles.has('backoffice') || roles.has('backoffice_comercial');
  const isAcp        = roles.has('acp_comercial');
  const isManager    = ['gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'].some(r => roles.has(r));
  const isTecnico    = ['tecnico','jefe_tecnico','jefe_servicio_tecnico'].some(r => roles.has(r));
  const isLogistica  = roles.has('logistica') || roles.has('jefe_logistica');
  const isOps        = roles.has('operaciones') || roles.has('jefe_operaciones');

  // Composite helpers
  const isMgr = isManager;
  const isComercialOrMgr = isComercial || isMgr;
  const isBkOrMgr = isBackoffice || isMgr;
  const isAcpOrMgr = isAcp || isMgr;
  const isComBkOrMgr = isComercial || isBackoffice || isMgr;
  const isDelivery = isLogistica || isOps || isTecnico || isMgr;

  // ── mark helper: adds tab only when current user can act ────────────────
  const mark = (tab, canAct) => { if (canAct) pending.add(tab); };

  // ══════════════════════════════════════════════════════════════════════
  //  PRIVATE PURCHASE
  // ══════════════════════════════════════════════════════════════════════
  if (type === 'private') {

    // ── Tab: COMERCIAL ──────────────────────────────────────────────────
    // comercial needs to fill initial request details
    mark('comercial', status === 'pending_commercial' && isComercialOrMgr);

    // ── Tab: FLUJO_COMERCIAL ────────────────────────────────────────────
    // backoffice reviews and sends to ACP (the "solicitar disponibilidad a ACP" action)
    mark('flujo_comercial', status === 'pending_backoffice'          && isBkOrMgr);
    // ACP confirmed availability → backoffice prepares offer
    mark('flujo_comercial', status === 'acp_availability_confirmed'  && isBkOrMgr);
    // backoffice/manager handles offer rejection or price improvement request
    mark('flujo_comercial', status === 'offer_rejected_by_commercial' && isBkOrMgr);
    mark('flujo_comercial', status === 'price_improvement_requested'  && isBkOrMgr);
    // manager must sign the offer
    mark('flujo_comercial', status === 'pending_manager_signature'   && isMgr);
    // comercial follows up / uploads signed offer from client
    mark('flujo_comercial', (status === 'offer_sent' || status === 'pending_client_signature') && isComercialOrMgr);
    // client signed → backoffice advances to contract
    mark('flujo_comercial', status === 'offer_signed'                && isBkOrMgr);
    // client registration pending
    mark('flujo_comercial', (status === 'client_registration_requested' || status === 'client_registered') && isComBkOrMgr);

    // ── Tab: DISPONIBILIDAD ─────────────────────────────────────────────
    // ACP must send availability email to provider (purchase just arrived to ACP)
    mark('disponibilidad', status === 'sent_to_acp'                     && isAcpOrMgr);
    // ACP must register the provider's response — until response is registered
    mark('disponibilidad', status === 'acp_availability_requested' && !purchase?.provider_response_at && isAcpOrMgr);
    // Once provider response is registered, asesor comercial must confirm with client
    mark('disponibilidad', status === 'acp_availability_requested' && Boolean(purchase?.provider_response_at) && isComercialOrMgr);
    // Comercial must register the client's CU decision
    mark('disponibilidad', status === 'acp_availability_cu_pending'      && isComercialOrMgr);
    // Comercial must obtain client's binding import approval
    mark('disponibilidad', status === 'acp_availability_import_pending'  && isComercialOrMgr);
    // After availability confirmed, ACP must request the proforma from provider
    mark('disponibilidad', status === 'acp_availability_confirmed' && !purchase?.extra?.proforma_request_sent_at && isAcpOrMgr);
    // After proforma requested, ACP must upload the unsigned proforma (activates reservation)
    mark('disponibilidad', status === 'acp_availability_confirmed' && Boolean(purchase?.extra?.proforma_request_sent_at) && !purchase?.extra?.proforma_file_id && isAcpOrMgr);
    // After unsigned proforma uploaded, ACP must upload the signed proforma (enables contract)
    mark('disponibilidad', status === 'acp_availability_confirmed' && Boolean(purchase?.extra?.proforma_file_id) && !purchase?.extra?.proforma_signed_file_id && isAcpOrMgr);

    // ── Tab: CONTRATO ───────────────────────────────────────────────────
    // Backoffice draft (after signed proforma is uploaded by ACP)
    mark('contrato', Boolean(purchase?.extra?.proforma_signed_file_id) &&
                      ((status === 'client_registered' && inspectionHandledByBc) || (status === 'inspection_requested' && (purchase?.site_inspection_ready_for_installation || purchase?.inspection_site_ready_for_installation))) &&
                      !purchase?.contract_document_id && isBkOrMgr);
    // Comercial uploads client-signed
    mark('contrato', status === 'pending_contract_client_signature' && isComercialOrMgr);
    // Gerencia/ACP uploads manager-signed
    mark('contrato', status === 'pending_contract_approval' && (isMgr || isAcp));
    mark('contrato', status === 'contract_available'                 && isComBkOrMgr);

    // ── Tab: LOGISTICA ──────────────────────────────────────────────────
    // comercial must request delivery dates once the contract is signed/available
    mark('logistica', status === 'contract_available'                && isComercialOrMgr);
    // logistics/ops/tecnico respond to the date request
    mark('logistica', status === 'delivery_dates_requested'          && isDelivery);
    // backoffice/manager confirm the submitted dates
    mark('logistica', status === 'delivery_dates_submitted'          && isBkOrMgr);
    mark('logistica', (status === 'waiting_dispatch' || status === 'dispatch_ready') && isDelivery);
    mark('logistica', ['pending_reception','received_pending_serial'].includes(serialSt) && isDelivery);

    // ── Tab: FLUJO_COMERCIAL — solicitar inspección de ambiente (acción del asesor, no del técnico)
    mark('flujo_comercial', !inspectionHandledByBc && status === 'client_registered' && !purchase?.inspection_request_id && isComercialOrMgr);

    // ── Tab: TECNICA ────────────────────────────────────────────────────
    mark('tecnica', !inspectionHandledByBc && (status === 'inspection_requested' || status === 'inspection_coordinated') && (isTecnico || isMgr));
    mark('tecnica', (status === 'installation_pending' || status === 'installation_in_progress') && (isTecnico || isLogistica || isMgr));

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLIC PURCHASE
  // ══════════════════════════════════════════════════════════════════════
  } else {

    // ── Tab: COMERCIAL ──────────────────────────────────────────────────
    // draft / initial state — comercial or backoffice completes info
    mark('comercial', status === 'draft'                   && isComBkOrMgr);
    // Pending backoffice review in unified flow
    mark('comercial', status === 'pending_backoffice_review' && isBkOrMgr);

    // ── Tab: DISPONIBILIDAD ─────────────────────────────────────────────
    // ACP must start the availability request to provider
    mark('disponibilidad', status === 'pending_provider_assignment'        && isAcpOrMgr);
    // ACP must register the provider's response
    mark('disponibilidad', status === 'waiting_provider_response'          && isAcpOrMgr);
    // Comercial must register the client's CU decision
    mark('disponibilidad', status === 'waiting_client_cu_approval'         && isComercialOrMgr);
    // ACP must confirm import awareness
    mark('disponibilidad', status === 'waiting_acp_import_confirmation'    && isAcpOrMgr);
    // No stock — ACP should handle (find alternative, close, etc.)
    mark('disponibilidad', status === 'no_stock'                           && isAcpOrMgr);

    // ── Tab: ACP ────────────────────────────────────────────────────────
    // ACP requests or uploads proforma
    mark('acp', status === 'waiting_proforma'              && isAcpOrMgr);
    // ACP or manager confirms reservation
    mark('acp', status === 'proforma_received'             && isAcpOrMgr);
    // Only acp_comercial submits signed proforma
    mark('acp', status === 'waiting_signed_proforma'       && isAcp);
    // Portal checklist / portal submission
    mark('acp', (status === 'portal_checklist_pending' ||
                 status === 'pending_portal_submission')   && isAcpOrMgr);

    // ── Tab: CONTRATO ───────────────────────────────────────────────────
    mark('contrato', status === 'pending_contract'         && isAcpOrMgr);
    mark('contrato', status === 'contract_available'       && isAcpOrMgr);
    // Proforma uploaded but no contract yet
    if (purchase.proforma_file_id && !purchase.contract_file_id) {
      mark('contrato', isAcpOrMgr);
    }

    // ── Tab: LOGISTICA ──────────────────────────────────────────────────
    mark('logistica', status === 'delivery_dates_requested'  && isDelivery);
    mark('logistica', status === 'delivery_dates_submitted'  && isDelivery);
    mark('logistica', (status === 'waiting_dispatch' || status === 'dispatch_ready') && isDelivery);
    mark('logistica', ['pending_reception','received_pending_serial'].includes(serialSt) && isDelivery);

    // ── Tab: TECNICA ────────────────────────────────────────────────────
    mark('tecnica', (status === 'inspection_requested' || status === 'inspection_coordinated') && (isTecnico || isMgr));
    mark('tecnica', (status === 'installation_pending' || status === 'installation_in_progress') && (isTecnico || isLogistica || isMgr));
  }

  return pending;
}

/* ─────────────────────────────────────────────────────────────────────────
   computeTabStates
   Returns { locked: Set, done: Set } based on the STAGE/STATUS of the purchase,
   not on roles. Roles only gate ACTIONS inside tabs (RoleGatedAction stays).

   locked → workflow hasn't reached this tab's stage yet (not clickable)
   done   → workflow has moved past this tab's stage (green check, still clickable)
───────────────────────────────────────────────────────────────────────── */
function computeTabStates(purchase, type) {
  if (!purchase) return { locked: new Set(), done: new Set() };

  const status = purchase?.status || '';
  const locked = new Set();
  const done   = new Set();

  if (type === 'private') {
    // Ordered list of private purchase statuses (approximate progression)
    const STAGES = [
      'pending_commercial',
      'pending_backoffice',
      'sent_to_acp', 'acp_availability_requested', 'acp_availability_confirmed',
      'acp_availability_cu_pending', 'acp_availability_import_pending',
      'offer_sent', 'pending_client_signature', 'offer_signed',
      'offer_rejected_by_commercial', 'price_improvement_requested',
      'client_registration_requested', 'client_registered',
      'inspection_requested', 'inspection_coordinated',
      'pending_contract_approval', 'pending_contract_client_signature', 'contract_available',
      'delivery_dates_requested', 'delivery_dates_submitted', 'calendar_events_created',
      'waiting_dispatch', 'dispatch_ready',
      'pending_reception', 'received_pending_serial', 'serial_registered',
      'installation_pending', 'installation_in_progress',
      'delivery_act_draft_ready', 'delivery_act_tech_assigned', 'delivery_act_logistics_signed',
      'delivery_act_generated', 'delivered_signed',
      'completed', 'rejected', 'cancelled',
    ];

    const idx = STAGES.indexOf(status);
    // idx === -1 means unknown/future state → treat as fully unlocked
    const atOrPast = (stage) => {
      const si = STAGES.indexOf(stage);
      return si === -1 || idx === -1 || idx >= si;
    };
    const strictlyPast = (stage) => {
      const si = STAGES.indexOf(stage);
      return si !== -1 && idx !== -1 && idx > si;
    };

    // comercial: always unlocked; done once past pending_commercial
    if (strictlyPast('pending_commercial')) done.add('comercial');

    // flujo_comercial: unlock from pending_backoffice onward; done once past client_registered
    if (!atOrPast('pending_backoffice'))    locked.add('flujo_comercial');
    else if (strictlyPast('client_registered')) done.add('flujo_comercial');

    // disponibilidad: unlock from sent_to_acp; done cuando la proforma firmada fue subida (paso final del tab)
    // o cuando el status ya pasó el registro de cliente (flujo sin proforma)
    if (!atOrPast('sent_to_acp')) locked.add('disponibilidad');
    else if (
      Boolean(purchase?.extra?.proforma_signed_file_id) ||   // proforma firmada = todos los pasos del tab completos
      atOrPast('client_registration_requested')              // fallback: status avanzó más allá de disponibilidad
    ) done.add('disponibilidad');

    // contrato: unlock from client_registration_requested; done when past contract_available
    if (!atOrPast('client_registration_requested')) locked.add('contrato');
    else if (strictlyPast('contract_available'))    done.add('contrato');

    // logistica: unlock from contract_available; done when installation stage starts
    if (!atOrPast('contract_available'))         locked.add('logistica');
    else if (atOrPast('installation_pending'))   done.add('logistica');

    // tecnica: unlock from client_registered so comercial can request the environment inspection.
    if (!atOrPast('client_registered'))          locked.add('tecnica');
    else if (atOrPast('delivery_act_generated')) done.add('tecnica');

    // entrenamiento: unlock from installation_pending
    if (!atOrPast('installation_pending')) locked.add('entrenamiento');

    // insumos: unlock from contract_available (supply control can start then)
    if (!atOrPast('contract_available')) locked.add('insumos');

    // timeline: always unlocked (never locked, never "done")

  } else {
    // ── Public purchase stages ────────────────────────────────────────
    const STAGES = [
      'draft', 'pending_backoffice_review',
      'pending_provider_assignment', 'waiting_provider_response',
      'waiting_client_cu_approval', 'waiting_acp_import_confirmation', 'no_stock',
      'waiting_proforma', 'proforma_received', 'waiting_signed_proforma',
      'portal_checklist_pending', 'pending_portal_submission',
      'pending_contract', 'contract_available',
      'delivery_dates_requested', 'delivery_dates_submitted',
      'waiting_dispatch', 'dispatch_ready',
      'pending_reception', 'received_pending_serial', 'serial_registered',
      'inspection_requested', 'inspection_coordinated',
      'installation_pending', 'installation_in_progress',
      'delivery_act_draft_ready', 'delivery_act_tech_assigned', 'delivery_act_logistics_signed',
      'delivery_act_generated', 'delivered_signed',
      'completed', 'rejected', 'cancelled',
    ];

    const idx = STAGES.indexOf(status);
    const atOrPast = (stage) => {
      const si = STAGES.indexOf(stage);
      return si === -1 || idx === -1 || idx >= si;
    };
    const strictlyPast = (stage) => {
      const si = STAGES.indexOf(stage);
      return si !== -1 && idx !== -1 && idx > si;
    };

    // comercial: always unlocked; done once past draft
    if (strictlyPast('draft')) done.add('comercial');

    // disponibilidad: always unlocked in public; done when past acp stages
    if (atOrPast('waiting_proforma')) done.add('disponibilidad');

    // acp: unlock from waiting_proforma; done when past portal submission
    if (!atOrPast('waiting_proforma'))           locked.add('acp');
    else if (atOrPast('contract_available'))     done.add('acp');

    // contrato: unlock from pending_contract; done when past contract_available
    if (!atOrPast('pending_contract'))           locked.add('contrato');
    else if (strictlyPast('contract_available')) done.add('contrato');

    // logistica: unlock from contract_available; done when inspection starts
    if (!atOrPast('contract_available'))       locked.add('logistica');
    else if (atOrPast('inspection_requested')) done.add('logistica');

    // tecnica: unlock from inspection_requested
    if (!atOrPast('inspection_requested'))       locked.add('tecnica');
    else if (atOrPast('delivery_act_generated')) done.add('tecnica');

    // entrenamiento: unlock from installation_pending
    if (!atOrPast('installation_pending')) locked.add('entrenamiento');

    // insumos: unlock from contract_available
    if (!atOrPast('contract_available')) locked.add('insumos');
  }

  return { locked, done };
}

/* ─────────────────────────────────────────────────────────────────────────
   computeNextAction
   Returns the single most-relevant action the current user must take right now,
   or null if the purchase is complete / no action needed.
   { tabId, tabLabel, description, actor, urgent }
───────────────────────────────────────────────────────────────────────── */
function computeNextAction(purchase, type, userRoles = []) {
  if (!purchase) return null;

  const status   = purchase?.status || '';
  const roles    = new Set(userRoles);
  const inspectionHandledByBc = purchaseInspectionHandledByBusinessCase(purchase, type);

  const isComercial  = roles.has('comercial') || roles.has('asesor_comercial') || roles.has('analista_comercial');
  const isBackoffice = roles.has('backoffice') || roles.has('backoffice_comercial');
  const isAcp        = roles.has('acp_comercial');
  const isManager    = ['gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'].some(r => roles.has(r));
  const isTecnico    = ['tecnico','jefe_tecnico','jefe_servicio_tecnico'].some(r => roles.has(r));
  const isLogistica  = roles.has('logistica') || roles.has('jefe_logistica');
  const isOps        = roles.has('operaciones') || roles.has('jefe_operaciones');
  const isDelivery   = isLogistica || isOps || isTecnico || isManager;

  // Terminal states — no action needed
  if (['completed','rejected','cancelled','delivered_signed'].includes(status)) return null;

  // Build an ordered list of possible actions.
  // The FIRST one whose `when` evaluates to true wins.
  const checks = type === 'private' ? [

    // ── Comercial inicial ───────────────────────────────────────────
    { tabId: 'comercial',
      description: 'Completa los datos de la solicitud para iniciar el flujo comercial.',
      actor: 'Asesor Comercial',
      when: status === 'pending_commercial' && (isComercial || isManager) },

    // ── Backoffice → enviar a ACP ───────────────────────────────────
    { tabId: 'flujo_comercial',
      description: 'Solicita disponibilidad a ACP Comercial para preparar la oferta.',
      actor: 'Backoffice Comercial',
      when: status === 'pending_backoffice' && (isBackoffice || isManager) },

    // ── ACP → verificar disponibilidad ─────────────────────────────
    { tabId: 'disponibilidad',
      description: 'Verifica disponibilidad en inventario interno o solicita al proveedor.',
      actor: 'ACP Comercial',
      when: status === 'sent_to_acp' && (isAcp || isManager) },

    // ── ACP → registrar respuesta del proveedor ────────────────────
    { tabId: 'disponibilidad',
      description: 'Registra la respuesta del proveedor sobre disponibilidad del equipo.',
      actor: 'ACP Comercial',
      when: status === 'acp_availability_requested' && !purchase?.provider_response_at && (isAcp || isManager) },

    // ── Asesor Comercial → confirmar respuesta del proveedor con el cliente ───
    { tabId: 'disponibilidad',
      description: 'Confirma con el cliente la respuesta del proveedor y autoriza continuar o cancelar el proceso.',
      actor: 'Asesor Comercial',
      when: status === 'acp_availability_requested' && Boolean(purchase?.provider_response_at) && (isComercial || isManager) },

    // ── Backoffice → preparar oferta ───────────────────────────────
    { tabId: 'flujo_comercial',
      description: 'Prepara y sube la oferta sin firmar para enviarla al cliente.',
      actor: 'Backoffice Comercial',
      when: ['acp_availability_confirmed','price_improvement_requested'].includes(status) && (isBackoffice || isManager) },

    // ── Comercial → CU (condición de uso) ─────────────────────────
    { tabId: 'disponibilidad',
      description: 'Registra si el cliente acepta el equipo en condición de uso (CU).',
      actor: 'Asesor Comercial',
      urgent: true,
      when: status === 'acp_availability_cu_pending' && (isComercial || isManager) },

    // ── Comercial → importación vinculante ─────────────────────────
    { tabId: 'disponibilidad',
      description: 'Obtén la confirmación del cliente para proceder con la importación.',
      actor: 'Asesor Comercial',
      urgent: true,
      when: status === 'acp_availability_import_pending' && (isComercial || isManager) },

    // ── Comercial → subir oferta firmada ───────────────────────────
    { tabId: 'flujo_comercial',
      description: 'Sube la oferta firmada por el cliente para avanzar al contrato.',
      actor: 'Asesor Comercial',
      when: ['offer_sent','pending_client_signature'].includes(status) && (isComercial || isManager) },

    // ── Comercial → rechazar oferta (jefe) ─────────────────────────
    { tabId: 'flujo_comercial',
      description: 'Evalúa el rechazo de oferta: acepta el cierre o solicita mejora de precio.',
      actor: 'Jefe Comercial',
      when: status === 'offer_rejected_by_commercial' && isManager },

    // ── Comercial → registrar cliente ──────────────────────────────
    { tabId: 'flujo_comercial',
      description: 'Registra al cliente en el sistema para habilitar el contrato.',
      actor: 'Asesor Comercial',
      urgent: !purchase?.client_registered_at,
      when: ['offer_signed','client_registration_requested'].includes(status) && !purchase?.client_registered_at && (isComercial || isBackoffice || isManager) },

    // Solicitar inspección: es acción del asesor comercial, va en Flujo Comercial
    { tabId: 'flujo_comercial',
      description: 'Solicita la inspección de ambiente para que Servicio Técnico planifique la visita.',
      actor: 'Asesor Comercial',
      urgent: true,
      when: !inspectionHandledByBc && status === 'client_registered' && !purchase?.inspection_request_id && (isComercial || isBackoffice || isManager) },

    // ── ACP → solicitar proforma al proveedor ─────────────────────
    { tabId: 'disponibilidad',
      description: 'Envía email al proveedor solicitando la proforma para los equipos confirmados.',
      actor: 'ACP Comercial',
      when: status === 'acp_availability_confirmed' && !purchase?.extra?.proforma_request_sent_at && (isAcp || isManager) },

    // ── ACP → subir proforma sin firmar + reserva ─────────────────
    { tabId: 'disponibilidad',
      description: 'Sube la proforma sin firmar enviada por el proveedor; se activa la reserva del equipo.',
      actor: 'ACP Comercial',
      when: status === 'acp_availability_confirmed' && Boolean(purchase?.extra?.proforma_request_sent_at) && !purchase?.extra?.proforma_file_id && (isAcp || isManager) },

    // ── ACP → subir proforma firmada (habilita contrato) ──────────
    { tabId: 'disponibilidad',
      description: 'Firma y sube la proforma del proveedor para habilitar la gestión del contrato.',
      actor: 'Gerencia General / ACP Comercial',
      when: status === 'acp_availability_confirmed' && Boolean(purchase?.extra?.proforma_file_id) && !purchase?.extra?.proforma_signed_file_id && (isAcp || isManager) },

    // ── Backoffice → generar contrato borrador (después de proforma firmada) ─
    { tabId: 'contrato',
      description: 'Genera el contrato borrador y envíalo al asesor comercial para firma del cliente.',
      actor: 'Backoffice Comercial',
      when: Boolean(purchase?.extra?.proforma_signed_file_id) && (
        (status === 'client_registered' && inspectionHandledByBc) ||
        (status === 'inspection_requested' && (purchase?.site_inspection_ready_for_installation || purchase?.inspection_site_ready_for_installation))
      ) && !purchase?.contract_document_id && (isBackoffice || isManager) },

    // ── Comercial → firmar contrato cliente ────────────────────────
    { tabId: 'contrato',
      description: 'Sube el contrato firmado por el cliente.',
      actor: 'Asesor Comercial',
      when: status === 'pending_contract_client_signature' && !purchase?.contract_client_signed_document_id && (isComercial || isManager) },

    // ── Gerencia/ACP → firmar contrato (último paso) ──────────────
    { tabId: 'contrato',
      description: 'Sube el contrato firmado por gerencia para habilitar la logística.',
      actor: 'Gerencia General / ACP Comercial',
      when: status === 'pending_contract_approval' && !purchase?.contract_signed_document_id && (isManager || isAcp) },

    // ── Comercial → solicitar fechas de entrega ────────────────────
    { tabId: 'logistica',
      description: 'Solicita las fechas de entrega del equipo al equipo de logística.',
      actor: 'Asesor Comercial',
      when: status === 'contract_available' && (isComercial || isManager) },

    // ── Logística/Ops → registrar fechas ──────────────────────────
    { tabId: 'logistica',
      description: 'Registra las fechas de entrega propuestas para el despacho del equipo.',
      actor: 'Logística / Operaciones',
      when: status === 'delivery_dates_requested' && isDelivery },

    // ── Backoffice → confirmar fechas ──────────────────────────────
    { tabId: 'logistica',
      description: 'Revisa y confirma las fechas de entrega registradas por logística.',
      actor: 'Backoffice Comercial',
      when: status === 'delivery_dates_submitted' && (isBackoffice || isManager) },

    // ── Logística → despacho ───────────────────────────────────────
    { tabId: 'logistica',
      description: 'Coordina y registra el despacho del equipo al cliente.',
      actor: 'Logística / Operaciones',
      when: ['waiting_dispatch','dispatch_ready'].includes(status) && isDelivery },

    // Jefe Tecnico -> planificar inspeccion
    { tabId: 'tecnica',
      description: 'Asigna tecnico y fecha segun el cronograma de Servicio Tecnico.',
      actor: 'Jefe Tecnico',
      urgent: true,
      when: !inspectionHandledByBc && status === 'inspection_requested' && !purchase?.inspection_scheduled_date && (isTecnico || isManager) },

    // Tecnico -> registrar F.ST-07
    { tabId: 'tecnica',
      description: 'Registra el F.ST-07 de inspeccion de ambiente realizada en sitio.',
      actor: 'Tecnico',
      when: !inspectionHandledByBc && ['inspection_requested','inspection_coordinated'].includes(status) && purchase?.inspection_scheduled_date && !(purchase?.site_inspection_ready_for_installation || purchase?.inspection_site_ready_for_installation) && (isTecnico || isManager) },

    // ── Técnico → instalación ──────────────────────────────────────
    { tabId: 'tecnica',
      description: 'Registra el avance de la instalación del equipo en el sitio del cliente.',
      actor: 'Técnico',
      when: ['installation_pending','installation_in_progress'].includes(status) && (isTecnico || isLogistica || isManager) },

  ] : [
    // ═══ COMPRA PÚBLICA ═══════════════════════════════════════════

    { tabId: 'comercial',
      description: 'Completa los detalles del expediente para enviarlo a disponibilidad.',
      actor: 'Comercial / Backoffice',
      when: ['draft','pending_backoffice_review'].includes(status) && (isComercial || isBackoffice || isManager) },

    { tabId: 'disponibilidad',
      description: 'Asigna el proveedor e inicia la consulta de disponibilidad.',
      actor: 'ACP Comercial',
      when: status === 'pending_provider_assignment' && (isAcp || isManager) },

    { tabId: 'disponibilidad',
      description: 'Registra la respuesta del proveedor sobre disponibilidad del equipo.',
      actor: 'ACP Comercial',
      when: status === 'waiting_provider_response' && (isAcp || isManager) },

    { tabId: 'disponibilidad',
      description: 'Registra si el cliente acepta la disponibilidad en condición de uso.',
      actor: 'Asesor Comercial',
      urgent: true,
      when: status === 'waiting_client_cu_approval' && (isComercial || isManager) },

    { tabId: 'disponibilidad',
      description: 'Confirma que tienes al cliente asegurado para proceder con la importación.',
      actor: 'ACP Comercial',
      urgent: true,
      when: status === 'waiting_acp_import_confirmation' && (isAcp || isManager) },

    { tabId: 'acp',
      description: 'Gestiona la proforma: solicita, confirma reserva y sube la versión firmada.',
      actor: 'ACP Comercial',
      when: ['waiting_proforma','proforma_received','waiting_signed_proforma'].includes(status) && (isAcp || isManager) },

    { tabId: 'acp',
      description: 'Completa el checklist del portal e ingresa la oferta al sistema.',
      actor: 'ACP Comercial',
      when: ['portal_checklist_pending','pending_portal_submission'].includes(status) && (isAcp || isManager) },

    { tabId: 'contrato',
      description: 'Sube el contrato del proceso de contratación pública.',
      actor: 'ACP Comercial / Backoffice',
      when: ['pending_contract','contract_available'].includes(status) && (isAcp || isBackoffice || isManager) },

    { tabId: 'logistica',
      description: 'Registra las fechas de entrega del equipo.',
      actor: 'Logística / Operaciones',
      when: status === 'delivery_dates_requested' && isDelivery },

    { tabId: 'logistica',
      description: 'Coordina el despacho del equipo al cliente.',
      actor: 'Logística / Operaciones',
      when: ['waiting_dispatch','dispatch_ready'].includes(status) && isDelivery },

    { tabId: 'tecnica',
      description: 'Coordina y registra la inspección técnica del equipo.',
      actor: 'Técnico',
      when: ['inspection_requested','inspection_coordinated'].includes(status) && (isTecnico || isManager) },

    { tabId: 'tecnica',
      description: 'Registra el avance de la instalación en sitio del cliente.',
      actor: 'Técnico',
      when: ['installation_pending','installation_in_progress'].includes(status) && (isTecnico || isLogistica || isManager) },
  ];

  return checks.find((c) => c.when) || null;
}

/* ─────────────────────────────────────────────────────────────────────────
   computeWaitingState
   When the current user has NO action to take but the process is actively
   moving (another role is responsible), returns a waiting-state descriptor:
     { waitingFor: string, description: string }
   Returns null if not in a waiting state for this user.
───────────────────────────────────────────────────────────────────────── */
function computeWaitingState(purchase, type, userRoles = []) {
  if (!purchase) return null;

  const status = purchase?.status || '';
  const roles  = new Set(userRoles);
  const inspectionHandledByBc = purchaseInspectionHandledByBusinessCase(purchase, type);

  const isComercial  = roles.has('comercial') || roles.has('asesor_comercial') || roles.has('analista_comercial');
  const isBackoffice = roles.has('backoffice') || roles.has('backoffice_comercial');
  const isAcp        = roles.has('acp_comercial');
  const isManager    = ['gerencia','gerencia_general','jefe_comercial','jefe_de_comercial'].some(r => roles.has(r));
  const isTecnico    = ['tecnico','jefe_tecnico','jefe_servicio_tecnico'].some(r => roles.has(r));
  const isLogistica  = roles.has('logistica') || roles.has('jefe_logistica');
  const isOps        = roles.has('operaciones') || roles.has('jefe_operaciones');
  const isDelivery   = isLogistica || isOps || isTecnico;

  // Managers always see a next action — never in a pure waiting state
  if (isManager) return null;
  if (['completed','rejected','cancelled','delivered_signed'].includes(status)) return null;

  const checks = type === 'private' ? [

    { waitingFor: 'Backoffice Comercial',
      description: 'Está revisando la solicitud y la enviará a ACP para verificar disponibilidad.',
      when: status === 'pending_backoffice' && (isComercial || isAcp) },

    { waitingFor: 'ACP Comercial',
      description: 'Está verificando disponibilidad del equipo en inventario interno o con el proveedor.',
      when: status === 'sent_to_acp' && (isComercial || isBackoffice) },

    { waitingFor: 'ACP Comercial',
      description: 'Está registrando la respuesta del proveedor sobre disponibilidad del equipo.',
      when: status === 'acp_availability_requested' && !purchase?.provider_response_at && (isComercial || isBackoffice) },

    { waitingFor: 'Asesor Comercial',
      description: 'Debe confirmar con el cliente la respuesta del proveedor y autorizar continuar o cancelar el proceso.',
      when: status === 'acp_availability_requested' && Boolean(purchase?.provider_response_at) && (isBackoffice || isAcp) },

    { waitingFor: 'Backoffice Comercial',
      description: 'Está preparando la oferta para enviar al cliente.',
      when: status === 'price_improvement_requested' && (isComercial || isAcp) },

    { waitingFor: 'ACP Comercial',
      description: 'Debe solicitar la proforma al proveedor para los equipos confirmados.',
      when: status === 'acp_availability_confirmed' && !purchase?.extra?.proforma_request_sent_at && (isComercial || isBackoffice) },

    { waitingFor: 'ACP Comercial',
      description: 'Está esperando la proforma del proveedor para activar la reserva del equipo.',
      when: status === 'acp_availability_confirmed' && Boolean(purchase?.extra?.proforma_request_sent_at) && !purchase?.extra?.proforma_file_id && (isComercial || isBackoffice) },

    { waitingFor: 'Gerencia General / ACP Comercial',
      description: 'Debe firmar y aprobar la proforma del proveedor para habilitar la gestión del contrato.',
      when: status === 'acp_availability_confirmed' && Boolean(purchase?.extra?.proforma_file_id) && !purchase?.extra?.proforma_signed_file_id && (isComercial || isBackoffice) },

    { waitingFor: 'Asesor Comercial',
      description: 'Está gestionando la firma del cliente en la oferta enviada.',
      when: ['offer_sent','pending_client_signature'].includes(status) && (isBackoffice || isAcp) },

    { waitingFor: 'Asesor Comercial',
      description: 'Debe registrar al cliente en el sistema para habilitar el contrato.',
      when: ['offer_signed','client_registration_requested'].includes(status) && !purchase?.client_registered_at && (isBackoffice || isAcp) },

    { waitingFor: 'Gerencia General / ACP Comercial',
      description: 'Está subiendo el contrato firmado por gerencia para cerrar la gestión contractual.',
      when: status === 'pending_contract_approval' && (isComercial || isBackoffice) },

    { waitingFor: 'Asesor Comercial',
      description: 'Debe coordinar la firma del cliente y subir el contrato firmado.',
      when: status === 'pending_contract_client_signature' && (isBackoffice || isAcp) },

    { waitingFor: 'Backoffice Comercial',
      description: 'Debe generar el contrato borrador y enviarlo al asesor comercial para firma del cliente.',
      when: Boolean(purchase?.extra?.proforma_signed_file_id) && (
        (status === 'client_registered' && inspectionHandledByBc) ||
        (status === 'inspection_requested' && (purchase?.site_inspection_ready_for_installation || purchase?.inspection_site_ready_for_installation))
      ) && !purchase?.contract_document_id && (isComercial || isAcp) },

    { waitingFor: 'Asesor Comercial',
      description: 'Debe solicitar las fechas de entrega del equipo al equipo de logística.',
      when: status === 'contract_available' && (isBackoffice || isAcp) },

    { waitingFor: 'Logística / Operaciones',
      description: 'Está registrando las fechas de entrega propuestas para el despacho del equipo.',
      when: status === 'delivery_dates_requested' && (isComercial || isBackoffice) },

    { waitingFor: 'Backoffice Comercial',
      description: 'Debe revisar y confirmar las fechas de entrega registradas por logística.',
      when: status === 'delivery_dates_submitted' && (isComercial || isDelivery) },

    { waitingFor: 'Logística / Técnico',
      description: 'El equipo de despacho está coordinando la entrega del equipo.',
      when: ['waiting_dispatch','dispatch_ready'].includes(status) && isComercial },

    { waitingFor: 'Técnico',
      description: 'Está coordinando la inspección técnica del equipo en el sitio del cliente.',
      when: ['inspection_requested','inspection_coordinated'].includes(status) && (isComercial || isBackoffice || isDelivery) },

    { waitingFor: 'Técnico',
      description: 'Está realizando la instalación del equipo en el sitio del cliente.',
      when: ['installation_pending','installation_in_progress'].includes(status) && (isComercial || isBackoffice) },

  ] : [

    { waitingFor: 'ACP Comercial',
      description: 'Está asignando el proveedor e iniciando la consulta de disponibilidad.',
      when: status === 'pending_provider_assignment' && (isComercial || isBackoffice) },

    { waitingFor: 'ACP Comercial',
      description: 'Está esperando y registrando la respuesta del proveedor sobre disponibilidad.',
      when: status === 'waiting_provider_response' && (isComercial || isBackoffice) },

    { waitingFor: 'Asesor Comercial',
      description: 'Debe registrar si el cliente acepta la disponibilidad en condición de uso.',
      when: status === 'waiting_client_cu_approval' && (isAcp || isBackoffice) },

    { waitingFor: 'ACP Comercial',
      description: 'Debe confirmar que el cliente está asegurado para proceder con la importación.',
      when: status === 'waiting_acp_import_confirmation' && (isComercial || isBackoffice) },

    { waitingFor: 'ACP Comercial',
      description: 'Está gestionando la proforma: confirmación de reserva y versión firmada.',
      when: ['waiting_proforma','proforma_received','waiting_signed_proforma'].includes(status) && (isComercial || isBackoffice) },

    { waitingFor: 'ACP Comercial',
      description: 'Está completando el checklist del portal e ingresando la oferta al sistema.',
      when: ['portal_checklist_pending','pending_portal_submission'].includes(status) && (isComercial || isBackoffice) },

    { waitingFor: 'ACP Comercial / Backoffice',
      description: 'Está gestionando el contrato del proceso de contratación pública.',
      when: ['pending_contract','contract_available'].includes(status) && isComercial },

    { waitingFor: 'Logística / Operaciones',
      description: 'Está registrando las fechas de entrega del equipo.',
      when: status === 'delivery_dates_requested' && (isComercial || isBackoffice) },

    { waitingFor: 'Logística / Operaciones',
      description: 'Está coordinando el despacho del equipo al cliente.',
      when: ['waiting_dispatch','dispatch_ready'].includes(status) && isComercial },

    { waitingFor: 'Técnico',
      description: 'Está coordinando la inspección técnica del equipo en sitio.',
      when: ['inspection_requested','inspection_coordinated'].includes(status) && (isComercial || isBackoffice) },

    { waitingFor: 'Técnico',
      description: 'Está realizando la instalación del equipo en el sitio del cliente.',
      when: ['installation_pending','installation_in_progress'].includes(status) && (isComercial || isBackoffice) },

  ];

  return checks.find((c) => c.when) || null;
}

const normalizeRoles = (user) => {
  if (!user) return [];
  const raw = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? user?.scope ?? [];
  const arr  = Array.isArray(raw) ? raw : [raw];
  return arr.flatMap((r) => String(r || '').split(/[,\s]+/)).map((t) => t.toLowerCase().trim()).filter(Boolean);
};

const OFFER_KIND_LABELS = {
  venta:                          'Venta',
  alquiler:                       'Alquiler',
  alquiler_transferencia_dominio: 'Alquiler con transferencia de dominio',
  comodato:                       'Comodato',
};

const SERIAL_STATUS_LABELS = {
  not_applicable_yet:    'No aplica aún',
  pending_reception:     'Pendiente recepción',
  received_pending_serial: 'Recibido — pendiente serial',
  serial_registered:     'Serial registrado',
};

const AVAIL_STATUS_LABELS = {
  not_checked:                   'No consultado',
  internal_available_ready:      'Disponible interno',
  supplier_requested:            'Solicitado al proveedor',
  supplier_confirmed:            'Confirmado por proveedor',
  supplier_rejected:             'Rechazado por proveedor',
  alternative_required:          'Requiere alternativa',
  availability_confirmed:        'Disponibilidad confirmada',
  cu_available_pending_approval: 'CU — pendiente cliente',
};

const TABS_PUBLIC = [
  { id: 'comercial',      label: 'Comercial',          icon: FiBriefcase   },
  { id: 'disponibilidad', label: 'Disponibilidad',     icon: FiCheckCircle },
  { id: 'acp',            label: 'ACP / Portal',        icon: FiGlobe       },
  { id: 'contrato',       label: 'Contrato',            icon: FiFileText    },
  { id: 'logistica',      label: 'Logística Equipo',    icon: FiPackage     },
  { id: 'tecnica',        label: 'Técnica',             icon: FiTool        },
  { id: 'entrenamiento',  label: 'Entrenamiento',       icon: FiBookOpen    },
  { id: 'insumos',        label: 'Control de Insumos',  icon: FiGrid        },
  { id: 'timeline',       label: 'Timeline',            icon: FiClock       },
  { id: 'auditoria',      label: 'Auditoria',           icon: FiShield      },
];

/* Compra privada: Flujo Comercial en lugar de ACP/Portal (no aplica en privadas) */
const TABS_PRIVATE = [
  { id: 'comercial',      label: 'Comercial',          icon: FiBriefcase   },
  { id: 'flujo_comercial',label: 'Flujo Comercial',    icon: FiTrendingUp  },
  { id: 'disponibilidad', label: 'Disponibilidad',     icon: FiCheckCircle },
  { id: 'contrato',       label: 'Contrato',            icon: FiFileText    },
  { id: 'logistica',      label: 'Logística Equipo',    icon: FiPackage     },
  { id: 'tecnica',        label: 'Técnica',             icon: FiTool        },
  { id: 'entrenamiento',  label: 'Entrenamiento',       icon: FiBookOpen    },
  { id: 'insumos',        label: 'Control de Insumos',  icon: FiGrid        },
  { id: 'timeline',       label: 'Timeline',            icon: FiClock       },
  { id: 'auditoria',      label: 'Auditoria',           icon: FiShield      },
];

function SkeletonBlock({ className = '' }) {
  return <div className={`bg-slate-200 rounded-xl animate-pulse ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <SkeletonBlock className="h-6 w-1/3" />
      <SkeletonBlock className="h-4 w-1/2" />
      <div className="space-y-3 mt-6">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-14" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="p-3 bg-red-50 rounded-2xl">
        <FiAlertCircle size={24} className="text-alert-red" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-slate">No se pudo cargar el expediente</p>
        <p className="text-xs text-warm-ash mt-1">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-ink-slate hover:bg-slate-50 transition-colors duration-150 cursor-pointer shadow-sm"
      >
        <FiRefreshCw size={13} aria-hidden="true" />
        Reintentar
      </button>
    </div>
  );
}

const PurchaseExpedienteDetail = ({ id, type }) => {
  const { user }     = useAuth();
  const userRoles    = useMemo(() => normalizeRoles(user), [user]);
  const hasRole      = (token) => userRoles.some((r) => r === token || r.includes(token));

  const { purchase, timeline, loading, error, refresh } = usePurchaseExpediente(id, type);
  const prefersReducedMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState('comercial');

  const canViewAudit = hasRole('jefe_ti') || hasRole('gerencia_general');
  const tabs = useMemo(() => {
    const base = type === 'public' ? TABS_PUBLIC : TABS_PRIVATE;
    return canViewAudit ? base : base.filter((t) => t.id !== 'auditoria');
  }, [type, canViewAudit]);
  const pendingTabs = useMemo(() => computePendingTabs(purchase, type, userRoles), [purchase, type, userRoles]);
  const { locked: lockedTabs, done: doneTabs } = useMemo(
    () => computeTabStates(purchase, type),
    [purchase, type],
  );
  const nextAction    = useMemo(() => computeNextAction(purchase, type, userRoles),    [purchase, type, userRoles]);
  const waitingState  = useMemo(() => computeWaitingState(purchase, type, userRoles),  [purchase, type, userRoles]);

  // If the active tab is locked (stage not reached yet), fall back to 'comercial'
  useEffect(() => {
    if (lockedTabs.has(activeTab) || !tabs.some((t) => t.id === activeTab)) setActiveTab('comercial');
  }, [lockedTabs, activeTab, tabs]);

  const tabProps = { purchase, type, userRoles, hasRole, refresh };

  if (loading && !purchase) return <LoadingSkeleton />;
  if (error)                 return <ErrorState message={error} onRetry={refresh} />;
  if (!purchase)             return null;

  const offerLabel = type === 'public'
    ? 'Compra Pública'
    : (OFFER_KIND_LABELS[purchase.offer_kind] || purchase.offer_kind || '—');

  const clientName = type === 'public'
    ? (purchase.equipment?.[0]?.provider_name || purchase.provider_name || '—')
    : (purchase.client_data?.commercial_name || purchase.client_data?.legal_person_business_name || '—');

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Expediente header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash">
                {type === 'public' ? 'Compra Pública' : 'Compra Privada'}
              </span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] font-medium text-warm-ash">{offerLabel}</span>
            </div>
            <h2 className="text-base font-semibold text-ink-slate tracking-tight mt-0.5 truncate">
              {clientName}
            </h2>
            {purchase.equipment && (
              <p className="text-xs text-warm-ash mt-0.5 truncate">
                {Array.isArray(purchase.equipment)
                  ? purchase.equipment.map((e) => e.model || e.name || e.equipment_name).filter(Boolean).join(', ')
                  : '—'}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {purchase.serial_status && purchase.serial_status !== 'not_applicable_yet' && (
              <span className="text-[10px] font-medium text-slate-500 hidden sm:block">
                {SERIAL_STATUS_LABELS[purchase.serial_status]}
              </span>
            )}
            {purchase.availability_status && purchase.availability_status !== 'not_checked' && (
              <span className="text-[10px] font-medium text-slate-500 hidden sm:block">
                {AVAIL_STATUS_LABELS[purchase.availability_status]}
              </span>
            )}
            <button
              onClick={refresh}
              aria-label="Actualizar expediente"
              disabled={loading}
              className={`p-1.5 rounded-lg text-warm-ash hover:bg-slate-100 transition-colors duration-150 cursor-pointer ${loading ? 'opacity-40' : ''}`}
            >
              <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Panel "Próxima acción" / "En espera" ───────────────────── */}
      <AnimatePresence>
        {/* ── Acción disponible para el usuario ────────────────────── */}
        {nextAction && activeTab !== nextAction.tabId && (
          <motion.div
            key="next-action"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className={`px-6 py-2.5 border-b flex items-center gap-3 ${
              nextAction.urgent
                ? 'bg-amber-50 border-amber-200'
                : 'bg-action-blue/5 border-action-blue/20'
            }`}>
              {/* Icon */}
              <div className={`p-1.5 rounded-lg shrink-0 ${
                nextAction.urgent ? 'bg-amber-100 text-amber-600' : 'bg-action-blue/10 text-action-blue'
              }`}>
                <FiZap size={13} />
              </div>

              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    nextAction.urgent ? 'text-amber-700' : 'text-action-blue'
                  }`}>
                    Tu próxima acción
                  </span>
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium ${
                    nextAction.urgent
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-action-blue/10 text-action-blue border border-action-blue/20'
                  }`}>
                    {nextAction.actor}
                  </span>
                </div>
                <p className={`text-xs font-medium mt-0.5 truncate ${
                  nextAction.urgent ? 'text-amber-900' : 'text-ink-slate'
                }`}>
                  {nextAction.description}
                </p>
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={() => setActiveTab(nextAction.tabId)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-[0.97] ${
                  nextAction.urgent
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-action-blue text-white hover:bg-action-blue/90'
                }`}
              >
                {tabs.find((t) => t.id === nextAction.tabId)?.label ?? nextAction.tabId}
                <FiArrowRight size={12} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── En espera: otro rol está actuando ────────────────────── */}
        {!nextAction && waitingState && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
              {/* Icon */}
              <div className="p-1.5 rounded-lg shrink-0 bg-slate-200 text-slate-500">
                <FiClock size={13} />
              </div>

              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    En espera
                  </span>
                  <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-slate-200 text-slate-600 border border-slate-300">
                    {waitingState.waitingFor}
                  </span>
                </div>
                <p className="text-xs font-medium mt-0.5 truncate text-slate-600">
                  {waitingState.description}
                </p>
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                aria-label="Actualizar"
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors duration-150 cursor-pointer disabled:opacity-40"
              >
                <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Horizontal tab bar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div
          className="flex items-center gap-0 px-4 h-10 min-w-max"
          role="tablist"
          aria-label="Secciones del expediente"
        >
          {tabs.map((tab, index) => {
            const Icon          = tab.icon;
            const isActive      = activeTab === tab.id;
            const isLocked      = lockedTabs.has(tab.id);
            const isDone        = !isLocked && doneTabs.has(tab.id);
            // En curso: la etapa ya empezó pero aún no está completada (visible incluso cuando no es la tab activa)
            const isCurrentStage = !isLocked && !isDone;
            const isInProgress  = isCurrentStage && !isActive;
            const hasPending    = !isActive && !isLocked && pendingTabs.has(tab.id);
            return (
              <motion.button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-disabled={isLocked}
                title={
                  isLocked
                    ? 'Esta etapa aún no ha comenzado'
                    : isDone
                    ? `${tab.label} — Etapa completada`
                    : isInProgress
                    ? `${tab.label} — En curso`
                    : tab.label
                }
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.03, duration: 0.14, ease: EASE_OUT }}
                onClick={() => !isLocked && setActiveTab(tab.id)}
                className={`
                  relative inline-flex items-center gap-1.5 px-3 h-full text-[11px] font-medium
                  whitespace-nowrap flex-shrink-0 border-b-2 -mb-px
                  transition-colors duration-150
                  ${isLocked
                    ? 'border-transparent text-slate-300 cursor-not-allowed select-none'
                    : isActive
                    ? 'border-action-blue text-ink-slate cursor-pointer'
                    : isDone
                    ? 'border-transparent text-operative-green/70 hover:text-operative-green hover:border-green-200 cursor-pointer'
                    : isInProgress
                    ? 'border-transparent text-amber-600/80 hover:text-amber-700 hover:border-amber-300 cursor-pointer'
                    : 'border-transparent text-warm-ash hover:text-ink-slate hover:border-slate-200 cursor-pointer'
                  }
                `}
              >
                {isLocked
                  ? <FiLock size={10} aria-hidden="true" className="text-slate-300" />
                  : isDone
                  ? <FiCheckCircle size={11} aria-hidden="true" className={isActive ? 'text-operative-green' : 'text-operative-green/60'} />
                  : isInProgress
                  ? <FiActivity size={11} aria-hidden="true" className="text-amber-500" />
                  : <Icon size={11} aria-hidden="true" />
                }
                <span className={isLocked ? 'opacity-40' : ''}>{tab.label}</span>
                {hasPending && (
                  <span
                    aria-label="Acción pendiente"
                    className="ml-0.5 w-1.5 h-1.5 rounded-full bg-alert-red shrink-0 animate-pulse"
                  />
                )}
                {isInProgress && !hasPending && (
                  <span
                    aria-label="En curso"
                    className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Scrollable tab content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: EASE_OUT }}
            className="p-5"
          >
            {activeTab === 'comercial'      && <CommercialTab         {...tabProps} />}
            {activeTab === 'flujo_comercial'&& <PrivateFlowTab        {...tabProps} />}
            {activeTab === 'disponibilidad' && <AvailabilityTab       {...tabProps} />}
            {activeTab === 'acp'            && <PublicAcpTab          {...tabProps} />}
            {activeTab === 'contrato'      && <ContractTab            {...tabProps} />}
            {activeTab === 'logistica'     && <EquipmentLogisticsTab  {...tabProps} />}
            {activeTab === 'tecnica'       && <TechnicalTab           {...tabProps} />}
            {activeTab === 'entrenamiento' && <TrainingTab            {...tabProps} />}
            {activeTab === 'insumos'       && <SupplyControlTab       {...tabProps} />}
            {activeTab === 'timeline'      && <ExpedienteTimelineTab  {...tabProps} timeline={timeline} />}
            {activeTab === 'auditoria'     && canViewAudit && <ExpedienteAuditTab {...tabProps} timeline={timeline} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PurchaseExpedienteDetail;
