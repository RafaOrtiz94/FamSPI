import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import { createEquipmentPurchase, getEquipmentPurchaseMeta } from "../../../core/api/equipmentPurchasesApi";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/useUI";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";

const LIS_OPTIONS = [
  { value: "Cobas Infinity", label: "Cobas Infinity" },
  { value: "Orion", label: "Orion" },
];

const submissionSteps = [
  { id: "validating", label: "Validando información" },
  { id: "preparing", label: "Preparando solicitud" },
  { id: "submitting", label: "Enviando a ACP" },
];

const PurchaseHandoffWidget = ({ isOpen: externalIsOpen, onOpenChange, hideButton = false }) => {
  const { showToast } = useUI();
  const [meta, setMeta] = useState({ clients: [], equipment: [], acpUsers: [] });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [progressStep, setProgressStep] = useState(null);

  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (value) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalIsOpen(value);
    }
  };
  const [form, setForm] = useState({
    clientId: "",
    equipment: [],
    assignedTo: "",
    requiresLis: false,
    lisOption: "",
    notes: "",
  });

  const selectedClient = useMemo(
    () => meta.clients.find((c) => `${c.id}` === `${form.clientId}`),
    [meta.clients, form.clientId]
  );

  useEffect(() => {
    const loadMeta = async () => {
      setLoading(true);
      try {
        const metaRes = await getEquipmentPurchaseMeta();
        setMeta({
          clients: metaRes.clients || [],
          equipment: metaRes.equipment || [],
          acpUsers: metaRes.acp_users || [],
        });
      } catch (error) {
        console.error(error);
        showToast("No se pudo cargar el catálogo de compras", "error");
      } finally {
        setLoading(false);
      }
    };

    loadMeta();
  }, [showToast]);

  useEffect(() => {
    if (!form.assignedTo && meta.acpUsers?.length) {
      setForm((prev) => ({ ...prev, assignedTo: meta.acpUsers[0].id }));
    }
  }, [meta.acpUsers, form.assignedTo]);

  const toggleEquipment = (id) => {
    setForm((prev) => {
      const exists = prev.equipment.find((eq) => eq.id === id);
      return {
        ...prev,
        equipment: exists
          ? prev.equipment.filter((eq) => eq.id !== id)
          : [...prev.equipment, { id, type: "new" }],
      };
    });
  };

  const updateEquipmentType = (id, type) => {
    setForm((prev) => ({
      ...prev,
      equipment: prev.equipment.map((eq) => (eq.id === id ? { ...eq, type } : eq)),
    }));
  };

  const handleSubmit = async () => {
    if (!form.clientId || !form.equipment.length) {
      showToast("Selecciona un cliente y al menos un equipo", "warning");
      return;
    }
    if (!form.assignedTo) {
      showToast("Debes asignar la solicitud a un ACP Comercial", "warning");
      return;
    }
    if (form.requiresLis && !form.lisOption) {
      showToast("Selecciona la plataforma LIS solicitada", "warning");
      return;
    }

    setProgressStep("validating");
    setCreating(true);
    try {
      setProgressStep("preparing");
      const equipmentPayload = form.equipment.map((item) => {
        const catalogItem = meta.equipment.find((eq) => eq.id === item.id) || {};
        return {
          id: catalogItem.id,
          name: catalogItem.name,
          sku: catalogItem.sku,
          serial: catalogItem.serial,
          type: item.type,
        };
      });

      setProgressStep("submitting");
      await createEquipmentPurchase({
        client_id: form.clientId,
        client_name: selectedClient?.name,
        client_email: selectedClient?.client_email,
        assigned_to: form.assignedTo,
        equipment: equipmentPayload,
        notes: form.notes,
        extra: {
          requires_lis: form.requiresLis,
          lis_system: form.requiresLis ? form.lisOption : null,
        },
      });

      showToast("Solicitud enviada al ACP Comercial", "success");
      setIsOpen(false);
      setForm({
        clientId: "",
        equipment: [],
        assignedTo: meta.acpUsers?.[0]?.id || "",
        requiresLis: false,
        lisOption: "",
        notes: "",
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo crear la solicitud", "error");
    } finally {
      setCreating(false);
      setProgressStep(null);
    }
  };

  return (
    <>
      {!hideButton && (
        <div className="flex flex-col justify-between h-full">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Nueva Solicitud de Compra
            </p>
            <p className="text-sm text-gray-700">
              Envía al ACP Comercial para gestionar proveedor
            </p>
          </div>
          <Button size="sm" className="w-full" onClick={() => setIsOpen(true)}>
            Abrir Formulario
          </Button>
        </div>
      )}

      {isOpen && (
        <>
          {creating && (
            <ProcessingOverlay
              className="z-[1010]"
              title="Procesando solicitud de compra"
              steps={submissionSteps}
              activeStep={progressStep || submissionSteps[submissionSteps.length - 1].id}
            />
          )}
          <Dialog open onClose={() => setIsOpen(false)} className="fixed inset-0 z-[999]">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
              <Dialog.Panel className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Solicitud de compra</h2>
                    <p className="text-sm text-gray-500">Selecciona cliente, equipos y requisitos de LIS</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setIsOpen(false)}
                      disabled={creating}
                    >
                      Cancelar
                    </Button>
                    <Button className="px-3 py-1.5 text-xs" loading={creating} onClick={handleSubmit} disabled={loading || creating}>
                      Enviar a ACP
                    </Button>
                  </div>
                </div>
                <div className="space-y-4 overflow-y-auto px-6 py-4 max-h-[calc(100vh-200px)] sm:px-8 sm:py-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                      <select
                        className="w-full border-gray-300 rounded-lg text-sm"
                        value={form.clientId}
                        onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                        disabled={loading}
                      >
                        <option value="">Selecciona un cliente</option>
                        {meta.clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
                      <select
                        className="w-full border-gray-300 rounded-lg text-sm"
                        value={form.assignedTo}
                        onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
                        disabled={loading}
                      >
                        <option value="">Selecciona un ACP Comercial</option>
                        {meta.acpUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullname || user.name || user.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Equipos solicitados</label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {meta.equipment.map((item) => {
                        const selected = form.equipment.find((eq) => eq.id === item.id);
                        return (
                          <div
                            key={item.id}
                            className={`border rounded-lg p-3 cursor-pointer transition ${selected ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
                            onClick={() => toggleEquipment(item.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm text-gray-900">{item.name || item.sku}</p>
                                <p className="text-xs text-gray-500">{item.sku}</p>
                              </div>
                              <input type="checkbox" checked={!!selected} readOnly />
                            </div>
                            {selected && (
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <span className="text-gray-500">Tipo:</span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className={`px-2 py-1 rounded text-xs border ${selected.type === "new" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700"}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateEquipmentType(item.id, "new");
                                    }}
                                  >
                                    Nuevo
                                  </button>
                                  <button
                                    type="button"
                                    className={`px-2 py-1 rounded text-xs border ${selected.type === "cu" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700"}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateEquipmentType(item.id, "cu");
                                    }}
                                  >
                                    CU
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.requiresLis}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, requiresLis: e.target.checked, lisOption: e.target.checked ? prev.lisOption : "" }))
                          }
                        />
                        El cliente requiere LIS
                      </label>
                      {form.requiresLis && (
                        <div className="mt-2">
                          <label className="block text-sm text-gray-600 mb-1">Plataforma LIS</label>
                          <select
                            className="w-full border-gray-300 rounded-lg text-sm"
                            value={form.lisOption}
                            onChange={(e) => setForm((prev) => ({ ...prev, lisOption: e.target.value }))}
                          >
                            <option value="">Selecciona una opción</option>
                            {LIS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                      <textarea
                        className="w-full border-gray-300 rounded-lg text-sm"
                        rows={form.requiresLis ? 3 : 4}
                        value={form.notes}
                        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Añade contexto relevante para el ACP Comercial"
                      />
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
        </>
      )}
    </>
  );
};

export default PurchaseHandoffWidget;
