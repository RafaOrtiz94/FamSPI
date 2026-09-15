import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiPackage,
  FiRefreshCw,
  FiSearch,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";
import { getRequests } from "../../../core/api/requestsApi";
import {
  generateWithdrawalActPDF,
  getWithdrawalWorkflow,
  listWithdrawalWorkflowStatuses,
  listWorkflowDocuments,
  updateWithdrawalWorkflowAction,
} from "../../../core/api/servicioApi";
import WithdrawalStepper from "../components/WithdrawalStepper";
import WithdrawalPackagingPanel from "../components/WithdrawalPackagingPanel";
import ServicioWorkspaceShell from "../design/ServicioWorkspaceShell";
import ServicioRailItem from "../design/ServicioRailItem";
import ServicioBadge from "../design/ServicioBadge";
import ServicioCard from "../design/ServicioCard";
import ServicioEmptyState from "../design/ServicioEmptyState";

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 text-sm outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

const STATUS_META = {
  withdrawal_requested: { label: "Retiro solicitado", tone: "warning", Icon: FiClock },
  withdrawal_coordinated: { label: "Retiro coordinado", tone: "info", Icon: FiCalendar },
  desinfectado: { label: "Desinfectado", tone: "accent", Icon: FiCheckCircle },
  embalado: { label: "Embalado", tone: "warning", Icon: FiPackage },
  retirado: { label: "Retirado", tone: "accent", Icon: FiTruck },
  cerrado: { label: "Cerrado", tone: "success", Icon: FiCheckCircle },
};

const getStatusMeta = (status) => STATUS_META[status] || { label: status || "Sin estado", tone: "neutral", Icon: FiClock };

const DetailLine = ({ icon: Icon, label, value }) => (
  <div className="flex min-w-0 items-start gap-3 rounded-[var(--st-radius-md)] border px-4 py-4" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
    <div className="shrink-0 rounded-full p-2" style={{ background: "var(--st-surface)" }}>
      <Icon size={15} style={{ color: "var(--st-text-muted)" }} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase leading-5 tracking-[0.1em] break-normal" style={{ color: "var(--st-text-faint)" }}>{label}</p>
      <p className="mt-1 text-base font-medium leading-7 break-words" style={{ color: "var(--st-text)" }}>{value || "N/D"}</p>
    </div>
  </div>
);

const parsePayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (_error) {
      return {};
    }
  }
  return payload;
};

const formatDate = (value) => {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  return date.toLocaleDateString("es-EC", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const normalizeQueryText = (value) => String(value || "").trim().toLowerCase();

const RetiroEquipos = () => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const currentUserId = Number(user?.id) || null;
  const [requests, setRequests] = useState([]);
  const [workflowRows, setWorkflowRows] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [workflowDocs, setWorkflowDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [busyPackaging, setBusyPackaging] = useState(false);
  const [busyEmit, setBusyEmit] = useState(false);

  const refreshBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsResp, workflowResp] = await Promise.all([
        getRequests({ pageSize: 300, type: "F.ST-21" }),
        listWithdrawalWorkflowStatuses({ limit: 300 }),
      ]);
      const requestRows = Array.isArray(requestsResp?.rows) ? requestsResp.rows : [];
      setRequests(requestRows);
      setWorkflowRows(Array.isArray(workflowResp) ? workflowResp : []);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar el workspace de retiros", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadWorkflowDetail = async (requestRow) => {
    if (!requestRow?.id) return;
    setLoadingDetail(true);
    try {
      const detail = await getWithdrawalWorkflow({ request_id: requestRow.id });
      setSelectedWorkflow(detail);
      if (detail?.source_type && detail?.source_id) {
        const docs = await listWorkflowDocuments({ source_type: detail.source_type, source_id: detail.source_id });
        setWorkflowDocs(Array.isArray(docs) ? docs : []);
      } else {
        setWorkflowDocs([]);
      }
    } catch (error) {
      setSelectedWorkflow(null);
      setWorkflowDocs([]);
      showToast(error?.response?.data?.error || "No se pudo cargar el detalle del retiro", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    refreshBaseData();
  }, [refreshBaseData]);

  const requestsWithWorkflow = useMemo(() => {
    const workflowByRequest = new Map(
      workflowRows.filter((row) => row?.request_id).map((row) => [Number(row.request_id), row]),
    );
    return requests.map((request) => {
      const payload = parsePayload(request.payload);
      const workflow = workflowByRequest.get(Number(request.id)) || null;
      const assignedUserId = Number(workflow?.workflow_state?.work_order?.assigned_user_id) || null;
      return {
        ...request,
        payload,
        workflow,
        assignedToMe: Boolean(currentUserId) && assignedUserId === currentUserId,
      };
    });
  }, [requests, workflowRows, currentUserId]);

  const filteredRows = useMemo(() => {
    const q = normalizeQueryText(search);
    return requestsWithWorkflow.filter((row) => {
      const payload = row.payload || {};
      const clientName = String(payload.nombre_cliente || "").toLowerCase();
      const equipmentName = String(payload.equipos?.[0]?.nombre_equipo || "").toLowerCase();
      const requestId = String(row.id || "");
      const workflowStatus = row.workflow?.workflow_status || "";
      const matchesSearch =
        !q ||
        clientName.includes(q) ||
        equipmentName.includes(q) ||
        requestId.includes(q) ||
        String(workflowStatus).toLowerCase().includes(q);
      const matchesStatus = !statusFilter || workflowStatus === statusFilter;
      const matchesAssigned = !assignedToMeOnly || row.assignedToMe;
      return matchesSearch && matchesStatus && matchesAssigned;
    });
  }, [requestsWithWorkflow, search, statusFilter, assignedToMeOnly]);

  const selectedContext = useMemo(() => {
    const sourceType = selectedWorkflow?.source_type || "commercial_request";
    const sourceId = selectedWorkflow?.source_id || (selectedRequest ? String(selectedRequest.id) : null);
    const requestId = selectedWorkflow?.request_id || selectedRequest?.id || null;
    return { source_type: sourceType, source_id: sourceId, request_id: requestId };
  }, [selectedWorkflow, selectedRequest]);

  const runWorkflowAction = async (action, payload = {}) => {
    if (!selectedRequest?.id) return;
    setBusyAction(action);
    try {
      const workflow = await updateWithdrawalWorkflowAction(
        { action, ...payload, request_id: selectedRequest.id, source_type: selectedContext.source_type, source_id: selectedContext.source_id },
        selectedContext,
      );
      setSelectedWorkflow(workflow);
      if (workflow?.source_type && workflow?.source_id) {
        const docs = await listWorkflowDocuments({ source_type: workflow.source_type, source_id: workflow.source_id });
        setWorkflowDocs(Array.isArray(docs) ? docs : []);
      }
      await refreshBaseData();
      showToast("Workflow actualizado correctamente", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "No se pudo actualizar el workflow", "error");
    } finally {
      setBusyAction("");
    }
  };

  const handleSavePackaging = async (payload) => {
    setBusyPackaging(true);
    try {
      await runWorkflowAction("register_packaging", payload);
    } finally {
      setBusyPackaging(false);
    }
  };

  const handleEmitFst11 = async () => {
    if (!selectedRequest?.id) return;
    setBusyEmit(true);
    try {
      const response = await generateWithdrawalActPDF(
        { request_id: selectedRequest.id, source_type: selectedContext.source_type, source_id: selectedContext.source_id },
        selectedContext,
      );
      setSelectedWorkflow(response?.workflow || selectedWorkflow);
      if (response?.workflow?.source_type && response?.workflow?.source_id) {
        const docs = await listWorkflowDocuments({ source_type: response.workflow.source_type, source_id: response.workflow.source_id });
        setWorkflowDocs(Array.isArray(docs) ? docs : []);
      }
      await refreshBaseData();
      showToast("F.ST-11 emitido correctamente", "success");
    } catch (error) {
      showToast(error?.response?.data?.error || "No se pudo emitir F.ST-11", "error");
    } finally {
      setBusyEmit(false);
    }
  };

  const pendingCount = useMemo(
    () => requestsWithWorkflow.filter((row) => (row.workflow?.workflow_status || "withdrawal_requested") !== "cerrado").length,
    [requestsWithWorkflow],
  );
  const closedCount = useMemo(
    () => requestsWithWorkflow.filter((row) => row.workflow?.workflow_status === "cerrado").length,
    [requestsWithWorkflow],
  );

  const selectedStatusMeta = getStatusMeta(selectedWorkflow?.workflow_status || "withdrawal_requested");

  const railContent = (
    <>
      <div className="border-b p-4" style={{ borderColor: "var(--st-border)" }}>
        <div className="flex items-center gap-3 rounded-[var(--st-radius-md)] border px-3 py-2.5" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
          <FiSearch size={16} style={{ color: "var(--st-text-faint)" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar solicitud, cliente o estado"
            className="w-full border-0 bg-transparent text-sm outline-none"
            style={{ color: "var(--st-text)" }}
          />
        </div>
        <select className={`${inputClass} mt-3`} style={inputStyle} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="withdrawal_requested">Retiro solicitado</option>
          <option value="withdrawal_coordinated">Retiro coordinado</option>
          <option value="desinfectado">Desinfectado</option>
          <option value="embalado">Embalado</option>
          <option value="retirado">Retirado</option>
          <option value="cerrado">Cerrado</option>
        </select>
        <label className="mt-3 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          <input type="checkbox" checked={assignedToMeOnly} onChange={(event) => setAssignedToMeOnly(event.target.checked)} />
          Solo asignados a mí
        </label>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Bandeja activa</p>
          <button
            type="button"
            onClick={refreshBaseData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-[var(--st-radius-sm)] border px-3 py-2 text-xs font-semibold transition disabled:opacity-60"
            style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)", background: "var(--st-surface)" }}
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="max-h-[65dvh] space-y-3 overflow-y-auto p-4">
        {loading && !requestsWithWorkflow.length ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[var(--st-radius-lg)]" style={{ background: "var(--st-surface-sunken)" }} />
          ))
        ) : filteredRows.length ? (
          filteredRows.map((row) => {
            const meta = getStatusMeta(row.workflow?.workflow_status || "withdrawal_requested");
            const active = selectedRequest?.id === row.id;
            return (
              <ServicioRailItem
                key={row.id}
                active={active}
                onClick={() => {
                  setSelectedRequest(row);
                  loadWorkflowDetail(row);
                }}
                title={
                  <>
                    {row.payload?.nombre_cliente || "Cliente sin registrar"}
                    {row.assignedToMe && <ServicioBadge tone="success" className="ml-2">Asignado a mí</ServicioBadge>}
                  </>
                }
                subtitle={`Solicitud #${row.id}`}
                badge={<ServicioBadge tone={meta.tone} icon={meta.Icon}>{meta.label}</ServicioBadge>}
                meta={<span className="inline-flex items-center gap-1"><FiCalendar size={12} />{formatDate(row.payload?.fecha_retiro)}</span>}
              />
            );
          })
        ) : (
          <ServicioEmptyState icon={FiTruck} title="No hay solicitudes F.ST-21 para los filtros actuales." description="Ajusta la búsqueda o vuelve a cargar la bandeja." />
        )}
      </div>
    </>
  );

  const detailContent = !selectedRequest ? (
    <ServicioEmptyState icon={FiTruck} title="Selecciona una solicitud" description="El workflow técnico de retiro se mostrará aquí." />
  ) : loadingDetail ? (
    <div className="flex min-h-[420px] items-center justify-center text-sm" style={{ color: "var(--st-text-muted)" }}>
      Cargando detalle del retiro...
    </div>
  ) : (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <ServicioBadge tone="neutral">F.ST-21</ServicioBadge>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
            {selectedRequest.payload?.nombre_cliente || "Cliente"}
          </h3>
          <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>Solicitud #{selectedRequest.id}</p>
        </div>
        <div className="flex flex-col items-start gap-3 xl:items-end">
          <ServicioBadge tone={selectedStatusMeta.tone} icon={selectedStatusMeta.Icon} className="self-start !px-3.5 !py-2 !text-sm">
            {selectedStatusMeta.label}
          </ServicioBadge>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => runWorkflowAction("initialize", { request_id: selectedRequest.id, source_type: selectedContext.source_type, source_id: selectedContext.source_id })}
            >
              Inicializar / refrescar
            </Button>
            <Link
              className="inline-flex items-center rounded-[var(--st-radius-md)] border px-3 py-2 text-xs font-semibold transition"
              style={{ borderColor: "var(--st-border)", color: "var(--st-text)" }}
              to={`/dashboard/servicio-tecnico/desinfeccion?source_type=${selectedContext.source_type}&source_id=${selectedContext.source_id}&request_id=${selectedContext.request_id}`}
            >
              Abrir F.ST-02
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <DetailLine icon={FiCalendar} label="Fecha de retiro" value={formatDate(selectedRequest.payload?.fecha_retiro)} />
        <DetailLine icon={FiUser} label="Contacto" value={selectedRequest.payload?.persona_contacto} />
        <DetailLine icon={FiPackage} label="Equipo" value={selectedRequest.payload?.equipos?.[0]?.nombre_equipo} />
        <DetailLine icon={FiCheckCircle} label="Asignado a" value={selectedWorkflow?.workflow_state?.work_order?.assigned_to} />
      </div>

      <WithdrawalStepper workflow={selectedWorkflow} onAction={runWorkflowAction} onEmitFst11={handleEmitFst11} busyAction={busyAction} busyEmit={busyEmit} />

      <WithdrawalPackagingPanel workflow={selectedWorkflow} onSave={handleSavePackaging} busy={busyPackaging} />

      <ServicioCard className="p-5" style={{ background: "var(--st-surface-sunken)" }}>
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Expediente documental</h4>
        {workflowDocs.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--st-text-muted)" }}>Sin documentos registrados todavía.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr style={{ color: "var(--st-text-faint)" }}>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {workflowDocs.map((doc) => (
                  <tr key={doc.id} style={{ borderTop: "1px solid var(--st-border)" }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: "var(--st-text)" }}>{doc.document_code}</td>
                    <td className="px-3 py-2" style={{ color: "var(--st-text-muted)" }}>{formatDate(doc.created_at)}</td>
                    <td className="px-3 py-2">
                      {doc.drive_file_id ? (
                        <a href={`https://drive.google.com/file/d/${doc.drive_file_id}/view`} target="_blank" rel="noreferrer" className="font-semibold hover:underline" style={{ color: "var(--st-accent)" }}>
                          Ver documento
                        </a>
                      ) : (
                        <span style={{ color: "var(--st-text-faint)" }}>Sin archivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ServicioCard>
    </div>
  );

  return (
    <ServicioWorkspaceShell
      eyebrow="Retiro de Equipos"
      eyebrowIcon={FiTruck}
      title="Retiro y desinstalación de equipos"
      description="Workflow integral de retiro con WO, desinfección F.ST-02, embalaje, bultos y acta F.ST-11."
      metrics={[
        { label: "Solicitudes", value: requestsWithWorkflow.length },
        { label: "En proceso", value: pendingCount },
        { label: "Cerrados", value: closedCount },
      ]}
      rail={railContent}
      detail={detailContent}
    />
  );
};

export default RetiroEquipos;
