import React from "react";
import { FiPlus, FiSearch, FiUser, FiUsers } from "react-icons/fi";
import Button from "../../../../core/ui/components/Button";
import { Spinner } from "../../../../core/ui/components/Spinner";

const VIEW_OPTIONS = [
  { key: "requests", label: "Solicitudes" },
  { key: "applicants", label: "Postulantes" },
  { key: "collaborators", label: "Colaboradores" },
];

const REQUEST_STATUS_META = {
  pendiente: { label: "Pendiente", color: "text-yellow-600 bg-yellow-50" },
  en_revision: { label: "En revisión", color: "text-blue-600 bg-blue-50" },
  aprobada: { label: "Aprobada", color: "text-green-600 bg-green-50" },
  en_proceso: { label: "En proceso", color: "text-indigo-600 bg-indigo-50" },
  completada: { label: "Completada", color: "text-emerald-600 bg-emerald-50" },
  rechazada: { label: "Rechazada", color: "text-rose-600 bg-rose-50" },
  cancelada: { label: "Cancelada", color: "text-slate-600 bg-slate-50" },
};

const ACTIONABLE_REQUEST_STATUSES = new Set(["pendiente", "en_revision"]);

const formatDateLabel = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
};

const LoadingArea = ({ label }) => (
  <div className="flex h-full min-h-[220px] items-center justify-center gap-2 text-sm text-gray-500">
    <Spinner size="sm" className="text-blue-500" />
    <span>Cargando {label}...</span>
  </div>
);

const EmptyArea = ({ message }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 text-sm text-gray-500">
    <span>{message}</span>
  </div>
);

const RequestCard = ({
  request,
  selected,
  onSelect,
  onReview,
  canReview,
}) => {
  const statusKey = (request?.status || "pendiente").toLowerCase();
  const statusMeta = REQUEST_STATUS_META[statusKey] || REQUEST_STATUS_META.pendiente;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(request);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(request)}
      onKeyDown={handleKeyDown}
      className={`flex flex-col gap-2 rounded-2xl border bg-white px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
        selected
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-transparent hover:border-gray-200 hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {request?.position_title || "Solicitud sin título"}
          </p>
          <p className="text-[11px] text-gray-500">
            {request?.department_name || "Sin departamento"}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.color}`}
        >
          {statusMeta.label}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{request?.request_number || "Sin referencia"}</span>
        {canReview && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReview?.(request);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-blue-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Revisar
          </button>
        )}
      </div>
      {request?.workflow?.current_stage_label && (
        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
          <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
            {request.workflow.current_stage_label}
          </span>
          {request.workflow.elapsed_label && (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
              {request.workflow.elapsed_label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const ApplicantCard = ({ applicant, selected, onSelect }) => {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(applicant);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(applicant)}
      onKeyDown={handleKeyDown}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
        selected
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-transparent hover:border-gray-200 hover:bg-white"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 shadow-sm">
        <FiUser className="text-lg" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {applicant?.fullname || applicant?.email || "Postulante sin nombre"}
        </p>
        {applicant?.email && (
          <p className="text-xs text-gray-500 truncate">{applicant.email}</p>
        )}
        {applicant?.position_title && (
          <p className="mt-1 text-[11px] text-gray-400">
            {applicant.position_title}
          </p>
        )}
        <p className="mt-1 text-[11px] text-gray-400">
          Actualizado {formatDateLabel(applicant?.updated_at)}
        </p>
      </div>
      {applicant?.status && (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
          {applicant.status}
        </span>
      )}
    </div>
  );
};

const CollaboratorCard = ({ collaborator, selected, onSelect }) => {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(collaborator);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(collaborator)}
      onKeyDown={handleKeyDown}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
        selected
          ? "border-blue-400 bg-blue-50 shadow-md"
          : "border-transparent hover:border-gray-200 hover:bg-white"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 shadow-sm">
        <FiUsers className="text-lg" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {collaborator?.fullname ||
            collaborator?.email ||
            "Colaborador sin nombre"}
        </p>
        {collaborator?.email && (
          <p className="text-xs text-gray-500 truncate">{collaborator.email}</p>
        )}
        {collaborator?.department_name && (
          <p className="mt-1 text-[11px] text-gray-400 truncate">
            {collaborator.department_name}
          </p>
        )}
      </div>
      {collaborator?.status && (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
          {collaborator.status}
        </span>
      )}
    </div>
  );
};

const CommandCenterEntityBrowser = ({
  activeView = "requests",
  onChangeView,
  searchQuery = "",
  onSearchChange,
  requests = [],
  loadingRequests = false,
  selectedRequestId,
  onSelectRequest,
  applicants = [],
  applicantsLoading = false,
  selectedApplicantId,
  onSelectApplicant,
  collaborators = [],
  loadingCollaborators = false,
  selectedCollaboratorId,
  onSelectCollaborator,
  canRequestPersonnel = false,
  canApprovePersonnel = false,
  onCreateRequest,
  onOpenReview,
}) => {
  const renderRequests = () => {
    if (loadingRequests) {
      return <LoadingArea label="solicitudes" />;
    }

    if (!requests.length) {
      return <EmptyArea message="No hay solicitudes para mostrar." />;
    }

    return (
      <div className="space-y-3">
        {requests.map((request, index) => {
          const isSelected = String(request?.id) === String(selectedRequestId);
          const normalizedStatus = (request?.status || "").toLowerCase();
          const canReview =
            canApprovePersonnel && ACTIONABLE_REQUEST_STATUSES.has(normalizedStatus);

          return (
            <RequestCard
              key={`request-${request?.id ?? request?.request_number ?? index}`}
              request={request}
              selected={isSelected}
              onSelect={onSelectRequest}
              canReview={canReview}
              onReview={onOpenReview}
            />
          );
        })}
      </div>
    );
  };

  const renderApplicants = () => {
    if (applicantsLoading) {
      return <LoadingArea label="postulantes" />;
    }

    if (!applicants.length) {
      return <EmptyArea message="No se encontraron postulantes." />;
    }

    return (
      <div className="space-y-3">
        {applicants.map((applicant, index) => (
          <ApplicantCard
            key={`applicant-${applicant?.id ?? applicant?.email ?? index}`}
            applicant={applicant}
            selected={String(applicant?.id) === String(selectedApplicantId)}
            onSelect={onSelectApplicant}
          />
        ))}
      </div>
    );
  };

  const renderCollaborators = () => {
    if (loadingCollaborators) {
      return <LoadingArea label="colaboradores" />;
    }

    if (!collaborators.length) {
      return <EmptyArea message="No hay colaboradores listados." />;
    }

    return (
      <div className="space-y-3">
        {collaborators.map((collaborator, index) => (
          <CollaboratorCard
            key={`collaborator-${collaborator?.id ?? collaborator?.email ?? index}`}
            collaborator={collaborator}
            selected={String(collaborator?.id) === String(selectedCollaboratorId)}
            onSelect={onSelectCollaborator}
          />
        ))}
      </div>
    );
  };

  const currentPane = () => {
    switch (activeView) {
      case "applicants":
        return renderApplicants();
      case "collaborators":
        return renderCollaborators();
      default:
        return renderRequests();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => onChangeView?.(view.key)}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                activeView === view.key
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
        {canRequestPersonnel && (
          <Button
            variant="primary"
            size="sm"
            icon={FiPlus}
            onClick={onCreateRequest}
            disabled={!onCreateRequest}
          >
            Nueva solicitud
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 shadow-inner focus-within:ring-2 focus-within:ring-blue-100">
          <FiSearch className="text-gray-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Buscar por nombre, cargo o referencia..."
            className="w-full border-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        {activeView && (
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {activeView === "requests" && `${requests.length ?? 0} resultados`}
            {activeView === "applicants" && `${applicants.length ?? 0} resultados`}
            {activeView === "collaborators" && `${collaborators.length ?? 0} resultados`}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
        <div className="h-full min-h-[260px] overflow-y-auto px-1 py-4 sm:px-3">
          {currentPane()}
        </div>
      </div>
    </div>
  );
};

export default CommandCenterEntityBrowser;
