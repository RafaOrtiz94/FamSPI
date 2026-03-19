import React, { useMemo, useState } from "react";
import { FiCalendar, FiEye } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";
import { useUI } from "../../../../core/ui/useUI";
import { useAuth } from "../../../../core/auth/useAuth";
import { useScheduleApproval } from "../../hooks/useScheduleApproval";
import { fetchScheduleDetail } from "../../../../core/api/schedulesApi";
import ScheduleCard from "./ScheduleCard";
import ScheduleDetailModal from "./ScheduleDetailModal";
import RejectScheduleModal from "./RejectScheduleModal";

const ScheduleApprovalWidget = () => {
 const {
 pending,
 teamSchedules,
 loading: listLoading,
 approve,
 reject,
 loadPending,
 loadTeamSchedules,
 } = useScheduleApproval();
 const { showToast, showLoader, hideLoader } = useUI();
 const { user } = useAuth();
 const role = (user?.role || "").toLowerCase();
 const isGerenciaGeneral = role.includes("gerencia_general");
 const [selectedSchedule, setSelectedSchedule] = useState(null);
 const [modalLoading, setModalLoading] = useState(false);
 const [showDetailModal, setShowDetailModal] = useState(false);
 const [showRejectModal, setShowRejectModal] = useState(false);
 const [actionLoadingKey, setActionLoadingKey] = useState(null);

 const schedulesList = useMemo(() => {
 const base = isGerenciaGeneral ? teamSchedules : pending;
 return [...(base || [])].sort((a, b) => {
 const nameA = (a.user_name || a.user_email || "").toLowerCase();
 const nameB = (b.user_name || b.user_email || "").toLowerCase();
 return nameA.localeCompare(nameB);
 });
 }, [isGerenciaGeneral, teamSchedules, pending]);

 const teamKpis = useMemo(() => {
 if (!isGerenciaGeneral) return null;
 const now = new Date();
 const currentMonth = now.getMonth() + 1;
 const currentYear = now.getFullYear();
 const currentSchedules = schedulesList.filter(
 (item) => Number(item.month) === currentMonth && Number(item.year) === currentYear
 );
 const total = currentSchedules.length;
 if (!total) return { avgEfficiency: 0, avgDetails: 0, avgPlanned: 0 };
 let sumEfficiency = 0;
 let sumDetails = 0;
 let sumPlanned = 0;
 let effCount = 0;
 let detailsCount = 0;
 currentSchedules.forEach((item) => {
 if (typeof item.efficiency_ratio === "number") {
 sumEfficiency += item.efficiency_ratio;
 effCount += 1;
 }
 if (typeof item.details_completion_ratio === "number") {
 sumDetails += item.details_completion_ratio;
 detailsCount += 1;
 }
 sumPlanned += Number(item.visits_count || 0);
 });
 return {
 avgEfficiency: effCount ? Math.round((sumEfficiency / effCount) * 100) : 0,
 avgDetails: detailsCount ? Math.round((sumDetails / detailsCount) * 100) : 0,
 avgPlanned: total ? Math.round(sumPlanned / total) : 0,
 };
 }, [isGerenciaGeneral, schedulesList]);

 const totalCount = schedulesList.length;

 const runActionWithLoader = async (loadingKey, message, action) => {
 setActionLoadingKey(loadingKey);
 showLoader(message);
 try {
 await action();
 } finally {
 hideLoader();
 setActionLoadingKey(null);
 }
 };

 const handleApprove = async (scheduleId) => {
 await runActionWithLoader(`approve-${scheduleId}`, "Aprobando cronograma...", async () => {
 try {
 await approve(scheduleId);
 showToast("Cronograma aprobado", "success");
 setShowDetailModal(false);
 setSelectedSchedule(null);
 } catch (error) {
 showToast(error.message || "No se pudo aprobar", "error");
 }
 });
 };

 const handleReject = async (reason) => {
 if (!selectedSchedule) return;
 await runActionWithLoader(`reject-${selectedSchedule.id}`, "Rechazando cronograma...", async () => {
 try {
 await reject(selectedSchedule.id, reason);
 showToast("Cronograma rechazado", "success");
 setShowRejectModal(false);
 setShowDetailModal(false);
 setSelectedSchedule(null);
 } catch (error) {
 showToast(error.message || "No se pudo rechazar", "error");
 }
 });
 };

 return (
 <Card className="p-5 space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold text-gray-900">
 {isGerenciaGeneral ? "Cronogramas del equipo" : "Cronogramas Pendientes de Aprobacion"}
 </h3>
 <p className="text-sm text-gray-500">
 {isGerenciaGeneral
 ? "Vista completa por asesor con fechas de envio y aprobacion."
 : "Revisa y aprueba los cronogramas mensuales de tu equipo"}
 </p>
 </div>
 <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
 {isGerenciaGeneral ? `${totalCount} cronogramas` : `${pending.length} pendientes`}
 </span>
 </div>

 {listLoading && <p className="text-sm text-gray-500">Cargando cronogramas...</p>}

 {isGerenciaGeneral && teamKpis && (
 <div className="space-y-2">
 <p className="text-[11px] text-gray-500 uppercase tracking-wide">
 KPI del mes actual ({new Date().toLocaleString("es-EC", { month: "long", year: "numeric" })})
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
 <p className="text-[11px] uppercase tracking-wide text-emerald-700">Eficiencia promedio</p>
 <p className="text-xl font-semibold text-emerald-900">{teamKpis.avgEfficiency}%</p>
 </div>
 <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
 <p className="text-[11px] uppercase tracking-wide text-teal-700">Detalles completos</p>
 <p className="text-xl font-semibold text-teal-900">{teamKpis.avgDetails}%</p>
 </div>
 <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
 <p className="text-[11px] uppercase tracking-wide text-sky-700">Promedio visitas/cronograma</p>
 <p className="text-xl font-semibold text-sky-900">{teamKpis.avgPlanned}</p>
 </div>
 </div>
 </div>
 )}

 <div className="space-y-3">
 {schedulesList.map((schedule) => (
 <ScheduleCard
 key={schedule.id}
 schedule={schedule}
 onApprove={handleApprove}
 onReject={() => {
 setSelectedSchedule(schedule);
 setShowRejectModal(true);
 }}
 onViewDetails={async () => {
 setActionLoadingKey(`view-${schedule.id}`);
 showLoader("Cargando detalle de cronograma...");
 setSelectedSchedule(schedule);
 setShowDetailModal(true);
 setModalLoading(true);
 try {
 const fullData = await fetchScheduleDetail(schedule.id);
 setSelectedSchedule(fullData);
 } catch (err) {
 showToast("No se pudo cargar el detalle", "error");
 } finally {
 hideLoader();
 setActionLoadingKey(null);
 setModalLoading(false);
 }
 }}
 approveLoading={actionLoadingKey === `approve-${schedule.id}`}
 rejectLoading={actionLoadingKey === `reject-${schedule.id}`}
 viewLoading={actionLoadingKey === `view-${schedule.id}`}
 disabled={Boolean(actionLoadingKey)}
 showMeta={isGerenciaGeneral}
 />
 ))}
 {!schedulesList.length && !listLoading && (
 <div className="text-sm text-gray-500">
 {isGerenciaGeneral ? "No hay cronogramas para mostrar." : "No hay cronogramas pendientes por revisar."}
 </div>
 )}
 </div>

 <Modal
 open={showDetailModal}
 onClose={() => {
 if (!actionLoadingKey) setShowDetailModal(false);
 }}
 title="Detalle de cronograma"
 >
 {modalLoading ? (
 <div className="p-10 flex flex-col items-center justify-center text-gray-500">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
 <p className="text-sm">Cargando detalles...</p>
 </div>
 ) : selectedSchedule ? (
 <ScheduleDetailModal
 schedule={selectedSchedule}
 onApprove={() => handleApprove(selectedSchedule.id)}
 onReject={() => {
 setShowRejectModal(true);
 }}
 approveLoading={actionLoadingKey === `approve-${selectedSchedule.id}`}
 rejectLoading={actionLoadingKey === `reject-${selectedSchedule.id}`}
 actionsDisabled={Boolean(actionLoadingKey)}
 />
 ) : null}
 </Modal>

 <RejectScheduleModal
 open={showRejectModal}
 onClose={() => {
 if (!actionLoadingKey) setShowRejectModal(false);
 }}
 onConfirm={handleReject}
 loading={selectedSchedule ? actionLoadingKey === `reject-${selectedSchedule.id}` : false}
 disabled={Boolean(actionLoadingKey)}
 />

 <div className="flex items-center justify-end gap-2">
 <Button
 size="sm"
 variant="ghost"
 icon={FiEye}
 onClick={() => (isGerenciaGeneral ? loadTeamSchedules() : loadPending())}
 >
 Refrescar
 </Button>
 <Button
 size="sm"
 variant="success"
 icon={FiCalendar}
 onClick={() => (isGerenciaGeneral ? loadTeamSchedules() : loadPending())}
 >
 Actualizar lista
 </Button>
 </div>
 </Card>
 );
};

export default ScheduleApprovalWidget;
