import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronRight, FiInbox } from "react-icons/fi";
import ServicioEmptyState from "../../design/ServicioEmptyState";
import {
  actionQueueTypeTone,
  formatTechnicalDateLabel,
  scheduleCategoryTone,
} from "./dashboardViewShared";

// Tag corto tipo orden-de-trabajo: identifica el tipo de fila de un vistazo
// sin depender solo del color (accesibilidad) y sin el patron "icono +
// badge" repetido en cada fila -- una sola pastilla monoespaciada, como el
// numero de folio de un ticket real.
const TYPE_TAG = {
  approval: "INS",
  inspection: "INS",
  withdrawal: "RET",
  corrective: "COR",
  preventive_offer: "MNT",
  maintenance: "MNT",
  training: "CAP",
  external_case: "EXT",
  manual: "GEN",
};

const TONE_COLOR = {
  danger: "var(--st-danger)",
  warning: "var(--st-warning)",
  info: "var(--st-info)",
  accent: "var(--st-accent-strong)",
  success: "var(--st-success)",
  neutral: "var(--st-text-faint)",
};

const normalizeQueueRow = (item) => ({
  key: `queue:${item.id}`,
  tag: TYPE_TAG[item.type] || "GEN",
  tone: actionQueueTypeTone(item.type),
  title: item.title,
  meta: [item.client_name, item.meta].filter(Boolean).join(" · "),
  right: item.primary_action,
  urgent: item.urgency === "urgent",
  path: item.source_path,
});

const normalizeScheduleRow = (row) => ({
  key: `sched:${row.id}`,
  tag: TYPE_TAG[row.category] || "GEN",
  tone: scheduleCategoryTone(row.category),
  title: row.title,
  meta: [formatTechnicalDateLabel(row.activity_date), row.user_name, row.notes].filter(Boolean).join(" · "),
  right: row.source_label,
  urgent: false,
  path: row.source_path,
});

const DocketRow = ({ row, onNavigate }) => (
  <button
    type="button"
    onClick={() => row.path && onNavigate(row.path)}
    className="group flex w-full cursor-pointer items-center gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--st-surface-sunken)]"
  >
    <span
      className="font-mono-data shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
      style={{ background: "var(--st-surface-sunken)", color: TONE_COLOR[row.tone] || TONE_COLOR.neutral }}
    >
      {row.tag}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium" style={{ color: "var(--st-text)" }}>
        {row.title}
      </span>
      {row.meta ? (
        <span className="block truncate text-xs" style={{ color: "var(--st-text-faint)" }}>
          {row.meta}
        </span>
      ) : null}
    </span>
    {row.right ? (
      <span className="hidden shrink-0 text-xs font-medium sm:block" style={{ color: "var(--st-text-muted)" }}>
        {row.right}
      </span>
    ) : null}
    <FiChevronRight
      size={14}
      className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      style={{ color: "var(--st-text-faint)" }}
    />
  </button>
);

const SectionHeader = ({ label, count }) => (
  <div className="flex items-center justify-between pt-4 pb-1 first:pt-0">
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--st-text-faint)" }}>
      {label}
    </span>
    {count ? (
      <span className="font-mono-data text-[11px]" style={{ color: "var(--st-text-faint)" }}>
        {count}
      </span>
    ) : null}
  </div>
);

/**
 * Bitacora unica de despacho: reemplaza "cola de acciones" + "pulso del
 * cronograma" como dos ServicioCard separadas por una sola superficie
 * continua, agrupada por urgencia real (AHORA / PENDIENTE / AGENDA) en vez
 * de por que servicio backend origino el dato. Sin caja por fila -- divisor
 * fino entre lineas, como un manifiesto de despacho, no una lista de
 * tarjetas.
 */
const DispatchLog = ({ queueItems = [], queueLoading = false, scheduleRows = [], emptyDescription }) => {
  const navigate = useNavigate();

  const { urgent, pending, agenda } = useMemo(() => {
    const urgentRows = queueItems.filter((item) => item.urgency === "urgent").map(normalizeQueueRow);
    const pendingRows = queueItems.filter((item) => item.urgency !== "urgent").map(normalizeQueueRow);
    const agendaRows = [...scheduleRows]
      .sort((a, b) => String(a.activity_date || "").localeCompare(String(b.activity_date || "")))
      .slice(0, 6)
      .map(normalizeScheduleRow);
    return { urgent: urgentRows, pending: pendingRows, agenda: agendaRows };
  }, [queueItems, scheduleRows]);

  const isEmpty = !queueLoading && urgent.length === 0 && pending.length === 0 && agenda.length === 0;

  if (queueLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando bitácora">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 py-2.5">
            <div className="h-4 w-9 shrink-0 rounded-[3px]" style={{ background: "var(--st-border)" }} />
            <div className="h-3.5 w-2/5 rounded" style={{ background: "var(--st-border)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <ServicioEmptyState
        icon={FiInbox}
        title="Sin nada pendiente"
        description={emptyDescription || "Cuando algo requiera tu acción o tengas agenda próxima, aparecerá aquí."}
      />
    );
  }

  return (
    <div className="divide-y" style={{ borderColor: "var(--st-border)" }}>
      {urgent.length ? (
        <div>
          <SectionHeader label="Ahora" count={urgent.length} />
          {urgent.map((row) => (
            <DocketRow key={row.key} row={row} onNavigate={navigate} />
          ))}
        </div>
      ) : null}
      {pending.length ? (
        <div>
          <SectionHeader label="Pendiente" count={pending.length} />
          {pending.map((row) => (
            <DocketRow key={row.key} row={row} onNavigate={navigate} />
          ))}
        </div>
      ) : null}
      {agenda.length ? (
        <div>
          <SectionHeader label="Agenda" count={agenda.length} />
          {agenda.map((row) => (
            <DocketRow key={row.key} row={row} onNavigate={navigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default DispatchLog;
