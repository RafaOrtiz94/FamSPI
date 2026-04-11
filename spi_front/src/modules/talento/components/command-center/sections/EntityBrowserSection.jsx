import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VariableSizeList as List } from "react-window";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";

const VIEW_OPTIONS = [
  { key: "requests", label: "Contratacion" },
  { key: "collaborators", label: "Colaboradores" },
  { key: "offboarding", label: "Desvinculacion" },
];

const REQUEST_STATUS_META = {
  pendiente: { label: "Pendiente", className: "text-yellow-700 bg-yellow-100" },
  en_revision: { label: "En revision", className: "text-blue-700 bg-blue-100" },
  aprobada: { label: "Aprobada", className: "text-green-700 bg-green-100" },
  en_proceso: { label: "En proceso", className: "text-indigo-700 bg-indigo-100" },
  completada: { label: "Completada", className: "text-emerald-700 bg-emerald-100" },
  rechazada: { label: "Rechazada", className: "text-rose-700 bg-rose-100" },
  cancelada: { label: "Cancelada", className: "text-slate-700 bg-slate-100" },
};

const ACTIONABLE_REQUEST_STATUSES = new Set(["pendiente", "en_revision"]);

const getBaseItemSize = (view, width) => {
  const isMobile = width < 640;
  if (view === "requests") return isMobile ? 154 : 124;
  return isMobile ? 116 : 96;
};

const resolveListState = (activeView, browserProps = {}) => {
  if (activeView === "collaborators") {
    return {
      key: "collaborators",
      loading: Boolean(browserProps.loadingCollaborators),
      items: Array.isArray(browserProps.collaborators) ? browserProps.collaborators : [],
      emptyMessage: "No hay colaboradores listados.",
    };
  }
  if (activeView === "offboarding") {
    return {
      key: "offboarding",
      loading: Boolean(browserProps.loadingCollaborators),
      items: Array.isArray(browserProps.offboardingCollaborators)
        ? browserProps.offboardingCollaborators
        : [],
      emptyMessage: "No hay colaboradores en desvinculacion.",
    };
  }

  return {
    key: "requests",
    loading: Boolean(browserProps.loadingRequests),
    items: Array.isArray(browserProps.requests) ? browserProps.requests : [],
    emptyMessage: "No hay solicitudes para mostrar.",
  };
};

const EntityBrowserSection = ({
  open = true,
  onToggle,
  activeView = "requests",
  onChangeView,
  searchQuery = "",
  onSearchChange,
  browserProps = {},
}) => {
  const operationalView =
    activeView === "collaborators" || activeView === "offboarding"
      ? activeView
      : "requests";
  const listRef = useRef(null);
  const [listContainerNode, setListContainerNode] = useState(null);
  const [listWidth, setListWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );

  const listState = useMemo(
    () => resolveListState(operationalView, browserProps),
    [operationalView, browserProps],
  );

  const baseItemSize = useMemo(
    () => getBaseItemSize(operationalView, viewportWidth),
    [operationalView, viewportWidth],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open || !listContainerNode) return undefined;

    const syncWidth = () => {
      const nextWidth = Math.floor(listContainerNode.getBoundingClientRect().width || 0);
      setListWidth(nextWidth);
    };

    syncWidth();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => syncWidth());
    observer.observe(listContainerNode);
    return () => observer.disconnect();
  }, [open, listContainerNode]);

  const getItemSize = useCallback(
    (index) => {
      const item = listState.items[index] || {};
      let extra = 0;

      if (listState.key === "requests") {
        if (item?.workflow?.current_stage_label) extra += 24;
        if (item?.workflow?.elapsed_label) extra += 20;
      } else if (listState.key === "collaborators" || listState.key === "offboarding") {
        if (item?.department_name) extra += 12;
      }

      return baseItemSize + extra;
    },
    [baseItemSize, listState.items, listState.key],
  );

  const listHeight = useMemo(() => {
    if (!listState.items.length) return 260;

    const minHeight = 220;
    const maxHeight = viewportWidth < 768 ? 420 : 560;
    const estimatedHeight = listState.items.reduce(
      (acc, _, index) => acc + getItemSize(index),
      0,
    );
    return Math.max(minHeight, Math.min(maxHeight, estimatedHeight));
  }, [getItemSize, listState.items, viewportWidth]);

  useEffect(() => {
    listRef.current?.resetAfterIndex?.(0, true);
  }, [operationalView, baseItemSize, listState.items.length, viewportWidth]);

  const rowData = useMemo(
    () => ({
      activeView: operationalView,
      browserProps,
      items: listState.items,
    }),
    [operationalView, browserProps, listState.items],
  );

  const Row = ({ index, style, data }) => {
    const item = data.items[index];
    const isRequest = data.activeView === "requests";
    const isCollaborator =
      data.activeView === "collaborators" || data.activeView === "offboarding";

    const isSelected = isRequest
      ? String(item?.id) === String(data.browserProps.selectedRequestId)
      : String(item?.id) === String(data.browserProps.selectedCollaboratorId);

    const onSelect = isRequest
      ? data.browserProps.onSelectRequest
      : data.browserProps.onSelectCollaborator;

    const onKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect?.(item);
      }
    };

    const requestStatus = String(item?.status || "").toLowerCase();
    const requestStatusMeta =
      REQUEST_STATUS_META[requestStatus] || REQUEST_STATUS_META.pendiente;
    const canReview =
      isRequest &&
      Boolean(data.browserProps.canApprovePersonnel) &&
      ACTIONABLE_REQUEST_STATUSES.has(requestStatus);
    const normalizedEmploymentStatus = String(
      item?.estatus_empleado || item?.status || "",
    )
      .trim()
      .toLowerCase();
    const isPassive =
      item?.active === false ||
      normalizedEmploymentStatus === "pasivo" ||
      normalizedEmploymentStatus === "desvinculado" ||
      normalizedEmploymentStatus === "inactivo";
    const isOffboardingInProgress =
      !isPassive &&
      (item?.offboarding_requested === true ||
        item?.profile?.onboarding?.offboarding_requested === true);
    const startingThisCollaborator =
      String(data.browserProps.startingOffboardingId || "") === String(item?.id || "");
    const canStartOffboarding =
      data.activeView === "collaborators" &&
      !isPassive &&
      !isOffboardingInProgress &&
      typeof data.browserProps.onStartOffboarding === "function";

    return (
      <div style={style} className="px-1 pb-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect?.(item)}
          onKeyDown={onKeyDown}
          className={`rounded-2xl border bg-white p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
            isSelected
              ? "border-slate-700 bg-slate-50 shadow-sm"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          {isRequest && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item?.position_title || "Solicitud sin titulo"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item?.department_name || "Sin departamento"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${requestStatusMeta.className}`}
                >
                  {requestStatusMeta.label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{item?.request_number || "Sin referencia"}</span>
                {canReview ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      data.browserProps.onOpenReview?.(item);
                    }}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Revisar
                  </button>
                ) : null}
              </div>
              {item?.workflow?.current_stage_label ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  {item.workflow.current_stage_label}
                </p>
              ) : null}
            </>
          )}

          {isCollaborator && (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item?.fullname || item?.email || "Colaborador sin nombre"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item?.email || "Sin correo"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    isPassive
                      ? "bg-slate-200 text-slate-700"
                      : isOffboardingInProgress
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isPassive
                    ? "Pasivo"
                    : isOffboardingInProgress
                      ? "En desvinculacion"
                      : "Activo"}
                </span>
              </div>
              {item?.department_name ? (
                <p className="mt-2 text-[11px] text-slate-500">{item.department_name}</p>
              ) : null}
              {canStartOffboarding ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      data.browserProps.onStartOffboarding?.(item);
                    }}
                    disabled={startingThisCollaborator}
                    className="rounded-full border border-blue-300 px-3 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {startingThisCollaborator
                      ? "Iniciando..."
                      : "Iniciar desvinculacion"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Contexto operativo
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Navegador unificado</h2>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-100"
          >
            {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
            {open ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((option) => {
            const isActive = operationalView === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onChangeView?.(option.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <label className="relative block">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Buscar por nombre, numero, area o correo"
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200"
          />
        </label>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="entity-browser-pane"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 lg:p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {listState.loading ? (
                  <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
                    Cargando datos...
                  </div>
                ) : !listState.items.length ? (
                  <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
                    {listState.emptyMessage}
                  </div>
                ) : (
                  <div ref={setListContainerNode} className="w-full">
                    {listWidth > 0 ? (
                      <List
                        ref={listRef}
                        height={listHeight}
                        width={listWidth}
                        itemCount={listState.items.length}
                        itemSize={getItemSize}
                        itemData={rowData}
                        overscanCount={6}
                      >
                        {Row}
                      </List>
                    ) : (
                      <div className="min-h-[260px]" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default EntityBrowserSection;
