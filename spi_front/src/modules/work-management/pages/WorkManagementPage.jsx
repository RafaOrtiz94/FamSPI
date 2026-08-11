import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowRight,
  FiBriefcase,
  FiCheckSquare,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiFilter,
  FiGrid,
  FiLink2,
  FiList,
  FiMessageSquare,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTarget,
  FiUsers,
  FiUserPlus,
  FiX,
} from "react-icons/fi";

import {
  createBoard,
  createChecklistItem,
  createItemComment,
  createItem,
  createProject,
  createWorkspace,
  fetchAssigneeOptions,
  fetchMyWork,
  fetchPortfolioSummary,
  fetchProject,
  fetchProjectBoards,
  fetchProjectItems,
  fetchWorkspaceProjects,
  fetchWorkspaces,
  fetchWorkManagementCollaborators,
  deleteChecklistItem,
  updateItem,
  updateItemAssignees,
  updateChecklistItem,
  updateItemSupporters,
  uploadItemAttachment,
} from "../../../core/api/workManagementApi";
import { useAuth } from "../../../core/auth/AuthContext";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";

const EMPTY_WORKSPACE_FORM = {
  name: "",
  description: "",
  visibility: "private",
  member_user_ids: [],
};

const EMPTY_PROJECT_FORM = {
  name: "",
  description: "",
  project_type: "general",
  priority: "medium",
  status: "draft",
};

const EMPTY_BOARD_FORM = {
  name: "",
  board_type: "kanban",
};

const EMPTY_ITEM_FORM = {
  title: "",
  description: "",
  item_type: "task",
  priority: "medium",
  status: "todo",
  group_id: "",
  assign_to_me: true,
};

const VIEW_OPTIONS = [
  { id: "board", label: "Board", icon: FiGrid },
  { id: "my_work", label: "Mi trabajo", icon: FiCheckCircle },
  { id: "overview", label: "Resumen", icon: FiTarget },
];

const MONDAY_COLUMNS = [
  { key: "item", label: "Item", width: "minmax(250px,1.9fr)" },
  { key: "status", label: "Estado", width: "minmax(120px,0.8fr)" },
  { key: "priority", label: "Prioridad", width: "minmax(120px,0.8fr)" },
  { key: "assignees", label: "Responsable", width: "minmax(150px,0.95fr)" },
  { key: "support", label: "Apoyo", width: "minmax(230px,1.15fr)" },
  { key: "checklist", label: "Checklist", width: "minmax(260px,1.25fr)" },
  { key: "updates", label: "Actualizaciones", width: "minmax(280px,1.3fr)" },
  { key: "documents", label: "Documentos", width: "minmax(190px,0.95fr)" },
  { key: "date", label: "Fecha", width: "minmax(130px,0.8fr)" },
  { key: "type", label: "Tipo", width: "minmax(120px,0.7fr)" },
];

const ITEM_STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "En curso" },
  { value: "done", label: "Hecho" },
  { value: "blocked", label: "Bloqueado" },
  { value: "cancelled", label: "Cancelado" },
];

const ITEM_PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Critica" },
];

const ITEM_TYPE_OPTIONS = [
  { value: "task", label: "Tarea" },
  { value: "subtask", label: "Subtarea" },
  { value: "meeting", label: "Reunion" },
  { value: "visit", label: "Visita" },
  { value: "approval", label: "Aprobacion" },
  { value: "followup", label: "Seguimiento" },
];

const getBoardGridClass = (showGroupColumn) =>
  showGroupColumn
    ? "grid grid-cols-1 md:min-w-[2120px] md:grid-cols-[minmax(260px,1.55fr)_minmax(145px,0.7fr)_minmax(120px,0.58fr)_minmax(120px,0.58fr)_minmax(160px,0.78fr)_minmax(230px,1.05fr)_minmax(260px,1.2fr)_minmax(280px,1.25fr)_minmax(190px,0.9fr)_minmax(130px,0.62fr)_minmax(120px,0.56fr)]"
    : "grid grid-cols-1 md:min-w-[1840px] md:grid-cols-[minmax(300px,1.85fr)_minmax(130px,0.64fr)_minmax(130px,0.64fr)_minmax(165px,0.78fr)_minmax(235px,1.06fr)_minmax(260px,1.2fr)_minmax(280px,1.28fr)_minmax(195px,0.92fr)_minmax(140px,0.64fr)_minmax(120px,0.54fr)]";

const boardSelectClass =
  "min-h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:cursor-wait disabled:opacity-60";

const boardDateClass =
  "min-h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:cursor-wait disabled:opacity-60";

const mondayShell =
  "bg-[radial-gradient(circle_at_top_left,#DFF7F2_0,#F6F8FF_34%,#FFF8EC_72%,#FFFFFF_100%)]";

const mondayCard =
  "border border-white/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur";

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const formatLabel = (value, fallback = "Sin dato") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.replace(/_/g, " ");
};

const getInitials = (value) => {
  const text = String(value || "").trim();
  if (!text) return "U";
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

const classifyDateBucket = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((target.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "Vencido";
  if (diffDays === 0) return "Hoy";
  if (diffDays <= 7) return "Esta semana";
  return "Luego";
};

const statusTone = (status) => {
  const normalized = normalize(status);
  if (normalized.includes("done") || normalized.includes("complete")) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }
  if (normalized.includes("blocked") || normalized.includes("cancel")) {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }
  if (normalized.includes("progress") || normalized.includes("active")) {
    return "border-sky-200 bg-sky-100 text-sky-800";
  }
  return "border-amber-200 bg-amber-100 text-amber-800";
};

const priorityTone = (priority) => {
  const normalized = normalize(priority);
  if (normalized === "critical" || normalized === "high") {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }
  if (normalized === "medium") {
    return "border-violet-200 bg-violet-100 text-violet-800";
  }
  return "border-teal-200 bg-teal-100 text-teal-800";
};

const statusColorBar = (status) => {
  const normalized = normalize(status);
  if (normalized.includes("done") || normalized.includes("complete")) return "bg-[#00C875]";
  if (normalized.includes("blocked") || normalized.includes("cancel")) return "bg-[#E2445C]";
  if (normalized.includes("progress") || normalized.includes("active")) return "bg-[#0086C9]";
  return "bg-[#FDAB3D]";
};

const statusAccent = (status) => {
  const normalized = normalize(status);
  if (normalized.includes("done") || normalized.includes("complete")) return "from-emerald-400 to-teal-500";
  if (normalized.includes("blocked") || normalized.includes("cancel")) return "from-rose-400 to-orange-500";
  if (normalized.includes("progress") || normalized.includes("active")) return "from-sky-400 to-blue-600";
  return "from-amber-300 to-orange-500";
};

const columnAccent = (key) => {
  const accents = {
    item: "bg-[#0086C9]",
    group: "bg-[#6161FF]",
    status: "bg-[#FDAB3D]",
    priority: "bg-[#A25DDC]",
    assignees: "bg-[#00C875]",
    support: "bg-[#00B8D9]",
    checklist: "bg-[#A25DDC]",
    documents: "bg-[#FFCB00]",
    date: "bg-[#579BFC]",
    type: "bg-[#E2445C]",
  };
  return accents[key] || "bg-slate-300";
};

const SectionBadge = ({ children, tone = "neutral" }) => {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
      : tone === "danger"
      ? "border-rose-200 bg-rose-100 text-rose-800"
      : tone === "info"
      ? "border-cyan-200 bg-cyan-100 text-cyan-800"
      : tone === "warm"
      ? "border-orange-200 bg-orange-100 text-orange-800"
      : "border-slate-200 bg-white text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${className}`}
    >
      {children}
    </span>
  );
};

const EmptyBlock = ({ title, detail, action }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center shadow-sm">
    <FiList className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
    <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

const LoadingSkeleton = ({ rows = 3, height = "h-16" }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className={`${height} animate-pulse rounded-2xl bg-slate-100`} />
    ))}
  </div>
);

const MondayPill = ({ label, tone }) => (
  <span
    className={`inline-flex min-h-8 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}
  >
    {label}
  </span>
);

const WorkspaceCard = ({ workspace, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all duration-200 active:scale-[0.99] ${
      active
        ? "border-[#6161FF] bg-[#6161FF] text-white shadow-[0_16px_32px_rgba(97,97,255,0.24)]"
        : "border-white bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50/60 hover:shadow-md"
    }`}
  >
    <span className={`absolute inset-y-0 left-0 w-1.5 ${active ? "bg-[#00C875]" : "bg-transparent group-hover:bg-[#00C875]"}`} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{workspace.name}</p>
        <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
          {workspace.project_count || 0} proyectos
        </p>
      </div>
      <SectionBadge tone={active ? "neutral" : "info"}>
        {workspace.access_role || "member"}
      </SectionBadge>
    </div>
  </button>
);

const ProjectRow = ({ project, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all duration-200 active:scale-[0.99] ${
      active
        ? "border-[#00C875]/40 bg-emerald-50 shadow-sm"
        : "border-transparent bg-transparent hover:border-violet-100 hover:bg-white hover:shadow-sm"
    }`}
  >
    <span className={`absolute inset-y-0 left-0 w-1 ${active ? "bg-[#00C875]" : "bg-transparent group-hover:bg-[#A25DDC]"}`} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {project.item_count || 0} items, {project.board_count || 0} secciones
        </p>
      </div>
      <span
        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(project.status)}`}
      >
        {formatLabel(project.status)}
      </span>
    </div>
  </button>
);

const BoardHeaderRow = ({ showGroupColumn, boardGridClass }) => (
  <div className={`${boardGridClass} sticky top-0 z-10 hidden rounded-t-[24px] border-b border-slate-200 bg-white/95 shadow-[0_8px_22px_rgba(15,23,42,0.05)] backdrop-blur md:grid`}>
    {MONDAY_COLUMNS.filter((column) => showGroupColumn || column.key !== "group").map((column) => (
      <div
        key={column.key}
        className="border-r border-slate-200 px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 last:border-r-0"
        style={{ minWidth: 0 }}
      >
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${columnAccent(column.key)}`} />
          {column.label}
        </span>
      </div>
    ))}
  </div>
);

const SupportCell = ({ item, collaboratorOptions, saving, onChange }) => {
  const supporters = Array.isArray(item.supporters) ? item.supporters : [];
  const supporterIds = supporters
    .map((supporter) => Number(supporter.user_id))
    .filter((userId) => Number.isFinite(userId));
  const availableOptions = collaboratorOptions.filter(
    (option) => !supporterIds.includes(Number(option.id))
  );

  const updateSupporters = (nextIds) => {
    onChange(item.id, nextIds);
  };

  return (
    <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/80 to-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-cyan-800">
          <FiUserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Apoyo
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-cyan-700 shadow-sm">
          {supporters.length}
        </span>
      </div>
      <div className="flex min-h-9 flex-wrap gap-1.5">
        {supporters.length ? (
          supporters.map((supporter) => (
            <span
              key={supporter.user_id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white bg-white px-2 py-1 text-[11px] font-bold text-cyan-900 shadow-sm"
              title={supporter.email || supporter.fullname}
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[9px] font-black text-white shadow-sm">
                {getInitials(supporter.fullname)}
              </span>
              <span className="max-w-[110px] truncate">{supporter.fullname}</span>
              <button
                type="button"
                onClick={() =>
                  updateSupporters(
                    supporterIds.filter((userId) => userId !== Number(supporter.user_id))
                  )
                }
                disabled={saving}
                className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-cyan-700 transition-colors hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-50"
                aria-label={`Quitar apoyo ${supporter.fullname}`}
              >
                <FiX className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))
        ) : (
          <span className="inline-flex items-center rounded-full border border-dashed border-cyan-200 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
            Sin apoyo
          </span>
        )}
      </div>
      <select
        value=""
        onChange={(event) => {
          const userId = Number(event.target.value);
          if (Number.isFinite(userId)) updateSupporters([...supporterIds, userId]);
        }}
        disabled={saving || !availableOptions.length}
        className={`${boardSelectClass} mt-2 border-cyan-100 bg-white/90 text-cyan-900`}
      >
        <option value="">
          {availableOptions.length ? "Agregar persona de apoyo" : "Sin mas usuarios"}
        </option>
        {availableOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.fullname}
          </option>
        ))}
      </select>
    </div>
  );
};

const ChecklistCell = ({ item, savingFieldKey, onAdd, onToggle, onRename, onDelete }) => {
  const [draftTitle, setDraftTitle] = useState("");
  const checklist = item.checklist || {};
  const checklistItems = Array.isArray(checklist.items) ? checklist.items : [];
  const totalItems = Number(checklist.total_items ?? checklistItems.length ?? 0);
  const doneItems = Number(
    checklist.done_items ?? checklistItems.filter((checkItem) => checkItem.is_done).length ?? 0
  );
  const progress = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
  const isAdding = savingFieldKey === `${item.id}:checklist:add`;

  const submitDraft = () => {
    const title = draftTitle.trim();
    if (!title || isAdding) return;
    onAdd(item.id, title, () => setDraftTitle(""));
  };

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/90 to-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-violet-800">
          <FiCheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Checklist
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-violet-700 shadow-sm">
          {doneItems}/{totalItems}
        </span>
      </div>

      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
        {checklistItems.length ? (
          checklistItems.map((checkItem) => {
            const savingKey = `${checkItem.id}:checklist`;
            return (
              <div
                key={checkItem.id}
                className="flex items-center gap-2 rounded-xl border border-white bg-white px-2 py-1.5 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={Boolean(checkItem.is_done)}
                  disabled={savingFieldKey === savingKey}
                  onChange={(event) => onToggle(checkItem.id, event.target.checked, item.id)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-violet-200 text-violet-600 focus:ring-violet-400 disabled:cursor-wait"
                  aria-label={`Marcar ${checkItem.title}`}
                />
                <input
                  key={`${checkItem.id}:${checkItem.title || ""}`}
                  defaultValue={checkItem.title || ""}
                  disabled={savingFieldKey === savingKey}
                  onBlur={(event) => {
                    const nextTitle = event.target.value.trim();
                    if (nextTitle && nextTitle !== (checkItem.title || "")) {
                      onRename(checkItem.id, nextTitle, item.id);
                    }
                  }}
                  className={`min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold text-slate-800 transition-colors focus:border-violet-200 focus:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-200 ${
                    checkItem.is_done ? "text-slate-400 line-through" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onDelete(checkItem.id, item.id)}
                  disabled={savingFieldKey === savingKey}
                  className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50"
                  aria-label={`Eliminar ${checkItem.title}`}
                >
                  <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-violet-200 bg-white/70 px-2.5 py-2 text-[11px] font-semibold text-violet-700">
            Agrega pasos para cumplir este item.
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-1.5">
        <input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitDraft();
            }
          }}
          disabled={isAdding}
          placeholder="Nuevo paso..."
          className="min-h-9 min-w-0 flex-1 rounded-xl border border-violet-100 bg-white/90 px-2.5 text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:cursor-wait disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submitDraft}
          disabled={isAdding || !draftTitle.trim()}
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Agregar paso de checklist"
        >
          <FiPlus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

const UpdatesCell = ({ item, saving, onAdd }) => {
  const [draftBody, setDraftBody] = useState("");
  const comments = Array.isArray(item.comments) ? item.comments : [];
  const visibleComments = comments.slice(0, 3);
  const totalComments = Number(item.comment_count ?? comments.length ?? 0);

  const submitDraft = () => {
    const body = draftBody.trim();
    if (!body || saving) return;
    onAdd(item.id, body, () => setDraftBody(""));
  };

  return (
    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-sky-800">
          <FiMessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizaciones
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-sky-700 shadow-sm">
          {totalComments}
        </span>
      </div>

      <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
        {visibleComments.length ? (
          visibleComments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-xl border border-white bg-white px-2.5 py-2 shadow-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-black uppercase tracking-[0.06em] text-sky-700">
                  {comment.created_by_name || "Colaborador"}
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                  {formatDateTime(comment.created_at)}
                </span>
              </div>
              <p className="line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                {comment.body}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-sky-200 bg-white/70 px-2.5 py-2 text-[11px] font-semibold text-sky-700">
            Sin notas todavia. Agrega contexto, acuerdos o avances.
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-1.5">
        <textarea
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              submitDraft();
            }
          }}
          disabled={saving}
          rows={2}
          maxLength={2000}
          placeholder="Escribe una nota..."
          className="min-h-[54px] min-w-0 flex-1 resize-none rounded-xl border border-sky-100 bg-white/90 px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-wait disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submitDraft}
          disabled={saving || !draftBody.trim()}
          className="inline-flex h-[54px] w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Agregar actualizacion"
          title="Agregar actualizacion"
        >
          <FiPlus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

const DocumentsCell = ({ item, saving, onUpload }) => {
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  const visibleAttachments = attachments.slice(0, 6);
  const hiddenCount = Math.max(attachments.length - visibleAttachments.length, 0);

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-amber-800">
          <FiPaperclip className="h-3.5 w-3.5" aria-hidden="true" />
          Evidencias
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-amber-700 shadow-sm">
          {attachments.length}
        </span>
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5">
        {visibleAttachments.length ? (
          visibleAttachments.map((attachment, index) =>
            attachment.file_url ? (
              <a
                key={attachment.id || `${attachment.file_name}-${index}`}
                href={attachment.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white bg-white text-amber-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-100"
                title={attachment.file_name || "Documento"}
              >
                <FiFileText className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <span
                key={attachment.id || `${attachment.file_name}-${index}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400"
                title={attachment.file_name || "Documento sin enlace"}
              >
                <FiFileText className="h-4 w-4" aria-hidden="true" />
              </span>
            )
          )
        ) : (
          <span className="inline-flex items-center rounded-full border border-dashed border-amber-200 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            Sin documentos
          </span>
        )}
        {hiddenCount ? (
          <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-600">
            +{hiddenCount}
          </span>
        ) : null}
      </div>
      <label
        className={`inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition-all duration-150 ${
          saving
            ? "cursor-wait border-slate-200 bg-slate-50 text-slate-400"
            : "cursor-pointer border-amber-200 bg-white text-amber-800 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100"
        }`}
      >
        <FiPlus className="h-4 w-4" aria-hidden="true" />
        {saving ? "Subiendo..." : "Agregar documento"}
        <input
          type="file"
          className="hidden"
          disabled={saving}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(item.id, file);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
};

const BoardItemRow = ({
  item,
  showGroupColumn,
  boardGridClass,
  availableGroups,
  assigneeOptions,
  collaboratorOptions,
  savingFieldKey,
  onOpenProject,
  onOpenDetail,
  onFieldChange,
  onAssigneeChange,
  onSupportChange,
  onChecklistAdd,
  onChecklistToggle,
  onChecklistRename,
  onChecklistDelete,
  onCommentAdd,
  onAttachmentUpload,
}) => (
  <div className={`${boardGridClass} group border-b border-slate-100 bg-white/95 transition-all duration-200 hover:bg-white hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]`}>
    <div className="relative overflow-hidden border-r border-slate-100 px-4 py-3 last:border-r-0 md:min-h-[92px]">
      <span className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${statusAccent(item.status)}`} />
      <div className="min-w-0 pl-2">
        <div className="flex items-start gap-3">
          <span className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${statusAccent(item.status)} text-xs font-black text-white shadow-[0_10px_20px_rgba(15,23,42,0.14)]`}>
            {getInitials(item.title)}
          </span>
          <div className="min-w-0 flex-1">
            <input
              key={`${item.id}:${item.title || ""}`}
              defaultValue={item.title || ""}
              onBlur={(event) => {
                if (event.target.value !== (item.title || "")) {
                  onFieldChange(item.id, "title", event.target.value);
                }
              }}
              disabled={savingFieldKey === `${item.id}:title`}
              className="min-h-9 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-sm font-black text-slate-950 transition-colors focus:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 disabled:cursor-wait disabled:opacity-60"
            />
            <p className="mt-1 inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              <span className="truncate">{formatLabel(item.item_type, "Tarea")} del proyecto</span>
            </p>
          </div>
        </div>
        {item.description ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenProject(item.project_id)}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
          >
            Abrir proyecto
            <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900"
          >
            Detalle
          </button>
        </div>
      </div>
    </div>
    {showGroupColumn ? (
      <div className="border-r border-slate-200 px-4 py-3">
        <select
          value={item.group_id || ""}
          onChange={(event) => onFieldChange(item.id, "group_id", event.target.value)}
          disabled={savingFieldKey === `${item.id}:group_id`}
          className={boardSelectClass}
        >
          {availableGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </div>
    ) : null}
    <div className="border-r border-slate-200 px-4 py-3">
      <div className="mb-2 h-1.5 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${statusColorBar(item.status)}`} />
      </div>
      <select
        value={item.status || "todo"}
        onChange={(event) => onFieldChange(item.id, "status", event.target.value)}
        disabled={savingFieldKey === `${item.id}:status`}
        className={`${boardSelectClass} ${statusTone(item.status)}`}
      >
        {ITEM_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
    <div className="border-r border-slate-200 px-4 py-3">
      <select
        value={item.priority || "medium"}
        onChange={(event) => onFieldChange(item.id, "priority", event.target.value)}
        disabled={savingFieldKey === `${item.id}:priority`}
        className={`${boardSelectClass} ${priorityTone(item.priority)}`}
      >
        {ITEM_PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
    <div className="border-r border-slate-200 px-4 py-3">
      <select
        value={item.assignees?.[0]?.user_id || ""}
        onChange={(event) => onAssigneeChange(item.id, event.target.value)}
        disabled={savingFieldKey === `${item.id}:assignees`}
        className={boardSelectClass}
      >
        <option value="">Sin asignar</option>
        {assigneeOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.fullname}
          </option>
        ))}
      </select>
    </div>
    <div className="border-r border-slate-200 px-4 py-3">
      <SupportCell
        item={item}
        collaboratorOptions={collaboratorOptions}
        saving={savingFieldKey === `${item.id}:supporters`}
        onChange={onSupportChange}
      />
    </div>
    <div className="border-r border-slate-200 px-4 py-3">
      <ChecklistCell
        item={item}
        savingFieldKey={savingFieldKey}
        onAdd={onChecklistAdd}
        onToggle={onChecklistToggle}
        onRename={onChecklistRename}
        onDelete={onChecklistDelete}
      />
    </div>
    <div className="border-r border-slate-200 px-4 py-3">
      <UpdatesCell
        item={item}
        saving={savingFieldKey === `${item.id}:comment`}
        onAdd={onCommentAdd}
      />
    </div>
    <div className="border-r border-slate-200 px-4 py-3">
      <DocumentsCell
        item={item}
        saving={savingFieldKey === `${item.id}:attachment`}
        onUpload={onAttachmentUpload}
      />
    </div>
    <div className="border-r border-slate-200 px-4 py-3">
      <input
        type="date"
        value={formatDateInput(item.planned_end_at)}
        onChange={(event) => onFieldChange(item.id, "planned_end_at", event.target.value || null)}
        disabled={savingFieldKey === `${item.id}:planned_end_at`}
        className={boardDateClass}
      />
    </div>
    <div className="px-4 py-3">
      <select
        value={item.item_type || "task"}
        onChange={(event) => onFieldChange(item.id, "item_type", event.target.value)}
        disabled={savingFieldKey === `${item.id}:item_type`}
        className={boardSelectClass}
      >
        {ITEM_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);

const MobileItemCard = ({ item, onOpenProject }) => (
  <article className="relative overflow-hidden rounded-[28px] border border-white bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/5 md:hidden">
    <span className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${statusAccent(item.status)}`} />
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3 pl-1">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${statusAccent(item.status)} text-xs font-black text-white shadow-[0_10px_20px_rgba(15,23,42,0.14)]`}>
          {getInitials(item.title)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">
            {formatLabel(item.item_type, "Tarea")} del proyecto
          </p>
        </div>
      </div>
      <MondayPill label={formatLabel(item.status, "Todo")} tone={statusTone(item.status)} />
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <MondayPill
        label={formatLabel(item.priority, "Media")}
        tone={priorityTone(item.priority)}
      />
      <SectionBadge>{formatLabel(item.item_type, "task")}</SectionBadge>
      <SectionBadge>{formatDate(item.planned_end_at)}</SectionBadge>
    </div>
    {item.assignees?.length ? (
      <p className="mt-3 text-xs text-slate-600">
        Responsable: {item.assignees.map((assignee) => assignee.fullname).join(", ")}
      </p>
    ) : null}
    {item.supporters?.length ? (
      <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-2">
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.08em] text-cyan-800">Apoyo</p>
        <div className="flex flex-wrap gap-1.5">
          {item.supporters.slice(0, 4).map((supporter) => (
            <span
              key={supporter.user_id}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-cyan-900 shadow-sm"
              title={supporter.email || supporter.fullname}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[9px] font-black text-white">
                {getInitials(supporter.fullname)}
              </span>
              {supporter.fullname}
            </span>
          ))}
        </div>
      </div>
    ) : null}
    {Number(item.checklist?.total_items || 0) > 0 ? (
      <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/80 p-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-violet-800">
            Checklist
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-violet-700">
            {Number(item.checklist?.done_items || 0)}/{Number(item.checklist?.total_items || 0)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
            style={{
              width: `${
                Number(item.checklist?.total_items || 0)
                  ? Math.round(
                      (Number(item.checklist?.done_items || 0) /
                        Number(item.checklist?.total_items || 0)) *
                        100
                    )
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    ) : null}
    {Number(item.comment_count || 0) > 0 ? (
      <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/80 p-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-sky-800">
            <FiMessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizaciones
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-sky-700">
            {Number(item.comment_count || 0)}
          </span>
        </div>
        <p className="line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
          {(item.comments || [])[0]?.body || "Sin detalle reciente"}
        </p>
      </div>
    ) : null}
    {Number(item.attachment_count || 0) > 0 ? (
      <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-amber-100 bg-amber-50/80 p-2">
        <span className="mr-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-800">Docs</span>
        {(item.attachments || []).slice(0, 5).map((attachment, index) => (
          <a
            key={attachment.id || `${attachment.file_name}-${index}`}
            href={attachment.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm"
            title={attachment.file_name || "Documento"}
          >
            <FiFileText className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ))}
        {Number(item.attachment_count || 0) > 5 ? (
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-amber-700">
            +{Number(item.attachment_count || 0) - 5}
          </span>
        ) : null}
      </div>
    ) : null}
    <button
      type="button"
      onClick={() => onOpenProject(item.project_id)}
      className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
    >
      Abrir proyecto
      <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </article>
);

const OverviewMetric = ({ label, value, detail }) => (
  <div className="rounded-3xl border border-white bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-0.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-[1.6rem] font-semibold tracking-[-0.03em] text-slate-900">
      {value}
    </p>
    {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
  </div>
);

const WorkManagementPage = () => {
  const { projectId: routeProjectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useUI();

  const userId = Number(user?.id || 0);

  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [boards, setBoards] = useState([]);
  const [items, setItems] = useState([]);
  const [projectDetail, setProjectDetail] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [collaboratorOptions, setCollaboratorOptions] = useState([]);
  const [myWork, setMyWork] = useState({ summary: {}, items: [] });
  const [portfolio, setPortfolio] = useState({
    summary: {},
    attention_items: [],
  });

  const [workspaceId, setWorkspaceId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId || "");
  const projectDataRequestRef = useRef(0);
  const suppressRouteProjectSyncRef = useRef(false);
  const [activeView, setActiveView] = useState("board");
  const [searchTerm, setSearchTerm] = useState("");
  const [workspaceMemberSearch, setWorkspaceMemberSearch] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemDetailOpen, setItemDetailOpen] = useState(false);

  const [workspaceForm, setWorkspaceForm] = useState(EMPTY_WORKSPACE_FORM);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [boardForm, setBoardForm] = useState(EMPTY_BOARD_FORM);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);

  const [submitting, setSubmitting] = useState("");
  const [savingFieldKey, setSavingFieldKey] = useState("");
  const [itemDetailDraft, setItemDetailDraft] = useState(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) || null,
    [workspaces, workspaceId]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projectDetail || null,
    [projectDetail, projects, selectedProjectId]
  );

  const selectedWorkspaceMembers = useMemo(() => {
    const selected = new Set(workspaceForm.member_user_ids || []);
    return collaboratorOptions.filter((collaborator) => selected.has(Number(collaborator.id)));
  }, [collaboratorOptions, workspaceForm.member_user_ids]);

  const filteredCollaboratorOptions = useMemo(() => {
    const query = normalize(workspaceMemberSearch);
    const selected = new Set(workspaceForm.member_user_ids || []);
    return collaboratorOptions
      .filter((collaborator) => Number(collaborator.id) !== userId)
      .filter((collaborator) => {
        if (selected.has(Number(collaborator.id))) return false;
        if (!query) return true;
        return [
          collaborator.fullname,
          collaborator.email,
          collaborator.role,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 8);
  }, [collaboratorOptions, userId, workspaceForm.member_user_ids, workspaceMemberSearch]);

  const groupedBoards = useMemo(
    () =>
      (boards || []).map((board) => ({
        ...board,
        groups: Array.isArray(board.groups) ? board.groups : [],
      })),
    [boards]
  );

  const availableGroups = useMemo(() => {
    const groups = [];
    for (const board of groupedBoards) {
      for (const group of board.groups || []) {
        groups.push({
          id: group.id,
          label: `${board.name} / ${group.name}`,
        });
      }
    }
    return groups;
  }, [groupedBoards]);

  const showGroupColumn = false;
  const boardGridClass = useMemo(() => getBoardGridClass(showGroupColumn), [showGroupColumn]);

  const projectStats = useMemo(() => {
    const totalItems = items.length;
    const completed = items.filter((item) => item.status === "done").length;
    const blocked = items.filter((item) => item.status === "blocked").length;
    const inProgress = items.filter((item) => item.status === "in_progress").length;
    return { totalItems, completed, blocked, inProgress };
  }, [items]);

  const overviewStats = useMemo(() => {
    const summary = portfolio?.summary || {};
    const mine = myWork?.summary || {};
    return {
      portfolioProjects: Number(summary.project_count || 0),
      portfolioItems: Number(summary.item_count || 0),
      mineOpen: Number(mine.total_items || 0) - Number(mine.done_items || 0),
      overdue: Math.max(
        Number(summary.overdue_items || 0),
        Number(mine.overdue_items || 0)
      ),
    };
  }, [myWork, portfolio]);

  const filteredItems = useMemo(() => {
    const query = normalize(searchTerm);
    return items.filter((item) => {
      if (hideDone && normalize(item.status) === "done") return false;
      if (!query) return true;
      const haystack = [
        item.title,
        item.description,
        item.group_name,
        item.board_name,
        item.item_type,
        item.status,
        item.priority,
        ...(item.assignees || []).map((assignee) => assignee.fullname),
        ...(item.comments || []).map((comment) => comment.body),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [hideDone, items, searchTerm]);

  const myWorkSections = useMemo(() => {
    const base = ["Vencido", "Hoy", "Esta semana", "Luego", "Sin fecha"];
    const grouped = new Map(base.map((label) => [label, []]));

    for (const item of myWork?.items || []) {
      if (hideDone && normalize(item.status) === "done") continue;
      const query = normalize(searchTerm);
      if (query) {
        const haystack = [
          item.title,
          item.description,
          item.project_name,
          item.workspace_name,
          item.group_name,
          item.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) continue;
      }
      const bucket = classifyDateBucket(item.planned_end_at);
      grouped.get(bucket).push(item);
    }

    return base.map((label) => ({
      label,
      items: grouped.get(label) || [],
    }));
  }, [hideDone, myWork, searchTerm]);

  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    setErrorMessage("");
    try {
      const response = await fetchWorkspaces();
      setWorkspaces(response);

      if (!response.length) {
        setWorkspaceId("");
        setProjects([]);
        setSelectedProjectId("");
        setProjectDetail(null);
        setBoards([]);
        setItems([]);
        return;
      }

      if (routeProjectId) return;

      setWorkspaceId((current) =>
        current && response.some((workspace) => workspace.id === current)
          ? current
          : response[0].id
      );
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "No se pudieron cargar los workspaces."
      );
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [routeProjectId]);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [myWorkData, portfolioData] = await Promise.all([
        fetchMyWork(),
        fetchPortfolioSummary(),
      ]);
      setMyWork(myWorkData || { summary: {}, items: [] });
      setPortfolio(portfolioData || { summary: {}, attention_items: [] });
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || "No se pudo cargar el resumen operativo."
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadCollaborators = useCallback(async () => {
    try {
      const response = await fetchWorkManagementCollaborators({ active: true, limit: 200 });
      setCollaboratorOptions(Array.isArray(response) ? response : []);
    } catch (error) {
      setCollaboratorOptions([]);
    }
  }, []);

  const loadProjects = useCallback(
    async (nextWorkspaceId) => {
      if (!nextWorkspaceId) {
        setProjects([]);
        return;
      }
      setLoadingProjects(true);
      setErrorMessage("");
      try {
        const response = await fetchWorkspaceProjects(nextWorkspaceId);
        setProjects(response);

        if (routeProjectId && response.some((project) => project.id === routeProjectId)) {
          setSelectedProjectId(routeProjectId);
          return;
        }

        setSelectedProjectId((current) =>
          current && response.some((project) => project.id === current)
            ? current
            : response[0]?.id || ""
        );
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.message || "No se pudieron cargar los proyectos."
        );
      } finally {
        setLoadingProjects(false);
      }
    },
    [routeProjectId]
  );

  const loadProjectData = useCallback(async (nextProjectId) => {
    const requestId = ++projectDataRequestRef.current;
    if (!nextProjectId) {
      setProjectDetail(null);
      setBoards([]);
      setItems([]);
      setAssigneeOptions([]);
      return;
    }
    setLoadingProjectData(true);
    setErrorMessage("");
    try {
      const [detail, boardRows, itemRows, assigneeRows] = await Promise.all([
        fetchProject(nextProjectId),
        fetchProjectBoards(nextProjectId),
        fetchProjectItems(nextProjectId),
        fetchAssigneeOptions(nextProjectId),
      ]);
      if (requestId !== projectDataRequestRef.current) return;
      setProjectDetail(detail);
      setBoards(boardRows);
      setItems(itemRows);
      setAssigneeOptions(Array.isArray(assigneeRows) ? assigneeRows : []);
      if (detail?.workspace_id) {
        setWorkspaceId((current) =>
          current === detail.workspace_id ? current : detail.workspace_id
        );
      }
    } catch (error) {
      if (requestId !== projectDataRequestRef.current) return;
      setErrorMessage(
        error?.response?.data?.message || "No se pudo cargar el detalle del proyecto."
      );
    } finally {
      if (requestId === projectDataRequestRef.current) {
        setLoadingProjectData(false);
      }
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  useEffect(() => {
    if (!routeProjectId || !workspaces.length) return;
    if (suppressRouteProjectSyncRef.current) {
      suppressRouteProjectSyncRef.current = false;
      return;
    }
    if (selectedProjectId === routeProjectId && projectDetail?.id === routeProjectId) return;

    (async () => {
      const requestId = ++projectDataRequestRef.current;
      setLoadingProjectData(true);
      try {
        const detail = await fetchProject(routeProjectId);
        if (requestId !== projectDataRequestRef.current) return;
        setProjectDetail(detail);
        setWorkspaceId(detail.workspace_id || "");
        setSelectedProjectId(detail.id);
      } catch (error) {
        if (requestId !== projectDataRequestRef.current) return;
        setErrorMessage(
          error?.response?.data?.message || "No se pudo resolver el proyecto solicitado."
        );
      } finally {
        if (requestId === projectDataRequestRef.current) {
          setLoadingProjectData(false);
        }
      }
    })();
  }, [projectDetail?.id, routeProjectId, selectedProjectId, workspaces.length]);

  useEffect(() => {
    if (!workspaceId) return;
    loadProjects(workspaceId);
  }, [loadProjects, workspaceId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    loadProjectData(selectedProjectId);
    navigate(`/dashboard/work-management/projects/${selectedProjectId}`, { replace: true });
  }, [loadProjectData, navigate, selectedProjectId]);

  useEffect(() => {
    if (!availableGroups.length) return;
    setItemForm((current) =>
      current.group_id ? current : { ...current, group_id: availableGroups[0].id }
    );
  }, [availableGroups]);

  const resetWorkspaceForm = () => setWorkspaceForm(EMPTY_WORKSPACE_FORM);
  const resetProjectForm = () => setProjectForm(EMPTY_PROJECT_FORM);
  const resetBoardForm = () => setBoardForm(EMPTY_BOARD_FORM);
  const resetItemForm = () =>
    setItemForm({
      ...EMPTY_ITEM_FORM,
      group_id: availableGroups[0]?.id || "",
    });

  const handleRefresh = async () => {
    await loadOverview();
    await loadCollaborators();
    await loadWorkspaces();
    if (workspaceId) await loadProjects(workspaceId);
    if (selectedProjectId) await loadProjectData(selectedProjectId);
  };

  const handleWorkspaceSelect = useCallback(
    (nextWorkspaceId) => {
      if (!nextWorkspaceId) return;
      if (nextWorkspaceId === workspaceId) {
        setStructureOpen(false);
        return;
      }

      suppressRouteProjectSyncRef.current = true;
      projectDataRequestRef.current += 1;
      navigate("/dashboard/work-management", { replace: true });
      setWorkspaceId(nextWorkspaceId);
      setProjects([]);
      setSelectedProjectId("");
      setProjectDetail(null);
      setBoards([]);
      setItems([]);
      setAssigneeOptions([]);
      setLoadingProjectData(false);
      setStructureOpen(false);
    },
    [navigate, workspaceId]
  );

  const toggleWorkspaceMember = (memberId) => {
    const parsed = Number(memberId);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed === userId) return;
    setWorkspaceForm((current) => {
      const selected = new Set(current.member_user_ids || []);
      if (selected.has(parsed)) {
        selected.delete(parsed);
      } else {
        selected.add(parsed);
      }
      return { ...current, member_user_ids: Array.from(selected) };
    });
  };

  const clearWorkspaceMembers = () => {
    setWorkspaceForm((current) => ({ ...current, member_user_ids: [] }));
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceForm.name.trim()) {
      showToast("Debes ingresar el nombre del workspace.", "error");
      return;
    }
    setSubmitting("workspace");
    try {
      const created = await createWorkspace(workspaceForm);
      await loadWorkspaces();
      setWorkspaceId(created.id);
      setWorkspaceModalOpen(false);
      resetWorkspaceForm();
      setWorkspaceMemberSearch("");
      showToast("Workspace creado correctamente.", "success");
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo crear el workspace.",
        "error"
      );
    } finally {
      setSubmitting("");
    }
  };

  const handleCreateProject = async () => {
    if (!workspaceId) {
      showToast("Primero selecciona un workspace.", "error");
      return;
    }
    if (!projectForm.name.trim()) {
      showToast("Debes ingresar el nombre del proyecto.", "error");
      return;
    }
    setSubmitting("project");
    try {
      const created = await createProject(workspaceId, projectForm);
      await loadProjects(workspaceId);
      setSelectedProjectId(created.id);
      setProjectModalOpen(false);
      resetProjectForm();
      showToast("Proyecto creado correctamente.", "success");
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo crear el proyecto.",
        "error"
      );
    } finally {
      setSubmitting("");
    }
  };

  const handleCreateBoard = async () => {
    if (!selectedProjectId) {
      showToast("Selecciona un proyecto para crear la seccion operativa.", "error");
      return;
    }
    if (!boardForm.name.trim()) {
      showToast("Debes ingresar el nombre de la seccion operativa.", "error");
      return;
    }
    setSubmitting("board");
    try {
      await createBoard(selectedProjectId, boardForm);
      await loadProjectData(selectedProjectId);
      setBoardModalOpen(false);
      resetBoardForm();
      showToast("Seccion operativa creada correctamente.", "success");
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo crear la seccion operativa.",
        "error"
      );
    } finally {
      setSubmitting("");
    }
  };

  const handleCreateItem = async () => {
    if (!itemForm.group_id) {
      showToast("Selecciona una columna para crear el item.", "error");
      return;
    }
    if (!itemForm.title.trim()) {
      showToast("Debes ingresar el titulo del item.", "error");
      return;
    }
    setSubmitting("item");
    try {
      await createItem(itemForm.group_id, {
        title: itemForm.title,
        description: itemForm.description,
        item_type: itemForm.item_type,
        priority: itemForm.priority,
        status: itemForm.status,
        assignee_user_ids: itemForm.assign_to_me && userId ? [userId] : [],
      });
      await loadProjectData(selectedProjectId);
      await loadOverview();
      setItemModalOpen(false);
      resetItemForm();
      showToast("Item creado correctamente.", "success");
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo crear el item.",
        "error"
      );
    } finally {
      setSubmitting("");
    }
  };

  const handleInlineFieldChange = async (itemId, field, value) => {
    const currentItem = items.find((item) => item.id === itemId);
    const currentValue = currentItem?.[field] ?? null;
    if (currentValue === value) {
      return;
    }

    const nextValue = field === "planned_end_at" && value ? `${value}T00:00:00` : value;
    const previousItems = items;

    setSavingFieldKey(`${itemId}:${field}`);
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [field]: nextValue } : item))
    );

    try {
      await updateItem(itemId, { [field]: nextValue });
      showToast("Item actualizado.", "success");
      await Promise.all([loadProjectData(selectedProjectId), loadOverview()]);
    } catch (error) {
      setItems(previousItems);
      showToast(
        error?.response?.data?.message || "No se pudo actualizar el item.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const handleInlineAssigneeChange = async (itemId, assigneeUserId) => {
    const previousItems = items;
    const assigneeId = assigneeUserId ? Number(assigneeUserId) : null;
    const selectedAssignee = assigneeOptions.find((option) => Number(option.id) === assigneeId);

    setSavingFieldKey(`${itemId}:assignees`);
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              assignees: selectedAssignee
                ? [{ user_id: selectedAssignee.id, fullname: selectedAssignee.fullname }]
                : [],
            }
          : item
      )
    );

    try {
      await updateItemAssignees(itemId, {
        assignee_user_ids: assigneeId ? [assigneeId] : [],
      });
      showToast("Responsable actualizado.", "success");
      await Promise.all([loadProjectData(selectedProjectId), loadOverview()]);
    } catch (error) {
      setItems(previousItems);
      showToast(
        error?.response?.data?.message || "No se pudo actualizar el responsable.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const handleInlineSupportChange = async (itemId, supportUserIds = []) => {
    const previousItems = items;
    const supporterIds = Array.from(
      new Set(
        (Array.isArray(supportUserIds) ? supportUserIds : [supportUserIds])
          .map((userId) => Number(userId))
          .filter((userId) => Number.isFinite(userId))
      )
    );
    const selectedSupporters = collaboratorOptions.filter((option) =>
      supporterIds.includes(Number(option.id))
    );

    setSavingFieldKey(`${itemId}:supporters`);
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              supporters: selectedSupporters.map((supporter) => ({
                user_id: supporter.id,
                fullname: supporter.fullname,
                email: supporter.email,
              })),
            }
          : item
      )
    );

    try {
      await updateItemSupporters(itemId, {
        support_user_ids: supporterIds,
      });
      showToast("Apoyo actualizado.", "success");
      await Promise.all([loadProjectData(selectedProjectId), loadOverview()]);
    } catch (error) {
      setItems(previousItems);
      showToast(
        error?.response?.data?.message || "No se pudo actualizar el apoyo.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const applyChecklistToItem = (itemId, checklist) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const itemsList = Array.isArray(checklist?.items) ? checklist.items : [];
        const totalItems = Number(checklist?.total_items ?? itemsList.length ?? 0);
        const doneItems = Number(
          checklist?.done_items ?? itemsList.filter((checkItem) => checkItem.is_done).length ?? 0
        );
        return {
          ...item,
          checklist: {
            ...(checklist || {}),
            items: itemsList,
            total_items: totalItems,
            done_items: doneItems,
          },
          completion_pct: totalItems ? Math.round((doneItems / totalItems) * 100) : 0,
        };
      })
    );
  };

  const applyCommentToItem = (itemId, comment) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const comments = Array.isArray(item.comments) ? item.comments : [];
        return {
          ...item,
          comments: [comment, ...comments].slice(0, 5),
          comment_count: Number(item.comment_count || comments.length || 0) + 1,
        };
      })
    );
  };

  const handleChecklistAdd = async (itemId, title, onSuccess) => {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return;

    setSavingFieldKey(`${itemId}:checklist:add`);
    try {
      const checklist = await createChecklistItem(itemId, { title: cleanTitle });
      applyChecklistToItem(itemId, checklist);
      if (typeof onSuccess === "function") onSuccess();
      showToast("Paso agregado al checklist.", "success");
      await Promise.all([loadProjectData(selectedProjectId), loadOverview()]);
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo agregar el paso al checklist.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const handleChecklistToggle = async (checklistItemId, isDone, itemId) => {
    setSavingFieldKey(`${checklistItemId}:checklist`);
    try {
      const checklist = await updateChecklistItem(checklistItemId, { is_done: isDone });
      applyChecklistToItem(itemId, checklist);
      await Promise.all([loadProjectData(selectedProjectId), loadOverview()]);
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo actualizar el checklist.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const handleChecklistRename = async (checklistItemId, title, itemId) => {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return;

    setSavingFieldKey(`${checklistItemId}:checklist`);
    try {
      const checklist = await updateChecklistItem(checklistItemId, { title: cleanTitle });
      applyChecklistToItem(itemId, checklist);
      showToast("Checklist actualizado.", "success");
      await loadProjectData(selectedProjectId);
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo actualizar el texto del checklist.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const handleChecklistDelete = async (checklistItemId, itemId) => {
    setSavingFieldKey(`${checklistItemId}:checklist`);
    try {
      const checklist = await deleteChecklistItem(checklistItemId);
      applyChecklistToItem(itemId, checklist);
      showToast("Paso eliminado del checklist.", "success");
      await Promise.all([loadProjectData(selectedProjectId), loadOverview()]);
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo eliminar el paso del checklist.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const handleCommentAdd = async (itemId, body, onSuccess) => {
    const cleanBody = String(body || "").trim();
    if (!cleanBody) return;

    setSavingFieldKey(`${itemId}:comment`);
    try {
      const comment = await createItemComment(itemId, { body: cleanBody });
      applyCommentToItem(itemId, comment);
      if (typeof onSuccess === "function") onSuccess();
      showToast("Actualizacion agregada al item.", "success");
      await loadProjectData(selectedProjectId);
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo agregar la actualizacion.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const handleItemAttachmentUpload = async (itemId, file) => {
    if (!file) return;

    setSavingFieldKey(`${itemId}:attachment`);
    try {
      await uploadItemAttachment(itemId, file);
      showToast("Documento subido al item.", "success");
      await loadProjectData(selectedProjectId);
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo subir el documento.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  const openItemDetail = (item) => {
    setItemDetailDraft({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      status: item.status || "todo",
      priority: item.priority || "medium",
      item_type: item.item_type || "task",
      planned_end_at: formatDateInput(item.planned_end_at),
      group_id: item.group_id || "",
      assignee_user_id: item.assignees?.[0]?.user_id ? String(item.assignees[0].user_id) : "",
    });
    setItemDetailOpen(true);
  };

  const closeItemDetail = () => {
    if (savingFieldKey === "item-detail") return;
    setItemDetailOpen(false);
    setItemDetailDraft(null);
  };

  const handleSaveItemDetail = async () => {
    if (!itemDetailDraft?.id) return;
    if (!String(itemDetailDraft.title || "").trim()) {
      showToast("Debes ingresar el titulo del item.", "error");
      return;
    }

    setSavingFieldKey("item-detail");
    try {
      await updateItem(itemDetailDraft.id, {
        title: itemDetailDraft.title,
        description: itemDetailDraft.description || null,
        status: itemDetailDraft.status,
        priority: itemDetailDraft.priority,
        item_type: itemDetailDraft.item_type,
        planned_end_at: itemDetailDraft.planned_end_at
          ? `${itemDetailDraft.planned_end_at}T00:00:00`
          : null,
        group_id: itemDetailDraft.group_id || undefined,
      });

      await updateItemAssignees(itemDetailDraft.id, {
        assignee_user_ids: itemDetailDraft.assignee_user_id
          ? [Number(itemDetailDraft.assignee_user_id)]
          : [],
      });

      await Promise.all([loadProjectData(selectedProjectId), loadOverview()]);
      setItemDetailOpen(false);
      setItemDetailDraft(null);
      showToast("Detalle del item actualizado.", "success");
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo actualizar el detalle del item.",
        "error"
      );
    } finally {
      setSavingFieldKey("");
    }
  };

  return (
    <main className={`${WORKSPACE_PAGE_CLASS} ${mondayShell} gap-4 px-2 pb-6 pt-3 sm:px-0`}>
      <section className={`overflow-hidden rounded-[28px] ${mondayCard}`}>
        <div className="relative overflow-hidden border-b border-slate-200 px-4 py-5 sm:px-6 lg:px-7">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[#6161FF]/16 blur-3xl" />
          <div className="absolute right-32 top-8 h-24 w-24 rounded-full bg-[#00C875]/20 blur-2xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm">Workspaces</span>
              <span>/</span>
              <span>{selectedWorkspace?.name || "Selecciona un workspace"}</span>
              {selectedProject ? (
                <>
                  <span>/</span>
                  <span className="font-medium text-slate-700">{selectedProject.name}</span>
                </>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-[1.75rem] font-black tracking-[-0.04em] text-slate-950 sm:text-[2.25rem]">
                Work Management
              </h1>
              <SectionBadge tone="warm">Workspace colaborativo</SectionBadge>
              <SectionBadge>{workspaces.length} workspaces</SectionBadge>
              <SectionBadge tone={overviewStats.overdue ? "danger" : "success"}>
                {overviewStats.overdue} alertas
              </SectionBadge>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Organizacion visible tipo monday: espacio, proyecto e items en una sola
              superficie de trabajo. El flujo sigue conectado a CRM y a procesos SPI ya existentes.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[440px]">
              <div className="rounded-2xl border border-white bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Portafolio</p>
                <p className="mt-1 text-lg font-black text-slate-950">{overviewStats.portfolioProjects}</p>
              </div>
              <div className="rounded-2xl border border-white bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Items</p>
                <p className="mt-1 text-lg font-black text-slate-950">{overviewStats.portfolioItems}</p>
              </div>
              <div className="rounded-2xl border border-white bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Abiertos</p>
                <p className="mt-1 text-lg font-black text-slate-950">{overviewStats.mineOpen}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setStructureOpen((current) => !current)}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-all duration-200 hover:bg-white hover:shadow-md active:scale-[0.97] xl:hidden"
            >
              <FiList className="h-4 w-4" aria-hidden="true" />
              Estructura
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={
                loadingWorkspaces || loadingProjects || loadingProjectData || loadingOverview
              }
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white bg-white/80 px-4 text-sm font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              <FiRefreshCw
                className={`h-4 w-4 ${
                  loadingWorkspaces || loadingProjects || loadingProjectData || loadingOverview
                    ? "animate-spin"
                    : ""
                }`}
                aria-hidden="true"
              />
              Actualizar
            </button>
            </div>
          </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <FiAlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          </div>
        ) : null}

        <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            className={`border-b border-slate-200 bg-white/65 xl:block xl:border-b-0 xl:border-r ${
              structureOpen ? "block" : "hidden"
            }`}
          >
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-900">Estructura viva</p>
                  <p className="text-xs text-slate-500">Espacios, proyectos y acceso del equipo.</p>
                </div>
                <FiBriefcase className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </div>
              <div className="mt-4 rounded-3xl border border-cyan-100 bg-cyan-50/80 p-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#0086C9] shadow-sm">
                    <FiUsers className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Participacion visible</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Asigna responsables y fechas para que cada persona vea su carga en Mi trabajo.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceModalOpen(true)}
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#6161FF]/20 bg-white px-3 text-sm font-bold text-[#5151E5] shadow-sm transition-colors hover:bg-[#F1F1FF]"
                >
                  <FiPlus className="h-4 w-4" aria-hidden="true" />
                  Nuevo workspace
                </button>
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(true)}
                  disabled={!workspaceId}
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#6161FF] px-3 text-sm font-bold text-white shadow-[0_10px_20px_rgba(97,97,255,0.20)] transition-colors hover:bg-[#5151E5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiPlus className="h-4 w-4" aria-hidden="true" />
                  Nuevo proyecto
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div>
                <div className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Workspaces
                  </p>
                </div>

                <div className="space-y-2">
                  {loadingWorkspaces ? (
                    <LoadingSkeleton rows={3} height="h-20" />
                  ) : workspaces.length ? (
                    workspaces.map((workspace) => (
                      <WorkspaceCard
                        key={workspace.id}
                        workspace={workspace}
                        active={workspace.id === workspaceId}
                        onClick={() => handleWorkspaceSelect(workspace.id)}
                      />
                    ))
                  ) : (
                    <EmptyBlock
                      title="Sin workspaces"
                      detail="Crea el primer espacio para empezar a organizar proyectos e items."
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Proyectos del espacio
                  </p>
                </div>

                <div className="space-y-1">
                  {loadingProjects ? (
                    <LoadingSkeleton rows={4} height="h-16" />
                  ) : projects.length ? (
                    projects.map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        active={project.id === selectedProjectId}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setStructureOpen(false);
                        }}
                      />
                    ))
                  ) : (
                    <EmptyBlock
                      title="Sin proyectos"
                      detail="El workspace seleccionado todavía no tiene proyectos."
                    />
                  )}
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="border-b border-slate-200 bg-white/80 px-4 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-semibold tracking-[-0.02em] text-slate-900">
                        {selectedProject?.name || "Selecciona un proyecto"}
                      </p>
                      {selectedProject ? (
                        <>
                          <SectionBadge>{formatLabel(selectedProject.project_type)}</SectionBadge>
                          <SectionBadge tone="info">
                            {groupedBoards.length} secciones
                          </SectionBadge>
                        </>
                      ) : null}
                    </div>
                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                      {selectedProject?.description ||
                        "La superficie principal concentra items editables del proyecto en una sola vista."}
                    </p>
                  </div>

                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {VIEW_OPTIONS.map((view) => {
                      const Icon = view.icon;
                      const active = activeView === view.id;
                      return (
                        <button
                          key={view.id}
                          type="button"
                          onClick={() => setActiveView(view.id)}
                          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                            active
                              ? "border-[#6161FF] bg-[#6161FF] text-white shadow-[0_10px_22px_rgba(97,97,255,0.22)]"
                              : "border-white bg-white text-slate-700 shadow-sm hover:border-cyan-200 hover:bg-cyan-50/70"
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {view.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="relative block min-w-[250px]">
                      <FiSearch
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar item, board, responsable o estado"
                        className="min-h-11 w-full rounded-2xl border border-white bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm focus:border-[#6161FF] focus:outline-none focus:ring-2 focus:ring-[#6161FF]/20"
                      />
                    </label>
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-white bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm">
                      <FiFilter className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      <input
                        type="checkbox"
                        checked={hideDone}
                        onChange={(event) => setHideDone(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#0EA5E9]"
                      />
                      Ocultar done
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              {activeView === "board" ? (
                <section className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-4">
                    <OverviewMetric
                      label="Items visibles"
                      value={filteredItems.length}
                      detail={`${projectStats.completed} hechos`}
                    />
                    <OverviewMetric
                      label="En curso"
                      value={projectStats.inProgress}
                      detail="Estado operativo"
                    />
                    <OverviewMetric
                      label="Bloqueados"
                      value={projectStats.blocked}
                      detail="Requieren seguimiento"
                    />
                    <OverviewMetric
                      label="Estructura"
                      value={groupedBoards.length}
                      detail={`${filteredItems.length} items visibles`}
                    />
                  </div>

                  {loadingProjectData ? (
                    <LoadingSkeleton rows={5} height="h-24" />
                  ) : selectedProjectId ? (
                    availableGroups.length ? (
                      <section className="overflow-hidden rounded-[30px] border border-white bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
                        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-white via-cyan-50/80 to-amber-50/90 px-5 py-5">
                          <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#FFCB00]/25 blur-3xl" />
                          <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-[#00B8D9]/20 blur-2xl" />
                          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6161FF] to-[#00B8D9] text-white shadow-[0_14px_28px_rgba(97,97,255,0.22)]">
                                  <FiGrid className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <div>
                                  <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">Tabla operativa</h3>
                                  <p className="text-xs font-medium text-slate-500">Coordina items, apoyo y evidencias desde una sola vista.</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <SectionBadge>{filteredItems.length} filas</SectionBadge>
                                <SectionBadge tone="info">Estados editables</SectionBadge>
                                <SectionBadge tone="info">Checklist colaborativo</SectionBadge>
                                <SectionBadge tone="info">Notas por item</SectionBadge>
                                <SectionBadge tone="success">Apoyo multiple</SectionBadge>
                                <SectionBadge tone="warm">Documentos por item</SectionBadge>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                              Gestiona estado, prioridad, responsables, checklist, notas y evidencias desde una sola tabla continua.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setItemModalOpen(true)}
                              disabled={!selectedProjectId || !availableGroups.length}
                              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#00B8D9] px-5 text-sm font-black text-white shadow-[0_16px_30px_rgba(37,99,235,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(37,99,235,0.30)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <FiPlus className="h-4 w-4" aria-hidden="true" />
                              Nuevo item
                            </button>
                          </div>
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                          <BoardHeaderRow
                            showGroupColumn={showGroupColumn}
                            boardGridClass={boardGridClass}
                          />
                          {filteredItems.length ? (
                            filteredItems.map((item) => (
                              <BoardItemRow
                                key={item.id}
                                item={item}
                                showGroupColumn={showGroupColumn}
                                boardGridClass={boardGridClass}
                                availableGroups={availableGroups}
                                assigneeOptions={assigneeOptions}
                                collaboratorOptions={collaboratorOptions}
                                savingFieldKey={savingFieldKey}
                                onOpenProject={setSelectedProjectId}
                                onOpenDetail={openItemDetail}
                                onFieldChange={handleInlineFieldChange}
                                onAssigneeChange={handleInlineAssigneeChange}
                                onSupportChange={handleInlineSupportChange}
                                onChecklistAdd={handleChecklistAdd}
                                onChecklistToggle={handleChecklistToggle}
                                onChecklistRename={handleChecklistRename}
                                onChecklistDelete={handleChecklistDelete}
                                onCommentAdd={handleCommentAdd}
                                onAttachmentUpload={handleItemAttachmentUpload}
                              />
                            ))
                          ) : (
                            <div className="p-4">
                              <EmptyBlock
                                title="Sin filas visibles"
                                detail="Ajusta el buscador o crea el primer item para este proyecto."
                              />
                            </div>
                          )}
                        </div>
                        <div className="space-y-3 p-3 md:hidden">
                          {filteredItems.length ? (
                            filteredItems.map((item) => (
                              <MobileItemCard
                                key={item.id}
                                item={item}
                                onOpenProject={setSelectedProjectId}
                              />
                            ))
                          ) : (
                            <EmptyBlock
                              title="Sin filas visibles"
                              detail="Ajusta el buscador o crea el primer item para este proyecto."
                            />
                          )}
                        </div>
                      </section>
                    ) : (
                      <EmptyBlock
                        title="No hay estructura operativa"
                        detail="El proyecto existe, pero todavia no tiene una seccion operativa disponible para crear items."
                        action={
                          <button
                            type="button"
                            onClick={() => setBoardModalOpen(true)}
                            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#6161FF] px-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(97,97,255,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#5151E5] active:scale-[0.97]"
                          >
                            Crear seccion operativa
                          </button>
                        }
                      />
                    )
                  ) : (
                    <EmptyBlock
                      title="Selecciona un proyecto"
                      detail="La vista tipo monday se activa cuando eliges un proyecto desde el panel izquierdo."
                    />
                  )}
                </section>
              ) : null}

              {activeView === "my_work" ? (
                <section className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-4">
                    <OverviewMetric
                      label="Asignadas"
                      value={Number(myWork?.summary?.total_items || 0)}
                      detail="Items directos al usuario"
                    />
                    <OverviewMetric
                      label="En curso"
                      value={Number(myWork?.summary?.in_progress_items || 0)}
                      detail="Carga activa"
                    />
                    <OverviewMetric
                      label="Bloqueadas"
                      value={Number(myWork?.summary?.blocked_items || 0)}
                      detail="Requieren destrabe"
                    />
                    <OverviewMetric
                      label="Vencidas"
                      value={Number(myWork?.summary?.overdue_items || 0)}
                      detail="Seguimiento inmediato"
                    />
                  </div>

                  {loadingOverview ? (
                    <LoadingSkeleton rows={5} height="h-20" />
                  ) : (
                    myWorkSections.map((section) => (
                      <section
                        key={section.label}
                        className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
                            <SectionBadge>{section.items.length}</SectionBadge>
                          </div>
                          <FiClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        </div>

                        <div className="p-4">
                          {section.items.length ? (
                            <div className="space-y-3">
                              {section.items.map((item) => (
                                <article
                                  key={item.id}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-slate-900">
                                          {item.title}
                                        </p>
                                        <MondayPill
                                          label={formatLabel(item.status)}
                                          tone={statusTone(item.status)}
                                        />
                                      </div>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.workspace_name} / {item.project_name}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <MondayPill
                                        label={formatLabel(item.priority)}
                                        tone={priorityTone(item.priority)}
                                      />
                                      <SectionBadge>{formatDate(item.planned_end_at)}</SectionBadge>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveView("board");
                                      setSelectedProjectId(item.project_id);
                                    }}
                                    className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
                                  >
                                    Abrir en board
                                    <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <EmptyBlock
                              title={`Sin items en ${section.label.toLowerCase()}`}
                              detail="Cuando existan tareas asignadas en este tramo aparecerán aquí."
                            />
                          )}
                        </div>
                      </section>
                    ))
                  )}
                </section>
              ) : null}

              {activeView === "overview" ? (
                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <OverviewMetric
                        label="Proyectos"
                        value={Number(portfolio?.summary?.project_count || 0)}
                        detail="Portafolio accesible"
                      />
                      <OverviewMetric
                        label="Workspaces"
                        value={Number(portfolio?.summary?.workspace_count || 0)}
                        detail="Estructura activa"
                      />
                      <OverviewMetric
                        label="Items"
                        value={Number(portfolio?.summary?.item_count || 0)}
                        detail="Carga total"
                      />
                      <OverviewMetric
                        label="En curso"
                        value={Number(portfolio?.summary?.in_progress_items || 0)}
                        detail="Ejecución actual"
                      />
                    </div>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Estado de proyectos</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Lectura rápida del portafolio sin salir del módulo.
                          </p>
                        </div>
                        <FiTarget className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </div>

                      <div className="mt-4 space-y-3">
                        {(portfolio?.summary?.projects_by_status || []).length ? (
                          portfolio.summary.projects_by_status.map((row) => (
                            <div
                              key={`project-status-${row.status}`}
                              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <span className="text-sm font-medium text-slate-700">
                                {formatLabel(row.status)}
                              </span>
                              <SectionBadge>{row.count}</SectionBadge>
                            </div>
                          ))
                        ) : (
                          <EmptyBlock
                            title="Sin lectura de estados"
                            detail="Cuando el módulo tenga más proyectos, este resumen se poblará."
                          />
                        )}
                      </div>
                    </section>
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Atención prioritaria</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Items urgentes o vencidos dentro del alcance actual.
                        </p>
                      </div>
                      <FiAlertCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>

                    <div className="mt-4 space-y-3">
                      {loadingOverview ? (
                        <LoadingSkeleton rows={5} height="h-20" />
                      ) : portfolio?.attention_items?.length ? (
                        portfolio.attention_items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveView("board");
                              setSelectedProjectId(item.project_id);
                            }}
                            className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-white active:scale-[0.99]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.workspace_name} / {item.project_name}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <MondayPill
                                  label={formatLabel(item.priority)}
                                  tone={priorityTone(item.priority)}
                                />
                                <span className="text-[11px] text-slate-500">
                                  {formatDate(item.planned_end_at)}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <EmptyBlock
                          title="Sin alertas"
                          detail="No hay items urgentes ni vencidos dentro del portafolio visible."
                        />
                      )}
                    </div>

                    {selectedProject ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2">
                          <FiLink2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          <p className="text-sm font-semibold text-slate-900">
                            Contexto del proyecto actual
                          </p>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p>
                            <span className="font-medium text-slate-800">Workspace:</span>{" "}
                            {projectDetail?.workspace_name || selectedWorkspace?.name || "Sin dato"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">Responsable:</span>{" "}
                            {projectDetail?.owner_name || "Sin responsable"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">Estado:</span>{" "}
                            {formatLabel(projectDetail?.status)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </section>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      <Modal
        open={itemDetailOpen}
        onClose={closeItemDetail}
        title="Detalle del item"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Titulo</span>
              <input
                value={itemDetailDraft?.title || ""}
                onChange={(event) =>
                  setItemDetailDraft((current) =>
                    current ? { ...current, title: event.target.value } : current
                  )
                }
                className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Descripcion</span>
              <textarea
                value={itemDetailDraft?.description || ""}
                onChange={(event) =>
                  setItemDetailDraft((current) =>
                    current ? { ...current, description: event.target.value } : current
                  )
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Estado</span>
                <select
                  value={itemDetailDraft?.status || "todo"}
                  onChange={(event) =>
                    setItemDetailDraft((current) =>
                      current ? { ...current, status: event.target.value } : current
                    )
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  {ITEM_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Prioridad</span>
                <select
                  value={itemDetailDraft?.priority || "medium"}
                  onChange={(event) =>
                    setItemDetailDraft((current) =>
                      current ? { ...current, priority: event.target.value } : current
                    )
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  {ITEM_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Responsable</span>
                <select
                  value={itemDetailDraft?.assignee_user_id || ""}
                  onChange={(event) =>
                    setItemDetailDraft((current) =>
                      current ? { ...current, assignee_user_id: event.target.value } : current
                    )
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  <option value="">Sin asignar</option>
                  {assigneeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullname}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Seccion operativa</span>
                <select
                  value={itemDetailDraft?.group_id || ""}
                  onChange={(event) =>
                    setItemDetailDraft((current) =>
                      current ? { ...current, group_id: event.target.value } : current
                    )
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Fecha compromiso</span>
                <input
                  type="date"
                  value={itemDetailDraft?.planned_end_at || ""}
                  onChange={(event) =>
                    setItemDetailDraft((current) =>
                      current ? { ...current, planned_end_at: event.target.value } : current
                    )
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Tipo</span>
                <select
                  value={itemDetailDraft?.item_type || "task"}
                  onChange={(event) =>
                    setItemDetailDraft((current) =>
                      current ? { ...current, item_type: event.target.value } : current
                    )
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  {ITEM_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeItemDetail}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97]"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSaveItemDetail}
              disabled={savingFieldKey === "item-detail"}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              {savingFieldKey === "item-detail" ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={workspaceModalOpen}
        onClose={() => {
          if (submitting) return;
          setWorkspaceModalOpen(false);
          resetWorkspaceForm();
          setWorkspaceMemberSearch("");
        }}
        title="Nuevo workspace"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Nombre</span>
              <input
                value={workspaceForm.name}
                onChange={(event) =>
                  setWorkspaceForm((current) => ({ ...current, name: event.target.value }))
                }
                className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Descripcion</span>
              <textarea
                value={workspaceForm.description}
                onChange={(event) =>
                  setWorkspaceForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Privacidad</span>
              <select
                value={workspaceForm.visibility}
                onChange={(event) =>
                  setWorkspaceForm((current) => ({
                    ...current,
                    visibility: event.target.value,
                  }))
                }
                className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              >
                <option value="private">Privado</option>
                <option value="team">Por equipo</option>
                <option value="company">Institucional</option>
              </select>
            </label>
            <section className="rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">Invitar colaboradores</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Los usuarios seleccionados podran ver este workspace y participar desde su propia vista de trabajo.
                  </p>
                </div>
                {selectedWorkspaceMembers.length ? (
                  <button
                    type="button"
                    onClick={clearWorkspaceMembers}
                    className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl border border-white bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-xs font-medium text-slate-700">Buscar por nombre, correo o rol</span>
                <input
                  value={workspaceMemberSearch}
                  onChange={(event) => setWorkspaceMemberSearch(event.target.value)}
                  placeholder="Ej. Rafael, tecnico, comercial..."
                  className="min-h-11 w-full rounded-2xl border border-white bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-[#6161FF] focus:outline-none focus:ring-2 focus:ring-[#6161FF]/20"
                />
              </label>

              {selectedWorkspaceMembers.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedWorkspaceMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleWorkspaceMember(member.id)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#6161FF]/20 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition-colors hover:bg-violet-50"
                      title="Quitar del workspace"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6161FF] text-[10px] font-black text-white">
                        {(member.fullname || member.email || "?").charAt(0).toUpperCase()}
                      </span>
                      {member.fullname || member.email}
                      <span className="text-slate-400">x</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-dashed border-cyan-200 bg-white/70 px-3 py-2 text-xs text-slate-500">
                  Si no seleccionas colaboradores, solo tu usuario vera este workspace.
                </p>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {filteredCollaboratorOptions.length ? (
                  filteredCollaboratorOptions.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleWorkspaceMember(member.id)}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white bg-white px-3 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#00C875]/40 hover:shadow-md"
                    >
                      <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#00C875]/12 text-sm font-black text-[#007F50]">
                        {(member.fullname || member.email || "?").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">{member.fullname || member.email}</span>
                        <span className="block truncate text-xs text-slate-500">{member.email || member.role || "Colaborador"}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-3 py-4 text-center text-xs text-slate-500 sm:col-span-2">
                    No hay colaboradores disponibles con ese criterio.
                  </div>
                )}
              </div>
            </section>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setWorkspaceModalOpen(false);
                resetWorkspaceForm();
                setWorkspaceMemberSearch("");
              }}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateWorkspace}
              disabled={submitting === "workspace"}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting === "workspace" ? "Guardando..." : "Crear workspace"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={projectModalOpen}
        onClose={() => {
          if (submitting) return;
          setProjectModalOpen(false);
          resetProjectForm();
        }}
        title="Nuevo proyecto"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Workspace actual:{" "}
              <strong className="text-slate-900">
                {selectedWorkspace?.name || "Sin workspace seleccionado"}
              </strong>
            </div>
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Nombre</span>
              <input
                value={projectForm.name}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, name: event.target.value }))
                }
                className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Descripcion</span>
              <textarea
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Tipo</span>
                <select
                  value={projectForm.project_type}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      project_type: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  <option value="general">General</option>
                  <option value="crm">CRM</option>
                  <option value="purchase">Compras</option>
                  <option value="service">Servicio</option>
                  <option value="operations">Operaciones</option>
                  <option value="hr">Talento humano</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Estado</span>
                <select
                  value={projectForm.status}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Activo</option>
                  <option value="on_hold">Pausado</option>
                  <option value="completed">Finalizado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Prioridad</span>
                <select
                  value={projectForm.priority}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Critica</option>
                </select>
              </label>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setProjectModalOpen(false);
                resetProjectForm();
              }}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={submitting === "project"}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting === "project" ? "Guardando..." : "Crear proyecto"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={boardModalOpen}
        onClose={() => {
          if (submitting) return;
          setBoardModalOpen(false);
          resetBoardForm();
        }}
        title="Nueva seccion operativa"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <label className="space-y-2">
            <span className="text-xs font-medium text-slate-700">Nombre de la seccion</span>
            <input
              value={boardForm.name}
              onChange={(event) =>
                setBoardForm((current) => ({ ...current, name: event.target.value }))
              }
              className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium text-slate-700">Vista inicial</span>
            <select
              value={boardForm.board_type}
              onChange={(event) =>
                setBoardForm((current) => ({
                  ...current,
                  board_type: event.target.value,
                }))
              }
              className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
            >
              <option value="kanban">Kanban</option>
              <option value="list">Lista</option>
              <option value="calendar">Calendario</option>
              <option value="timeline">Timeline</option>
            </select>
          </label>
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            La seccion se crea con una estructura base y se muestra dentro de la tabla operativa.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setBoardModalOpen(false);
                resetBoardForm();
              }}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateBoard}
              disabled={submitting === "board"}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting === "board" ? "Guardando..." : "Crear seccion"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={itemModalOpen}
        onClose={() => {
          if (submitting) return;
          setItemModalOpen(false);
          resetItemForm();
        }}
        title="Nuevo item"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Titulo</span>
              <input
                value={itemForm.title}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, title: event.target.value }))
                }
                className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-slate-700">Descripcion</span>
              <textarea
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Columna</span>
                <select
                  value={itemForm.group_id}
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, group_id: event.target.value }))
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Tipo</span>
                <select
                  value={itemForm.item_type}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      item_type: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  <option value="task">Tarea</option>
                  <option value="subtask">Subtarea</option>
                  <option value="meeting">Reunion</option>
                  <option value="visit">Visita</option>
                  <option value="approval">Aprobacion</option>
                  <option value="followup">Seguimiento</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Estado</span>
                <select
                  value={itemForm.status}
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, status: event.target.value }))
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">En curso</option>
                  <option value="done">Hecho</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-slate-700">Prioridad</span>
                <select
                  value={itemForm.priority}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Critica</option>
                </select>
              </label>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={itemForm.assign_to_me}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    assign_to_me: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#0EA5E9]"
              />
              Asignarme automaticamente este item
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setItemModalOpen(false);
                resetItemForm();
              }}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateItem}
              disabled={submitting === "item"}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-[#2563EB] px-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting === "item" ? "Guardando..." : "Crear item"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
};

export default WorkManagementPage;
