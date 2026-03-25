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
}) => {
  const title = extractTitle(currentEntity);
  const subtitle = extractSubtitle(currentEntity);
  const contextLabel = currentContextKind || "Comando de talento";

  return (
    <header className="flex flex-col gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {contextLabel}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenBrowser && (
            <button
              type="button"
              onClick={onOpenBrowser}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-50"
            >
              Abrir navegador
            </button>
          )}
          {onToggleFocus && (
            <button
              type="button"
              onClick={onToggleFocus}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-50"
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
    </header>
  );
};

export default CommandCenterWorkspaceHeader;
