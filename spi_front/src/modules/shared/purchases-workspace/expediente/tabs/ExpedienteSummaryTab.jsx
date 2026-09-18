import React from 'react';
import { FiActivity, FiCheckCircle, FiLock, FiClock, FiZap } from 'react-icons/fi';
import TabBadge from '../../components/TabBadge';
import CommercialTab from './CommercialTab';

const STATUS_CONFIG = {
  done:    { label: 'Completado', cls: 'bg-green-soft text-operative-green border-green-200',  Icon: FiCheckCircle },
  active:  { label: 'En curso',   cls: 'bg-amber-soft text-caution-amber border-amber-200',     Icon: FiActivity    },
  locked:  { label: 'Bloqueado',  cls: 'bg-slate-100 text-slate-400 border-slate-200',          Icon: FiLock        },
  pending: { label: 'Pendiente',  cls: 'bg-slate-100 text-slate-500 border-slate-200',          Icon: FiClock       },
};

/* Fechas + actor reales que cada tab ya expone (completedAt de sus
   WorkflowStep, y las columnas *_by_email ya existentes en la base) — se
   reutilizan tal cual para no inventar campos. Cada tab devuelve una lista
   de eventos {at, actor}; se toma el más reciente como "última actividad". */
const TAB_ACTIVITY_GETTERS = {
  comercial: (p) => [{ at: p?.created_at, actor: p?.created_by_email || p?.created_by }],
  flujo_comercial: (p) => [
    { at: p?.offer_signed_uploaded_at, actor: p?.flujo_comercial_last_actor_email },
    { at: p?.client_registered_at, actor: p?.flujo_comercial_last_actor_email },
    { at: p?.inspection_requested_at, actor: p?.flujo_comercial_last_actor_email },
  ],
  disponibilidad: (p) => [
    { at: p?.availability_email_sent_at, actor: p?.disponibilidad_last_actor_email },
    { at: p?.provider_response_at, actor: p?.disponibilidad_last_actor_email },
    { at: p?.extra?.proforma_request_sent_at, actor: p?.disponibilidad_last_actor_email },
    { at: p?.extra?.proforma_uploaded_at, actor: p?.disponibilidad_last_actor_email },
    { at: p?.extra?.proforma_signed_uploaded_at, actor: p?.disponibilidad_last_actor_email },
  ],
  acp: (p) => [
    { at: p?.availability_email_sent_at, actor: p?.disponibilidad_last_actor_email },
    { at: p?.provider_response_at, actor: p?.disponibilidad_last_actor_email },
  ],
  contrato: (p) => [
    { at: p?.contract_uploaded_at, actor: p?.contrato_last_actor_email },
    { at: p?.contract_client_signed_uploaded_at, actor: p?.contrato_last_actor_email },
    { at: p?.manager_contract_decision_at, actor: p?.contrato_last_actor_email },
    { at: p?.contract_signed_uploaded_at, actor: p?.contrato_last_actor_email },
    { at: p?.provider_contract_received_at, actor: p?.contrato_last_actor_email },
    { at: p?.provider_contract_uploaded_at, actor: p?.contrato_last_actor_email },
  ],
  tecnica: (p) => [
    { at: p?.inspection_coordinated_at, actor: p?.inspection_coordinated_by_email },
    { at: p?.inspection_registered_at, actor: p?.site_inspection_updated_by_email },
    { at: p?.installation_workflow?.visual_reception?.inspection_date, actor: null },
    { at: p?.installation_workflow?.verification_decision?.decided_at, actor: null },
  ],
};

const latestActivity = (events = []) => {
  const valid = events
    .filter((e) => e.at)
    .map((e) => ({ ...e, date: new Date(e.at) }))
    .filter((e) => !Number.isNaN(e.date.getTime()));
  if (!valid.length) return { date: null, actor: null };
  return valid.reduce((latest, e) => (e.date > latest.date ? e : latest));
};

const fmtDateTime = (date) => {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  } catch { return null; }
};

/* Resumen del expediente: siempre visible para cualquier rol, incluso si no
   participa en ninguna etapa. Muestra estado, responsable, última actividad
   real (fecha) y el siguiente paso cuando aplica, para orientarse sin tener
   que abrir cada tab. */
const ExpedienteSummaryTab = ({
  purchase, type, userRoles, hasRole, refresh,
  tabs = [], lockedTabs, doneTabs, pendingTabs, tabRoleLabels = {}, onJumpToTab, nextAction,
}) => {
  const rows = tabs.filter((t) => t.id !== 'resumen' && t.id !== 'timeline' && t.id !== 'auditoria');
  const doneCount = rows.filter((t) => !lockedTabs?.has(t.id) && doneTabs?.has(t.id)).length;

  return (
    <div className="flex flex-col min-w-0">
      {/* Cliente, equipo, tipo de oferta — informacion transversal, visible
          para todos los roles independiente de si participan en la etapa. */}
      <CommercialTab purchase={purchase} type={type} userRoles={userRoles} hasRole={hasRole} refresh={refresh} />

      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-t border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Resumen</h2>
          <p className="text-xs text-warm-ash mt-0.5">Estado, responsable y próximo paso de cada etapa del expediente</p>
        </div>
        <TabBadge status={doneCount === rows.length && rows.length > 0 ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6">
        {!rows.length ? (
          <div className="bg-white rounded-xl border border-soft-border p-6 text-xs text-warm-ash text-center">
            No tienes etapas asignadas en este expediente.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
            <div className="space-y-1.5">
              {rows.map((tab) => {
                const isLocked = lockedTabs?.has(tab.id);
                const isDone   = !isLocked && doneTabs?.has(tab.id);
                const hasPending = !isLocked && !isDone && pendingTabs?.has(tab.id);
                const statusKey = isLocked ? 'locked' : isDone ? 'done' : hasPending ? 'active' : 'pending';
                const { label, cls, Icon } = STATUS_CONFIG[statusKey];
                const TabIcon = tab.icon;
                const { date: lastActivityDate, actor } = latestActivity(TAB_ACTIVITY_GETTERS[tab.id]?.(purchase) || []);
                const lastActivity = fmtDateTime(lastActivityDate);
                const isNextForMe = nextAction?.tabId === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !isLocked && onJumpToTab?.(tab.id)}
                    disabled={isLocked}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors duration-150 ${
                      isLocked
                        ? 'border-transparent cursor-not-allowed opacity-60'
                        : isNextForMe
                        ? 'border-action-blue/30 bg-action-blue/5 cursor-pointer hover:bg-action-blue/10'
                        : 'border-transparent cursor-pointer hover:bg-paper-white hover:border-soft-border'
                    }`}
                  >
                    <TabIcon size={14} className="text-warm-ash shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-slate truncate">{tab.label}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {tabRoleLabels[tab.id] && (
                          <p className="text-[11px] text-warm-ash truncate">Responsable: {tabRoleLabels[tab.id]}</p>
                        )}
                        {actor && (
                          <p className="text-[11px] text-warm-ash truncate">Por: {actor}</p>
                        )}
                        {lastActivity && (
                          <p className="text-[11px] text-warm-ash truncate">Última actividad: {lastActivity}</p>
                        )}
                      </div>
                      {isNextForMe && nextAction?.description && (
                        <p className="text-xs font-medium text-action-blue mt-1 flex items-start gap-1">
                          <FiZap size={11} className="shrink-0 mt-0.5" />
                          {nextAction.description}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
                      <Icon size={10} />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpedienteSummaryTab;
