import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FiCalendar, FiCheckCircle, FiUsers } from "react-icons/fi";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useBusinessCaseWizard } from "../../pages/BusinessCaseWizard";

const Step1GeneralData = ({ onNext }) => {
  const { state, updateState } = useBusinessCaseWizard();
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const { showToast, showLoader, hideLoader } = useUI();

  const defaultValues = useMemo(() => ({
    ...state.generalData,
    bcType: state.bcType,
  }), [state.generalData, state.bcType]);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ defaultValues });

  const watchBcType = watch('bcType');

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const res = await api.get("/clients");
        const payload = res.data?.data ?? res.data;
        const parsedClients = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.clients)
            ? payload.clients
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload)
                ? payload
                : [];
        setClients(parsedClients);
      } catch (err) {
        console.warn("No se pudieron cargar clientes", err.message);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  const formatClientLabel = (client) =>
    client?.nombre ||
    client?.commercial_name ||
    client?.name ||
    client?.display_name ||
    client?.email ||
    client?.identificador ||
    client?.id ||
    "Cliente";

  const onSubmit = async (formData) => {
    const selected = clients.find(
      (c) =>
        String(c.id) === String(formData.client) ||
        String(c.email) === String(formData.client) ||
        String(c.identificador) === String(formData.client),
    );

    const client_name = selected ? formatClientLabel(selected) : formData.client;
    const client_id = selected?.id && Number.isFinite(Number(selected.id)) ? Number(selected.id) : undefined;

    const payload = {
      client_id,
      client_name,
      bc_type: formData.bcType || 'comodato_publico',
      duration_years: parseInt(formData.durationYears) || 3,
      target_margin_percentage: parseFloat(formData.targetMargin) || 25,
      process_code: formData.processCode || null,
      contract_object: formData.contractObject || null,
      equipment_id: null,
      equipment_cost: 0,
      created_by: 'system',
      modern_bc_metadata: {
        businessType: formData.businessType,
        notes: formData.notes,
        date: formData.date,
      },
    };

    showLoader();
    try {
      const res = await api.post("/business-case/orchestrator/create-economic", payload);
      const bcId =
        res.data?.data?.id ||
        res.data?.id ||
        res.data?.businessCaseId ||
        res.data?.data?.businessCaseId ||
        res.data?.data?.business_case_id;
      if (!bcId) {
        throw new Error("No se recibió el identificador del Business Case");
      }

      updateState({
        generalData: formData,
        businessCaseId: bcId,
        bcType: formData.bcType || 'comodato_publico'
      });
      showToast("Datos guardados correctamente", "success");
      if (onNext) onNext();
    } catch (err) {
      showToast(err.response?.data?.message || "No se pudo crear el Business Case", "error");
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <FiCheckCircle />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Datos Generales</h2>
          <p className="text-sm text-gray-500">Completa los datos base. Se guardará un borrador automáticamente.</p>
        </div>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiUsers /> Cliente
          </span>
          <select
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            {...register("client", { required: "El cliente es obligatorio" })}
          >
            <option value="">Selecciona un cliente</option>
            {Array.isArray(clients) &&
              clients.map((client) => {
                const value = client.id || client.email || client.identificador || client.nombre || client.name;
                const label =
                  client.nombre || // API español
                  client.commercial_name ||
                  client.name ||
                  client.display_name ||
                  client.email ||
                  client.identificador ||
                  client.id;
                return (
                  <option key={`${value}-${label}`} value={value}>
                    {label}
                  </option>
                );
              })}
          </select>
          {loadingClients && <p className="text-xs text-gray-400">Cargando clientes...</p>}
          {errors.client && <p className="text-xs text-red-500">{errors.client.message}</p>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Tipo de Comodato</span>
          <select
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            {...register("bcType", { required: "Selecciona un tipo" })}
          >
            <option value="">Selecciona...</option>
            <option value="comodato_publico">Comodato Público (Licitación)</option>
            <option value="comodato_privado">Comodato Privado</option>
          </select>
          {errors.bcType && <p className="text-xs text-red-500">{errors.bcType.message}</p>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Tipo de Negocio</span>
          <select
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            {...register("businessType", { required: "Selecciona un tipo" })}
          >
            <option value="">Selecciona...</option>
            <option value="nuevo">Nuevo</option>
            <option value="renovacion">Renovación</option>
            <option value="ampliacion">Ampliación</option>
          </select>
          {errors.businessType && <p className="text-xs text-red-500">{errors.businessType.message}</p>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Duración del Comodato (años)</span>
          <input
            type="number"
            min="1"
            max="10"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            {...register("durationYears", {
              required: "Especifica la duración",
              min: { value: 1, message: "Mínimo 1 año" },
              max: { value: 10, message: "Máximo 10 años" }
            })}
          />
          {errors.durationYears && <p className="text-xs text-red-500">{errors.durationYears.message}</p>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Margen Objetivo (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            {...register("targetMargin", {
              required: "Especifica el margen objetivo",
              min: { value: 0, message: "Mínimo 0%" },
              max: { value: 100, message: "Máximo 100%" }
            })}
          />
          <p className="text-xs text-gray-500">Margen de utilidad esperado para el comodato</p>
          {errors.targetMargin && <p className="text-xs text-red-500">{errors.targetMargin.message}</p>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiCalendar /> Fecha
          </span>
          <input
            type="date"
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            {...register("date", { required: "Selecciona una fecha" })}
          />
          {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Observaciones</span>
          <textarea
            rows={3}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="Notas internas o comentarios"
            {...register("notes")}
          />
        </label>

        <div className="md:col-span-2 flex justify-between items-center pt-2">
          <div className="text-xs text-gray-500">Los cambios se guardan en un borrador local automáticamente.</div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Guardar y continuar
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step1GeneralData;
