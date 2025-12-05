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

  const defaultValues = useMemo(() => state.generalData, [state.generalData]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues });

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

  const onSubmit = async (data) => {
    showLoader();
    try {
      const res = await api.post("/business-case", data);
      const bcId = res.data?.id || res.data?.businessCaseId;
      updateState({ generalData: data, businessCaseId: bcId });
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
          <span className="text-sm font-medium text-gray-700">Tipo de Business Case</span>
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
