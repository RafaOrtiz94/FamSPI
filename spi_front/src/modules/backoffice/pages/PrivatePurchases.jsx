import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiFileText,
  FiRefreshCw,
  FiSend,
  FiUpload,
  FiLayers,
  FiActivity,
  FiFilter,
} from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Modal from "../../../core/ui/components/Modal";
import { useAuth } from "../../../core/auth/useAuth";
import { useApi } from "../../../core/hooks/useApi";
import { useUI } from "../../../core/ui/useUI";
import { listPrivatePurchases, sendPrivatePurchaseOffer, uploadPrivateSignedOffer } from "../../../core/api/privatePurchasesApi";

const STATUS_DEFINITIONS = [
  { value: "pending_commercial", label: "Pendiente comercial", accent: "bg-blue-50 text-blue-700" },
  { value: "pending_backoffice", label: "Pendiente backoffice", accent: "bg-yellow-50 text-yellow-700" },
  { value: "pending_manager_signature", label: "Pendiente firma jefe", accent: "bg-indigo-50 text-indigo-700" },
  { value: "pending_client_signature", label: "Pendiente firma cliente", accent: "bg-teal-50 text-teal-700" },
  { value: "offer_sent", label: "Oferta enviada", accent: "bg-indigo-50 text-indigo-700" },
  { value: "offer_signed", label: "Oferta firmada", accent: "bg-green-50 text-green-700" },
  { value: "client_registered", label: "Cliente registrado", accent: "bg-teal-50 text-teal-700" },
  { value: "sent_to_acp", label: "Enviada a ACP", accent: "bg-purple-50 text-purple-700" },
  { value: "rejected", label: "Rechazada", accent: "bg-rose-50 text-rose-700" },
];

const statusLookup = STATUS_DEFINITIONS.reduce((acc, def) => {
  acc[def.value] = def;
  return acc;
}, {});

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("es-EC") : "Sin fecha";

const PrivatePurchasesPage = () => {
  const { showToast } = useUI();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [offerModal, setOfferModal] = useState({
    open: false,
    loading: false,
    file: null,
  });
  const [signedModal, setSignedModal] = useState({
    open: false,
    loading: false,
    file: null,
  });
  const [processingAction, setProcessingAction] = useState(null);
  const { role, user } = useAuth();
  const normalizedRole = (role || user?.role || user?.role_name || user?.scope || "").toLowerCase();
  const normalizedScope = (user?.scope || "").toLowerCase();
  const isBackofficeUser = normalizedRole.includes("backoffice");
  const isAcpUser = normalizedRole.includes("acp_comercial");
  const isManagerUser =
    normalizedRole.includes("gerencia") ||
    normalizedRole.includes("jefe_comercial");
  const isPureCommercial =
    !isBackofficeUser &&
    !isManagerUser &&
    !isAcpUser &&
    (normalizedRole.startsWith("comercial") || normalizedScope.startsWith("comercial"));
  const canManageRequests = isBackofficeUser || isManagerUser || isAcpUser;
  const canViewRequests = canManageRequests || isPureCommercial;

  const privatePurchasesFetcher = useCallback(
    (params) => listPrivatePurchases(params),
    [],
  );

  const { data, loading, execute: fetchPrivatePurchases } = useApi(
    privatePurchasesFetcher,
    { errorMsg: "No se pudo cargar las solicitudes privadas" },
  );

  const requests = canViewRequests ? data?.rows || data || [] : [];

  const selectedRequest = useMemo(
    () => requests.find((req) => req.id === selectedId) || null,
    [requests, selectedId],
  );
  const [detailModalRequest, setDetailModalRequest] = useState(null);

  const handleDetailOpen = (req) => {
    setSelectedId(req.id);
    setDetailModalRequest(req);
  };

  const handleDetailClose = () => setDetailModalRequest(null);

  useEffect(() => {
    if (!canViewRequests) return;
    fetchPrivatePurchases({
      status: statusFilter !== "all" ? statusFilter : undefined,
    });
  }, [fetchPrivatePurchases, statusFilter, canViewRequests]);

  useEffect(() => {
    if (!requests.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !requests.some((req) => req.id === selectedId)) {
      setSelectedId(requests[0].id);
    }
  }, [requests, selectedId]);

  const summary = useMemo(() => {
    const counts = STATUS_DEFINITIONS.map((def) => ({
      ...def,
      count: 0,
    }));
    requests.forEach((req) => {
      const idx = counts.findIndex((entry) => entry.value === req.status);
      if (idx >= 0) counts[idx].count += 1;
    });
    return counts;
  }, [requests]);

  const buildUnsignedFolderPath = () => {
    const commercial =
      selectedRequest?.created_by_email ||
      selectedRequest?.created_by ||
      user?.email ||
      "comercial";
    const client = selectedRequest?.client_snapshot?.commercial_name || "cliente";
    return `/Ofertas Sin Firmar/${commercial}/${client}`;
  };

  const buildSignedFolderPath = () => {
    const commercial =
      selectedRequest?.created_by_email ||
      selectedRequest?.created_by ||
      user?.email ||
      "comercial";
    const client = selectedRequest?.client_snapshot?.commercial_name || "cliente";
    return `/Ofertas Firmadas/${commercial}/${client}`;
  };

  const handleOfferSubmit = async () => {
    if (!selectedRequest) return;
    if (!offerModal.file) {
      showToast("Selecciona un archivo de oferta", "warning");
      return;
    }

    setOfferModal((prev) => ({ ...prev, loading: true }));
    try {
      const base64 = await fileToBase64(offerModal.file);
      if (!base64 || !base64.includes(",")) {
        showToast("No se pudo leer el archivo, intenta nuevamente", "error");
        setOfferModal((prev) => ({ ...prev, loading: false }));
        return;
      }
      const base64payload = base64.split(",")[1];
      if (!base64payload || !base64payload.trim()) {
        showToast("El archivo de oferta estヌ vacヌo o no se pudo procesar", "error");
        setOfferModal((prev) => ({ ...prev, loading: false }));
        return;
      }
      await sendPrivatePurchaseOffer(selectedRequest.id, {
        offer_base64: base64payload,
        file_name: offerModal.file.name,
        folder_path: buildUnsignedFolderPath(),
        mime_type: offerModal.file?.type,
      });
      showToast("Oferta registrada y enviada", "success");
      setOfferModal({ open: false, loading: false, file: null });
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar la oferta", "error");
      setOfferModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSignedUpload = async () => {
    if (!selectedRequest || !signedModal.file) {
      showToast("Selecciona un archivo firmado", "warning");
      return;
    }
    setSignedModal((prev) => ({ ...prev, loading: true }));
    try {
      const base64 = await fileToBase64(signedModal.file);
      if (!base64 || !base64.includes(",")) {
        showToast("No se pudo leer el archivo, intenta nuevamente", "error");
        setSignedModal((prev) => ({ ...prev, loading: false }));
        return;
      }
      const base64payload = base64.split(",")[1];
      if (!base64payload || !base64payload.trim()) {
        showToast("El archivo estヌ vacヌo o no se pudo procesar", "error");
        setSignedModal((prev) => ({ ...prev, loading: false }));
        return;
      }
      await uploadPrivateSignedOffer(selectedRequest.id, {
        signed_offer_base64: base64payload,
        file_name: signedModal.file.name,
        mime_type: signedModal.file?.type,
        signed_folder_path: buildSignedFolderPath(),
      });
      showToast("Oferta firmada registrada", "success");
      setSignedModal({ open: false, loading: false, file: null });
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo subir la oferta firmada", "error");
      setSignedModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleManagerReject = async () => {
    if (!selectedRequest) return;
    setProcessingAction({ id: selectedRequest.id, type: "reject" });
    try {
      await uploadPrivateSignedOffer(selectedRequest.id, { decision: "reject" });
      showToast("Oferta rechazada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo rechazar la oferta", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* 1️⃣ HERO HEADER */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-blue-700 p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-3">
              <FiLayers /> Compras Privadas
            </h1>
            <p className="text-sm opacity-90 mt-1">
              Pipeline privado desde comercial hasta cierre legal y ACP
            </p>
          </div>

          <div className="flex items-center gap-2">
            <FiFilter />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg bg-white/90 px-3 py-2 text-sm text-gray-800"
            >
              <option value="all">Todos los estados</option>
              {STATUS_DEFINITIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              variant="ghost"
              leftIcon={FiRefreshCw}
              loading={loading}
              onClick={() =>
                fetchPrivatePurchases({
                  status: statusFilter !== "all" ? statusFilter : undefined,
                })
              }
            >
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* 2️⃣ STATUS OVERVIEW */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {summary.map((chunk) => (
          <Card key={chunk.value} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{chunk.label}</p>
              <FiActivity className="text-gray-400" />
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{chunk.count}</p>
          </Card>
        ))}
      </div>

      {/* 3️⃣ PIPELINE TABLE */}
      <Card className="overflow-hidden shadow-lg">
        <div className="bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">
          Solicitudes privadas
        </div>

        <div className="overflow-x-auto bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Creado por</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center">
                    Cargando solicitudes...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-gray-500">
                    No existen solicitudes privadas
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className={`cursor-pointer hover:bg-blue-50 ${req.id === selectedId ? "bg-blue-50" : ""}`}
                    onClick={() => setSelectedId(req.id)}
                  >
                    <td className="px-4 py-3 font-semibold">{req.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {req.client_snapshot?.commercial_name || "Cliente temporal"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {req.client_snapshot?.client_email || "Sin correo"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-[2px] text-[11px] font-semibold">
                        {req.client_type || req.client_snapshot?.client_type || "Privado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-[2px] text-[11px] font-semibold ${statusLookup[req.status]?.accent || "bg-gray-100 text-gray-600"}`}
                      >
                        {statusLookup[req.status]?.label || req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{req.created_by_email || req.created_by || "Anónimo"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(req.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDetailOpen(req);
                        }}
                        icon={<FiChevronDown />}
                      >
                        Detalle
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Detalle seleccionado</p>
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedRequest?.client_snapshot?.commercial_name || "Selecciona una solicitud"}
            </h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedRequest ? statusLookup[selectedRequest.status]?.accent : "bg-gray-100 text-gray-500"}`}>
            {selectedRequest ? statusLookup[selectedRequest.status]?.label || selectedRequest.status : "Sin selección"}
          </span>
        </div>

        {selectedRequest ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">Cliente</p>
                <p className="text-lg font-semibold text-gray-900">{selectedRequest.client_snapshot?.commercial_name}</p>
                <p className="text-xs text-gray-500">{selectedRequest.client_snapshot?.client_identifier || "Sin identificador"}</p>
                <p className="text-xs text-gray-500">{selectedRequest.client_snapshot?.client_email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">Equipos</p>
                <p className="text-sm font-semibold text-gray-900">
                  {Array.isArray(selectedRequest.equipment) ? selectedRequest.equipment.length : 0} elementos
                </p>
                <p className="text-xs text-gray-500">
                  {selectedRequest.equipment?.map((item) => item.name || item.label || "Sin nombre").join(", ") ||
                    "Sin detalles"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">Notas</p>
                <p className="text-sm text-gray-600">{selectedRequest.notes || "Sin notas adicionales"}</p>
              </div>
            </div>

            {selectedRequest.offer_document_id && (
              <a
                href={`https://drive.google.com/file/d/${selectedRequest.offer_document_id}/view`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
              >
                <FiFileText /> Ver oferta enviada
              </a>
            )}
            {selectedRequest.offer_signed_document_id && (
              <a
                href={`https://drive.google.com/file/d/${selectedRequest.offer_signed_document_id}/view`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-green-600 hover:underline"
              >
                <FiUpload /> Oferta firmada disponible
              </a>
            )}

            {isBackofficeUser ? (
              <div className="flex flex-wrap gap-2">
                {(selectedRequest.status === "pending_commercial" ||
                  selectedRequest.status === "pending_backoffice" ||
                  selectedRequest.status === "rejected") && (
                  <Button onClick={() => setOfferModal({ open: true, loading: false })} variant="primary">
                    <FiSend /> Enviar oferta
                  </Button>
                )}
              </div>
            ) : isManagerUser ? (
              <div className="flex flex-wrap gap-2">
                {(selectedRequest.status === "pending_manager_signature" ||
                  selectedRequest.status === "offer_sent") && (
                  <Button onClick={() => setSignedModal({ open: true, loading: false, file: null })} variant="success">
                    <FiUpload /> Aprobar y firmar
                  </Button>
                )}
                {(selectedRequest.status === "pending_manager_signature" ||
                  selectedRequest.status === "offer_sent") && (
                  <Button
                    variant="danger"
                    onClick={handleManagerReject}
                    loading={processingAction?.type === "reject" && processingAction?.id === selectedRequest.id}
                  >
                    Rechazar
                  </Button>
                )}
                {selectedRequest.status === "pending_manager_signature" && (
                  <p className="text-xs text-gray-500">Pendiente de firma de jefe comercial.</p>
                )}
              </div>
            ) : isPureCommercial ? (
              <div className="flex flex-wrap gap-2">
                <p className="text-xs text-gray-500">
                  Espera la oferta firmada por jefe comercial para presentarla al cliente.
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Este panel solo muestra el estado de la solicitud; Backoffice completar&aacute; los siguientes pasos.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Selecciona una solicitud para ver acciones disponibles.</p>
        )}
      </Card>

      <Modal
        open={offerModal.open}
        onClose={() => setOfferModal({ open: false, loading: false, file: null })}
        title="Enviar oferta"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Sube el documento de oferta sin firma de cliente. Se guardará en Drive en{" "}
            <span className="font-semibold">/Ofertas Sin Firmar/&lt;comercial&gt;/&lt;cliente&gt;</span> y se notificará a comercial/jefe.
          </p>
          <div className="text-[11px] text-gray-500">
            Ruta destino: <span className="font-mono">{buildUnsignedFolderPath()}</span>
          </div>
          <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
            Archivo de oferta (PDF, PNG o JPG)
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(event) =>
                setOfferModal((prev) => ({
                  ...prev,
                  file: event.target.files?.[0] || null,
                }))
              }
              className="mt-1 cursor-pointer rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-xs text-gray-600"
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOfferModal({ open: false, loading: false, file: null })}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleOfferSubmit}
              loading={offerModal.loading}
              disabled={!offerModal.file}
            >
              Guardar oferta
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={signedModal.open}
        onClose={() => setSignedModal({ open: false, loading: false, file: null })}
        title="Subir oferta firmada"
        maxWidth="max-w-lg"
      >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="text-xs text-gray-500">
              {isManagerUser
                ? "Adjunta el documento firmado por jefe comercial para cerrar la revisión interna."
                : "Adjunta el documento firmado por Backoffice para enviarlo a jefe comercial."}
            </p>
          <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
            Selecciona archivo (PDF, PNG o JPG)
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(event) =>
                setSignedModal((prev) => ({
                  ...prev,
                  file: event.target.files?.[0] || null,
                }))
              }
              className="mt-1 cursor-pointer rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-xs text-gray-600"
            />
          </label>
          <div className="text-[11px] text-gray-500">
            Ruta destino firma: <span className="font-mono">{buildSignedFolderPath()}</span>
          </div>
          {signedModal.file && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-900">{signedModal.file.name}</p>
              <p>{(signedModal.file.size / 1024).toFixed(1)} KB</p>
            </div>
          )}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setSignedModal({ open: false, loading: false, file: null })}
              >
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={handleSignedUpload}
                disabled={!signedModal.file}
                loading={signedModal.loading}
              >
                Subir documento
              </Button>
            </div>
          </div>
        </Modal>

      <Modal
        open={Boolean(detailModalRequest)}
        onClose={handleDetailClose}
        title="Detalle de solicitud privada"
        maxWidth="max-w-3xl"
      >
        {detailModalRequest ? (
          <div className="space-y-5 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Solicitud</p>
                <p className="text-sm font-semibold text-gray-900 break-all">{detailModalRequest.id}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusLookup[detailModalRequest.status]?.accent || "bg-gray-100 text-gray-500"
                }`}
              >
                {statusLookup[detailModalRequest.status]?.label || detailModalRequest.status}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">Cliente</p>
                <p className="text-lg font-semibold text-gray-900">{detailModalRequest.client_snapshot?.commercial_name || "Cliente temporal"}</p>
                <p className="text-xs text-gray-500">{detailModalRequest.client_snapshot?.client_identifier || "Sin identificador"}</p>
                <p className="text-xs text-gray-500">{detailModalRequest.client_snapshot?.client_email || "Sin correo"}</p>
                <p className="text-xs text-gray-500">
                  {detailModalRequest.client_snapshot?.first_name} {detailModalRequest.client_snapshot?.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">Fecha</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(detailModalRequest.created_at)}</p>
                <p className="text-xs text-gray-500">
                  Creado por {detailModalRequest.created_by_email || detailModalRequest.created_by || "Anónimo"}
                </p>
                {detailModalRequest.client_registered_at && (
                  <p className="text-xs text-emerald-600">Cliente registrado el {formatDate(detailModalRequest.client_registered_at)}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-500">Tipo de oferta</p>
                <p className="text-sm font-semibold text-gray-900 capitalize">{detailModalRequest.offer_kind || "venta"}</p>
                <p className="text-xs text-gray-500">
                  Vigente hasta {formatDate(detailModalRequest.offer_valid_until)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Equipos ({Array.isArray(detailModalRequest.equipment) ? detailModalRequest.equipment.length : 0})</p>
              {Array.isArray(detailModalRequest.equipment) && detailModalRequest.equipment.length ? (
                <ul className="space-y-2">
                  {detailModalRequest.equipment.map((item, idx) => {
                    const typeLabel = item?.type === "cu" ? "CU" : item?.type === "new" ? "Nuevo" : (item?.type || "N/D").toUpperCase();
                    return (
                      <li
                        key={item?.id || item?.sku || idx}
                        className="flex items-start justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item?.name || item?.label || "Equipo sin nombre"}</p>
                          <p className="text-xs text-gray-500">{item?.sku || "SKU sin datos"}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-[2px] text-[11px] font-semibold text-gray-600">
                          {typeLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Sin equipos registrados en esta solicitud</p>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              <p className="text-xs uppercase tracking-widest text-gray-500">Notas y documentos</p>
              <p>{detailModalRequest.notes || "Sin notas adicionales"}</p>
              {detailModalRequest.comodato_document_id && (
                <a
                  href={`https://drive.google.com/file/d/${detailModalRequest.comodato_document_id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <FiFileText /> Documento estadístico (comodato)
                </a>
              )}
              {detailModalRequest.offer_document_id && (
                <a
                  href={`https://drive.google.com/file/d/${detailModalRequest.offer_document_id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  <FiFileText /> Oferta enviada
                </a>
              )}
              {detailModalRequest.offer_signed_document_id && (
                <a
                  href={`https://drive.google.com/file/d/${detailModalRequest.offer_signed_document_id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-green-600 hover:underline"
                >
                  <FiUpload /> Oferta firmada
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isBackofficeUser &&
                (detailModalRequest.status === "pending_commercial" ||
                  detailModalRequest.status === "pending_backoffice" ||
                  detailModalRequest.status === "rejected") && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setOfferModal({ open: true, loading: false })}
                >
                  <FiSend /> Enviar oferta
                </Button>
              )}
              {isManagerUser &&
                (detailModalRequest.status === "pending_manager_signature" ||
                  detailModalRequest.status === "offer_sent") && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setSignedModal({ open: true, loading: false, file: null })}
                  >
                    <FiUpload /> Aprobar y firmar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleManagerReject}
                    loading={processingAction?.type === "reject" && processingAction?.id === detailModalRequest.id}
                  >
                    Rechazar
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Selecciona una solicitud para ver sus detalles.</p>
        )}
      </Modal>
    </div>
  );
};

export default PrivatePurchasesPage;
