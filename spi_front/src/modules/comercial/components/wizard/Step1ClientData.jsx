import React, { useEffect, useState } from "react";
import { FiUser, FiFileText } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const Step1ClientData = ({ onNext }) => {
    const { state, updateState } = useBusinessCaseWizard();
    const { showToast, showLoader, hideLoader } = useUI();
    const [clients, setClients] = useState([]);
    const [formData, setFormData] = useState(state.generalData || {});

    useEffect(() => {
        loadClients();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadClients = async () => {
        try {
            const res = await api.get("/clients");
            setClients(res.data?.data || []);
        } catch (err) {
            console.warn("Error cargando clientes", err);
        }
    };

    useEffect(() => {
        // Sync local form data with wizard context
        // Debounce slightly to allow state to settle and avoid render thrashing
        const timer = setTimeout(() => {
            updateState({ generalData: formData });
        }, 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData]);

    const handleChange = (field, value) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };

            // Auto-populate client type and name if client changes
            if (field === 'client') {
                const selectedClient = clients.find(c => c.id == value);
                if (selectedClient) {
                    if (selectedClient.client_type) {
                        next.clientType = selectedClient.client_type;
                    }
                    // Ensure client_name is set for backend validation
                    next.client_name = selectedClient.nombre || selectedClient.commercial_name || selectedClient.name;
                }
            }
            return next;
        });
    };

    const handleNext = async () => {
        if (!formData.client) {
            showToast("Completa los campos obligatorios (Cliente)", "warning");
            return;
        }

        try {
            showLoader();
            let bcId = state.businessCaseId;
            const payload = {
                client_name: formData.client_name,
                client_id: formData.client,
                // Wrap other fields in 'extra' as per backend schema
                extra: {
                    clientType: formData.clientType,
                    contractingEntity: formData.contractingEntity,
                    processCode: formData.processCode,
                    contractObject: formData.contractObject,
                    project_duration: formData.durationYears,
                    targetMargin: formData.targetMargin
                }
            };

            if (!bcId) {
                // Create new BC
                const res = await api.post("/business-case", payload);
                bcId = res.data?.data?.id;
                updateState({ businessCaseId: bcId });
            } else {
                // Update existing
                await api.put(`/business-case/${bcId}`, payload);
            }

            showToast("Datos guardados", "success");
            onNext();
        } catch (err) {
            showToast("Error guardando datos", "error");
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
                <FiUser className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">Datos del Cliente</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Cliente *</span>
                    <select
                        value={formData.client || ""}
                        onChange={(e) => handleChange("client", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        <option value="">Seleccione...</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.nombre || c.commercial_name || c.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Tipo de Cliente</span>
                    <select
                        value={formData.clientType || ""}
                        onChange={(e) => handleChange("clientType", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        <option value="">Seleccione...</option>
                        <option value="publico">Público</option>
                        <option value="privado">Privado</option>
                    </select>
                </label>

                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Entidad Contratante</span>
                    <input
                        type="text"
                        value={formData.contractingEntity || ""}
                        onChange={(e) => handleChange("contractingEntity", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Ej: Hospital General..."
                    />
                </label>

                <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Código de Proceso</span>
                    <input
                        type="text"
                        value={formData.processCode || ""}
                        onChange={(e) => handleChange("processCode", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Ej: SIE-..."
                    />
                </label>

                <label className="space-y-1 md:col-span-2">
                    <span className="text-sm font-medium text-gray-700">Objeto de Contratación</span>
                    <textarea
                        value={formData.contractObject || ""}
                        onChange={(e) => handleChange("contractObject", e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 h-20"
                        placeholder="Descripción del objeto..."
                    />
                </label>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleNext}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                    Guardar y Continuar
                </button>
            </div>
        </div>
    );
};

export default Step1ClientData;
