import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/UIContext";
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

const inputClass =
 "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100";

const WORKFLOW_STATUS_LABELS = {
 withdrawal_requested: "Retiro solicitado",
 withdrawal_coordinated: "Retiro coordinado",
 desinfectado: "Desinfectado",
 embalado: "Embalado",
 retirado: "Retirado",
 cerrado: "Cerrado",
};

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

const getWorkflowStatusLabel = (value) => WORKFLOW_STATUS_LABELS[value] || value || "Sin estado";

const normalizeQueryText = (value) => String(value || "").trim().toLowerCase();

const RetiroEquipos = () => {
 const { showToast } = useUI();
 const [requests, setRequests] = useState([]);
 const [workflowRows, setWorkflowRows] = useState([]);
 const [selectedRequest, setSelectedRequest] = useState(null);
 const [selectedWorkflow, setSelectedWorkflow] = useState(null);
 const [workflowDocs, setWorkflowDocs] = useState([]);
 const [loading, setLoading] = useState(false);
 const [loadingDetail, setLoadingDetail] = useState(false);
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("");
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
 const docs = await listWorkflowDocuments({
 source_type: detail.source_type,
 source_id: detail.source_id,
 });
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
 workflowRows
 .filter((row) => row?.request_id)
 .map((row) => [Number(row.request_id), row]),
 );
 return requests.map((request) => {
 const payload = parsePayload(request.payload);
 const workflow = workflowByRequest.get(Number(request.id)) || null;
 return {
 ...request,
 payload,
 workflow,
 };
 });
 }, [requests, workflowRows]);

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
 return matchesSearch && matchesStatus;
 });
 }, [requestsWithWorkflow, search, statusFilter]);

 const selectedContext = useMemo(() => {
 const sourceType = selectedWorkflow?.source_type || "commercial_request";
 const sourceId = selectedWorkflow?.source_id || (selectedRequest ? String(selectedRequest.id) : null);
 const requestId = selectedWorkflow?.request_id || selectedRequest?.id || null;
 return {
 source_type: sourceType,
 source_id: sourceId,
 request_id: requestId,
 };
 }, [selectedWorkflow, selectedRequest]);

 const runWorkflowAction = async (action, payload = {}) => {
 if (!selectedRequest?.id) return;
 setBusyAction(action);
 try {
 const workflow = await updateWithdrawalWorkflowAction(
 {
 action,
 ...payload,
 request_id: selectedRequest.id,
 source_type: selectedContext.source_type,
 source_id: selectedContext.source_id,
 },
 selectedContext,
 );
 setSelectedWorkflow(workflow);
 if (workflow?.source_type && workflow?.source_id) {
 const docs = await listWorkflowDocuments({
 source_type: workflow.source_type,
 source_id: workflow.source_id,
 });
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
 {
 request_id: selectedRequest.id,
 source_type: selectedContext.source_type,
 source_id: selectedContext.source_id,
 },
 selectedContext,
 );
 setSelectedWorkflow(response?.workflow || selectedWorkflow);
 if (response?.workflow?.source_type && response?.workflow?.source_id) {
 const docs = await listWorkflowDocuments({
 source_type: response.workflow.source_type,
 source_id: response.workflow.source_id,
 });
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

 return (
 <div className="space-y-5">
 <Card className="p-5">
 <h1 className="text-xl font-semibold text-slate-900">Retiro y desinstalación de equipos</h1>
 <p className="mt-1 text-sm text-slate-600">
 Workflow integral de retiro con WO, desinfección F.ST-02, embalaje, bultos y acta F.ST-11.
 </p>
 </Card>

 <Card className="p-4">
 <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
 <label className="text-xs font-medium text-slate-600 md:col-span-2">
 Buscar solicitud / cliente / estado
 <input
 className={inputClass}
 value={search}
 onChange={(event) => setSearch(event.target.value)}
 placeholder="Ej. 1204, Clínica, embalado"
 />
 </label>
 <label className="text-xs font-medium text-slate-600">
 Estado workflow
 <select
 className={inputClass}
 value={statusFilter}
 onChange={(event) => setStatusFilter(event.target.value)}
 >
 <option value="">Todos</option>
 <option value="withdrawal_requested">Retiro solicitado</option>
 <option value="withdrawal_coordinated">Retiro coordinado</option>
 <option value="desinfectado">Desinfectado</option>
 <option value="embalado">Embalado</option>
 <option value="retirado">Retirado</option>
 <option value="cerrado">Cerrado</option>
 </select>
 </label>
 </div>
 </Card>

 <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
 <Card className="xl:col-span-4 p-0">
 <div className="max-h-[68vh] overflow-auto">
 <table className="w-full min-w-[560px] text-left text-xs">
 <thead className="sticky top-0 bg-slate-50 text-slate-600">
 <tr>
 <th className="px-3 py-2">Solicitud</th>
 <th className="px-3 py-2">Cliente</th>
 <th className="px-3 py-2">Fecha retiro</th>
 <th className="px-3 py-2">Estado</th>
 </tr>
 </thead>
 <tbody>
 {loading ? (
 <tr>
 <td className="px-3 py-4 text-slate-500" colSpan={4}>
 Cargando...
 </td>
 </tr>
 ) : filteredRows.length === 0 ? (
 <tr>
 <td className="px-3 py-4 text-slate-500" colSpan={4}>
 No hay solicitudes F.ST-21 para los filtros actuales.
 </td>
 </tr>
 ) : (
 filteredRows.map((row) => {
 const isSelected = selectedRequest?.id === row.id;
 return (
 <tr
 key={row.id}
 className={`cursor-pointer border-t border-slate-100 ${
 isSelected ? "bg-blue-50" : "hover:bg-slate-50"
 }`}
 onClick={() => {
 setSelectedRequest(row);
 loadWorkflowDetail(row);
 }}
 >
 <td className="px-3 py-2 font-semibold text-slate-700">#{row.id}</td>
 <td className="px-3 py-2 text-slate-700">
 {row.payload?.nombre_cliente || "N/D"}
 </td>
 <td className="px-3 py-2 text-slate-600">
 {formatDate(row.payload?.fecha_retiro)}
 </td>
 <td className="px-3 py-2">
 <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
 {getWorkflowStatusLabel(row.workflow?.workflow_status || "withdrawal_requested")}
 </span>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </Card>

 <div className="space-y-4 xl:col-span-8">
 {!selectedRequest ? (
 <Card className="p-5 text-sm text-slate-600">
 Selecciona una solicitud de retiro para gestionar su workflow técnico.
 </Card>
 ) : loadingDetail ? (
 <Card className="p-5 text-sm text-slate-600">Cargando detalle del retiro...</Card>
 ) : (
 <>
 <Card className="p-4">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div>
 <h2 className="text-base font-semibold text-slate-900">
 Solicitud #{selectedRequest.id} · {selectedRequest.payload?.nombre_cliente || "Cliente"}
 </h2>
 <p className="text-xs text-slate-600">
 Estado actual:{" "}
 <span className="font-semibold">
 {getWorkflowStatusLabel(selectedWorkflow?.workflow_status)}
 </span>
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <Button
 size="sm"
 variant="secondary"
 onClick={() =>
 runWorkflowAction("initialize", {
 request_id: selectedRequest.id,
 source_type: selectedContext.source_type,
 source_id: selectedContext.source_id,
 })
 }
 >
 Inicializar / refrescar
 </Button>
 <Link
 className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
 to={`/dashboard/servicio-tecnico/desinfeccion?source_type=${selectedContext.source_type}&source_id=${selectedContext.source_id}&request_id=${selectedContext.request_id}`}
 >
 Abrir F.ST-02
 </Link>
 </div>
 </div>
 </Card>

 <WithdrawalStepper
 workflow={selectedWorkflow}
 onAction={runWorkflowAction}
 onEmitFst11={handleEmitFst11}
 busyAction={busyAction}
 busyEmit={busyEmit}
 />

 <WithdrawalPackagingPanel
 workflow={selectedWorkflow}
 onSave={handleSavePackaging}
 busy={busyPackaging}
 />

 <Card className="p-4">
 <h4 className="text-sm font-semibold text-slate-900">Expediente documental</h4>
 {workflowDocs.length === 0 ? (
 <p className="mt-2 text-xs text-slate-500">Sin documentos registrados todavía.</p>
 ) : (
 <div className="mt-3 overflow-x-auto">
 <table className="min-w-full text-left text-xs">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-3 py-2">Código</th>
 <th className="px-3 py-2">Fecha</th>
 <th className="px-3 py-2">Archivo</th>
 </tr>
 </thead>
 <tbody>
 {workflowDocs.map((doc) => (
 <tr key={doc.id} className="border-t border-slate-100">
 <td className="px-3 py-2 font-semibold text-slate-700">{doc.document_code}</td>
 <td className="px-3 py-2 text-slate-600">{formatDate(doc.created_at)}</td>
 <td className="px-3 py-2">
 {doc.drive_file_id ? (
 <a
 href={`https://drive.google.com/file/d/${doc.drive_file_id}/view`}
 target="_blank"
 rel="noreferrer"
 className="font-semibold text-blue-600 hover:underline"
 >
 Ver documento
 </a>
 ) : (
 <span className="text-slate-400">Sin archivo</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </Card>
 </>
 )}
 </div>
 </div>
 </div>
 );
};

export default RetiroEquipos;
