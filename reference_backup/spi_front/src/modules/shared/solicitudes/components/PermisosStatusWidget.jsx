import React, { useEffect, useMemo, useState } from "react";
import {
  FiClock,
  FiCheck,
  FiX,
  FiFileText,
  FiAlertCircle,
  FiUpload,
  FiEye,
  FiUsers,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Card from "../../../../core/ui/components/Card";
import Button from "../../../../core/ui/components/Button";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/AuthContext";
import { STATUS_META, getTipoLabel, formatDateShort, hasJustificantes } from "../utils/solicitudesHelpers";
import {
  getMisSolicitudes,
  getPendientes,
  aprobarParcial,
  aprobarFinal,
  rechazar,
} from "../../../../core/api/permisosApi";
import UploadJustificantesModal from "../modals/UploadJustificantesModal";

const normalizeRole = (value = "") => value.toLowerCase();

const PermisosStatusWidget = () => {
  const { user } = useAuth();
  const { showToast } = useUI();
  const role = normalizeRole(user?.role);
  const scope = normalizeRole(user?.scope || role);
  const userEmail = user?.email || "";

  const isJefe = ["jefe_comercial", "jefe_tecnico", "jefe_aplicaciones", "jefe_calidad"].some((r) =>
    role.includes(r)
  );
  const isGerencia = role.includes("gerencia");
  const isApprover = isJefe || isGerencia;

  const [activeTab, setActiveTab] = useState("mine");
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [pendientesParcial, setPendientesParcial] = useState([]);
  const [pendientesFinal, setPendientesFinal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const requests = [getMisSolicitudes()];
      if (isApprover) {
        requests.push(getPendientes("pending"));
        requests.push(getPendientes("pending_final"));
      }
      const [mineResp, pendingResp, finalResp] = await Promise.all(requests);

      if (mineResp?.ok) setMisSolicitudes(mineResp.data || []);
      if (pendingResp?.ok) {
        const filtered = (pendingResp.data || []).filter((s) => s.user_email !== userEmail);
        setPendientesParcial(filtered);
      } else {
        setPendientesParcial([]);
      }
      if (finalResp?.ok) {
        const filtered = (finalResp.data || []).filter((s) => s.user_email !== userEmail);
        setPendientesFinal(filtered);
      } else {
        setPendientesFinal([]);
      }
    } catch (error) {
      console.error("Error loading permisos:", error);
      showToast("Error al cargar solicitudes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, scope]);

  const handleAprobarParcial = async (id) => {
    setActionLoading(id);
    try {
      const response = await aprobarParcial(id);
      if (response.ok) {
        showToast("Aprobado parcialmente. El colaborador debe subir documentos.", "success");
        await loadData();
      }
    } catch (error) {
      showToast(error.response?.data?.message || "Error al aprobar", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAprobarFinal = async (id) => {
    setActionLoading(id);
    try {
      const response = await aprobarFinal(id);
      if (response.ok) {
        showToast("Aprobado definitivamente. PDF generado en Drive.", "success");
        await loadData();
      }
    } catch (error) {
      showToast(error.response?.data?.message || "Error al aprobar", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRechazar = async () => {
    if (!selectedSolicitud || !rejectReason.trim()) {
      showToast("Debes proporcionar una razon de rechazo", "warning");
      return;
    }

    setActionLoading(selectedSolicitud.id);
    try {
      const response = await rechazar(selectedSolicitud.id, rejectReason);
      if (response.ok) {
        showToast("Solicitud rechazada", "success");
        setShowRejectModal(false);
        setSelectedSolicitud(null);
        setRejectReason("");
        await loadData();
      }
    } catch (error) {
      showToast(error.response?.data?.message || "Error al rechazar", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadSuccess = async () => {
    showToast("Documentos subidos correctamente", "success");
    setShowUploadModal(false);
    setSelectedSolicitud(null);
    await loadData();
  };

  const pendientesDeJustificante = useMemo(
    () => misSolicitudes.filter((sol) => sol.status === "partially_approved"),
    [misSolicitudes]
  );

  const misEsperandoGerencia = useMemo(
    () => misSolicitudes.filter((sol) => sol.status === "pending_final"),
    [misSolicitudes]
  );

  const tabs = useMemo(() => {
    const base = [
      { id: "mine", label: "Mis solicitudes", count: misSolicitudes.length, visible: true },
    ];
    if (isApprover) {
      base.push({
        id: "approve",
        label: isGerencia ? "Aprobar final" : "Aprobar",
        count: pendientesParcial.length + pendientesFinal.length,
        visible: true,
      });
    }
    if (isJefe) {
      base.push({
        id: "waiting",
        label: "Esperando gerencia",
        count: misEsperandoGerencia.length,
        visible: true,
      });
    }
    return base.filter((t) => t.visible);
  }, [misSolicitudes.length, pendientesParcial.length, pendientesFinal.length, misEsperandoGerencia.length, isApprover, isGerencia, isJefe]);

  const renderStatusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.pending;
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md ${meta.color}`}>
        <Icon className="w-3 h-3" />
        {meta.label}
      </span>
    );
  };

  const renderSolicitudCard = (solicitud, options = {}) => {
    const { showActions = false, showUser = false, showDocs = false } = options;
    const shouldShowDocs = (showActions || showDocs) && hasJustificantes(solicitud);
    const requiresUpload = solicitud.status === "partially_approved" && !showActions;

    return (
      <motion.div
        key={solicitud.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
      >
        <div
          className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${
            solicitud.status === "approved"
              ? "bg-green-500"
              : solicitud.status === "partially_approved"
              ? "bg-blue-500"
              : solicitud.status === "pending_final"
              ? "bg-purple-500"
              : solicitud.status === "rejected"
              ? "bg-red-500"
              : "bg-amber-400"
          }`}
        />
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-gray-900">{getTipoLabel(solicitud)}</span>
              {renderStatusBadge(solicitud.status)}
            </div>
            {showUser && (
              <p className="text-xs text-gray-600 mb-1">
                <FiUsers className="inline mr-1" />
                {solicitud.user_fullname}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {formatDateShort(solicitud.fecha_inicio)} - {formatDateShort(solicitud.fecha_fin)}
              </span>
              <span className="font-medium text-gray-700">
                {solicitud.duracion_horas ? `${solicitud.duracion_horas}h` : `${solicitud.duracion_dias}d`}
              </span>
            </div>
          </div>

          {/* Acciones de subida cuando esta parcialmente aprobada (colaborador) */}
          {requiresUpload && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setSelectedSolicitud(solicitud);
                setShowUploadModal(true);
              }}
              className="text-xs px-3 py-1.5"
            >
              <FiUpload className="w-3 h-3 mr-1" />
              Subir docs
            </Button>
          )}
        </div>

        {requiresUpload && (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800">
              Sube la evidencia solicitada para que pase a revision final.
            </p>
            {Array.isArray(solicitud.justificacion_requerida) && solicitud.justificacion_requerida.length > 0 && (
              <p className="mt-1 text-[11px] text-blue-700">
                Documentos requeridos: {solicitud.justificacion_requerida.join(", ")}.
              </p>
            )}
          </div>
        )}

        {shouldShowDocs && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
            <p className="text-xs font-semibold text-blue-900 mb-1.5">Documentos justificantes:</p>
            <div className="flex flex-wrap gap-1.5">
              {solicitud.justificantes_urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-300 rounded text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <FiEye className="w-3 h-3" />
                  Documento {idx + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {showActions && (
          <div className="space-y-2 mt-3">
            <div className="flex gap-2">
              {solicitud.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleAprobarParcial(solicitud.id)}
                    disabled={actionLoading === solicitud.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                  >
                    {actionLoading === solicitud.id ? "..." : "Aprobar parcial"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedSolicitud(solicitud);
                      setRejectReason("");
                      setShowRejectModal(true);
                    }}
                    className="flex-1 text-xs py-1.5"
                  >
                    Rechazar
                  </Button>
                </>
              )}

              {solicitud.status === "pending_final" && (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleAprobarFinal(solicitud.id)}
                    disabled={actionLoading === solicitud.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                  >
                    {actionLoading === solicitud.id ? "..." : "Aprobar final"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedSolicitud(solicitud);
                      setRejectReason("");
                      setShowRejectModal(true);
                    }}
                    className="flex-1 text-xs py-1.5"
                  >
                    Rechazar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === "mine") {
      if (misSolicitudes.length === 0) {
        return (
          <div className="text-center py-10">
            <FiFileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No tienes solicitudes</p>
            <p className="text-xs text-gray-500 mt-1">Crea una nueva solicitud para comenzar</p>
          </div>
        );
      }
      return misSolicitudes.map((sol) =>
        renderSolicitudCard(sol, {
          showDocs: sol.status === "pending_final" || sol.status === "approved",
        })
      );
    }

    if (activeTab === "approve") {
      if (!isApprover) return null;
      const noItems = pendientesParcial.length === 0 && pendientesFinal.length === 0;
      if (noItems) {
        return (
          <div className="text-center py-10">
            <FiCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No hay solicitudes pendientes</p>
            <p className="text-xs text-gray-500 mt-1">Nada por aprobar en este momento</p>
          </div>
        );
      }
      return (
        <>
          {pendientesParcial.map((sol) => renderSolicitudCard(sol, { showActions: true, showUser: true }))}
          {pendientesFinal.map((sol) => renderSolicitudCard(sol, { showActions: true, showUser: true }))}
        </>
      );
    }

    if (activeTab === "waiting") {
      if (!isJefe) return null;
      if (misEsperandoGerencia.length === 0) {
        return (
          <div className="text-center py-10">
            <FiClock className="w-12 h-12 text-amber-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">Sin solicitudes esperando gerencia</p>
          </div>
        );
      }
      return misEsperandoGerencia.map((sol) =>
        renderSolicitudCard(sol, { showDocs: hasJustificantes(sol) })
      );
    }

    return null;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <>
      {pendientesDeJustificante.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-blue-600 text-white shadow">
                <FiUpload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900">
                  Accin requerida
                </h3>
                <p className="text-sm text-blue-700">
                  Tienes permisos aprobados parcialmente. Debes subir los documentos justificantes.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {pendientesDeJustificante.map((sol) => (
              <div
                key={sol.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white border border-blue-100 px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    #{sol.id}  {getTipoLabel(sol)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateShort(sol.fecha_inicio)} - {formatDateShort(sol.fecha_fin)}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setSelectedSolicitud(sol);
                    setShowUploadModal(true);
                  }}
                >
                  <FiUpload className="mr-1" />
                  Subir docs
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <Card className="overflow-hidden">
        {/* Header con Tabs */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-base font-bold text-gray-900">Permisos y Vacaciones</h3>
          </div>
          <div className="flex gap-1 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon || FiClock;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-5 py-3 text-sm font-semibold transition-all ${
                    isActive ? "text-blue-700" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4 inline mr-2" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-2 rounded-full bg-blue-600 px-2 text-xs text-white">
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 h-0.5 w-full bg-blue-600"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-2"
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>

      {/* Modal de Rechazo */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-100 rounded-xl">
                    <FiAlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Rechazar Solicitud</h3>
                    <p className="text-sm text-gray-600">Proporciona una razon</p>
                  </div>
                </div>

                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
                  placeholder="Motivo del rechazo"
                />

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                    Cancelar
                  </Button>
                  <Button variant="danger" onClick={handleRechazar} disabled={!!actionLoading}>
                    Rechazar
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de subida de justificantes */}
      <UploadJustificantesModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        solicitud={selectedSolicitud}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
};

export default PermisosStatusWidget;
