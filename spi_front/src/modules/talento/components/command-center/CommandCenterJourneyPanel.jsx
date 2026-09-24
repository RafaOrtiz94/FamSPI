import React from "react";
import { FiCheck, FiAlertTriangle, FiClock, FiCircle, FiAlertCircle } from "react-icons/fi";

// Design system tokens (DESIGN.md)
const D = {
  naval:   '#1E293B',
  ink:     '#1F2937',
  ash:     '#6B7280',
  fog:     '#D1D5DB',
  border:  '#E5E7EB',
  surface: '#FFFFFF',
  page:    '#F9FAFB',
  action:  '#2563EB',
  green:   '#16A34A',
  greenSoft: '#DCFCE7',
  amber:   '#D97706',
  amberSoft: '#FEF3C7',
  red:     '#DC2626',
  redSoft: '#FEE2E2',
};

const STATUS = {
  complete: { icon: FiCheck,         color: D.green,  bg: D.greenSoft, border: '#BBF7D0', label: 'Completado' },
  current:  { icon: FiClock,         color: D.action, bg: '#EFF6FF',   border: '#BFDBFE', label: 'En curso'   },
  warning:  { icon: FiAlertTriangle, color: D.amber,  bg: D.amberSoft, border: '#FDE68A', label: 'Alerta'     },
  stalled:  { icon: FiAlertCircle,   color: D.red,    bg: D.redSoft,   border: '#FECACA', label: 'Estancada'  },
  pending:  { icon: FiCircle,        color: D.fog,    bg: D.page,      border: D.border,  label: 'Pendiente'  },
};

const clamp = (v) => Math.max(0, Math.min(100, v ?? 0));

const CommandCenterJourneyPanel = ({ title, description, progress = {}, steps = [], aside }) => {
  const percent = typeof progress?.percent === 'number'
    ? clamp(progress.percent)
    : progress?.total > 0
      ? clamp(((progress.done ?? 0) / progress.total) * 100)
      : 0;

  return (
    <div className="rounded-2xl border" style={{ borderColor: D.border, background: D.surface, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: D.border }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {title && (
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: D.ash }}>
                {title}
              </p>
            )}
            {description && (
              <p className="text-sm" style={{ color: D.ink }}>{description}</p>
            )}
          </div>
          {aside && (
            <div className="lg:w-72 flex-shrink-0 rounded-xl border p-3 text-sm" style={{ borderColor: D.border, background: D.page, color: D.ink }}>
              {aside}
            </div>
          )}
        </div>

        {/* Progress bar — solid Action Blue, no gradient */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: D.ash }}>
              Progreso
            </span>
            <span className="text-[11px] font-mono font-semibold" style={{ color: D.ink }}>
              {Math.round(percent)}% · {progress.done ?? 0}/{progress.total ?? 0}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: D.border }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${percent}%`, background: D.action }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="divide-y" style={{ borderColor: D.border }}>
          {steps.map((step) => {
            const s = STATUS[step.status] || STATUS.pending;
            const Icon = s.icon;
            return (
              <div
                key={step.key || step.label}
                className="flex items-center gap-3 px-5 py-3"
                style={{ background: step.status === 'current' ? '#EFF6FF' : D.surface }}
              >
                {/* Status icon */}
                <div
                  className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: s.bg, border: `1.5px solid ${s.border}` }}
                >
                  <Icon size={13} style={{ color: s.color }} />
                </div>

                {/* Label + detail */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: D.ink }}>
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-xs truncate mt-0.5" style={{ color: D.ash }}>
                      {step.detail}
                    </p>
                  )}
                </div>

                {/* Status label + action */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span
                    className="hidden sm:block text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: s.color }}
                  >
                    {s.label}
                  </span>
                  {step.actionLabel && step.onAction && (
                    <button
                      type="button"
                      onClick={step.onAction}
                      className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer"
                      style={{ borderColor: D.border, color: D.ink, background: D.surface }}
                      onMouseEnter={e => { e.currentTarget.style.background = D.page; e.currentTarget.style.borderColor = '#9CA3AF'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = D.surface; e.currentTarget.style.borderColor = D.border; }}
                    >
                      {step.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommandCenterJourneyPanel;
