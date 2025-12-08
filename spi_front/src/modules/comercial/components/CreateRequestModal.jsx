// src/modules/comercial/components/CreateRequestModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "@headlessui/react";
import { FiSend, FiX, FiPlus, FiTrash2, FiPhone } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import FileUploader from "../../../core/ui/components/FileUploader";
import { createRequest } from "../../../core/api/requestsApi";
import { getUsers } from "../../../core/api/usersApi";
import { useUI } from "../../../core/ui/useUI";

const CLIENT_REQUIRED_FILES = [
  { key: "doc1", label: "Archivo obligatorio 1" },
  { key: "doc2", label: "Archivo obligatorio 2" },
  { key: "doc3", label: "Archivo obligatorio 3" },
];

const INITIAL_CLIENT_FILES_STATE = CLIENT_REQUIRED_FILES.reduce(
  (acc, { key }) => ({ ...acc, [key]: null }),
  {}
);

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
const PhoneNumberInput = ({ name, value, onChange, error }) => {
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
  inspection: { nombre_equipo: "", estado: "nuevo" },
  retiro: { nombre_equipo: "", cantidad: 1 },
  compra: { nombre_equipo: "", estado: "nuevo" },
};

const EquipoInput = ({ index, equipo, updateEquipo, type, removeEquipo }) => {
  const keys = Object.keys(requestTypesForEquipments[type] || {});

  const isStateField = (k) => k === "estado" && (type === "inspection" || type === "compra");
  const isQuantityField = (k) => k === "cantidad";

  return (
    <div className="flex items-center gap-2 mb-2 flex-wrap sm:flex-nowrap w-full">
      {keys.map((k) => (
        <div key={k} className="flex-1 min-w-[100px]">
          {isStateField(k) ? (
            <select
              value={equipo[k]}
              onChange={(e) => updateEquipo(index, k, e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white capitalize"
            >
              <option value="nuevo">Nuevo</option>
              <option value="usado">Usado</option>
            </select>
          ) : (
            <input
              type={isQuantityField(k) ? "number" : "text"}
              placeholder={k.replaceAll("_", " ")}
              value={equipo[k]}
              min={isQuantityField(k) ? 1 : null}
              onChange={(e) => updateEquipo(index, k, isQuantityField(k) ? parseInt(e.target.value) || 1 : e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => removeEquipo(index)}
        className="text-red-500 hover:text-red-700 p-2"
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
const CreateRequestModal = ({ open, onClose, onCreated }) => {
  const [type, setType] = useState(null);
  const [formData, setFormData] = useState({});
  const [equipos, setEquipos] = useState([]);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [clientFiles, setClientFiles] = useState(INITIAL_CLIENT_FILES_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const todayDateString = useMemo(() => TODAY, []);
  const { showToast } = useUI();

  const resetClientFiles = () => setClientFiles({ ...INITIAL_CLIENT_FILES_STATE });

  const setClientFile = (key, file) => {
    setClientFiles((prev) => ({ ...prev, [key]: file || null }));
    if (errors.clientFiles) {
      setErrors((prev) => ({ ...prev, clientFiles: null }));
    }
  };

  const removeClientFile = (key) => {
    setClientFile(key, null);
  };

  useEffect(() => {
    if (!open) return;
    const loadClients = async () => {
      try {
        setLoadingClients(true);
        const data = await getUsers();
        setClients(
          (data || [])
            .map((u) => u.fullname || u.name || u.email)
            .filter(Boolean)
        );
      } catch (err) {
        console.error("No se pudo cargar la lista de clientes", err);
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, [open]);

  // ✅ Validar formulario
  const validateForm = () => {
    if (!type) return false;
    const newErrors = {};
    const requiredFields = requestTypes[type].required;

    // 1. Validaciones de Campos Requeridos
    requiredFields.forEach((field) => {
      const value = typeof formData[field] === "string" ? formData[field].trim() : formData[field];
      if (!value) {
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
    
    // 4. Validar equipos con estado
    if (requestTypes[type].equipos?.estado) {
        equipos.forEach((eq, i) => {
            if (!eq.nombre_equipo || !eq.estado) {
                newErrors.equipos = "Todos los equipos deben tener nombre y estado seleccionado.";
            }
        });
    }

    if (type === "cliente") {
      const requiredDocs = Object.values(clientFiles).filter(Boolean).length;
      if (requiredDocs < CLIENT_REQUIRED_FILES.length) {
        newErrors.clientFiles = "Debes adjuntar los 3 archivos obligatorios para registrar al cliente.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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

  const buildFieldErrorMap = (validationErrors = []) => {
    const map = {};
    validationErrors.forEach((err) => {
      const key = (err.instancePath || err.keyword || "").replace("/", "");
      if (key) map[key] = err.message || "Campo inválido";
    });
    return map;
  };

  // ✅ Envío al backend (ya estructurado)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerErrors([]);
    if (!validateForm()) return;

    const payload = { ...formData };
    if (equipos.length > 0) payload.equipos = equipos;

    try {
      setSubmitting(true);
      await createRequest({ request_type_id: type, payload, files });
      showToast("Solicitud enviada correctamente ✅", "success");
      if (onCreated) onCreated();
      // Limpiar estado
      setFiles([]);
      setFormData({});
      setEquipos([]);
      setErrors({});
      setType(null);
      resetClientFiles();
      onClose?.();
    } catch (err) {
      console.error("Error al crear solicitud", err);
      const validationErrors = err?.response?.data?.details || err?.validationErrors || [];
      const parsedErrors = Array.isArray(validationErrors)
        ? validationErrors
        : Array.isArray(validationErrors?.errors)
        ? validationErrors.errors
        : [];
      if (parsedErrors.length) {
        const fieldMap = buildFieldErrorMap(parsedErrors);
        setErrors((prev) => ({ ...prev, ...fieldMap }));
        setServerErrors(parsedErrors.map((e) => e.message || JSON.stringify(e)));
        showToast("Revisa los campos requeridos", "error");
      } else {
        const message = err?.response?.data?.message || "No se pudo crear la solicitud";
        setServerErrors([message]);
        showToast(message, "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full shadow-xl overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
              Nueva Solicitud
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Tipo de solicitud */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
              Tipo de solicitud
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-gray-900 dark:text-white"
              onChange={(e) => {
                setType(e.target.value || null);
                setFormData({});
                setEquipos([]);
                setErrors({});
                setServerErrors([]);
              }}
              value={type || ""}
            >
              <option value="">Seleccione una opción</option>
              {Object.entries(requestTypes).map(([id, info]) => (
                <option key={id} value={id}>
                  {info.title}
                </option>
              ))}
            </select>
          </div>

          {serverErrors.length > 0 && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold mb-1">Corrige los siguientes puntos:</p>
              <ul className="list-disc list-inside space-y-1">
                {serverErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Campos dinámicos */}
          {type && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {requestTypes[type].fields.map((f) => (
                <div key={f}>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 capitalize">
                    {f.replaceAll("_", " ")}
                    {requestTypes[type].required.includes(f) && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>

                  {/* 📞 Input de Teléfono Personalizado */}
                  {f === "celular_contacto" ? (
                    <PhoneNumberInput
                      name={f}
                      value={formData[f] || COUNTRIES[0].dialCode}
                      onChange={handleChange}
                      error={errors[f]}
                    />
                  ) : f === "nombre_cliente" ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        name={f}
                        list="clientes-options"
                        placeholder="Selecciona o escribe el cliente"
                        value={formData[f] || ""}
                        onChange={handleChange}
                        className={`w-full p-2 rounded-lg border ${
                          errors[f] ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                        } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                      />
                      <datalist id="clientes-options">
                        {clients.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      {loadingClients && (
                        <p className="text-xs text-gray-500">Cargando clientes...</p>
                      )}
                    </div>
                  ) : f === "requiere_lis" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={f}
                        checked={formData[f] || false}
                        onChange={handleChange}
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
                      className={`w-full p-2 rounded-lg border ${
                        errors[f]
                          ? "border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
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
                    />
                  ))}
                  {errors.equipos && (
                    <p className="text-red-500 text-xs mt-1 mb-2">{errors.equipos}</p>
                  )}
                <Button
                    type="button"
                    onClick={addEquipo}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 flex items-center gap-2"
                >
                    <FiPlus /> Agregar equipo
                </Button>
                </div>
              )}

{/* 📎 Adjuntos especiales SOLO si es registro de nuevo cliente */}
{type === "cliente" && (
  <div className="mt-5 border-t pt-3 border-gray-200 dark:border-gray-600">
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
      Documentos obligatorios para registrar cliente
    </p>

    {[
      { key: "doc1", label: "Nombramiento del representante legal" },
      { key: "doc2", label: "RUC" },
      { key: "doc3", label: "Cédula del representante legal" },
    ].map(({ key, label }) => (
      <div key={key} className="mb-4">
        <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">
          {label} <span className="text-red-500">*</span>
        </label>

        {clientFiles[key] ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
            <span className="truncate text-gray-900 dark:text-white text-sm">
              📄 {clientFiles[key].name} ({Math.round(clientFiles[key].size / 1024)} KB)
            </span>
            <button
              type="button"
              className="text-red-500 text-xs font-semibold hover:underline"
              onClick={() => removeClientFile(key)}
            >
              Quitar
            </button>
          </div>
        ) : (
          <FileUploader
            multiple={false}
            helper="Sube PDF o imagen"
            onFilesSelected={(files) => setClientFile(key, files[0])}
          />
        )}
      </div>
    ))}

    {errors.clientFiles && (
      <p className="text-red-500 text-xs mt-1">{errors.clientFiles}</p>
    )}
  </div>
)}


{type !== "cliente" && (
  <div className="mt-5 border-t pt-3 border-gray-200 dark:border-gray-600">
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
      Adjuntos (opcional)
    </p>
    <input
      type="file"
      multiple
      onChange={(e) =>
        setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
      }
      className="mb-3 block w-full text-sm text-gray-700 dark:text-gray-200"
    />
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
)}

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
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  >
                    <FiSend /> Enviar
                  </Button>
              </div>
            </form>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default CreateRequestModal;
