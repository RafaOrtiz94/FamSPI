import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheck, FiX, FiClock } from "react-icons/fi";
import { listVacationRequests, updateVacationStatus, getVacationSummary } from "../../../core/api/vacationsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/UIContext";
import { useAuth } from "../../../core/auth/AuthContext";

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
  const value = (status || "").toLowerCase();
  if (value === "aprobado") return "bg-green-100 text-green-700";
  if (value === "rechazado") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};

const VacationRequestsWidget = ({ mode = "approver" }) => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const role = useMemo(() => (user?.role || "").toLowerCase(), [user]);
  const canApprove = mode === "hr" || managerRoles.includes(role);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const scope = mode === "hr" ? "all" : canApprove ? "pending" : "mine";
      const [reqs, sum] = await Promise.all([
        listVacationRequests({ scope }),
        getVacationSummary(mode === "hr"),
      ]);
      setRequests(Array.isArray(reqs?.data) ? reqs.data : reqs);
      setSummary(sum);
    } catch (err) {
      console.warn("No se pudieron cargar las vacaciones", err);
      showToast("No se pudieron cargar las solicitudes de vacaciones", "error");
    } finally {
      setLoading(false);
    }
  }, [canApprove, mode, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id, status) => {
    try {
      await updateVacationStatus(id, status);
      showToast(`Solicitud ${status === "aprobado" ? "aprobada" : "rechazada"}`, "success");
      await load();
    } catch (err) {
      console.error(err);
      showToast("No se pudo actualizar la solicitud", "error");
    }
  };

  const title = canApprove ? "Solicitudes de vacaciones" : "Mis solicitudes de vacaciones";

  return (
    <Card className="p-4 h-full border border-gray-200">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500">Vacaciones</p>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <FiClock className="mr-2" /> Actualizar
        </Button>
      </div>

      {summary && !Array.isArray(summary) ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3 text-sm">
          <div className="p-2 bg-gray-50 rounded">Total {summary.allowance}</div>
          <div className="p-2 bg-blue-50 rounded">Tomados {summary.taken}</div>
          <div className="p-2 bg-amber-50 rounded">Pendientes {summary.pending}</div>
          <div className="p-2 bg-green-50 rounded">Disponibles {summary.remaining}</div>
        </div>
      ) : null}

      {Array.isArray(summary) && summary.length && mode === "hr" ? (
        <div className="max-h-64 overflow-y-auto mb-3">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left">Colaborador</th>
                <th>Días</th>
                <th>Restantes</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.user_id} className="border-t">
                  <td className="py-1 pr-2">
                    <p className="font-medium">{row.fullname || row.email}</p>
                    <p className="text-xs text-gray-500">{row.department || ""}</p>
                  </td>
                  <td className="text-center">{row.taken} / {row.allowance}</td>
                  <td className="text-center font-semibold text-green-700">{row.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {requests && requests.length ? (
          requests.map((req) => (
            <div key={req.id} className="p-3 border rounded-lg bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FiCalendar /> {req.start_date} → {req.end_date}
                  </p>
                  <p className="text-xs text-gray-500">
                    {req.requester_name || req.requester_email || "Solicitante"} · {req.days} día(s)
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(req.status)}`}>
                  {req.status || "pendiente"}
                </span>
              </div>

              {req.drive_doc_link ? (
                <a
                  href={req.drive_pdf_link || req.drive_doc_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver documento
                </a>
              ) : null}

              {canApprove && (req.status || "").toLowerCase() === "pendiente" ? (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="primary" icon={FiCheck} onClick={() => handleAction(req.id, "aprobado")}>
                    Aprobar
                  </Button>
                  <Button size="sm" variant="secondary" icon={FiX} onClick={() => handleAction(req.id, "rechazado")}>
                    Rechazar
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">{loading ? "Cargando..." : "No hay solicitudes"}</p>
        )}
      </div>
    </Card>
  );
};

export default VacationRequestsWidget;
