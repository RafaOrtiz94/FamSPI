import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiDownload, FiFileText, FiLayers, FiLoader } from "react-icons/fi";

import Button from "../../../../core/ui/components/Button";
import {
  getCollaboratorProfile,
  listCollaborators,
} from "../../../../core/api/collaboratorsApi";
import { computeChecklistCompletionBySections } from "./workspaceAccess";
import { generateCollaboratorWorkspaceReportPdf } from "../../utils/collaboratorReportsPdf";

const resolveDocumentType = (document = {}) =>
  String(document?.canonical_doc_type || document?.doc_type || "")
    .trim()
    .toUpperCase();

const normalizeEmploymentStatus = (value) => String(value || "").trim().toLowerCase();

const PASSIVE_EMPLOYMENT_STATUSES = new Set(["pasivo", "desvinculado", "inactivo"]);

const resolveCollaboratorStatusLabel = (collaborator = {}) => {
  const statusValue =
    collaborator?.estatus_empleado ||
    collaborator?.profile?.laboral?.estatus_empleado ||
    (collaborator?.active === false ? "pasivo" : "");
  const normalizedStatus = normalizeEmploymentStatus(statusValue);
  if (collaborator?.active === false || PASSIVE_EMPLOYMENT_STATUSES.has(normalizedStatus)) {
    return "Pasivo";
  }
  if (
    collaborator?.offboarding_requested === true ||
    collaborator?.profile?.onboarding?.offboarding_requested === true
  ) {
    return "En desvinculacion";
  }
  return "Activo";
};

const normalizeProfilePayload = (payload = {}) => ({
  user: payload?.user || {},
  profile: payload?.profile || {},
  documents: Array.isArray(payload?.documents) ? payload.documents : [],
  qualifications: Array.isArray(payload?.qualifications) ? payload.qualifications : [],
});

const mapLoadedCollaboratorReport = ({
  collaborator,
  payload,
  profileSections,
  checklistSections,
}) => {
  const normalized = normalizeProfilePayload(payload);
  return {
    id: collaborator?.id || normalized?.user?.id,
    name: collaborator?.fullname || normalized?.user?.fullname || normalized?.user?.email || "Colaborador",
    email: collaborator?.email || normalized?.user?.email || "No registrado",
    departmentName: collaborator?.department_name || "No registrado",
    statusLabel: resolveCollaboratorStatusLabel(collaborator),
    subtitle: [collaborator?.email || normalized?.user?.email, collaborator?.department_name]
      .filter(Boolean)
      .join(" · "),
    profileData: normalized.profile,
    documents: normalized.documents,
    qualifications: normalized.qualifications,
    profileCompletion: {
      total: (profileSections || []).reduce(
        (sum, section) => sum + (Array.isArray(section?.fields) ? section.fields.length : 0),
        0,
      ),
      done: (profileSections || []).reduce(
        (sum, section) =>
          sum +
          (section?.fields || []).reduce((count, field) => {
            const value = normalized.profile?.[section.key]?.[field.key];
            return count + (String(value ?? "").trim() !== "" ? 1 : 0);
          }, 0),
        0,
      ),
    },
    checklistCompletion: computeChecklistCompletionBySections(
      checklistSections,
      normalized.profile,
      normalized.documents,
      resolveDocumentType,
    ),
  };
};

const fetchAllVisibleCollaborators = async () => {
  const pageSize = 120;
  let page = 1;
  let allRows = [];
  let totalPages = 1;

  do {
    const response = await listCollaborators({ page, pageSize });
    const rows = Array.isArray(response?.data) ? response.data : [];
    allRows = [...allRows, ...rows];
    totalPages = Number(response?.pagination?.totalPages || 1);
    page += 1;
  } while (page <= totalPages);

  return allRows;
};

const loadBulkProfiles = async (collaborators = []) => {
  const chunkSize = 5;
  const reports = [];

  for (let index = 0; index < collaborators.length; index += chunkSize) {
    const chunk = collaborators.slice(index, index + chunkSize);
    const results = await Promise.all(
      chunk.map(async (collaborator) => {
        const response = await getCollaboratorProfile(collaborator.id);
        return { collaborator, payload: response?.data || response };
      }),
    );
    reports.push(...results);
  }

  return reports;
};

const PersonnelReports = ({
  selectedCollaborator,
  profileData,
  documents,
  qualifications,
  profileSections,
  checklistSections,
  documentDefinitions,
  mode = "combined",
}) => {
  const [exportingCurrent, setExportingCurrent] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const showCurrentReport = mode === "combined" || mode === "current";
  const showBulkReport = mode === "combined" || mode === "bulk";

  const currentReport = useMemo(
    () =>
      mapLoadedCollaboratorReport({
        collaborator: selectedCollaborator,
        payload: {
          user: selectedCollaborator,
          profile: profileData,
          documents,
          qualifications,
        },
        profileSections,
        checklistSections,
      }),
    [checklistSections, documents, profileData, profileSections, qualifications, selectedCollaborator],
  );

  const handleExportCurrent = async () => {
    if (!selectedCollaborator?.id) {
      toast.error("Selecciona un colaborador para exportar su reporte individual.");
      return;
    }

    try {
      setExportingCurrent(true);
      generateCollaboratorWorkspaceReportPdf({
        reportTitle: `Expediente de ${currentReport.name}`,
        summaryLines: [
          `Modo: reporte individual del expediente activo.`,
          `Incluye ficha laboral, credenciales academicas, documentos del expediente y checklist del colaborador seleccionado.`,
        ],
        collaborators: [currentReport],
        profileSections,
        documentDefinitions,
        checklistSections,
        fileName: `expediente-${currentReport.name.replace(/[^\w.-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
      toast.success("Reporte individual exportado correctamente.");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo exportar el reporte individual.");
    } finally {
      setExportingCurrent(false);
    }
  };

  const handleExportAll = async () => {
    try {
      setExportingAll(true);
      const allCollaborators = await fetchAllVisibleCollaborators();

      if (allCollaborators.length === 0) {
        toast.error("No existen colaboradores registrados para incluir en el reporte consolidado.");
        return;
      }

      const loadedProfiles = await loadBulkProfiles(allCollaborators);
      const reports = loadedProfiles.map(({ collaborator, payload }) =>
        mapLoadedCollaboratorReport({
          collaborator,
          payload,
          profileSections,
          checklistSections,
        }),
      );

      generateCollaboratorWorkspaceReportPdf({
        reportTitle: "Reporte consolidado general de colaboradores",
        summaryLines: [
          "Modo: reporte masivo general de todos los colaboradores registrados en la base de datos.",
          `Total de expedientes incluidos: ${reports.length}.`,
          `Cada expediente contiene ficha laboral, credenciales academicas, documentos del expediente y checklist de cumplimiento.`,
        ],
        collaborators: reports,
        profileSections,
        documentDefinitions,
        checklistSections,
        fileName: `expedientes-general-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
      toast.success("Reporte consolidado exportado correctamente.");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo exportar el reporte consolidado.");
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <FiFileText size={22} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {showCurrentReport && showBulkReport
                  ? "Exportacion de reportes del expediente"
                  : showBulkReport
                    ? "Exportacion de reporte consolidado"
                    : "Reporte del expediente"}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {showCurrentReport && showBulkReport
                  ? "Exporta el PDF individual del colaborador activo o un PDF consolidado general de todos los colaboradores registrados."
                  : showBulkReport
                    ? "Exporta un PDF consolidado general de todos los colaboradores registrados, sin depender de la vista cargada ni del colaborador seleccionado."
                    : "Exporta el PDF del colaborador activo con ficha laboral, documentos, credenciales y checklist."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {showCurrentReport ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCurrent}
                disabled={exportingCurrent || !selectedCollaborator?.id}
                leftIcon={
                  exportingCurrent ? <FiLoader size={15} className="animate-spin" /> : <FiDownload size={15} />
                }
              >
                {exportingCurrent ? "Exportando..." : "Exportar PDF individual"}
              </Button>
            ) : null}
            {showBulkReport ? (
              <Button
                size="sm"
                onClick={handleExportAll}
                disabled={exportingAll}
                leftIcon={
                  exportingAll ? <FiLoader size={15} className="animate-spin" /> : <FiLayers size={15} />
                }
              >
                {exportingAll ? "Exportando..." : "Exportar PDF consolidado"}
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className={`mt-5 grid gap-3 ${
            showCurrentReport && showBulkReport ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          {showCurrentReport ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Expediente actual
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {selectedCollaborator?.fullname || selectedCollaborator?.email || "No hay colaborador seleccionado"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Exporta la ficha laboral, los documentos del expediente, las credenciales academicas y el checklist de cumplimiento del colaborador activo.
              </p>
            </div>
          ) : null}
          {showBulkReport ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Alcance masivo
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Todos los colaboradores registrados en la base
              </p>
              <p className="mt-1 text-xs text-slate-500">
                El reporte consolidado consulta directamente la base a traves del backend y arma el PDF con todos los expedientes disponibles, sin depender de la vista activa del workspace.
              </p>
            </div>
          ) : null}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Contenido
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Ficha laboral, documentos y checklist
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tambien incorpora titulos, certificaciones y enlaces de respaldo cuando existen en el expediente central.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonnelReports;
