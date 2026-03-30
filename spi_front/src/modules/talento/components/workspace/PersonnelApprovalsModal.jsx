import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../../../../core/ui/components/Modal";
import Button from "../../../../core/ui/components/Button";
import { getPersonnelRequests, getPersonnelRequestById } from "../../../../core/api/personnelRequestsApi";
import PersonnelRequestReview from "./PersonnelRequestReview";

const PersonnelApprovalsModal = ({ open, onClose, canApprove }) => {
 const [loading, setLoading] = useState(false);
 const [requests, setRequests] = useState([]);
 const [filterStatus, setFilterStatus] = useState("all");
 const [search, setSearch] = useState("");
 const [selectedRequest, setSelectedRequest] = useState(null);
 const [loadingDetail, setLoadingDetail] = useState(false);

 const loadRequests = async () => {
 setLoading(true);
 try {
 const params = { pageSize: 50 };
 if (filterStatus !== "all") {
 params.status = filterStatus;
 }
 const response = await getPersonnelRequests(params);
 setRequests(response.data || []);
 } catch (error) {
 console.error("Error cargando solicitudes:", error);
 toast.error("No se pudieron cargar las solicitudes");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (open) {
 loadRequests();
 }
 }, [open, filterStatus]);

 const filteredRequests = useMemo(() => {
 const term = search.trim().toLowerCase();
 if (!term) return requests;
 return (requests || []).filter((req) => {
 const title = String(req.position_title || "").toLowerCase();
 const requester = String(req.requester_name || req.requester_email || "").toLowerCase();
 const number = String(req.request_number || "").toLowerCase();
 return title.includes(term) || requester.includes(term) || number.includes(term);
 });
 }, [requests, search]);

 const handleOpenReview = async (requestId) => {
 setLoadingDetail(true);
 try {
 const response = await getPersonnelRequestById(requestId);
 setSelectedRequest(response.data || null);
 } catch (error) {
 console.error("Error cargando solicitud:", error);
 toast.error("No se pudo cargar la solicitud");
 } finally {
 setLoadingDetail(false);
 }
 };

 const handleBack = () => {
 setSelectedRequest(null);
 };

 const handleUpdated = async () => {
 await loadRequests();
 setSelectedRequest(null);
 };

 return (
 <Modal open={open} onClose={onClose} title="Revision de Solicitudes" maxWidth="max-w-4xl">
 {selectedRequest ? (
 <PersonnelRequestReview
 request={selectedRequest}
 onRequestCancel={handleBack}
 onRequestUpdate={handleUpdated}
 canApprove={canApprove}
 />
 ) : (
 <div className="space-y-4">
 <div className="flex flex-wrap gap-2">
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Buscar por puesto, solicitante o numero"
 aria-label="Buscar solicitudes de personal"
 className="flex-1 min-w-[180px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
 />
 <select
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 aria-label="Filtrar solicitudes por estado"
 className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
 >
 <option value="all">Todas</option>
 <option value="pendiente">Pendientes</option>
 <option value="en_revision">En revision</option>
 <option value="aprobada">Aprobadas</option>
 <option value="rechazada">Rechazadas</option>
 <option value="en_proceso">En proceso</option>
 <option value="completada">Completadas</option>
 </select>
 <Button variant="secondary" onClick={loadRequests} disabled={loading} aria-label="Actualizar listado de solicitudes">
 Actualizar
 </Button>
 </div>

 {loading ? (
 <div className="flex h-40 items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
 </div>
 ) : filteredRequests.length === 0 ? (
 <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
 No hay solicitudes para mostrar.
 </div>
 ) : (
 <div className="space-y-3">
 {filteredRequests.map((req) => (
 <div
 key={req.id}
 className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
 >
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div>
 <p className="text-sm font-semibold text-gray-900">{req.position_title}</p>
 <p className="text-xs text-gray-600">
 {req.request_number} ? {req.requester_name || req.requester_email || "N/A"}
 </p>
 </div>
 <Button
 size="sm"
 variant="secondary"
 onClick={() => handleOpenReview(req.id)}
 disabled={loadingDetail}
 aria-label={`Ver detalle de solicitud ${req.request_number || req.id}`}
 >
 Ver detalle
 </Button>
 </div>
 <div className="text-xs text-gray-500">
 Estado: {req.status || "pendiente"}
 </div>
 {req.workflow && (
 <div className="flex flex-wrap gap-2 text-[10px] font-medium text-gray-600">
 <span className="rounded-full bg-slate-100 px-2 py-0.5">
 {req.workflow.current_stage_label}
 </span>
 <span className={`rounded-full px-2 py-0.5 ${
 req.workflow.stalled ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
 }`}>
 {req.workflow.stalled ? "Estancada" : req.workflow.elapsed_label || "En curso"}
 </span>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </Modal>
 );
};

export default PersonnelApprovalsModal;
