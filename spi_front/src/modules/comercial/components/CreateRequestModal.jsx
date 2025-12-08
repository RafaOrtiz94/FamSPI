// src/modules/comercial/components/CreateRequestModal.jsx

import React, { useState, useMemo, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { FiSend, FiX, FiPlus, FiTrash2, FiPhone } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import FileUploader from "../../../core/ui/components/FileUploader";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";
import NewClientRequestForm from "./NewClientRequestForm";
import { fetchClients } from "../../../core/api/clientsApi";
import { getEquiposDisponibles } from "../../../core/api/inventarioApi";

/* ============================================================
    🌐 Códigos de País (Ejemplo)
============================================================ */
const COUNTRIES = [
  { code: "EC", dialCode: "+593", name: "Ecuador" },
  { code: "CO", dialCode: "+57", name: "Colombia" },
  { code: "PE", dialCode: "+51", name: "Perú" },
  { code: "US", dialCode: "+1", name: "EE. UU." },
];

/* ============================================================
    📞 Componente para Input de Teléfono con País
============================================================ */
const PhoneNumberInput = ({ name, value, onChange, error, disabled }) => {
  // Inicializa el código de país basado en el valor o usa el primero por defecto
  const initialCountry = COUNTRIES.find(c => value.startsWith(c.dialCode))?.dialCode || COUNTRIES[0].dialCode;
  const [country, setCountry] = useState(initialCountry);

  // Asegura que el valor se trate como cadena y elimina el código para mostrar solo el número
  const number = (value || '').startsWith(country) ? (value || '').substring(country.length) : (value || '');

  const handleCountryChange = (e) => {
    const newCountryCode = e.target.value;
    setCountry(newCountryCode);
    // Combina el nuevo código con el número actual (limpio)
    onChange({ target: { name, value: newCountryCode + number } });
  };

  const handleNumberChange = (e) => {
    // Permite solo dígitos para el número
    const cleanNumber = e.target.value.replace(/\D/g, '');
    // Combina el código de país actual con el número nuevo
    onChange({ target: { name, value: country + cleanNumber } });
  };

  return (
    <div className={`flex rounded-lg border ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600"} overflow-hidden`}>
      <select
        value={country}
        onChange={handleCountryChange}
        className="bg-gray-100 dark:bg-gray-600 p-2 text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600 focus:outline-none"
        disabled={disabled}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.dialCode}>
            {c.code} ({c.dialCode})
          </option>
        ))}
      </select>
      <input
        type="tel"
        name={name}
        placeholder="Número de contacto"
        value={number}
        onChange={handleNumberChange}
        className="flex-1 p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
        disabled={disabled}
      />
      <span className="p-2 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center">
        <FiPhone />
      </span>
    </div>
  );
};

/* ============================================================
    ⚙️ Componente para Input de Equipo con Select de Estado
============================================================ */
const requestTypesForEquipments = {
  inspection: { equipo_id: "", nombre_equipo: "", estado: "nuevo", serial: "", unidad_id: "" },
  retiro: { equipo_id: "", nombre_equipo: "", cantidad: 1, serial: "", unidad_id: "" },
  compra: { equipo_id: "", nombre_equipo: "", estado: "nuevo", serial: "", unidad_id: "" },
};

const EquipoInput = ({
  index,
  equipo,
  updateEquipo,
  type,
  removeEquipo,
  equipmentOptions = [],
  equipmentLoading,
  equipmentError,
  disabled,
}) => {
  const keys = Object.keys(requestTypesForEquipments[type] || {});
  const renderKeys = keys.filter((k) => k !== "unidad_id");

  const isStateField = (k) => k === "estado" && (type === "inspection" || type === "compra");
  const isQuantityField = (k) => k === "cantidad";
  const isEquipmentField = (k) => k === "equipo_id";

  const handleEquipmentSelect = (e) => {
    const value = e.target.value;
    const selected = equipmentOptions.find((opt) => `${opt.id}` === `${value}`);
    updateEquipo(index, "equipo_id", value);
    updateEquipo(index, "nombre_equipo", selected?.nombre || "");
    updateEquipo(index, "unidad_id", selected?.unidad_id || selected?.id || value);
    updateEquipo(index, "serial", selected?.serial || "");
  };

  return (
    <div className="flex items-start gap-2 mb-3 flex-wrap sm:flex-nowrap w-full">
      {renderKeys.map((k) => (
        <div key={k} className="flex-1 min-w-[160px]">
          {isEquipmentField(k) ? (
            <select
              value={equipo[k]}
              onChange={handleEquipmentSelect}
              disabled={disabled || equipmentLoading}
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">
                {equipmentLoading ? "Cargando equipos..." : "Selecciona un equipo"}
              </option>
              {equipmentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.nombre || opt.name}
                  {opt.modelo ? ` ${opt.modelo}` : ""}
                  {opt.serial ? ` | Serie ${opt.serial}` : " | Serial pendiente"}
                  {opt.estado ? ` | ${opt.estado}` : ""}
                </option>
              ))}
            </select>
          ) : isStateField(k) ? (
            <select
              value={equipo[k]}
              onChange={(e) => updateEquipo(index, k, e.target.value)}
              disabled={disabled}
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white capitalize"
            >
              <option value="nuevo">Nuevo</option>
              {type === "inspection" ? <option value="cu">CU</option> : <option value="usado">Usado</option>}
            </select>
          ) : (
            <input
              type={isQuantityField(k) ? "number" : "text"}
              placeholder={k.replaceAll("_", " ")}
              value={equipo[k]}
              min={isQuantityField(k) ? 1 : null}
              onChange={(e) =>
                updateEquipo(index, k, isQuantityField(k) ? parseInt(e.target.value) || 1 : e.target.value)
              }
              disabled={disabled}
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          )}
          {isEquipmentField(k) && !equipmentLoading && equipmentOptions.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">No hay equipos disponibles.</p>
          )}
          {isEquipmentField(k) && equipmentError && (
            <p className="text-xs text-red-500 mt-1">{equipmentError}</p>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => removeEquipo(index)}
        className="text-red-500 hover:text-red-700 p-2"
        disabled={disabled}
      >
        <FiTrash2 />
      </button>
    </div>
  );
};


/* ============================================================
    📋 Mapeo de tipos ↔ schemas (alineado con backend)
============================================================ */
const requestTypes = {
  inspection: {
    title: "Solicitud de Inspección de Ambiente",
    required: ["nombre_cliente", "direccion_cliente", "fecha_instalacion"],
    fields: [
      "nombre_cliente",
      "direccion_cliente",
      "persona_contacto",
      "celular_contacto",
      "fecha_instalacion",
      "fecha_tope_instalacion",
      "requiere_lis",
      "anotaciones",
      "accesorios",
      "observaciones",
    ],
    equipos: requestTypesForEquipments.inspection,
  },
  retiro: {
    title: "Solicitud de Retiro de Equipo",
    required: ["nombre_cliente", "fecha_retiro"],
    fields: [
      "nombre_cliente",
      "direccion_cliente",
      "persona_contacto",
      "celular_contacto",
      "fecha_retiro",
      "anotaciones",
      "observaciones",
    ],
    equipos: requestTypesForEquipments.retiro,
  },
  compra: {
    title: "Requerimiento de Proceso de Compra",
    required: ["nombre_cliente", "fecha_tentativa_visita"],
    fields: [
      "nombre_cliente",
      "direccion_cliente",
      "persona_contacto",
      "celular_contacto",
      "fecha_tentativa_visita",
      "fecha_instalacion",
      "fecha_tope_instalacion",
      "anotaciones",
      "accesorios",
      "observaciones",
    ],
    equipos: requestTypesForEquipments.compra,
  },
  cliente: {
    title: "Registro de nuevo cliente",
    required: ["nombre_cliente", "direccion_cliente", "persona_contacto"],
    fields: [
      "nombre_cliente",
      "direccion_cliente",
      "persona_contacto",
      "celular_contacto",
      "email_cliente",
      "observaciones",
    ],
  },
};

/* ============================================================
    📦 Funciones de Utilidad
============================================================ */
const getTodayDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0); // Establecer la hora a medianoche
  return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
};
const TODAY = getTodayDate();


/* ============================================================
    🧾 Modal principal
============================================================ */
const CreateRequestModal = ({
  open,
  onClose,
  onSubmit,
  presetType = null,
  initialData = null,
  isEditing = false,
}) => {
  const [type, setType] = useState(null);
  const [formData, setFormData] = useState({});
  const [equipos, setEquipos] = useState([]);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(null);
  const [availableClients, setAvailableClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [equipmentError, setEquipmentError] = useState("");

  const todayDateString = useMemo(() => TODAY, []);
  const clientSelectionRequired = type === "inspection" || type === "retiro";
  const hasSelectedClient = !!(formData?.nombre_cliente || "").trim();

  const submissionSteps = useMemo(
    () => [
      { id: "validating", label: "Validando información" },
      { id: "preparing", label: "Preparando archivos y anexos" },
      { id: "submitting", label: "Enviando solicitud" },
      { id: "refreshing", label: "Actualizando bandeja" },
    ],
    [],
  );

  useEffect(() => {
    if (!open) {
      setType(null);
      setFormData({});
      setEquipos([]);
      setFiles([]);
      setErrors({});
      setSelectedClientId("");
      setEquipmentOptions([]);
      setEquipmentError("");
      return;
    }

    if (isEditing && initialData) {
      setType(presetType || (initialData.client_type ? "cliente" : null));
      if (presetType !== "cliente") {
      setFormData(initialData);
    }
  } else if (presetType) {
    setType(presetType);
  } else {
    setType(null);
  }

  if (!isEditing) {
    setFormData({});
    setEquipos([]);
    setErrors({});
    setSelectedClientId("");
  }
}, [open, presetType, initialData, isEditing]);

  // ✅ Validar formulario
  const validateForm = () => {
    if (!type) return false;
    const newErrors = {};
    const requiredFields = requestTypes[type].required;

    // 1. Validaciones de Campos Requeridos
    requiredFields.forEach((field) => {
      if (!formData[field]) {
        newErrors[field] = "Este campo es obligatorio.";
      }
    });

    // 2. Validaciones de Fechas (No menor a la fecha actual)
    const dateFields = ["fecha_instalacion", "fecha_retiro", "fecha_tentativa_visita", "fecha_tope_instalacion"];

    dateFields.forEach((field) => {
      const value = formData[field];
      if (value && value < todayDateString) {
        newErrors[field] = `La fecha no puede ser anterior a hoy (${new Date().toLocaleDateString()}).`;
      }
    });

    // 3. Validación de Fecha Tope (si aplica)
    const instalacion = formData.fecha_instalacion;
    const tope = formData.fecha_tope_instalacion;
    if ((type === "inspection" || type === "compra") && instalacion && tope) {
      if (instalacion > tope) {
        newErrors.fecha_tope_instalacion = "La fecha tope no puede ser menor a la fecha de instalación.";
      }
    }

    // 4. Validar equipos seleccionados desde inventario
    if (requestTypes[type].equipos) {
      equipos.forEach((eq) => {
        if (!eq.equipo_id) {
          newErrors.equipos = "Selecciona un equipo válido del inventario.";
        }
        if (requestTypes[type].equipos.estado !== undefined && !eq.estado) {
          newErrors.equipos = "Todos los equipos deben tener estado seleccionado.";
        }
        if (requestTypes[type].equipos.cantidad !== undefined && (!eq.cantidad || eq.cantidad < 1)) {
          newErrors.equipos = "Indica la cantidad de equipos a retirar.";
        }
        if ((type === "inspection" || type === "retiro") && !eq.serial) {
          newErrors.equipos = "Debes registrar el serial del equipo.";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const loadClients = async () => {
      if (!open || !type || type === "cliente") return;
      setLoadingClients(true);
      try {
        const clients = await fetchClients();
        if (Array.isArray(clients)) {
          setAvailableClients(clients);
        } else {
          setAvailableClients(Array.isArray(clients?.clients) ? clients.clients : []);
        }
      } catch (error) {
        console.error("Error cargando clientes", error);
        setAvailableClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    loadClients();
  }, [open, type]);

  useEffect(() => {
    const loadEquipmentOptions = async () => {
      if (!open || !requestTypes[type]?.equipos) return;

      setLoadingEquipment(true);
      setEquipmentError("");
      try {
        const data = await getEquiposDisponibles();
        setEquipmentOptions(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error cargando equipos", error);
        setEquipmentError("No pudimos cargar los equipos disponibles.");
        setEquipmentOptions([]);
      } finally {
        setLoadingEquipment(false);
      }
    };

    loadEquipmentOptions();
  }, [open, type]);

  // ✅ Actualiza valores del formulario
  const handleChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: inputType === "checkbox" ? checked : value,
    }));
    // Limpiar error al escribir
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // ✅ Gestión dinámica de equipos
  const addEquipo = () => {
    if (!type || !requestTypes[type].equipos) return;
    const base = requestTypesForEquipments[type];
    setEquipos([...equipos, { ...base }]);
  };

  const handleClientSelect = (clientId) => {
    if (!clientId) {
      setFormData((prev) => ({ ...prev, nombre_cliente: "" }));
      setSelectedClientId("");
      return;
    }

    const selected = availableClients.find((c) => `${c.id}` === `${clientId}`);
    if (!selected) return;

    setSelectedClientId(`${clientId}`);

    setFormData((prev) => ({
      ...prev,
      nombre_cliente: selected.commercial_name || selected.nombre || "",
      direccion_cliente: selected.shipping_address || "",
      persona_contacto: selected.shipping_contact_name || "",
      celular_contacto: selected.shipping_phone || prev.celular_contacto || COUNTRIES[0].dialCode,
    }));
  };

  const updateEquipo = (index, key, value) => {
    const copy = [...equipos];
    copy[index][key] = value;
    setEquipos(copy);
    // Limpia el error de equipos si ya se ha ingresado algo en un equipo anterior
    if (errors.equipos) {
      setErrors(prev => ({ ...prev, equipos: null }));
    }
  };

  const removeEquipo = (index) => {
    setEquipos(equipos.filter((_, i) => i !== index));
  };

  // ✅ Envío al backend (ya estructurado)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setProgressStep("validating");
    try {
      const payload = { ...formData };
      if (equipos.length > 0) {
        payload.equipos = equipos;
        const principal = equipos[0];
        payload.unidad_id = principal.unidad_id || principal.equipo_id;
        payload.serial = principal.serial;
        payload.serial_pendiente = !principal.serial;
      }

      setProgressStep("preparing");
      setProgressStep("submitting");
      await Promise.resolve(
        onSubmit?.({
          request_type_id: type,
          payload,
          files,
        }),
      );
      setProgressStep("refreshing");

      setFiles([]);
      setFormData({});
      setEquipos([]);
      setErrors({});
      setType(null);
    } catch (error) {
      console.error("Error al enviar la solicitud", error);
    } finally {
      setSubmitting(false);
      setProgressStep(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
          <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full shadow-xl overflow-y-auto max-h-[90vh]">
            {submitting && (
              <ProcessingOverlay
                title="Procesando solicitud comercial"
                steps={submissionSteps}
                activeStep={progressStep || "validating"}
              />
            )}
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                {type ? requestTypes[type]?.title || "Nueva solicitud" : "Selecciona una solicitud"}
              </Dialog.Title>
              {type && (
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Flujo comercial preconfigurado
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <FiX size={20} />
            </button>
          </div>

          {!type && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              Selecciona un flujo desde los accesos directos del dashboard para cargar la información correspondiente.
            </div>
          )}

          {/* Campos dinámicos */}
          {type && type !== "cliente" && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {clientSelectionRequired && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-semibold">Selecciona primero un cliente registrado.</p>
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/80">
                    Solo se habilitarán los campos y equipos después de elegir al cliente. ¿Aún no está registrado?
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => setType("cliente")}
                  >
                    Ir a solicitud de registro de cliente
                  </Button>
                </div>
              )}
              {requestTypes[type].fields.map((f) => (
                <div key={f}>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 capitalize">
                    {f.replaceAll("_", " ")}
                    {requestTypes[type].required.includes(f) && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>

                  {/* 📞 Input de Teléfono Personalizado */}
                  {clientSelectionRequired && f === "nombre_cliente" ? (
                    <div className="space-y-2">
                      <select
                        name={f}
                        value={selectedClientId}
                        onChange={(e) => handleClientSelect(e.target.value)}
                        disabled={loadingClients}
                        className={`w-full p-2 rounded-lg border ${errors[f]
                          ? "border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                      >
                        <option value="" disabled>
                          {loadingClients ? "Cargando clientes..." : "Selecciona un cliente"}
                        </option>
                        {availableClients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.commercial_name || client.nombre || `Cliente ${client.id}`}
                          </option>
                        ))}
                      </select>
                      {!loadingClients && availableClients.length === 0 && (
                        <p className="text-xs text-gray-500">
                          No encontramos clientes disponibles. Registra uno nuevo.
                        </p>
                      )}
                    </div>
                  ) : f === "celular_contacto" ? (
                    <PhoneNumberInput
                      name={f}
                      value={formData[f] || COUNTRIES[0].dialCode}
                      onChange={handleChange}
                      error={errors[f]}
                      disabled={clientSelectionRequired && !hasSelectedClient}
                    />
                  ) : f === "requiere_lis" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={f}
                        checked={formData[f] || false}
                        onChange={handleChange}
                        disabled={clientSelectionRequired && !hasSelectedClient}
                      />
                      Requiere LIS
                    </label>
                  ) : (
                    <input
                      type={
                        f.includes("fecha")
                          ? "date"
                          : f.includes("email")
                            ? "email"
                            : "text"
                      }
                        name={f}
                        value={formData[f] || ""}
                        onChange={handleChange}
                        min={f.includes("fecha") ? todayDateString : null} // Validación HTML5: min=fecha_actual
                        className={`w-full p-2 rounded-lg border ${errors[f]
                          ? "border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${clientSelectionRequired && f !== "nombre_cliente" && !hasSelectedClient ? "opacity-60 cursor-not-allowed" : ""}`}
                        disabled={clientSelectionRequired && f !== "nombre_cliente" && !hasSelectedClient}
                      />
                  )}
                  {errors[f] && (
                    <p className="text-red-500 text-xs mt-1">{errors[f]}</p>
                  )}
                </div>
              ))}

              {/* Equipos */}
              {requestTypes[type].equipos && (
                <div className="mt-4 border-t pt-3 border-gray-200 dark:border-gray-600">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Equipos
                  </p>
                  {equipos.map((eq, i) => (
                    <EquipoInput
                      key={i}
                      index={i}
                      equipo={eq}
                      updateEquipo={updateEquipo}
                      type={type}
                      removeEquipo={removeEquipo}
                      equipmentOptions={equipmentOptions}
                      equipmentLoading={loadingEquipment}
                      equipmentError={equipmentError}
                      disabled={clientSelectionRequired && !hasSelectedClient}
                    />
                  ))}
                  {errors.equipos && (
                    <p className="text-red-500 text-xs mt-1 mb-2">{errors.equipos}</p>
                  )}
                  <Button
                    type="button"
                    onClick={addEquipo}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 flex items-center gap-2 disabled:opacity-60"
                    disabled={clientSelectionRequired && !hasSelectedClient}
                  >
                    <FiPlus /> Agregar equipo
                  </Button>
                  {clientSelectionRequired && !hasSelectedClient && (
                    <p className="text-xs text-gray-500 mt-2">Selecciona un cliente para habilitar el listado de equipos.</p>
                  )}
                </div>
              )}

              <div className="mt-5 border-t pt-3 border-gray-200 dark:border-gray-600">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Adjuntos (opcional)
                </p>
                <FileUploader
                  multiple
                  helper="Arrastra o selecciona PDFs / imágenes"
                  onFilesSelected={(selected) =>
                    setFiles((prev) => [...prev, ...selected])
                  }
                />
                {files.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {files.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <span className="truncate text-gray-700 dark:text-gray-200">
                          {file.name} ({Math.round(file.size / 1024)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-red-500 text-xs font-semibold hover:underline"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={onClose}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <FiSend /> Enviar
                </Button>
              </div>
            </form>
          )}

          {type === "cliente" && (
            <NewClientRequestForm
              className="mt-2"
              showIntro={false}
              onCancel={onClose}
              onSuccess={() => {
                onClose();
              }}
              successMessage={isEditing ? "Solicitud actualizada correctamente." : "Solicitud registrada. El consentimiento quedó auditado o se envió al cliente automáticamente."}
              initialData={initialData}
              isEditing={isEditing}
            />
          )}
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default CreateRequestModal;
