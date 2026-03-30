import React, { useMemo, useState } from "react";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import RequestList from "./RequestList";
import ApplicantList from "./ApplicantList";
import CollaboratorList from "./CollaboratorList";
import PersonnelApprovalsModal from "./PersonnelApprovalsModal";

const PersonnelSidebar = ({
 className = "",
 activeView,
 onActiveViewChange,
 setActiveView,
 requests,
 loadingRequests,
 selectedRequestId,
 onSelectRequest,
 applicants,
 loadingApplicants,
 selectedApplicantId,
 onSelectApplicant,
 collaborators,
 loadingCollaborators,
 selectedCollaboratorId,
 onSelectCollaborator,
 canRequestPersonnel,
 canApprovePersonnel,
 selectedRequestTitle, // To show context in Applicant view
 onCreateRequest,
}) => {
 const handleActiveViewChange = onActiveViewChange || setActiveView;
 const [approvalsOpen, setApprovalsOpen] = useState(false);
 const [requestSearch, setRequestSearch] = useState("");
 const [applicantSearch, setApplicantSearch] = useState("");
 const [collaboratorSearch, setCollaboratorSearch] = useState("");

  const filteredRequests = useMemo(() => {
    const term = requestSearch.trim().toLowerCase();
    if (!term) return requests;
    return (requests || []).filter((req) => {
      const title = String(req.position_title || "").toLowerCase();
      const number = String(req.request_number || "").toLowerCase();
      return title.includes(term) || number.includes(term);
    });
  }, [requests, requestSearch]);

  const filteredCollaborators = useMemo(() => {
    const term = collaboratorSearch.trim().toLowerCase();
    if (!term) return collaborators;
    return (collaborators || []).filter((collab) => {
      const name = String(collab.fullname || "").toLowerCase();
      const email = String(collab.email || "").toLowerCase();
      const dept = String(collab.department_name || collab.department || "").toLowerCase();
      return name.includes(term) || email.includes(term) || dept.includes(term);
    });
  }, [collaborators, collaboratorSearch]);

  const isHiringView = activeView === "solicitudes" || activeView === "aspirantes";

  return (
    <Card className={`flex h-full flex-col overflow-hidden bg-white shadow-sm border border-gray-200 ${className}`}>
      <div className="border-b border-gray-100 p-4">
        <h2 className="text-lg font-bold text-gray-900">Workspace</h2>
        <p className="text-xs text-gray-500">Gestión de Talento Humano</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleActiveViewChange?.("solicitudes")}
            aria-label="Cambiar a vista de contratación"
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              isHiringView
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Contratación
          </button>
          <button
            type="button"
            onClick={() => handleActiveViewChange?.("colaboradores")}
            aria-label="Cambiar a vista de colaboradores"
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeView === "colaboradores"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Colaboradores
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        {isHiringView && (
          <div className="p-3">
            <div className="mb-3 grid gap-2">
              {canRequestPersonnel && (
                <Button variant="primary" size="sm" onClick={onCreateRequest} className="w-full" aria-label="Crear nueva solicitud de personal">
                  Nueva solicitud
                </Button>
              )}
              {canApprovePersonnel && (
                <Button variant="secondary" size="sm" onClick={() => setApprovalsOpen(true)} className="w-full" aria-label="Revisar solicitudes pendientes">
                  Revisar solicitudes
                </Button>
              )}
            </div>

            <input
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              placeholder="Buscar solicitud..."
              aria-label="Buscar solicitud por nombre o código"
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Solicitudes Activas ({filteredRequests.length})
            </h3>
            {loadingRequests ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <RequestList
                requests={filteredRequests}
                selectedRequestId={selectedRequestId}
                onSelectRequest={onSelectRequest}
              />
            )}
          </div>
        )}

        {activeView === "colaboradores" && (
          <div className="p-3">
            <input
              value={collaboratorSearch}
              onChange={(e) => setCollaboratorSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              aria-label="Buscar colaborador por nombre, correo o departamento"
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            <CollaboratorList
              collaborators={filteredCollaborators}
              loading={loadingCollaborators}
              selectedCollaboratorId={selectedCollaboratorId}
              onSelectCollaborator={onSelectCollaborator}
            />
          </div>
        )}
      </div>

 <PersonnelApprovalsModal
 open={approvalsOpen}
 onClose={() => setApprovalsOpen(false)}
 canApprove={canApprovePersonnel}
 />
 </Card>
 );
};

export default PersonnelSidebar;
