import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { FiLink, FiSave, FiPlus, FiTrash2 } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import Card from "../../../../../core/ui/components/Card";

// EMPTY SCHEMA - Initialize with no default values
const EMPTY_SCHEMA = {
    lisIncludes: false,
    lisProvider: "",
    lisIncludesHardware: false,
    lisMonthlyPatients: "",
    lisInterfaceSystem: "",
    lisInterfaceProvider: "",
    lisInterfaceHardware: "",
};

/**
 * LISSection - Workspace section for Laboratory Information System integration
 */
const LISSection = ({ businessCase, permissions = {}, ownership = {}, onSave }) => {
    const { id: bcId } = useParams();
    const { showToast } = useUI();
    const [saving, setSaving] = useState(false);

    // ONE-TIME HYDRATION GUARD
    const hydratedRef = useRef(false);

    // COMPLETE SECTION DATA - All fields from businessCase, even conditional ones
    const sectionData = useMemo(() => {
        if (!businessCase?.lis_integration) return EMPTY_SCHEMA;

        return {
            lisIncludes: businessCase.lis_integration.lis_includes || false,
            lisProvider: businessCase.lis_integration.lis_provider || "",
            lisIncludesHardware: businessCase.lis_integration.lis_includes_hardware || false,
            lisMonthlyPatients: businessCase.lis_integration.lis_monthly_patients || "",
            lisInterfaceSystem: businessCase.lis_integration.lis_interface_system || "",
            lisInterfaceProvider: businessCase.lis_integration.lis_interface_provider || "",
            lisInterfaceHardware: businessCase.lis_integration.lis_interface_hardware || "",
        };
    }, [businessCase]);

    // State for dynamic interfaces (these don't come from businessCase initially)
    const [interfaces, setInterfaces] = useState([]);

    // HYDRATE INTERFACES - This comes from API, not businessCase
    useEffect(() => {
        if (!businessCase?.lis_integration?.interfaces) return;
        setInterfaces(businessCase.lis_integration.interfaces);
    }, [businessCase]);

    // Initialize state with sectionData (deterministic hydration)
    const [formData, setFormData] = useState(() => sectionData);

    // ONE-TIME HYDRATION: Reset form with complete sectionData
    useEffect(() => {
        // GUARD: Only hydrate once, when sectionData is available and different
        if (!sectionData || hydratedRef.current) return;

        console.log('LISSection: Hydrating with sectionData:', sectionData);
        setFormData(sectionData);
        hydratedRef.current = true; // Mark as hydrated - never reset again
    }, [sectionData]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddInterface = () => {
        setInterfaces((prev) => [
            ...prev,
            { id: Date.now(), equipment_name: "", interface_type: "", notes: "" },
        ]);
    };

    const handleRemoveInterface = (id) => {
        setInterfaces((prev) => prev.filter((i) => i.id !== id));
    };

    const handleInterfaceChange = (id, field, value) => {
        setInterfaces((prev) =>
            prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
        );
    };

    const handleSave = async () => {
        if (!bcId) {
            showToast("Error: No se encontró el Business Case ID", "error");
            return;
        }

        try {
            setSaving(true);
            const payload = {
                lis_includes: formData.lisIncludes,
                lis_provider: formData.lisProvider || null,
                lis_includes_hardware: formData.lisIncludesHardware,
                lis_monthly_patients: formData.lisMonthlyPatients ? parseInt(formData.lisMonthlyPatients) : null,
                lis_interface_system: formData.lisInterfaceSystem || null,
                lis_interface_provider: formData.lisInterfaceProvider || null,
                lis_interface_hardware: formData.lisInterfaceHardware || null,
                interfaces: interfaces.map((i) => ({
                    equipment_name: i.equipment_name,
                    interface_type: i.interface_type,
                    notes: i.notes,
                })),
            };

            await api.post(`/business-case/${bcId}/lis-integration`, payload);
            showToast("Integración LIS guardada", "success");
            if (onSave) onSave();
        } catch (err) {
            console.error("Error saving LIS data:", err);
            showToast("Error guardando integración LIS", "error");
        } finally {
            setSaving(false);
        }
    };

    const canEdit = permissions.canEdit !== false && ownership.canUserEdit !== false;

    return (
        <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-3xl">🔗</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Integración LIS</h2>
                        <p className="text-sm text-gray-600">Sistema de información laboratorio y interfaces</p>
                    </div>
                </div>
                {canEdit && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <FiSave size={16} />
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                )}
            </div>

            {/* LIS Toggle */}
            <Card className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">¿Incluye Sistema LIS?</h3>
                        <p className="text-sm text-gray-600">
                            Active esta opción si el contrato incluye un Sistema de Información de Laboratorio
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.lisIncludes}
                            onChange={(e) => handleChange("lisIncludes", e.target.checked)}
                            disabled={!canEdit}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </Card>

            {/* LIS Configuration */}
            {formData.lisIncludes && (
                <Card className="p-6">
                    <div className="flex items-center gap-2 border-b pb-4 mb-6">
                        <FiLink className="text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Configuración del LIS</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Provider */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Proveedor del LIS
                            </label>
                            <input
                                type="text"
                                value={formData.lisProvider}
                                onChange={(e) => handleChange("lisProvider", e.target.value)}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: Cerner, Epic, LabWare..."
                            />
                        </div>

                        {/* Monthly Patients */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Pacientes mensuales estimados
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.lisMonthlyPatients}
                                onChange={(e) => handleChange("lisMonthlyPatients", e.target.value)}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: 5000"
                            />
                        </div>

                        {/* Hardware Included */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                ¿Incluye Hardware?
                            </label>
                            <select
                                value={formData.lisIncludesHardware ? "yes" : "no"}
                                onChange={(e) => handleChange("lisIncludesHardware", e.target.value === "yes")}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            >
                                <option value="no">No</option>
                                <option value="yes">Sí</option>
                            </select>
                        </div>

                        {/* Interface System */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Sistema a Interfazar
                            </label>
                            <input
                                type="text"
                                value={formData.lisInterfaceSystem}
                                onChange={(e) => handleChange("lisInterfaceSystem", e.target.value)}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: HIS del hospital..."
                            />
                        </div>

                        {/* Interface Provider */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Proveedor de Interface
                            </label>
                            <input
                                type="text"
                                value={formData.lisInterfaceProvider}
                                onChange={(e) => handleChange("lisInterfaceProvider", e.target.value)}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: HL7 Solutions..."
                            />
                        </div>

                        {/* Interface Hardware */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">
                                Hardware de Interface
                            </label>
                            <input
                                type="text"
                                value={formData.lisInterfaceHardware}
                                onChange={(e) => handleChange("lisInterfaceHardware", e.target.value)}
                                disabled={!canEdit}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                placeholder="Ej: Servidor dedicado, PC..."
                            />
                        </div>
                    </div>
                </Card>
            )}

            {/* Equipment Interfaces */}
            {formData.lisIncludes && (
                <Card className="p-6">
                    <div className="flex items-center justify-between border-b pb-4 mb-6">
                        <h3 className="text-lg font-semibold text-gray-800">Interfaces de Equipos</h3>
                        {canEdit && (
                            <button
                                onClick={handleAddInterface}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                <FiPlus size={14} />
                                Agregar Interface
                            </button>
                        )}
                    </div>

                    {interfaces.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>No hay interfaces de equipos configuradas</p>
                            {canEdit && (
                                <button
                                    onClick={handleAddInterface}
                                    className="mt-2 text-blue-600 hover:underline"
                                >
                                    Agregar primera interface
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {interfaces.map((iface, idx) => (
                                <div
                                    key={iface.id}
                                    className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg"
                                >
                                    <span className="text-sm font-medium text-gray-500 mt-2">
                                        #{idx + 1}
                                    </span>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input
                                            type="text"
                                            value={iface.equipment_name}
                                            onChange={(e) =>
                                                handleInterfaceChange(iface.id, "equipment_name", e.target.value)
                                            }
                                            disabled={!canEdit}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            placeholder="Nombre del equipo"
                                        />
                                        <input
                                            type="text"
                                            value={iface.interface_type}
                                            onChange={(e) =>
                                                handleInterfaceChange(iface.id, "interface_type", e.target.value)
                                            }
                                            disabled={!canEdit}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            placeholder="Tipo de interface"
                                        />
                                        <input
                                            type="text"
                                            value={iface.notes}
                                            onChange={(e) =>
                                                handleInterfaceChange(iface.id, "notes", e.target.value)
                                            }
                                            disabled={!canEdit}
                                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            placeholder="Notas"
                                        />
                                    </div>
                                    {canEdit && (
                                        <button
                                            onClick={() => handleRemoveInterface(iface.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            <FiTrash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Info Card */}
            <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                    <div className="text-blue-600 mt-0.5">ℹ️</div>
                    <div>
                        <h4 className="font-medium text-blue-900">Información</h4>
                        <p className="text-sm text-blue-700 mt-1">
                            La integración LIS afecta los costos de inversión y la complejidad del proyecto.
                            Configure correctamente las interfaces para una estimación precisa.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default LISSection;
