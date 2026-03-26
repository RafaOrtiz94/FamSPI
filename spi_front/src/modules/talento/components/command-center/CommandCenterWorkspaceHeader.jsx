import React from "react";
import Button from "../../../../core/ui/components/Button";
import { Badge } from "../../../../core/ui/components/Badge";

const fallbackTitle = "Workspace de Talento";

const extractTitle = (entity) => {
  if (!entity) return fallbackTitle;
  if (typeof entity === "string") return entity;
  return entity.name || entity.title || fallbackTitle;
};

const extractSubtitle = (entity) => {
  if (!entity || typeof entity === "string") return undefined;
  return entity.subtitle || entity.description || entity.detail;
};

const CommandCenterWorkspaceHeader = ({
  currentEntity,
  currentContextKind,
  summaryBadges = [],
  onOpenBrowser,
  onToggleFocus,
  focusMode = false,
  primaryAction,
  secondaryActions = [],
  workflowInfo,
}) => {
  const title = extractTitle(currentEntity);
  const subtitle = extractSubtitle(currentEntity);
  const contextLabel = currentContextKind || "Comando de talento";
  const workflowAlertTone =
    workflowInfo?.alertTone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : workflowInfo?.alertTone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {contextLabel}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600 truncate">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenBrowser && (
            <button
              type="button"
              onClick={onOpenBrowser}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
            >
              Abrir navegador
            </button>
          )}
          {onToggleFocus && (
            <button
              type="button"
              onClick={onToggleFocus}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
            >
              {focusMode ? "Salir de foco" : "Modo foco"}
            </button>
          )}
          {Array.isArray(secondaryActions) &&
            secondaryActions
              .filter((action) => action && action.label)
              .map((action, index) => (
                <Button
                  key={`secondary-action-${index}`}
                  variant={action.variant || "secondary"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  icon={action.icon}
                >
                  {action.label}
                </Button>
              ))}
          {primaryAction && primaryAction.label && (
            <Button
              variant={primaryAction.variant || "primary"}
              size="sm"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              icon={primaryAction.icon}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
      {Array.isArray(summaryBadges) && summaryBadges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summaryBadges.map((badge, index) => (
            <Badge
              key={`summary-badge-${index}`}
              variant={badge.variant || "gray"}
              className="text-xs font-semibold uppercase tracking-wide"
            >
              <span>{badge.label}</span>
              {badge.value !== undefined && (
                <span className="ml-1 font-mono text-[11px]">{badge.value}</span>
              )}
            </Badge>
          ))}
        </div>
      )}
      {workflowInfo && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Estado del flujo
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {workflowInfo.status || "Sin estado"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Responsable
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {workflowInfo.owner || "Sin asignar"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Siguiente accion
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {workflowInfo.nextAction || "Sin accion pendiente"}
            </p>
          </div>
          {workflowInfo.alert && (
            <div className={`rounded-xl border px-3 py-2 md:col-span-3 ${workflowAlertTone}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em]">
                Alerta de flujo
              </p>
              <p className="mt-1 text-sm font-semibold">{workflowInfo.alert}</p>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default CommandCenterWorkspaceHeader;
