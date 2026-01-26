import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import Button from "../../core/ui/components/Button";
import ProcessingOverlay from "../../core/ui/components/ProcessingOverlay";
import { useUI } from "../../core/ui/useUI";

// Import shared infrastructure
import { useCreatePurchaseRequest } from "./useCreatePurchaseRequest";
import { getPurchaseMeta } from "./purchaseRequestsApi";

// Submission steps for progress overlay - dynamic based on mode
const getSubmissionSteps = (isPrivateDirect) => [
    { id: "validating", label: "Validando información" },
    { id: "preparing", label: "Preparando solicitud" },
    { id: "submitting", label: isPrivateDirect ? "Creando solicitud privada" : "Enviando a ACP" },
];

// LIS Options per mode (legacy support)
const LIS_OPTIONS_BY_MODE = {
    acp_required: [
        { value: "Cobas Infinity", label: "Cobas Infinity" },
        { value: "Orion", label: "Orion" },
    ]
};

/**
 * NewPurchaseRequestModal - Single Source of Truth for Purchase Requests
 *
 * Unifies PurchaseHandoffWidget and PublicPurchaseRequestModal into one reusable component.
 *
 * Props:
 * - isOpen, onClose: Modal controls
 * - mode: 'acp_required' (only supported mode since backend doesn't support auto-assignment)
 * - source: 'dashboard' | 'solicitudes_publicas'
 * - intent: 'provider_handoff'
 * - onSuccess(result): Success callback
 * - hideButton: Hide internal button (for external control)
 * - onOpenChange: External open state change callback
 */

const NewPurchaseRequestModal = ({
    isOpen: externalIsOpen,
    onOpenChange,
    hideButton = false,
    mode = 'acp_required',
    source = 'dashboard',
    intent = 'provider_handoff',
    onSuccess
}) => {
    // Determinar si es modo privado directo
    const isPrivateDirect = mode === 'private_direct';
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

    // Form state - only acp_required mode supported
    const [form, setForm] = useState({
        clientId: "",
        equipment: [],
        assignedTo: "",
        requiresLis: false,
        lisOption: "",
        notes: ""
    });

    const selectedClient = useMemo(
        () => meta.clients.find((c) => `${c.id}` === `${form.clientId}`),
        [meta.clients, form.clientId]
    );

    // Dynamic LIS options based on mode
    const lisOptions = LIS_OPTIONS_BY_MODE[mode] || LIS_OPTIONS_BY_MODE.acp_required;

    // Dynamic titles and texts based on source and mode
    const modalTitle = isPrivateDirect
        ? "Nueva Solicitud de Compra Privada"
        : source === 'solicitudes_publicas'
            ? "Nueva Solicitud de Compra Pública"
            : "Solicitud de compra";

    const buttonText = isPrivateDirect
        ? "Crear Solicitud Privada"
        : source === 'solicitudes_publicas'
            ? "Crear Solicitud Pública"
            : "Enviar a ACP";

    const successMessage = isPrivateDirect
        ? "Solicitud de compra privada creada correctamente"
        : source === 'solicitudes_publicas'
            ? "Solicitud de compra pública creada correctamente"
            : "Solicitud enviada al ACP Comercial";

    // Use the shared hook for creating purchase requests
    const { submitRequest } = useCreatePurchaseRequest();

    useEffect(() => {
        const loadMeta = async () => {
            setLoading(true);
            try {
                const metaRes = await getPurchaseMeta();
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

        if (isOpen) {
            loadMeta();
        }
    }, [isOpen, showToast]);

    useEffect(() => {
        if (!form.assignedTo && meta.acpUsers?.length && mode === 'acp_required') {
            setForm((prev) => ({ ...prev, assignedTo: meta.acpUsers[0].id }));
        }
    }, [meta.acpUsers, form.assignedTo, mode]);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setForm({
                clientId: "",
                equipment: [],
                assignedTo: "",
                requiresLis: false,
                lisOption: "",
                notes: ""
            });
        }
    }, [isOpen]);

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
        // Basic validations
        if (!form.clientId || !form.equipment.length) {
            showToast("Selecciona un cliente y al menos un equipo", "warning");
            return;
        }

        // ACP validation - only required for public purchases
        if (!isPrivateDirect && !form.assignedTo) {
            showToast("Debes asignar la solicitud a un ACP Comercial", "warning");
            return;
        }

        // LIS validation
        if (form.requiresLis && !form.lisOption) {
            showToast("Selecciona la plataforma LIS solicitada", "warning");
            return;
        }

        setProgressStep("validating");
        setCreating(true);

        try {
            setProgressStep("preparing");

            // Prepare equipment payload
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
            const result = await submitRequest({
                clientId: form.clientId,
                clientName: selectedClient?.name,
                clientEmail: selectedClient?.client_email,
                assignedTo: form.assignedTo,
                equipment: equipmentPayload,
                notes: form.notes,
                requiresLis: form.requiresLis,
                lisOption: form.lisOption,
                _metadata: {
                    source,
                    intent,
                    mode,
                    version: '2.0'
                }
            });

            showToast(successMessage, "success");
            onSuccess?.(result);
            setIsOpen(false);

            // Reset form
            setForm({
                clientId: "",
                equipment: [],
                assignedTo: meta.acpUsers?.[0]?.id || "",
                requiresLis: false,
                lisOption: "",
                notes: ""
            });

        } catch (error) {
            console.error(error);
            const errorMessage = error.response?.data?.message || "No se pudo crear la solicitud";
            showToast(errorMessage, "error");
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
                            {source === 'solicitudes_publicas' ? 'Nueva Solicitud de Compra' : 'Nueva Solicitud de Compra'}
                        </p>
                        <p className="text-sm text-gray-700">
                            {source === 'solicitudes_publicas'
                                ? 'Proceso formal vía Administración de Contratación Pública'
                                : 'Envía al ACP Comercial para gestionar proveedor'
                            }
                        </p>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => setIsOpen(true)}>
                        {source === 'solicitudes_publicas' ? 'Nueva Compra Pública' : 'Abrir Formulario'}
                    </Button>
                </div>
            )}

            {isOpen && (
                <>
                    {creating && (
                        <ProcessingOverlay
                            className="z-[1010]"
                            title="Procesando solicitud de compra"
                            steps={getSubmissionSteps(isPrivateDirect)}
                            activeStep={progressStep || getSubmissionSteps(isPrivateDirect)[getSubmissionSteps(isPrivateDirect).length - 1].id}
                        />
                    )}
                    <Dialog open onClose={() => setIsOpen(false)} className="fixed inset-0 z-[999]">
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
                        <div className="fixed inset-0 overflow-y-auto">
                            <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
                                <Dialog.Panel className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
                                    <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
                                            <p className="text-sm text-gray-500">
                                                {source === 'solicitudes_publicas'
                                                    ? 'Proceso formal vía Administración de Contratación Pública'
                                                    : 'Selecciona cliente, equipos y requisitos de LIS'
                                                }
                                            </p>
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
                                            <Button
                                                className="px-3 py-1.5 text-xs"
                                                loading={creating}
                                                onClick={handleSubmit}
                                                disabled={loading || creating}
                                            >
                                                {buttonText}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-4 overflow-y-auto px-6 py-4 max-h-[calc(100vh-200px)] sm:px-8 sm:py-5">
                                        {/* Client Selection */}
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

                                        {/* ACP Assignment - only for public purchases */}
                                        {form.clientId && !isPrivateDirect && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Asignar a
                                                </label>
                                                <select
                                                    className="w-full border-gray-300 rounded-lg text-sm"
                                                    value={form.assignedTo}
                                                    onChange={(e) => setForm((prev) => ({ ...prev, assignedTo: e.target.value }))}
                                                    disabled={loading}
                                                    required
                                                >
                                                    <option value="">
                                                        Selecciona un ACP Comercial
                                                    </option>
                                                    {meta.acpUsers.map((user) => (
                                                        <option key={user.id} value={user.id}>
                                                            {user.fullname || user.name || user.email}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Equipment Selection */}
                                        {form.clientId && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Equipos solicitados</label>
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                                    {meta.equipment.map((item) => {
                                                        const selected = form.equipment.find((eq) => eq.id === item.id);
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={`border rounded-lg p-3 cursor-pointer transition ${selected ? "border-blue-500 bg-blue-50" : "border-gray-200"
                                                                    }`}
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
                                                                                className={`px-2 py-1 rounded text-xs border ${selected.type === "new" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700"
                                                                                    }`}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    updateEquipmentType(item.id, "new");
                                                                                }}
                                                                            >
                                                                                Nuevo
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className={`px-2 py-1 rounded text-xs border ${selected.type === "cu" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700"
                                                                                    }`}
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
                                        )}

                                        {/* LIS Configuration */}
                                        <div>
                                            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    checked={form.requiresLis}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            requiresLis: e.target.checked,
                                                            lisOption: e.target.checked ? prev.lisOption : ""
                                                        }))
                                                    }
                                                />
                                                El cliente requiere LIS
                                            </label>
                                            {form.requiresLis && (
                                                <div className="mt-2">
                                                    <label className="block text-sm text-gray-600 mb-1">
                                                        Plataforma LIS *
                                                    </label>
                                                    <select
                                                        className="w-full border-gray-300 rounded-lg text-sm"
                                                        value={form.lisOption}
                                                        onChange={(e) => setForm((prev) => ({ ...prev, lisOption: e.target.value }))}
                                                    >
                                                        <option value="">Selecciona una opción</option>
                                                        {lisOptions.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Notes */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Notas (opcional)
                                            </label>
                                            <textarea
                                                className="w-full border-gray-300 rounded-lg text-sm"
                                                rows={form.requiresLis ? 3 : 4}
                                                value={form.notes}
                                                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                                                placeholder={
                                                    isPrivateDirect
                                                        ? "Añade contexto relevante para la gestión directa con el cliente"
                                                        : "Añade contexto relevante para el ACP Comercial"
                                                }
                                            />
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

export default NewPurchaseRequestModal;
