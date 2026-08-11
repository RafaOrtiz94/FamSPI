/**
 * TechnicalTab
 *
 * Gestiona el flujo técnico desde el workspace:
 *   Paso 1 — Planificar visita y asignar técnico   (Jefe Técnico)
 *   Paso 2 — Registrar F.ST-07 Inspección de sitio (Técnico)
 *   Paso 3 — F.ST-14 Recepción visual              (Técnico)
 *   Paso 4 — F.ST-09 Verificación de instalación   (Técnico)
 *
 * NOTA: "Solicitar inspección de ambiente" se gestiona en PrivateFlowTab
 * (Flujo Comercial) ya que es responsabilidad del asesor/backoffice comercial.
 *
 * Si existe un Business Case vinculado, su inspección por costos se muestra
 * solo como referencia. La inspección operativa del proceso de compra siempre
 * se gestiona en este flujo técnico.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClipboard,
  FiTool,
  FiUserCheck,
  FiX,
  FiExternalLink,
} from 'react-icons/fi';
import WorkflowStep from '../../components/WorkflowStep';
import RoleGatedAction from '../../components/RoleGatedAction';
import TabBadge from '../../components/TabBadge';
import {
  coordinateInspectionDate as coordinatePublicInspectionDate,
  registerPublicPurchaseSiteInspection,
  updatePublicPurchaseInstallationWorkflow,
  getEquipmentPurchaseMeta,
} from '../../../../../core/api/equipmentPurchasesApi';
import {
  coordinatePrivatePurchaseInspectionDate,
  getPrivatePurchaseTechnicianSchedule,
  registerPrivatePurchaseSiteInspection,
  updatePrivatePurchaseInstallationWorkflow,
} from '../../../../../core/api/privatePurchasesApi';
import { PURCHASE_ROLE_GROUPS } from '../../purchaseRoleGroups';

const driveLink = (id) => (id ? `https://drive.google.com/file/d/${id}/view` : null);

/* ─────────────────────────────────────────── constantes ── */

const FST07_CHECKLIST = [
  { key: 'area_min_space',              label: 'Espacio requerido por el equipo',              section: 'Área', allowsNa: false },
  { key: 'area_pressure_temperature',   label: 'Presión y temperatura adecuadas',               section: 'Área', allowsNa: false },
  { key: 'area_humidity',               label: 'Humedad dentro del rango permitido',             section: 'Área', allowsNa: false },
  { key: 'area_free_dust',              label: 'Área libre de polvo o contaminación',            section: 'Área', allowsNa: false },
  { key: 'electrical_dedicated_outlets',label: 'Tomas eléctricas dedicadas',                    section: 'Eléctrico', allowsNa: false },
  { key: 'electrical_polarized_outlets',label: 'Tomas eléctricas polarizadas',                  section: 'Eléctrico', allowsNa: false },
  { key: 'electrical_breakers',         label: 'Breakers adecuados para la carga',              section: 'Eléctrico', allowsNa: false },
  { key: 'electrical_power_capacity',   label: 'Conexión soporta la potencia del equipo',       section: 'Eléctrico', allowsNa: false },
  { key: 'electrical_ups',              label: 'Toma protegida por UPS central',                section: 'Eléctrico', allowsNa: true  },
  { key: 'electrical_grounding',        label: 'Conexión a tierra menor a 1 V',                 section: 'Eléctrico', allowsNa: false },
  { key: 'water_intake',                label: 'Tomas de agua requeridas',                       section: 'Agua',      allowsNa: true  },
  { key: 'water_pressure',              label: 'Presión de agua adecuada',                       section: 'Agua',      allowsNa: true  },
  { key: 'water_drain',                 label: 'Desagüe necesario',                             section: 'Agua',      allowsNa: true  },
  { key: 'water_quality',               label: 'Calidad de agua adecuada',                       section: 'Agua',      allowsNa: true  },
  { key: 'remote_network_points',       label: 'Puntos de red cercanos al equipo',              section: 'Conectividad', allowsNa: false },
  { key: 'remote_internet',             label: 'Conexión a internet para acceso remoto',        section: 'Conectividad', allowsNa: false },
];

const defaultFst07 = () =>
  FST07_CHECKLIST.reduce((acc, item) => { acc[item.key] = 'SI'; return acc; }, {});

// Debe coincidir exactamente con DEFAULT_VISUAL_CHECKLIST en
// backend/src/modules/servicio/installationWorkflow.service.js — antes esta
// checklist no existia en la UI y el handler mandaba claves inventadas
// (equipment_received/packaging_ok/accessories_complete) que el backend
// siempre rechazaba con FST14_CHECKLIST_INCOMPLETE.
const FST14_CHECKLIST = [
  { key: 'guide_vs_proforma',   label: 'Guía de remisión coincide con la proforma' },
  { key: 'packaging_integrity', label: 'Integridad del empaque' },
  { key: 'tilt_indicator',      label: 'Indicador de inclinación (tilt) correcto' },
  { key: 'handling_indicator',  label: 'Indicador de manipulación (handling) correcto' },
  { key: 'serial_match',        label: 'Serial coincide con lo registrado' },
  { key: 'accessories_match',   label: 'Accesorios completos según lo solicitado' },
];

const defaultFst14Checklist = () =>
  FST14_CHECKLIST.reduce((acc, item) => { acc[item.key] = ''; return acc; }, {});

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

/* ─────────────────────────────────────────── helpers ── */

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch { return iso?.slice(0, 10) || '—'; }
};

const toDateOnly = (iso) => (iso ? String(iso).slice(0, 10) : null);

/* ─────────────────────────────────────────── CalendarPicker ── */

const CalendarPicker = ({ value, onChange, minDate, maxDate }) => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [viewYear,  setViewYear]  = useState(() => {
    const base = value || minDate || todayStr;
    return parseInt(base.slice(0, 4), 10);
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const base = value || minDate || todayStr;
    return parseInt(base.slice(5, 7), 10) - 1;
  });

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay  = new Date(viewYear, viewMonth + 1, 0);
    // lunes=0 offset
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(iso);
    }
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const isInRange = (iso) => {
    if (!iso) return false;
    if (minDate && iso < minDate) return false;
    if (maxDate && iso > maxDate) return false;
    return true;
  };

  const isDisabled = (iso) => {
    if (!iso) return true;
    if (iso < todayStr) return true;
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  return (
    <div className="select-none">
      {/* Cabecera mes */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <FiChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-ink-slate">
          {MONTHS_ES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <FiChevronRight size={16} />
        </button>
      </div>

      {/* Días de semana */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_ES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-warm-ash py-1">{d}</div>
        ))}
      </div>

      {/* Celdas de días */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((iso, i) => {
          if (!iso) return <div key={`e-${i}`} />;
          const isToday    = iso === todayStr;
          const isSelected = iso === value;
          const inRange    = isInRange(iso);
          const disabled   = isDisabled(iso);

          let cls = 'relative flex items-center justify-center h-9 w-full rounded-lg text-sm cursor-pointer transition-colors duration-100 ';
          if (isSelected) {
            cls += 'bg-action-blue text-white font-semibold shadow-sm ';
          } else if (disabled) {
            cls += 'text-slate-300 cursor-not-allowed ';
          } else if (inRange) {
            cls += 'bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium ';
          } else {
            cls += 'text-slate-500 hover:bg-slate-100 ';
          }

          return (
            <button
              type="button"
              key={iso}
              disabled={disabled}
              onClick={() => !disabled && onChange(iso)}
              className={cls}
            >
              {iso.slice(8)}
              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-action-blue" />
              )}
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      {(minDate || maxDate) && (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-warm-ash">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-blue-100" />
            Rango solicitado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-action-blue" />
            Fecha seleccionada
          </span>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────── PlanModal ── */

/**
 * La carga de trabajo (workload) se consulta al backend cuando el jefe
 * selecciona una fecha. Muestra cuántas inspecciones ya tiene programadas
 * cada técnico en ese día específico — completamente independiente de si
 * el técnico marcó "disponible" en su panel (eso es estado en tiempo real,
 * no planificación futura).
 */
const PlanModal = ({ purchase, technicians: techniciansProp, onClose, onSave, saving }) => {
  const minDate = toDateOnly(purchase?.inspection_min_date);
  const maxDate = toDateOnly(purchase?.inspection_max_date);

  const [date,        setDate]        = useState(minDate || '');
  const [techId,      setTechId]      = useState('');
  const [notes,       setNotes]       = useState('');
  const [workload,    setWorkload]    = useState(null);   // { by_technician: [...], technicians: [...], total_public_unassigned: n }
  const [loadingWl,   setLoadingWl]   = useState(false);

  /* Obtener carga + lista de técnicos del servidor cuando cambia la fecha */
  useEffect(() => {
    if (!date) { setWorkload(null); return; }
    let cancelled = false;
    setLoadingWl(true);
    getPrivatePurchaseTechnicianSchedule(date)
      .then((data) => { if (!cancelled) setWorkload(data); })
      .catch(() => { if (!cancelled) setWorkload(null); })
      .finally(() => { if (!cancelled) setLoadingWl(false); });
    return () => { cancelled = true; };
  }, [date]);

  /*
   * Lista efectiva de técnicos:
   *   1. workload.technicians — lista completa enviada por el endpoint (siempre actualizada)
   *   2. techniciansProp      — lista del meta endpoint (respaldo si el schedule aún no cargó)
   * Ambas se normalizan al mismo shape { id, email, role, fullname, name }.
   */
  const technicians = useMemo(() => {
    const fromSchedule = Array.isArray(workload?.technicians) ? workload.technicians : [];
    if (fromSchedule.length > 0) return fromSchedule;
    return Array.isArray(techniciansProp) ? techniciansProp : [];
  }, [workload, techniciansProp]);

  /* Carga (nº inspecciones) para un técnico en la fecha seleccionada */
  const getWorkloadForTech = (id) => {
    if (!workload?.by_technician) return 0;
    const entry = workload.by_technician.find(t => String(t.technician_id) === String(id));
    return entry?.count || 0;
  };

  const roleLabel = (role) => {
    if (!role) return '';
    const map = { tecnico: 'Técnico', ing_servicio: 'Ing. Servicio', jefe_tecnico: 'Jefe Técnico', jefe_servicio: 'Jefe Servicio', jefe_servicio_tecnico: 'Jefe Serv. Técnico' };
    return map[role] || role;
  };

  const selectedTech = technicians.find(t => String(t.id) === String(techId));
  const canSave = date && techId;

  /* Técnicos e ingenieros de servicio (tecnico/ing_servicio) disponibles para
     ser asignados a la visita; los jefes planifican pero normalmente no van
     solos a inspecciones. Si no hay técnicos puros, muestra todos. */
  const assignableTechs = technicians.filter(t =>
    ['tecnico', 'ing_servicio'].includes(String(t.role || '').toLowerCase())
  );
  const listToShow = assignableTechs.length > 0 ? assignableTechs : technicians;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 64px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-action-blue/10 flex items-center justify-center shrink-0">
              <FiCalendar className="text-action-blue" size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-slate">Planificar visita técnica</h3>
              <p className="text-xs text-warm-ash mt-0.5">
                {purchase?.client_snapshot?.commercial_name || purchase?.client_name || 'Cliente'} · #{purchase?.id}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px]">

            {/* ── Calendario ─────────────────────────────────────── */}
            <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                1. Selecciona la fecha de visita
              </p>

              {/* Rango solicitado por comercial */}
              {(minDate || maxDate) && (
                <div className="mb-4 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5"><FiCalendar size={12}/> Ventana solicitada por comercial</p>
                  <div className="flex flex-wrap gap-3">
                    {minDate && <span>Desde: <strong>{fmtDate(minDate)}</strong></span>}
                    {maxDate && <span>Hasta: <strong>{fmtDate(maxDate)}</strong></span>}
                  </div>
                  <p className="text-blue-500 text-[11px]">Los días del rango aparecen resaltados en el calendario.</p>
                </div>
              )}

              <CalendarPicker
                value={date}
                onChange={(d) => { setDate(d); setTechId(''); }}
                minDate={minDate}
                maxDate={maxDate}
              />

              {/* Carga global del día seleccionado */}
              {date && (
                <div className="mt-3 space-y-1.5">
                  <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-ink-slate font-medium flex items-center justify-between">
                    <span>{fmtDate(date)}</span>
                    {loadingWl ? (
                      <span className="text-warm-ash">Consultando agenda…</span>
                    ) : workload ? (
                      <span className={workload.by_technician.length > 0 ? 'text-amber-600' : 'text-operative-green'}>
                        {workload.by_technician.length > 0
                          ? `${workload.by_technician.reduce((s, t) => s + t.count, 0)} inspecc. programadas`
                          : 'Sin inspecciones programadas'}
                      </span>
                    ) : null}
                  </div>
                  {workload?.total_public_unassigned > 0 && (
                    <p className="text-[11px] text-warm-ash px-1">
                      + {workload.total_public_unassigned} inspecc. de compra pública (sin técnico asignado)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Técnicos ────────────────────────────────────────── */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  2. Asigna el técnico
                </p>

                {!date && (
                  <p className="text-xs text-warm-ash py-4 text-center">
                    Primero selecciona una fecha
                  </p>
                )}

                {date && (
                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
                    {listToShow.length === 0 && (
                      <p className="text-xs text-warm-ash py-2">Sin técnicos disponibles.</p>
                    )}
                    {listToShow.map((tech) => {
                      const isSelected  = String(tech.id) === String(techId);
                      const wl          = date ? getWorkloadForTech(tech.id) : null;
                      const hasTasks    = wl !== null && wl > 0;

                      return (
                        <button
                          key={tech.id}
                          type="button"
                          onClick={() => setTechId(String(tech.id))}
                          className={[
                            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-100 text-left',
                            isSelected
                              ? 'border-action-blue bg-action-blue/5 shadow-[0_0_0_2px_rgba(59,130,246,0.12)]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {/* Avatar */}
                          <div className={[
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                            isSelected ? 'bg-action-blue text-white' : 'bg-slate-100 text-slate-600',
                          ].join(' ')}>
                            {isSelected ? <FiCheck size={13} /> : (tech.fullname || tech.name || '?')[0].toUpperCase()}
                          </div>

                          {/* Nombre + rol */}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate leading-tight ${isSelected ? 'text-action-blue' : 'text-ink-slate'}`}>
                              {tech.fullname || tech.name || tech.email}
                            </p>
                            <p className="text-[10px] text-warm-ash">{roleLabel(tech.role)}</p>
                          </div>

                          {/* Badge de carga ese día */}
                          {loadingWl ? (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-slate-200 animate-pulse" />
                          ) : wl !== null ? (
                            <span className={[
                              'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                              hasTasks
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-green-50 text-operative-green border border-green-200',
                            ].join(' ')}>
                              {hasTasks ? `${wl} insp.` : 'Libre'}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notas */}
              {date && techId && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">3. Notas de agenda</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Indicaciones de acceso, contacto en sitio, observaciones…"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="text-xs min-w-0">
            {!canSave ? (
              <span className="flex items-center gap-1.5 text-amber-600">
                <FiAlertTriangle size={12} />
                {!date ? 'Elige una fecha en el calendario' : 'Selecciona el técnico responsable'}
              </span>
            ) : selectedTech ? (
              <span className="text-operative-green font-medium flex items-center gap-1.5">
                <FiCheckCircle size={13} />
                {fmtDate(date)} · {selectedTech.fullname || selectedTech.name}
                {getWorkloadForTech(selectedTech.id) > 0 && (
                  <span className="ml-1 text-amber-600 font-normal">(ya tiene {getWorkloadForTech(selectedTech.id)} insp. ese día)</span>
                )}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={() => onSave({ date, techId, notes })}
              className="px-5 py-2 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-[0.97] inline-flex items-center gap-2"
            >
              <FiUserCheck size={14} />
              {saving ? 'Planificando…' : 'Confirmar planificación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────── TechnicalTab ── */

const TechnicalTab = ({ purchase, type, userRoles, refresh }) => {
  const [saving,             setSaving]             = useState(null);
  const [error,              setError]              = useState(null);
  const [showPlanModal,      setShowPlanModal]      = useState(false);

  /* Paso 2 (antes 3) — F.ST-07 */
  const [fst07Result,       setFst07Result]       = useState('compliant');
  const [fst07FollowUp,     setFst07FollowUp]     = useState('');
  const [fst07Signer,       setFst07Signer]       = useState('');
  const [fst07Checklist,    setFst07Checklist]    = useState(defaultFst07);
  const [fst07Notes,        setFst07Notes]        = useState('');

  /* Paso 4 — F.ST-14 */
  const [fst14Result,    setFst14Result]    = useState('pass');
  const [fst14Notes,     setFst14Notes]     = useState('');
  const [fst14Checklist, setFst14Checklist] = useState(defaultFst14Checklist);

  /* Paso 5 — F.ST-09 */
  const [fst09Applies, setFst09Applies] = useState('true');
  const [fst09Notes,   setFst09Notes]   = useState('');

  /* Paso 5b — F.ST-09 intento de verificacion (solo si applies=true) */
  const [verifResult,          setVerifResult]          = useState('passed');
  const [verifCriteria,        setVerifCriteria]         = useState('');
  const [verifAnalysis,        setVerifAnalysis]         = useState('');
  const [verifNotes,           setVerifNotes]            = useState('');

  /* Técnicos */
  const [technicians, setTechnicians] = useState([]);

  const isPrivate = type === 'private' || purchase?.purchase_type === 'private';
  const iw        = purchase?.installation_workflow || null;

  const linkedBcId = purchase?.extra?.auto_business_case_id || purchase?.business_case_id || null;
  const hasLinkedBc = Boolean(linkedBcId);

  /* ── Carga técnicos ───────────────────── */
  useEffect(() => {
    let cancelled = false;
    getEquipmentPurchaseMeta()
      .then((meta) => {
        if (!cancelled) setTechnicians(Array.isArray(meta?.technical_users) ? meta.technical_users : []);
      })
      .catch(() => { if (!cancelled) setTechnicians([]); });
    return () => { cancelled = true; };
  }, []);

  /* ── Estado de cada paso ──────────────── */
  // step1Done: inspección solicitada (desde PrivateFlowTab — usada por step2Active)
  const step1Done = Boolean(purchase?.inspection_request_id);
  const step2Done = Boolean(purchase?.inspection_scheduled_date);
  const step3Done = Boolean(
    purchase?.inspection_site_result ||
    purchase?.inspection_site_status === 'ready_for_installation' ||
    purchase?.inspection_site_status === 'non_compliant_reinspection_pending' ||
    purchase?.site_inspection?.result
  );
  const step4Done = iw?.visual_reception?.result != null;
  // Bug: antes se marcaba "hecho" apenas se registraba la decision (applies
  // true/false), ocultando el formulario -- pero si applies=true todavia falta
  // completar el ciclo de verificacion (verification_cycle.status==='passed')
  // antes de que el cierre de instalacion (acta final) deje de estar bloqueado.
  const verificationApplies = iw?.verification_decision?.applies;
  const verificationCycleStatus = iw?.verification_cycle?.status || null;
  const step5Done = verificationApplies === false
    ? true
    : verificationApplies === true
      ? verificationCycleStatus === 'passed'
      : false;

  /* activos: el primero sin completar en la secuencia */
  // Paso 1 (planificar) activo cuando se solicitó inspección pero no se planificó
  const step2Active = step1Done && !step2Done;
  const step3Active = step2Done && !step3Done;
  const step4Active = step3Done && !step4Done;
  const step5Active = step4Done && !step5Done;

  /**
   * roleStepStatus — calcula el estado del paso considerando qué rol lo controla.
   * Si el usuario tiene uno de los ownerRoles → active/pending/completed normal.
   * Si no → completed si ya lo hicieron, waiting si ya es su turno, pending si aún no llega.
   */
  const roleStepStatus = (done, active, ownerRoles) => {
    if (done) return 'completed';
    const isMyStep = Array.isArray(ownerRoles) && userRoles.some((r) => ownerRoles.includes(r));
    if (isMyStep) return active ? 'active' : 'pending';
    return active ? 'waiting' : 'pending';
  };

  /* Cuantos completados para el badge */
  // Paso 1 (solicitar inspección) se gestiona desde el flujo comercial/ACP.
  const totalSteps     = 4;
  const completedSteps = (step2Done ? 1 : 0) + (step3Done ? 1 : 0) + (step4Done ? 1 : 0) + (step5Done ? 1 : 0);

  /* ── Runner genérico ──────────────────── */
  const run = async (name, fn) => {
    setSaving(name);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Error al guardar');
    } finally {
      setSaving(null);
    }
  };

  /* ── Acciones ─────────────────────────── */
  const handlePlanInspection = ({ date, techId, notes }) => run('step2', async () => {
    const payload = {
      inspection_date: date,
      notes,
      assigned_technician_id: techId || undefined,
      expected_updated_at: purchase.updated_at,
    };
    if (isPrivate) {
      await coordinatePrivatePurchaseInspectionDate(purchase.id, payload);
    } else {
      await coordinatePublicInspectionDate(purchase.id, payload);
    }
    setShowPlanModal(false);
  });

  const handleRegisterFst07 = () => run('step3', async () => {
    const payload = {
      result:            fst07Result,
      checklist:         fst07Checklist,
      observations:      fst07Notes,
      recommendations:   '',
      follow_up_date:    fst07Result === 'non_compliant' ? fst07FollowUp : undefined,
      client_signer_name: fst07Signer,
      expected_updated_at: purchase.updated_at,
    };
    if (isPrivate) await registerPrivatePurchaseSiteInspection(purchase.id, payload);
    else await registerPublicPurchaseSiteInspection(purchase.id, payload);
  });

  const updateWf = (action, payload) =>
    isPrivate
      ? updatePrivatePurchaseInstallationWorkflow(purchase.id, { action, payload, expected_updated_at: purchase.updated_at })
      : updatePublicPurchaseInstallationWorkflow(purchase.id, { action, payload, expected_updated_at: purchase.updated_at });

  const handleFst14 = () => run('step4', () =>
    updateWf('visual_inspection_fst14', {
      result: fst14Result,
      checklist: fst14Checklist,
      notes: fst14Notes,
      corrective_actions: fst14Result === 'failed' ? fst14Notes : '',
      inspection_date: new Date().toISOString(),
      form_reference: 'F.ST-14',
    })
  );

  const handleFst09 = () => run('step5', () =>
    updateWf('verification_decision', {
      applies: fst09Applies === 'true',
      source_reference: 'F.ST-09',
      justification: fst09Notes,
      form_reference: 'F.ST-09',
    })
  );

  const handleVerificationAttempt = () => run('step5b', async () => {
    await updateWf('verification_attempt', {
      result: verifResult,
      criteria_reference: verifCriteria,
      analysis: verifAnalysis,
      notes: verifNotes,
    });
    setVerifCriteria('');
    setVerifAnalysis('');
    setVerifNotes('');
  });

  /* F.ST-07 — toggle checklist */
  const setChecklistItem = (key, val) => setFst07Checklist(prev => ({ ...prev, [key]: val }));
  const setFst14ChecklistItem = (key, val) => setFst14Checklist(prev => ({ ...prev, [key]: val }));
  const fst14ChecklistComplete = FST14_CHECKLIST.every((item) => Boolean(fst14Checklist[item.key]));

  /* Secciones del F.ST-07 agrupadas */
  const fst07Sections = useMemo(() => {
    const map = {};
    FST07_CHECKLIST.forEach(item => {
      if (!map[item.section]) map[item.section] = [];
      map[item.section].push(item);
    });
    return map;
  }, []);

  /* ── Render ───────────────────────────── */
  return (
    <div className="flex flex-col min-w-0">

      {/* Header del tab */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Técnica</h2>
          <p className="text-xs text-warm-ash mt-0.5">
            Inspección operativa, instalación y verificación
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-warm-ash font-mono">{completedSteps}/{totalSteps}</span>
          <TabBadge status={completedSteps === totalSteps ? 'completado' : 'pendiente'} />
        </div>
      </div>

      <div className="p-6 space-y-3">

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <FiAlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Banner BC — referencia adicional */}
        {hasLinkedBc && (
          <div className="bg-sky-50 rounded-xl border border-sky-100 px-4 py-3 text-xs text-sky-800 flex items-center gap-2">
            <FiClipboard size={14} className="shrink-0" />
            Este expediente también tiene un Business Case vinculado con una inspección por costos o factibilidad.
            En esta pestaña se gestiona la inspección operativa del proceso de compra.
          </div>
        )}

        {/* ── PASO 1: Planificar visita ─────────────────────────────────── */}
        {/* (Paso 0: Solicitar inspección se gestiona en PrivateFlowTab) */}
        <WorkflowStep
            stepNumber={1}
            title="Planificar visita técnica"
            actor="Jefe Técnico · Jefe Servicio"
            status={roleStepStatus(step2Done, step2Active, PURCHASE_ROLE_GROUPS.jefe_tecnico)}
            completedAt={purchase?.inspection_coordinated_at}
          >
            <RoleGatedAction
              allowedRoles={PURCHASE_ROLE_GROUPS.jefe_tecnico}
              userRoles={userRoles}
            >
              {step2Done ? (
                /* Resumen de la planificación */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                    <p className="text-[11px] text-warm-ash mb-1">Fecha programada</p>
                    <p className="text-sm font-semibold text-ink-slate">{fmtDate(purchase?.inspection_scheduled_date)}</p>
                  </div>
                  {(purchase?.extra?.inspection_assigned_technician_name || purchase?.extra?.inspection_assigned_technician_email) && (
                    <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                      <p className="text-[11px] text-warm-ash mb-1">Técnico asignado</p>
                      <p className="text-sm font-semibold text-ink-slate">
                        {purchase.extra.inspection_assigned_technician_name || purchase.extra.inspection_assigned_technician_email}
                      </p>
                    </div>
                  )}
                  {purchase?.inspection_coordination_notes && (
                    <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                      <p className="text-[11px] text-warm-ash mb-1">Notas</p>
                      <p className="text-sm text-ink-slate">{purchase.inspection_coordination_notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-warm-ash">
                    Elige la fecha de visita dentro de la ventana solicitada por comercial y asigna al técnico que realizará la inspección operativa.
                  </p>
                  {(purchase?.inspection_min_date || purchase?.inspection_max_date) && (
                    <div className="flex flex-wrap gap-2">
                      {purchase?.inspection_min_date && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                          <FiCalendar size={11} /> Desde: {fmtDate(purchase.inspection_min_date)}
                        </span>
                      )}
                      {purchase?.inspection_max_date && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                          <FiCalendar size={11} /> Hasta: {fmtDate(purchase.inspection_max_date)}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action-blue text-white text-sm font-semibold hover:bg-blue-600 transition-colors active:scale-[0.97]"
                  >
                    <FiCalendar size={14} />
                    Abrir planificador de visita
                  </button>
                </div>
              )}
            </RoleGatedAction>
        </WorkflowStep>

        {/* ── PASO 2: F.ST-07 Inspección de sitio ──────────────────────── */}
        <WorkflowStep
            stepNumber={2}
            title="F.ST-07 · Inspección de sitio"
            actor="Técnico"
            status={roleStepStatus(step3Done, step3Active, PURCHASE_ROLE_GROUPS.tecnico)}
            completedAt={purchase?.inspection_registered_at}
          >
            <RoleGatedAction
              allowedRoles={PURCHASE_ROLE_GROUPS.tecnico}
              userRoles={userRoles}
            >
              {step3Done ? (
                /* Resumen del resultado */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                    <p className="text-[11px] text-warm-ash mb-1">Resultado</p>
                    <p className={`text-sm font-semibold ${purchase?.inspection_site_result === 'compliant' ? 'text-operative-green' : 'text-amber-600'}`}>
                      {purchase?.inspection_site_result === 'compliant' ? 'Cumple' : 'No cumple'}
                    </p>
                  </div>
                  {purchase?.inspection_site_notes && (
                    <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border sm:col-span-2">
                      <p className="text-[11px] text-warm-ash mb-1">Observaciones</p>
                      <p className="text-sm text-ink-slate">{purchase.inspection_site_notes}</p>
                    </div>
                  )}
                  {(purchase?.site_inspection_report_link || purchase?.site_inspection_report_document_id) && (
                    <a
                      href={purchase.site_inspection_report_link || driveLink(purchase.site_inspection_report_document_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sm:col-span-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-soft-border text-sm font-semibold text-ink-slate hover:bg-paper-white transition-colors"
                    >
                      <FiExternalLink size={14} />
                      Ver acta F.ST-07
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-5">

                  {/* Resultado + seguimiento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-slate">Resultado de la inspección</span>
                      <select
                        value={fst07Result}
                        onChange={(e) => setFst07Result(e.target.value)}
                        className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                      >
                        <option value="compliant">Cumple</option>
                        <option value="non_compliant">No cumple — requiere seguimiento</option>
                      </select>
                    </label>
                    {fst07Result === 'non_compliant' && (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-slate">Fecha de seguimiento</span>
                        <input
                          type="date"
                          value={fst07FollowUp}
                          onChange={(e) => setFst07FollowUp(e.target.value)}
                          className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                        />
                      </label>
                    )}
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-slate">Nombre del firmante del cliente</span>
                    <input
                      value={fst07Signer}
                      onChange={(e) => setFst07Signer(e.target.value)}
                      placeholder="Nombre completo de quien firma el acta"
                      className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                    />
                  </label>

                  {/* Checklist por secciones */}
                  <div>
                    <p className="text-xs font-medium text-ink-slate mb-2">Checklist de condiciones del sitio</p>
                    <div className="space-y-3">
                      {Object.entries(fst07Sections).map(([section, items]) => (
                        <div key={section} className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{section}</p>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {items.map((item) => (
                              <div key={item.key} className="flex items-center justify-between px-4 py-3 gap-3 hover:bg-slate-50/60 transition-colors">
                                <span className="text-sm text-ink-slate flex-1">{item.label}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {['SI', 'NO', ...(item.allowsNa ? ['N/A'] : [])].map((opt) => {
                                    const active = fst07Checklist[item.key] === opt;
                                    let cls = 'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ';
                                    if (active) {
                                      cls += opt === 'SI' ? 'bg-operative-green text-white border-green-500' : opt === 'NO' ? 'bg-red-500 text-white border-red-500' : 'bg-slate-400 text-white border-slate-400';
                                    } else {
                                      cls += 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50';
                                    }
                                    return (
                                      <button type="button" key={opt} className={cls} onClick={() => setChecklistItem(item.key, opt)}>
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Observaciones */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-slate">Observaciones y recomendaciones</span>
                    <textarea
                      value={fst07Notes}
                      onChange={(e) => setFst07Notes(e.target.value)}
                      placeholder="Condiciones especiales del sitio, recomendaciones al cliente…"
                      rows={3}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleRegisterFst07}
                    disabled={
                      saving === 'step3' ||
                      !fst07Signer.trim() ||
                      (fst07Result === 'non_compliant' && !fst07FollowUp)
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-[0.97]"
                  >
                    <FiClipboard size={14} />
                    {saving === 'step3' ? 'Generando acta…' : 'Registrar F.ST-07 y generar acta'}
                  </button>
                </div>
              )}
            </RoleGatedAction>
        </WorkflowStep>

        {/* ── PASO 3: F.ST-14 Recepción visual ─────────────────────────── */}
        <WorkflowStep
          stepNumber={3}
          title="F.ST-14 · Recepción visual"
          actor="Técnico"
          status={roleStepStatus(step4Done, step4Active, PURCHASE_ROLE_GROUPS.tecnico)}
          completedAt={iw?.visual_reception?.inspection_date}
        >
          <RoleGatedAction
            allowedRoles={PURCHASE_ROLE_GROUPS.tecnico}
            userRoles={userRoles}
          >
            {step4Done ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                  <p className="text-[11px] text-warm-ash mb-1">Resultado</p>
                  <p className={`text-sm font-semibold ${iw.visual_reception.result === 'pass' ? 'text-operative-green' : 'text-red-600'}`}>
                    {iw.visual_reception.result === 'pass' ? 'Aprueba' : 'No aprueba'}
                  </p>
                </div>
                {iw.visual_reception.notes && (
                  <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                    <p className="text-[11px] text-warm-ash mb-1">Notas</p>
                    <p className="text-sm text-ink-slate">{iw.visual_reception.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-warm-ash">Registra el resultado de la recepción visual del equipo instalado.</p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-slate">Resultado</span>
                  <select
                    value={fst14Result}
                    onChange={(e) => setFst14Result(e.target.value)}
                    className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                  >
                    <option value="pass">Aprueba</option>
                    <option value="failed">No aprueba — requiere corrección</option>
                  </select>
                </label>

                <div>
                  <p className="text-xs font-medium text-ink-slate mb-2">Checklist de recepción visual</p>
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {FST14_CHECKLIST.map((item) => (
                      <div key={item.key} className="flex items-center justify-between px-4 py-3 gap-3 hover:bg-slate-50/60 transition-colors">
                        <span className="text-sm text-ink-slate flex-1">{item.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {['OK', 'ISSUE', 'NA'].map((opt) => {
                            const active = fst14Checklist[item.key] === opt;
                            let cls = 'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ';
                            if (active) {
                              cls += opt === 'OK' ? 'bg-operative-green text-white border-green-500' : opt === 'ISSUE' ? 'bg-red-500 text-white border-red-500' : 'bg-slate-400 text-white border-slate-400';
                            } else {
                              cls += 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50';
                            }
                            return (
                              <button type="button" key={opt} className={cls} onClick={() => setFst14ChecklistItem(item.key, opt)}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!fst14ChecklistComplete && (
                    <p className="mt-2 text-xs text-caution-amber flex items-center gap-1.5">
                      <FiAlertTriangle size={12} />
                      Completa todos los ítems del checklist antes de registrar.
                    </p>
                  )}
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-slate">Notas{fst14Result === 'failed' ? ' / Acciones correctivas' : ''}</span>
                  <textarea
                    value={fst14Notes}
                    onChange={(e) => setFst14Notes(e.target.value)}
                    placeholder={fst14Result === 'failed' ? 'Detalla las acciones correctivas a tomar…' : 'Observaciones adicionales…'}
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleFst14}
                  disabled={saving === 'step4' || !fst14ChecklistComplete || (fst14Result === 'failed' && !fst14Notes.trim())}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-[0.97]"
                >
                  <FiTool size={14} />
                  {saving === 'step4' ? 'Guardando…' : 'Registrar F.ST-14'}
                </button>
              </div>
            )}
          </RoleGatedAction>
        </WorkflowStep>

        {/* ── PASO 4: F.ST-09 Verificación ─────────────────────────────── */}
        <WorkflowStep
          stepNumber={4}
          title="F.ST-09 · Verificación de instalación"
          actor="Técnico"
          status={roleStepStatus(step5Done, step5Active, PURCHASE_ROLE_GROUPS.tecnico)}
          completedAt={iw?.verification_decision?.decided_at}
        >
          <RoleGatedAction
            allowedRoles={PURCHASE_ROLE_GROUPS.tecnico}
            userRoles={userRoles}
          >
            {verificationApplies == null ? (
              <div className="space-y-4">
                <p className="text-xs text-warm-ash">Determina si este equipo requiere verificación de instalación según criterios técnicos.</p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-slate">¿Aplica verificación de instalación?</span>
                  <select
                    value={fst09Applies}
                    onChange={(e) => setFst09Applies(e.target.value)}
                    className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                  >
                    <option value="true">Sí aplica</option>
                    <option value="false">No aplica</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-slate">Criterio técnico</span>
                  <textarea
                    value={fst09Notes}
                    onChange={(e) => setFst09Notes(e.target.value)}
                    placeholder="Justificación de la decisión…"
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleFst09}
                  disabled={saving === 'step5'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-[0.97]"
                >
                  <FiCheckCircle size={14} />
                  {saving === 'step5' ? 'Guardando…' : 'Registrar F.ST-09'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                    <p className="text-[11px] text-warm-ash mb-1">¿Aplica verificación?</p>
                    <p className={`text-sm font-semibold ${verificationApplies ? 'text-ink-slate' : 'text-warm-ash'}`}>
                      {verificationApplies ? 'Sí aplica' : 'No aplica'}
                    </p>
                  </div>
                  {iw.verification_decision.justification && (
                    <div className="px-4 py-3 bg-paper-white rounded-xl border border-soft-border">
                      <p className="text-[11px] text-warm-ash mb-1">Criterio</p>
                      <p className="text-sm text-ink-slate">{iw.verification_decision.justification}</p>
                    </div>
                  )}
                </div>

                {/* Ciclo de verificación: solo cuando applies=true. Antes esto no
                    tenia UI en ningun lado -- la decision "si aplica" quedaba
                    marcada como "hecho" sin forma de registrar el resultado real. */}
                {verificationApplies && (
                  <div>
                    <p className="text-xs font-medium text-ink-slate mb-2">Ciclo de verificación (F.ST-09)</p>

                    {Array.isArray(iw?.verification_cycle?.attempts) && iw.verification_cycle.attempts.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {iw.verification_cycle.attempts.slice().reverse().map((attempt) => (
                          <div key={attempt.attempt_number} className={`rounded-xl border px-3 py-2 text-xs ${
                            attempt.result === 'passed' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-semibold ${attempt.result === 'passed' ? 'text-operative-green' : 'text-alert-red'}`}>
                                Intento #{attempt.attempt_number} · {attempt.result === 'passed' ? 'Aprobado' : 'Rechazado'}
                              </span>
                              <span className="text-warm-ash">{attempt.generated_by_email}</span>
                            </div>
                            <p className="mt-1 text-ink-slate">{attempt.criteria_reference}</p>
                            {attempt.analysis && <p className="mt-0.5 text-warm-ash">{attempt.analysis}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {verificationCycleStatus === 'passed' ? (
                      <div className="flex items-center gap-2 text-sm text-operative-green bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <FiCheckCircle size={14} />
                        Verificación aprobada — el ciclo F.ST-09 está completo.
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-ink-slate">Resultado del intento</span>
                          <select
                            value={verifResult}
                            onChange={(e) => setVerifResult(e.target.value)}
                            className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                          >
                            <option value="passed">Aprobado</option>
                            <option value="failed">Rechazado — requiere remediación</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-ink-slate">Criterio técnico utilizado</span>
                          <input
                            value={verifCriteria}
                            onChange={(e) => setVerifCriteria(e.target.value)}
                            placeholder="Ej. Manual de verificación cobas c111, sección 4.2"
                            className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-ink-slate">Análisis</span>
                          <textarea
                            value={verifAnalysis}
                            onChange={(e) => setVerifAnalysis(e.target.value)}
                            placeholder="Valores obtenidos, comparación con rangos esperados…"
                            rows={2}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-ink-slate">Notas{verifResult === 'failed' ? ' / Plan de remediación' : ''}</span>
                          <textarea
                            value={verifNotes}
                            onChange={(e) => setVerifNotes(e.target.value)}
                            placeholder={verifResult === 'failed' ? 'Que se debe corregir antes del proximo intento…' : 'Observaciones adicionales…'}
                            rows={2}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-action-blue/20 focus:border-action-blue transition-colors"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleVerificationAttempt}
                          disabled={saving === 'step5b' || !verifCriteria.trim()}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action-blue text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-[0.97]"
                        >
                          <FiCheckCircle size={14} />
                          {saving === 'step5b' ? 'Guardando…' : 'Registrar intento de verificación'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </RoleGatedAction>
        </WorkflowStep>

        {/* ── CIERRE — resumen del closure gate ────────────────────────── */}
        {iw?.closure_gate && (
          <div className={[
            'rounded-xl border px-5 py-4 flex items-center gap-3 text-sm',
            iw.closure_gate.can_close
              ? 'bg-green-50 border-green-200 text-operative-green'
              : 'bg-slate-50 border-slate-200 text-slate-500',
          ].join(' ')}>
            {iw.closure_gate.can_close ? <FiCheckCircle size={16} /> : <FiTool size={16} />}
            <div>
              <p className="font-semibold">
                {iw.closure_gate.can_close ? 'Flujo técnico completado' : 'Flujo técnico en progreso'}
              </p>
              {iw.closure_gate.blocked_reasons?.length > 0 && (
                <p className="text-xs mt-0.5 text-slate-500">
                  Pendiente: {iw.closure_gate.blocked_reasons.join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Modal de planificación ────────────────────────────────────── */}
      {showPlanModal && (
        <PlanModal
          purchase={purchase}
          technicians={technicians}
          saving={saving === 'step2'}
          onClose={() => setShowPlanModal(false)}
          onSave={handlePlanInspection}
        />
      )}
    </div>
  );
};

export default TechnicalTab;
