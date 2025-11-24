import React, { useEffect, useMemo, useState } from "react";
import {
  createEquipmentPurchase,
  getEquipmentPurchaseMeta,
  listEquipmentPurchases,
  requestProforma,
  reserveEquipment,
  saveProviderResponse,
  uploadContract,
  uploadProforma,
  uploadSignedProforma,
} from "../../../core/api/equipmentPurchasesApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";

const STATUS_LABELS = {
  waiting_provider_response: "Esperando respuesta de proveedor",
  no_stock: "Sin stock",
  waiting_proforma: "Solicitando proforma",
  proforma_received: "Proforma recibida",
  waiting_signed_proforma: "Esperando proforma firmada",
  pending_contract: "Pendiente contrato",
  completed: "Completado",
};

const EquipmentPurchaseWidget = () => {
  const { showToast } = useUI();
  const [meta, setMeta] = useState({ clients: [], equipment: [] });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ clientId: "", providerEmail: "", equipmentIds: [], notes: "" });
  const [responseDraft, setResponseDraft] = useState({ open: false, id: null, outcome: "new", notes: "" });
  const [inspectionDraft, setInspectionDraft] = useState({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [metaRes, listRes] = await Promise.all([
        getEquipmentPurchaseMeta(),
        listEquipmentPurchases(),
      ]);
      setMeta({ clients: metaRes.clients || [], equipment: metaRes.equipment || [] });
      setRequests(listRes || []);
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar las solicitudes de compra", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const selectedClient = useMemo(
    () => meta.clients.find((c) => `${c.id}` === `${form.clientId}`),
    [meta.clients, form.clientId],
  );

  const toggleEquipment = (id) => {
    setForm((prev) => {
      const exists = prev.equipmentIds.includes(id);
      return {
        ...prev,
        equipmentIds: exists
          ? prev.equipmentIds.filter((x) => x !== id)
          : [...prev.equipmentIds, id],
      };
    });
  };

  const handleCreate = async () => {
    if (!form.clientId || !form.providerEmail || !form.equipmentIds.length) {
      showToast("Cliente, proveedor y equipos son obligatorios", "warning");
      return;
    }
    setCreating(true);
    try {
      const equipmentPayload = meta.equipment
        .filter((eq) => form.equipmentIds.includes(eq.id))
        .map((eq) => ({ id: eq.id, name: eq.name, sku: eq.sku, serial: eq.serial }));

      await createEquipmentPurchase({
        client_id: form.clientId,
        client_name: selectedClient?.name,
        client_email: selectedClient?.client_email,
        provider_email: form.providerEmail,
        equipment: equipmentPayload,
        notes: form.notes,
      });
      showToast("Solicitud creada y correo enviado al proveedor", "success");
      setForm({ clientId: "", providerEmail: "", equipmentIds: [], notes: "" });
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo crear la solicitud", "error");
    } finally {
      setCreating(false);
    }
  };

  const openResponse = (id) => setResponseDraft({ open: true, id, outcome: "new", notes: "" });

  const submitResponse = async () => {
    try {
      await saveProviderResponse(responseDraft.id, {
        outcome: responseDraft.outcome,
        notes: responseDraft.notes,
      });
      showToast("Respuesta registrada", "success");
      setResponseDraft({ open: false, id: null, outcome: "new", notes: "" });
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar la respuesta", "error");
    }
  };

  const handleRequestProforma = async (id) => {
    try {
      await requestProforma(id);
      showToast("Proforma solicitada", "success");
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo solicitar la proforma", "error");
    }
  };

  const handleUpload = async (id, action, file, extra = {}) => {
    if (!file) {
      showToast("Selecciona un archivo", "warning");
      return;
    }
    try {
      if (action === "proforma") await uploadProforma(id, file);
      if (action === "signed") await uploadSignedProforma(id, { file, ...extra });
      if (action === "contract") await uploadContract(id, file);
      showToast("Archivo cargado", "success");
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar el archivo", "error");
    }
  };

  const handleReserve = async (id) => {
    try {
      await reserveEquipment(id);
      showToast("Reserva enviada y recordatorio agendado", "success");
      loadAll();
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar la reserva", "error");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nueva solicitud de compra</h2>
            <p className="text-sm text-gray-500">Disponible solo para ACP Comercial</p>
          </div>
          <Button onClick={loadAll} variant="ghost">Refrescar</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Cliente</label>
            <select
              className="w-full mt-1 rounded-lg border border-gray-300 p-2"
              value={form.clientId}
              onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
            >
              <option value="">Selecciona un cliente</option>
              {meta.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Proveedor (correo)</label>
            <input
              type="email"
              className="w-full mt-1 rounded-lg border border-gray-300 p-2"
              value={form.providerEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, providerEmail: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Equipos</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-48 overflow-auto border rounded-lg p-3">
            {meta.equipment.map((eq) => (
              <label key={eq.id} className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.equipmentIds.includes(eq.id)}
                  onChange={() => toggleEquipment(eq.id)}
                />
                <div>
                  <p className="font-medium">{eq.name}</p>
                  <p className="text-xs text-gray-500">SKU: {eq.sku} {eq.serial ? `| Serie ${eq.serial}` : ""}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm text-gray-600">Notas al proveedor</label>
          <textarea
            className="w-full mt-1 rounded-lg border border-gray-300 p-2"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        <div className="mt-4">
          <Button onClick={handleCreate} loading={creating}>Enviar correo de disponibilidad</Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Solicitudes en curso</h2>
          {loading && <span className="text-sm text-gray-500">Actualizando...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2">Cliente</th>
                <th className="py-2">Proveedor</th>
                <th className="py-2">Equipos</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b">
                  <td className="py-2">
                    <div className="font-medium">{req.client_name}</div>
                    <div className="text-xs text-gray-500">Creado: {new Date(req.created_at).toLocaleString()}</div>
                  </td>
                  <td className="py-2 text-gray-700">{req.provider_email}</td>
                  <td className="py-2 text-gray-700">
                    <ul className="list-disc pl-4">
                      {(req.equipment || []).map((eq, idx) => (
                        <li key={idx}>{eq.name || eq.sku}</li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {req.proforma_file_link && <a className="text-blue-600 underline" href={req.proforma_file_link} target="_blank" rel="noreferrer">Proforma</a>}
                      {req.signed_proforma_file_link && <a className="text-blue-600 underline" href={req.signed_proforma_file_link} target="_blank" rel="noreferrer">Proforma firmada</a>}
                      {req.contract_file_link && <a className="text-blue-600 underline" href={req.contract_file_link} target="_blank" rel="noreferrer">Contrato</a>}
                    </div>
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {req.status === "waiting_provider_response" && (
                        <Button size="sm" onClick={() => openResponse(req.id)}>Registrar respuesta</Button>
                      )}
                      {req.status === "waiting_proforma" && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => handleRequestProforma(req.id)}>Pedir proforma</Button>
                          <label className="text-xs text-gray-600 flex items-center gap-2">
                            <input type="file" onChange={(e) => setInspectionDraft({ ...inspectionDraft, [`proforma-${req.id}`]: e.target.files?.[0] })} />
                            <Button
                              size="sm"
                              onClick={() => handleUpload(req.id, "proforma", inspectionDraft[`proforma-${req.id}`])}
                            >
                              Subir proforma
                            </Button>
                          </label>
                        </>
                      )}
                      {req.status === "proforma_received" && (
                        <Button size="sm" onClick={() => handleReserve(req.id)}>Enviar reserva</Button>
                      )}
                      {req.status === "waiting_signed_proforma" && (
                        <div className="space-y-1">
                          <label className="text-xs text-gray-600 flex items-center gap-2">
                            <input
                              type="file"
                              onChange={(e) => setInspectionDraft({ ...inspectionDraft, [`signed-${req.id}`]: e.target.files?.[0] })}
                            />
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            <input
                              type="date"
                              className="border rounded p-1"
                              placeholder="Fecha mínima inspección"
                              onChange={(e) => setInspectionDraft((prev) => ({ ...prev, [`min-${req.id}`]: e.target.value }))}
                            />
                            <input
                              type="date"
                              className="border rounded p-1"
                              placeholder="Fecha máxima"
                              onChange={(e) => setInspectionDraft((prev) => ({ ...prev, [`max-${req.id}`]: e.target.value }))}
                            />
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                onChange={(e) => setInspectionDraft((prev) => ({ ...prev, [`kit-${req.id}`]: e.target.checked }))}
                              />
                              Incluye kit de arranque
                            </label>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleUpload(req.id, "signed", inspectionDraft[`signed-${req.id}`], {
                              inspection_min_date: inspectionDraft[`min-${req.id}`],
                              inspection_max_date: inspectionDraft[`max-${req.id}`],
                              includes_starter_kit: inspectionDraft[`kit-${req.id}`],
                            })}
                          >
                            Subir proforma firmada
                          </Button>
                        </div>
                      )}
                      {req.status === "pending_contract" && (
                        <label className="text-xs text-gray-600 flex items-center gap-2">
                          <input
                            type="file"
                            onChange={(e) => setInspectionDraft({ ...inspectionDraft, [`contract-${req.id}`]: e.target.files?.[0] })}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleUpload(req.id, "contract", inspectionDraft[`contract-${req.id}`])}
                          >
                            Subir contrato
                          </Button>
                        </label>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-gray-500">Sin solicitudes registradas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {responseDraft.open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-md">
            <h3 className="text-lg font-semibold">Respuesta del proveedor</h3>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="outcome"
                  checked={responseDraft.outcome === "new"}
                  onChange={() => setResponseDraft((prev) => ({ ...prev, outcome: "new" }))}
                />
                Equipos nuevos
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="outcome"
                  checked={responseDraft.outcome === "cu"}
                  onChange={() => setResponseDraft((prev) => ({ ...prev, outcome: "cu" }))}
                />
                CU (mantener CU)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="outcome"
                  checked={responseDraft.outcome === "none"}
                  onChange={() => setResponseDraft((prev) => ({ ...prev, outcome: "none" }))}
                />
                No hay equipo
              </label>
              <textarea
                className="w-full border rounded p-2 mt-2"
                rows={3}
                placeholder="Detalles del proveedor"
                value={responseDraft.notes}
                onChange={(e) => setResponseDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setResponseDraft({ open: false, id: null, outcome: "new", notes: "" })}>
                Cancelar
              </Button>
              <Button onClick={submitResponse}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentPurchaseWidget;
