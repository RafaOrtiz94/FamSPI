import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiFileText,
  FiRefreshCw,
  FiSend,
  FiShare,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Modal from "../../../core/ui/components/Modal";
import { useAuth } from "../../../core/auth/useAuth";
import { useApi } from "../../../core/hooks/useApi";
import { useUI } from "../../../core/ui/useUI";
import {
  forwardPrivatePurchaseToAcp,
  listPrivatePurchases,
  registerPrivateClient,
  sendPrivatePurchaseOffer,
  uploadPrivateSignedOffer,
} from "../../../core/api/privatePurchasesApi";

const STATUS_DEFINITIONS = [
  { value: "pending_commercial", label: "Pendiente comercial", accent: "bg-blue-50 text-blue-700" },
  { value: "pending_backoffice", label: "Pendiente backoffice", accent: "bg-yellow-50 text-yellow-700" },
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
  });
  const [offerForm, setOfferForm] = useState({
    template_id: "",
    folder_id: "",
    document_id: "",
    data: "",
  });
  const [signedModal, setSignedModal] = useState({
    open: false,
    loading: false,
    file: null,
  });
  const [processingAction, setProcessingAction] = useState(null);
  const { role, user } = useAuth();
  const normalizedRole = (role || user?.role || user?.role_name || user?.scope || "").toLowerCase();
  const isBackofficeUser = normalizedRole.includes("backoffice");

  const privatePurchasesFetcher = useCallback(
    (params) => listPrivatePurchases(params),
    [],
  );

  const { data, loading, execute: fetchPrivatePurchases } = useApi(
    privatePurchasesFetcher,
    { errorMsg: "No se pudo cargar las solicitudes privadas" },
  );

  const requests = isBackofficeUser ? data?.rows || data || [] : [];

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
    if (!isBackofficeUser) return;
    fetchPrivatePurchases({
      status: statusFilter !== "all" ? statusFilter : undefined,
    });
  }, [fetchPrivatePurchases, statusFilter, isBackofficeUser]);

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

  const handleOfferSubmit = async () => {
    if (!selectedRequest) return;
    if (!offerForm.template_id && !offerForm.document_id) {
      showToast("Ingresa un Template ID o Document ID", "warning");
      return;
    }

    let payload = {
      template_id: offerForm.template_id || undefined,
      folder_id: offerForm.folder_id || undefined,
      document_id: offerForm.document_id || undefined,
      data: undefined,
    };

    if (offerForm.data.trim()) {
      try {
        payload.data = JSON.parse(offerForm.data);
      } catch (error) {
        showToast("El JSON de datos no es válido", "error");
        return;
      }
    }

    setOfferModal((prev) => ({ ...prev, loading: true }));
    try {
      await sendPrivatePurchaseOffer(selectedRequest.id, payload);
      showToast("Oferta registrada", "success");
      setOfferModal({ open: false, loading: false });
      setOfferForm({ template_id: "", folder_id: "", document_id: "", data: "" });
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
    if (!selectedRequest || !signedModal.file) return;
    setSignedModal((prev) => ({ ...prev, loading: true }));
    try {
      const base64 = await fileToBase64(signedModal.file);
      const base64payload = base64.split(",")[1];
      await uploadPrivateSignedOffer(selectedRequest.id, {
        signed_offer_base64: base64payload,
        file_name: signedModal.file.name,
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

  const handleRegisterClient = async () => {
    if (!selectedRequest) return;
    setProcessingAction({ id: selectedRequest.id, type: "register" });
    try {
      await registerPrivateClient(selectedRequest.id);
      showToast("Cliente marcado como registrado", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo registrar el cliente", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleForwardToAcp = async () => {
    if (!selectedRequest) return;
    setProcessingAction({ id: selectedRequest.id, type: "forward" });
    try {
      await forwardPrivatePurchaseToAcp(selectedRequest.id);
      showToast("Solicitud enviada a ACP", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar a ACP", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  return (
      <div className="space-y-6 p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiFileText className="text-blue-600" />
              Compras Privadas
            </h1>
            <p className="text-sm text-gray-500">
              Gestiona el flujo privado que empieza en comercial y termina en ACP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">Todos los estados</option>
            {STATUS_DEFINITIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
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
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {summary.map((chunk) => (
          <Card key={chunk.value} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{chunk.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{chunk.count}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto bg-white">
                <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Creado por</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-sm text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center">
                    Cargando solicitudes...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-gray-500">
                    No hay solicitudes privadas registradas
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className={`${req.id === selectedId ? "bg-blue-50" : ""} cursor-pointer hover:bg-blue-50`}
                    onClick={() => setSelectedId(req.id)}
                  >
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">{req.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {req.client_snapshot?.commercial_name || "Cliente temporal"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {req.client_snapshot?.client_email || "Sin correo"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-[2px] text-[11px] font-semibold text-gray-600">
                        {req.client_type || req.client_snapshot?.client_type || "Privado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-[2px] text-[11px] font-semibold ${statusLookup[req.status]?.accent || "bg-gray-100 text-gray-600"}`}
                      >
                        {statusLookup[req.status]?.label || req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{req.created_by_email || req.created_by || "Anónimo"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(req.created_at)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={req.id === selectedId ? "secondary" : "ghost"}
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
                {selectedRequest.status === "offer_sent" && (
                  <Button onClick={() => setSignedModal({ open: true, loading: false, file: null })} variant="success">
                    <FiUpload /> Registrar oferta firmada
                  </Button>
                )}
                {selectedRequest.status === "offer_signed" && (
                  <Button
                    variant="secondary"
                    onClick={handleRegisterClient}
                    loading={processingAction?.type === "register" && processingAction?.id === selectedRequest.id}
                  >
                    <FiUsers /> Registrar cliente
                  </Button>
                )}
                {selectedRequest.status === "client_registered" && (
                  <Button
                    variant="outline"
                    onClick={handleForwardToAcp}
                    loading={processingAction?.type === "forward" && processingAction?.id === selectedRequest.id}
                  >
                    <FiShare /> Enviar a ACP
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Este panel solo muestra el estado de la solicitud; Backoffice completará los siguientes pasos.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Selecciona una solicitud para ver acciones disponibles.</p>
        )}
      </Card>

      <Modal
        open={offerModal.open}
        onClose={() => setOfferModal({ open: false, loading: false })}
        title="Enviar oferta"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Puedes usar una plantilla existente (template_id) o enlazar un documento creado (document_id).
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">
              Template ID
              <input
                value={offerForm.template_id}
                onChange={(event) =>
                  setOfferForm((prev) => ({ ...prev, template_id: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Document ID existente
              <input
                value={offerForm.document_id}
                onChange={(event) =>
                  setOfferForm((prev) => ({ ...prev, document_id: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="text-sm font-semibold text-gray-700">
            Folder ID (opcional)
            <input
              value={offerForm.folder_id}
              onChange={(event) =>
                setOfferForm((prev) => ({ ...prev, folder_id: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Datos (JSON) para reemplazar etiquetas en el documento
            <textarea
              value={offerForm.data}
              onChange={(event) =>
                setOfferForm((prev) => ({ ...prev, data: event.target.value }))
              }
              placeholder='{"cliente":"ACME","fecha":"2025-10-01"}'
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOfferModal({ open: false, loading: false })}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleOfferSubmit}
              loading={offerModal.loading}
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
            Adjunta el documento firmado para adjuntarlo a la solicitud y notificará automáticamente.
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
              {(detailModalRequest.status === "pending_commercial" ||
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
              {detailModalRequest.status === "offer_sent" && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => setSignedModal({ open: true, loading: false, file: null })}
                >
                  <FiUpload /> Registrar oferta firmada
                </Button>
              )}
              {detailModalRequest.status === "offer_signed" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRegisterClient}
                  loading={processingAction?.type === "register" && processingAction?.id === detailModalRequest.id}
                >
                  <FiUsers /> Registrar cliente
                </Button>
              )}
              {detailModalRequest.status === "client_registered" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleForwardToAcp}
                  loading={processingAction?.type === "forward" && processingAction?.id === detailModalRequest.id}
                >
                  <FiShare /> Enviar a ACP
                </Button>
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
