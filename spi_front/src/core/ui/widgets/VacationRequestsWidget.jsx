import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheck, FiClock, FiX } from "react-icons/fi";
import { DATA_UPDATE_SCOPES, useScopedAutoUpdate } from "../../api";
import {
  cancelVacationRequest,
  getVacationSummary,
  listVacationRequests,
  updateVacationDates,
  updateVacationStatus,
} from "../../api/vacationsApi";
import { useAuth } from "../../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";
import Modal from "../components/Modal";
import { useUI } from "../UIContext";

const managerRoles = [
  "jefe_comercial",
  "jefe_tecnico",
  "jefe_calidad",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "talento-humano",
  "talento_humano",
  "rh",
  "rrhh",
];

const statusBadge = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "aprobado" || value === "approved") return "bg-green-100 text-green-700";
  if (value === "rechazado" || value === "rejected") return "bg-red-100 text-red-700";
  if (value === "cancelado" || value === "cancelled") return "bg-stone-200 text-stone-700";
  return "bg-amber-100 text-amber-700";
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const text = String(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const getTodayLocalDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isApprovedStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  return normalized === "approved" || normalized === "aprobado";
};

const VacationRequestsWidget = ({ mode = "approver" }) => {
  const { showToast, showLoader, hideLoader } = useUI();
  const { user } = useAuth();
  const role = useMemo(() => (user?.role || "").toLowerCase(), [user]);
  const canApprove = mode === "hr" || managerRoles.includes(role);

  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [cancelModal, setCancelModal] = useState({ open: false, request: null, reason: "" });
  const [reprogramModal, setReprogramModal] = useState({
    open: false,
    request: null,
    startDate: "",
    endDate: "",
    returnDate: "",
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const scope = mode === "hr" ? "all" : canApprove ? "pending" : "mine";
        const [reqs, sum] = await Promise.all([listVacationRequests({ scope }), getVacationSummary(mode === "hr")]);
        setRequests(Array.isArray(reqs?.data) ? reqs.data : reqs);
        setSummary(sum);
      } catch (err) {
        console.warn("No se pudieron cargar las vacaciones", err);
        showToast("No se pudieron cargar las solicitudes de vacaciones", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [canApprove, mode, showToast]
  );

  useEffect(() => {
    load();
  }, [load]);

  useScopedAutoUpdate(
    DATA_UPDATE_SCOPES.VACACIONES,
    () => {
      load({ silent: true });
    },
    [load]
  );

  const canManageRequest = useCallback(
    (request = {}) =>
      canApprove ||
      Number(request.requester_id) === Number(user?.id) ||
      Number(request.approver_id) === Number(user?.id),
    [canApprove, user?.id]
  );

  const canMutateApprovedRequest = useCallback((request = {}) => {
    if (!isApprovedStatus(request.status)) return false;
    const startDate = normalizeDateOnly(request.start_date);
    if (!startDate) return false;
    return startDate > getTodayLocalDate();
  }, []);

  const handleStatusAction = async (id, status) => {
    setActionLoadingId(id);
    showLoader(status === "aprobado" ? "Aprobando vacaciones..." : "Rechazando vacaciones...");
    try {
      await updateVacationStatus(id, status);
      showToast(`Solicitud ${status === "aprobado" ? "aprobada" : "rechazada"}`, "success");
      await load();
    } catch (err) {
      console.error(err);
      showToast("No se pudo actualizar la solicitud", "error");
    } finally {
      hideLoader();
      setActionLoadingId(null);
    }
  };

  const openCancelModal = (request) => {
    setCancelModal({
      open: true,
      request,
      reason: "",
    });
  };

  const closeCancelModal = () => {
    if (modalSubmitting) return;
    setCancelModal({ open: false, request: null, reason: "" });
  };

  const confirmCancel = async () => {
    if (!cancelModal.request?.id) return;
    const reason = String(cancelModal.reason || "").trim();
    if (!reason) {
      showToast("Debes registrar un motivo de cancelacion.", "warning");
      return;
    }
    setModalSubmitting(true);
    showLoader("Cancelando solicitud...");
    try {
      await cancelVacationRequest(cancelModal.request.id, reason);
      showToast("Solicitud cancelada correctamente.", "success");
      closeCancelModal();
      await load();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || "No se pudo cancelar la solicitud.", "error");
    } finally {
      hideLoader();
      setModalSubmitting(false);
    }
  };

  const openReprogramModal = (request) => {
    setReprogramModal({
      open: true,
      request,
      startDate: normalizeDateOnly(request?.start_date) || "",
      endDate: normalizeDateOnly(request?.end_date) || "",
      returnDate: normalizeDateOnly(request?.return_date) || "",
    });
  };

  const closeReprogramModal = () => {
    if (modalSubmitting) return;
    setReprogramModal({
      open: false,
      request: null,
      startDate: "",
      endDate: "",
      returnDate: "",
    });
  };

  const confirmReprogram = async () => {
    if (!reprogramModal.request?.id) return;
    const today = getTodayLocalDate();
    if (!reprogramModal.startDate || !reprogramModal.endDate) {
      showToast("Debes registrar fecha de inicio y fin.", "warning");
      return;
    }
    if (reprogramModal.startDate > reprogramModal.endDate) {
      showToast("La fecha de inicio no puede ser mayor a la fecha fin.", "warning");
      return;
    }
    if (reprogramModal.startDate <= today) {
      showToast("La nueva fecha de inicio debe ser futura.", "warning");
      return;
    }

    setModalSubmitting(true);
    showLoader("Reprogramando solicitud...");
    try {
      await updateVacationDates(reprogramModal.request.id, {
        start_date: reprogramModal.startDate,
        end_date: reprogramModal.endDate,
        return_date: reprogramModal.returnDate || undefined,
      });
      showToast("Solicitud reprogramada correctamente.", "success");
      closeReprogramModal();
      await load();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || "No se pudo reprogramar la solicitud.", "error");
    } finally {
      hideLoader();
      setModalSubmitting(false);
    }
  };

  const title = canApprove ? "Solicitudes de vacaciones" : "Mis solicitudes de vacaciones";

  return (
    <>
      <Card className="h-full border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Vacaciones</p>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <FiClock className="mr-2" /> Actualizar
          </Button>
        </div>

        {summary && !Array.isArray(summary) ? (
          <div className="mb-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
            <div className="rounded bg-gray-50 p-2">Total {summary.allowance}</div>
            <div className="rounded bg-blue-50 p-2">Tomados {summary.taken}</div>
            <div className="rounded bg-amber-50 p-2">Pendientes {summary.pending}</div>
            <div className="rounded bg-green-50 p-2">Disponibles {summary.remaining}</div>
          </div>
        ) : null}

        {summary && !Array.isArray(summary) && summary.missing_hire_date ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Falta registrar la <strong>fecha de ingreso</strong> en el perfil. Talento humano debe completarla para
            calcular correctamente las vacaciones.
          </div>
        ) : null}

        {Array.isArray(summary) && summary.length && mode === "hr" ? (
          <div className="mb-3 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left">Colaborador</th>
                  <th>Dias</th>
                  <th>Restantes</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.user_id} className="border-t">
                    <td className="py-1 pr-2">
                      <p className="font-medium">{row.fullname || row.email}</p>
                      <p className="text-xs text-gray-500">{row.department || ""}</p>
                      {row.missing_hire_date ? <p className="text-[10px] text-amber-600">Falta fecha de ingreso</p> : null}
                    </td>
                    <td className="text-center">
                      {row.taken} / {row.allowance}
                    </td>
                    <td className="text-center font-semibold text-green-700">{row.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {requests && requests.length ? (
            requests.map((request) => {
              const isPending = String(request.status || "").toLowerCase() === "pendiente";
              const canManage = canManageRequest(request);
              const canMutate = canManage && canMutateApprovedRequest(request);
              const dateLabel = `${normalizeDateOnly(request.start_date) || request.start_date} -> ${
                normalizeDateOnly(request.end_date) || request.end_date
              }`;

              return (
                <div key={request.id} className="rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <FiCalendar /> {dateLabel}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.requester_name || request.requester_email || "Solicitante"} - {request.days} dia(s)
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(request.status)}`}>
                      {request.status || "pendiente"}
                    </span>
                  </div>

                  {request.drive_doc_link ? (
                    <a
                      href={request.drive_pdf_link || request.drive_doc_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver documento
                    </a>
                  ) : null}

                  {canApprove && isPending ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={FiCheck}
                        onClick={() => handleStatusAction(request.id, "aprobado")}
                        disabled={actionLoadingId === request.id}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={FiX}
                        onClick={() => handleStatusAction(request.id, "rechazado")}
                        disabled={actionLoadingId === request.id}
                      >
                        Rechazar
                      </Button>
                    </div>
                  ) : null}

                  {canMutate ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openReprogramModal(request)}>
                        Reprogramar
                      </Button>
                      <Button size="sm" variant="warning" onClick={() => openCancelModal(request)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">{loading ? "Cargando..." : "No hay solicitudes"}</p>
          )}
        </div>
      </Card>

      <Modal
        open={cancelModal.open}
        onClose={closeCancelModal}
        title={cancelModal.request ? `Cancelar solicitud #${cancelModal.request.id}` : "Cancelar solicitud"}
        disableClose={modalSubmitting}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Esta accion solo aplica para solicitudes aprobadas cuya fecha de inicio aun no ha comenzado.
          </p>
          <label className="block text-sm font-medium text-slate-700" htmlFor="vacation-cancel-reason">
            Motivo de cancelacion
          </label>
          <textarea
            id="vacation-cancel-reason"
            className="min-h-[110px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={cancelModal.reason}
            onChange={(event) => setCancelModal((prev) => ({ ...prev, reason: event.target.value }))}
            placeholder="Describe el motivo para auditoria"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeCancelModal} disabled={modalSubmitting}>
              Cerrar
            </Button>
            <Button variant="warning" onClick={confirmCancel} isLoading={modalSubmitting}>
              Confirmar cancelacion
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={reprogramModal.open}
        onClose={closeReprogramModal}
        title={reprogramModal.request ? `Reprogramar solicitud #${reprogramModal.request.id}` : "Reprogramar solicitud"}
        disableClose={modalSubmitting}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            El sistema validara nuevamente el saldo de dias disponible antes de guardar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Inicio
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={reprogramModal.startDate}
                onChange={(event) => setReprogramModal((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Fin
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={reprogramModal.endDate}
                onChange={(event) => setReprogramModal((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700 sm:col-span-2">
              Regreso (opcional)
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={reprogramModal.returnDate}
                onChange={(event) => setReprogramModal((prev) => ({ ...prev, returnDate: event.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeReprogramModal} disabled={modalSubmitting}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={confirmReprogram} isLoading={modalSubmitting}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default VacationRequestsWidget;
