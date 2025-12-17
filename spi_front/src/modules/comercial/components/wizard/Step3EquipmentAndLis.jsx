import React, { useState, useMemo } from "react";
import { FiServer, FiPlus, FiTrash2 } from "react-icons/fi";
import Step2EquipmentSelector from "./Step2EquipmentSelector";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";
import { useUI } from "../../../../core/ui/UIContext";
import api from "../../../../core/api";

const INITIAL_INTERFACE = { model: "", provider: "" };
const MIN_INTERFACE_ROWS = 3;
const ensureMinimumInterfaces = (list) => {
  const base = Array.isArray(list) ? list : [];
  const normalized = base.map((item) => ({ model: item?.model || "", provider: item?.provider || "" }));
  if (normalized.length >= MIN_INTERFACE_ROWS) return normalized;
  const fillers = Array.from({ length: MIN_INTERFACE_ROWS - normalized.length }, () => ({ ...INITIAL_INTERFACE }));
  return [...normalized, ...fillers];
};


const Step3EquipmentAndLis = ({ onPrev, onComplete }) => {
    const { state, updateState } = useBusinessCaseWizard();
    const { showToast, showLoader, hideLoader } = useUI();
    const [lisData, setLisData] = useState(state.generalData || {});
    const [interfaces, setInterfaces] = useState(() => {
        if (Array.isArray(state.lisInterfaces) && state.lisInterfaces.length) return ensureMinimumInterfaces(state.lisInterfaces);
        return ensureMinimumInterfaces([INITIAL_INTERFACE]);
    });

    // Map of equipmentId -> determinations[]
    const [determinationsMap, setDeterminationsMap] = useState({});
    const [loadingDets, setLoadingDets] = useState(false);

    // Determines which equipments need determinations loaded
    // We look at all PRIMARY equipments in the pairs.
    const activeEquipments = useMemo(() => {
        return (state.equipmentPairs || [])
            .filter(p => p.primary)
            .map(p => p.primary);
    }, [state.equipmentPairs]);

    // Load determinations when activeEquipments changes
    React.useEffect(() => {
        const loadDeterminations = async () => {
            const bcId = state.businessCaseId;
            if (!activeEquipments.length || !bcId) {
                setDeterminationsMap({});
                return;
            }

            setLoadingDets(true);
            try {
                // Fetch saved determination volumes for this BC
                const bcRes = await api.get(`/business-case/${bcId}/determinations`);
                const existingItems = bcRes.data?.data || [];

                const newMap = {};

                // For each primary equipment, fetch its catalog determinations
                for (const equip of activeEquipments) {
                    const catRes = await api.get("/determinations-catalog", { params: { equipmentId: equip.id } });
                    const catalogItems = catRes.data?.data || [];

                    // Merge with saved volumes
                    const merged = catalogItems.map(item => {
                        // Find if this determination for this equipment has saved data
                        // Note: Backend might store determination_id which is unique per catalog item.
                        const saved = existingItems.find(e => e.determination_id === item.id);
                        return {
                            ...item,
                            monthlyQty: saved ? saved.monthly_qty : "",
                            annualQty: saved ? saved.annual_qty : "",
                            bcDetId: saved ? saved.id : null
                        };
                    });
                    newMap[equip.id] = merged;
                }

                setDeterminationsMap(newMap);
            } catch (err) {
                console.error(err);
                showToast("Error cargando determinaciones", "error");
            } finally {
                setLoadingDets(false);
            }
        };

        loadDeterminations();
    }, [activeEquipments, state.businessCaseId]);

    const handleLisChange = (field, value) => {
        setLisData((prev) => {
            const next = { ...prev, [field]: value };
            updateState({ generalData: next });
            return next;
        });
    }
    const persistInterfaces = (nextList) => {
        const normalized = ensureMinimumInterfaces(nextList);
        setInterfaces(normalized);
        updateState({ lisInterfaces: normalized });
    };

    const addInterfaceRow = () => persistInterfaces([...interfaces, { ...INITIAL_INTERFACE }]);
    const removeInterfaceRow = (idx) => persistInterfaces(interfaces.filter((_, i) => i !== idx));
    const handleInterfaceChange = (idx, field, value) => {
        persistInterfaces(
            interfaces.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
        );
    };

;

    const handleVolumeChange = (equipmentId, detId, field, value) => {
        setDeterminationsMap(prev => {
            const list = prev[equipmentId] || [];
            const newList = list.map(d => {
                if (d.id !== detId) return d;
                const updates = { [field]: value };
                if (field === 'monthlyQty' && value) {
                    updates.annualQty = value * 12;
                }
                return { ...d, ...updates };
            });
            return { ...prev, [equipmentId]: newList };
        });
    };

    const saveDeterminations = async () => {
        // Flatten all determinations from all equipments
        const allDets = Object.values(determinationsMap).flat();

        // Filter items with volume > 0
        const toSave = allDets.filter(d => Number(d.monthlyQty) > 0 || Number(d.annualQty) > 0);

        for (const det of toSave) {
            const payload = {
                determinationId: det.id,
                monthlyQty: Number(det.monthlyQty) || 0,
                annualQty: Number(det.annualQty) || 0
            };

            try {
                    if (det.bcDetId) {
                        await api.put(`/business-case/${state.businessCaseId}/determinations/${det.bcDetId}`, payload);
                    } else {
                        await api.post(`/business-case/${state.businessCaseId}/determinations`, payload);
                    }
            } catch (e) {
                console.warn("Error saving det", det.name, e);
            }
        }
    };

    const handleEquipmentNext = async () => {
        showLoader();
        try {
            // 0. Save Equipment Pairs (Ensure backend has latest/final selection)
            const equipmentPairs = state.equipmentPairs || [];
            if (equipmentPairs.some(p => !p.primary)) {
                showToast("Todos los grupos deben tener un equipo principal seleccionado", "warning");
                hideLoader();
                return;
            }
            if (!state.businessCaseId) {
                showToast("Primero guarda los datos generales para generar el Business Case", "warning");
                hideLoader();
                return;
            }
            if (equipmentPairs.length > 0) {
                const eqPayload = {
                equipment_pairs: equipmentPairs.map(p => ({
                    primary_id: p.primary.id,
                    backup_id: p.backup?.id || null,
                    backup_install_simultaneous: p.backup?.install_with_primary || false,
                })),
            };
                await api.post(`/business-case/${state.businessCaseId}/equipment-details`, eqPayload);
            }

            // 1. Save LIS
            const hasLis = Boolean(lisData.lisIncludes);
            const lisPayload = {
                includes_lis: hasLis,
                lis_provider: lisData.lisProvider || null,
                includes_hardware: Boolean(lisData.lisIncludesHardware),
                monthly_patients: lisData.lisMonthlyPatients ? Number(lisData.lisMonthlyPatients) : null,
                current_system_name: lisData.lisInterfaceSystem || null,
                current_system_provider: lisData.lisInterfaceProvider || null,
                current_system_hardware: Boolean(lisData.lisInterfaceHardware),
            };
            await api.post(`/business-case/${state.businessCaseId}/lis-integration`, lisPayload);

            if (hasLis) {
                const validInterfaces = interfaces.filter((i) => i.model || i.provider);
                if (validInterfaces.length) {
                    await Promise.all(
                        validInterfaces.map((iface) =>
                            api.post(`/business-case/${state.businessCaseId}/lis-integration/equipment-interfaces`, {
                                model: iface.model,
                                provider: iface.provider,
                            }),
                        ),
                    );
                }
            }

            // 2. Save Determinations
            await saveDeterminations();

            // 3. Status Update
            if (onComplete) {
                await api.put(`/business-case/${state.businessCaseId}`, { status: 'pending_feasibility' });
                showToast("Solicitud de factibilidad enviada", "success");
                onComplete();
            }
        } catch (err) {
    console.error(err);
    showToast("Error guardando datos", "error");
} finally {
    hideLoader();
}
    };

return (
    <div className="space-y-8">
        {/* 1. Reuse existing Equipment Selector */}
        <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Selección de Equipos</h3>
            {/* We pass a no-op onNext so it doesn't navigate away, just stays here for inputs */}
            <Step2EquipmentSelector onPrev={onPrev} onNext={() => { }} hideNavigation={true} />
        </div>

        <hr className="border-gray-200" />

        {/* 2. Determination Volumes per Equipment Pair */}
        {activeEquipments.length > 0 && (
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <FiServer className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Volumen de Determinaciones</h3>
                </div>

                {loadingDets ? (
                    <p className="text-sm text-gray-500">Cargando determinaciones...</p>
                ) : (
                    <div className="space-y-6">
                        {activeEquipments.map(equip => {
                            const dets = determinationsMap[equip.id] || [];
                            return (
                                <div key={equip.id} className="border rounded-lg overflow-hidden bg-white">
                                    <div className="bg-gray-50 px-4 py-2 border-b">
                                        <h4 className="font-medium text-gray-700">{equip.name}</h4>
                                    </div>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white text-gray-600 font-semibold border-b">
                                            <tr>
                                                <th className="px-4 py-2">Prueba / Determinación</th>
                                                <th className="px-4 py-2 w-32">Mensual</th>
                                                <th className="px-4 py-2 w-32">Anual</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {dets.map(det => (
                                                <tr key={det.id} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-2">
                                                        <p className="font-medium text-gray-900">{det.name}</p>
                                                        <p className="text-xs text-gray-500">{det.roche_code || det.vendor_code}</p>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            className="w-full border rounded px-2 py-1"
                                                            value={det.monthlyQty}
                                                            onChange={(e) => handleVolumeChange(equip.id, det.id, 'monthlyQty', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            className="w-full border rounded px-2 py-1"
                                                            value={det.annualQty}
                                                            onChange={(e) => handleVolumeChange(equip.id, det.id, 'annualQty', e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                            {!dets.length && (
                                                <tr>
                                                    <td colSpan="3" className="px-4 py-4 text-center text-gray-500">
                                                        No hay determinaciones configuradas para este equipo.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        <hr className="border-gray-200" />

        {/* 3. LIS Integration Data */}
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <FiServer className="text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">Integracion LIS e interfaces</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-gray-700">Incluye LIS (Si/No)</span>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={lisData.lisIncludes || false}
                            onChange={(e) => handleLisChange("lisIncludes", e.target.checked)}
                            className="rounded text-blue-600"
                        />
                        <span className="text-xs text-gray-500">{lisData.lisIncludes ? "Si" : "No"}</span>
                    </div>
                </label>
                {lisData.lisIncludes && (
                    <>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-700">Proveedor del sistema a trabajar</span>
                            <input
                                type="text"
                                value={lisData.lisProvider || ""}
                                onChange={(e) => handleLisChange("lisProvider", e.target.value)}
                                className="w-full border rounded-lg px-3 py-2"
                            />
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-700">Incluye hardware (Si/No)</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={Boolean(lisData.lisIncludesHardware)}
                                    onChange={(e) => handleLisChange("lisIncludesHardware", e.target.checked)}
                                    className="rounded text-blue-600"
                                />
                                <span className="text-xs text-gray-500">{lisData.lisIncludesHardware ? "Si" : "No"}</span>
                            </div>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-700">Numero de pacientes (mensual)</span>
                            <input
                                type="number"
                                value={lisData.lisMonthlyPatients || ""}
                                onChange={(e) => handleLisChange("lisMonthlyPatients", e.target.value)}
                                className="w-full border rounded-lg px-3 py-2"
                                min="0"
                            />
                        </label>
                    </>
                )}
            </div>

            {lisData.lisIncludes && (
                <div className="space-y-4">
                    <div className="space-y-3 border rounded-lg border-gray-200 p-4 bg-white">
                        <h4 className="text-sm font-semibold text-gray-700">Interfaz de sistema actual</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-700">Nombre del sistema</span>
                                <input
                                    type="text"
                                    value={lisData.lisInterfaceSystem || ""}
                                    onChange={(e) => handleLisChange("lisInterfaceSystem", e.target.value)}
                                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-700">Proveedor</span>
                                <input
                                    type="text"
                                    value={lisData.lisInterfaceProvider || ""}
                                    onChange={(e) => handleLisChange("lisInterfaceProvider", e.target.value)}
                                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-gray-700">Incluye hardware (Si/No)</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(lisData.lisInterfaceHardware)}
                                        onChange={(e) => handleLisChange("lisInterfaceHardware", e.target.checked)}
                                        className="rounded text-blue-600"
                                    />
                                    <span className="text-xs text-gray-500">{lisData.lisInterfaceHardware ? "Si" : "No"}</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-3 border rounded-lg border-gray-200 p-4 bg-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-700">Interfaz de equipos</p>
                                <p className="text-[11px] text-gray-500">Modelos / Proveedores (3 filas por defecto).</p>
                            </div>
                            <button
                                type="button"
                                onClick={addInterfaceRow}
                                className="inline-flex items-center gap-1 text-xs text-blue-600"
                            >
                                <FiPlus /> Agregar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {interfaces.map((iface, idx) => (
                                <div key={`${iface.model}-${iface.provider}-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        value={iface.model}
                                        onChange={(e) => handleInterfaceChange(idx, "model", e.target.value)}
                                        placeholder="Modelo / Serie"
                                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={iface.provider}
                                        onChange={(e) => handleInterfaceChange(idx, "provider", e.target.value)}
                                        placeholder="Proveedor"
                                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeInterfaceRow(idx)}
                                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-xs text-rose-500"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
        <div className="flex justify-end pt-4">
            <button
                onClick={handleEquipmentNext}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold"
            >
                Solicitar Factibilidad
            </button>
        </div>
    </div>
);
};

export default Step3EquipmentAndLis;
