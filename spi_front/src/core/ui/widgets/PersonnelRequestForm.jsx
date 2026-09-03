import React, { useEffect, useState } from "react";
import { FiBriefcase, FiMapPin, FiSave, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import Button from "../components/Button";
import { createPersonnelRequest } from "../../api/personnelRequestsApi";
import { ECUADOR_CITY_OPTIONS } from "../../../modules/talento/components/collaboratorProfileDefinitions";

const PersonnelRequestForm = ({ onClose, onSuccess, isModal = true }) => {
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [portalNode] = useState(() => document.createElement("div"));

  const [formData, setFormData] = useState({
    position_title: "",
    position_type: "permanente",
    quantity: 1,
    start_date: "",
    end_date: "",
    work_location: "",
    justification: "",
  });

  useEffect(() => {
    if (!isModal) return;
    document.body.appendChild(portalNode);
    return () => {
      if (document.body.contains(portalNode)) {
        document.body.removeChild(portalNode);
      }
    };
  }, [isModal, portalNode]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateFields = () => {
    const nextErrors = {};
    ["position_title", "position_type", "quantity", "work_location", "justification"].forEach((field) => {
      const value = formData[field];
      if (value === undefined || value === null || String(value).trim() === "") {
        nextErrors[field] = "Este campo es obligatorio";
      }
    });

    const quantityValue = Number(formData.quantity);
    if (!Number.isInteger(quantityValue) || quantityValue < 1) {
      nextErrors.quantity = "La cantidad debe ser un numero entero mayor o igual a 1";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    if (!validateFields()) {
      toast.error("Completa los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      await createPersonnelRequest(formData);
      toast.success("Solicitud de personal creada exitosamente");
      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error("Error creando solicitud:", error);
      toast.error(error.response?.data?.message || "Error al crear la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div
      className={
        isModal
          ? "fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4"
          : "flex h-full w-full flex-col bg-white"
      }
    >
      <div
        className={
          isModal
            ? "max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-none bg-white shadow-xl sm:rounded-2xl"
            : "h-full w-full overflow-y-auto"
        }
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Solicitud de requerimiento de personal
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Registra el cargo solicitado, la cantidad requerida y el sitio donde se realizará la labor.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="self-end text-slate-400 transition-colors hover:text-slate-600 sm:self-auto"
              title="Cancelar"
            >
              <FiX size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <FiBriefcase className="text-blue-600" size={22} />
                <h3 className="text-lg font-semibold text-slate-900">Datos del requerimiento</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Titulo del puesto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="position_title"
                    value={formData.position_title}
                    onChange={handleChange}
                    className={`input-field ${fieldErrors.position_title ? "border-red-500" : ""}`}
                    placeholder="Ej: Analista administrativo"
                    required
                  />
                  {fieldErrors.position_title && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.position_title}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo de contratacion <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="position_type"
                    value={formData.position_type}
                    onChange={handleChange}
                    className={`input-field ${fieldErrors.position_type ? "border-red-500" : ""}`}
                    required
                  >
                    <option value="permanente">Permanente</option>
                    <option value="temporal">Temporal</option>
                    <option value="reemplazo">Reemplazo</option>
                    <option value="proyecto">Por proyecto</option>
                  </select>
                  {fieldErrors.position_type && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.position_type}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Cantidad de vacantes <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    className={`input-field ${fieldErrors.quantity ? "border-red-500" : ""}`}
                    min="1"
                    required
                  />
                  {fieldErrors.quantity && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.quantity}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fecha de inicio estimada
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>

                {formData.position_type === "temporal" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Fecha de fin estimada
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <FiMapPin className="text-emerald-600" size={22} />
                <h3 className="text-lg font-semibold text-slate-900">Sitio a laborar</h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ciudad <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="work_location"
                    value={formData.work_location}
                    onChange={handleChange}
                    className={`input-field ${fieldErrors.work_location ? "border-red-500" : ""}`}
                    required
                  >
                    <option value="">Selecciona una ciudad</option>
                    {ECUADOR_CITY_OPTIONS.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.work_location && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.work_location}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Justificacion de la solicitud <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="justification"
                    value={formData.justification}
                    onChange={handleChange}
                    className={`input-field ${fieldErrors.justification ? "border-red-500" : ""}`}
                    rows="5"
                    placeholder="Explica por que es necesario este requerimiento de personal..."
                    required
                  />
                  {fieldErrors.justification && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.justification}</p>
                  )}
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" icon={FiSave} disabled={loading}>
                {loading ? "Procesando..." : "Guardar solicitud"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  if (isModal) {
    return createPortal(content, portalNode);
  }

  return content;
};

export default PersonnelRequestForm;
