import React, { useMemo, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useUI } from "../../../core/ui/useUI";
import { createClientRequest } from "../../../core/api/requestsApi";

const COMMON_REQUIRED_FIELDS = [
  "commercial_name",
  "ruc_cedula",
  "client_email",
  "establishment_name",
  "establishment_province",
  "establishment_city",
  "establishment_address",
  "establishment_reference",
  "establishment_phone",
  "establishment_cellphone",
  "shipping_contact_name",
  "shipping_address",
  "shipping_city",
  "shipping_province",
  "shipping_reference",
  "shipping_phone",
  "shipping_cellphone",
  "shipping_delivery_hours",
  "legal_rep_name",
  "legal_rep_position",
  "legal_rep_id_document",
  "legal_rep_cellphone",
  "legal_rep_email",
  "operating_permit_status",
];

const NATURAL_REQUIRED_FIELDS = ["natural_person_firstname", "natural_person_lastname"];

const LEGAL_REQUIRED_FIELDS = [
  "legal_person_business_name",
  "nationality",
];

const FILE_REQUIREMENTS = {
  id_file: {
    label: "Documento de identificación del solicitante",
    helper: "Formato PDF, máximo 10 MB.",
  },
  ruc_file: {
    label: "RUC del cliente",
    helper: "Obligatorio para todos los clientes (PDF).",
  },
  legal_rep_appointment_file: {
    label: "Nombramiento del representante legal",
    helper: "Solo personas jurídicas (PDF).",
  },
  operating_permit_file: {
    label: "Permiso de funcionamiento",
    helper: "Adjunta solo si el cliente ya cuenta con permiso vigente.",
  },
};

const initialFormState = {
  data_processing_consent: false,
  client_type: "persona_natural",
  natural_person_firstname: "",
  natural_person_lastname: "",
  legal_person_business_name: "",
  commercial_name: "",
  establishment_name: "",
  ruc_cedula: "",
  nationality: "",
  client_email: "",
  establishment_province: "",
  establishment_city: "",
  establishment_address: "",
  establishment_reference: "",
  establishment_phone: "",
  establishment_cellphone: "",
  legal_rep_name: "",
  legal_rep_position: "",
  legal_rep_id_document: "",
  legal_rep_cellphone: "",
  legal_rep_email: "",
  shipping_contact_name: "",
  shipping_address: "",
  shipping_city: "",
  shipping_province: "",
  shipping_reference: "",
  shipping_phone: "",
  shipping_cellphone: "",
  shipping_delivery_hours: "",
  operating_permit_status: "does_not_have_it",
};

const initialFilesState = {
  id_file: null,
  ruc_file: null,
  legal_rep_appointment_file: null,
  operating_permit_file: null,
};

const requiredFilesByType = (type, permitStatus) => {
  const files = ["id_file", "ruc_file"];
  if (type === "persona_juridica") {
    files.push("legal_rep_appointment_file");
  }
  if (permitStatus === "has_it") {
    files.push("operating_permit_file");
  }
  return files;
};

const NewClientRequestForm = ({
  className = "",
  canUploadFiles = true,
  onCancel,
  onSuccess,
  showIntro = true,
  successMessage = "Solicitud registrada. El cliente recibirá el correo para confirmar el uso de datos.",
}) => {
  const { showToast } = useUI();
  const [formData, setFormData] = useState(initialFormState);
  const [files, setFiles] = useState(initialFilesState);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const requiredFiles = useMemo(
    () => requiredFilesByType(formData.client_type, formData.operating_permit_status),
    [formData.client_type, formData.operating_permit_status],
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

    if (name === "client_type" && value === "persona_natural") {
      setFiles((prev) => ({ ...prev, legal_rep_appointment_file: null }));
    }
    if (name === "operating_permit_status" && value !== "has_it") {
      setFiles((prev) => ({ ...prev, operating_permit_file: null }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    const file = selectedFiles?.[0] || null;
    setFiles((prev) => ({ ...prev, [name]: file }));
    setErrors((prev) => {
      if (!prev.files) return prev;
      const nextFiles = { ...prev.files };
      delete nextFiles[name];
      const next = { ...prev };
      if (Object.keys(nextFiles).length) {
        next.files = nextFiles;
      } else {
        delete next.files;
      }
      return next;
    });
  };

  const validateForm = () => {
    const validationErrors = {};
    if (!formData.data_processing_consent) {
      validationErrors.data_processing_consent = "Debes registrar la aceptación del tratamiento de datos.";
    }

    const checkField = (field) => {
      const value = (formData[field] || "").trim();
      if (!value) {
        validationErrors[field] = "Este campo es obligatorio.";
      }
    };

    COMMON_REQUIRED_FIELDS.forEach(checkField);
    if (formData.client_type === "persona_natural") {
      NATURAL_REQUIRED_FIELDS.forEach(checkField);
    } else {
      LEGAL_REQUIRED_FIELDS.forEach(checkField);
    }

    if (!canUploadFiles) {
      validationErrors.filesPermission = "No tienes permisos para adjuntar documentos de clientes.";
    } else {
      const missingFiles = requiredFiles.filter((field) => !files[field]);
      if (missingFiles.length) {
        validationErrors.files = missingFiles.reduce((acc, field) => {
          acc[field] = "Adjunta este documento";
          return acc;
        }, {});
      }
    }

    return validationErrors;
  };

  const resetForm = () => {
    setFormData({ ...initialFormState });
    setFiles({ ...initialFilesState });
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      showToast("Por favor completa la información obligatoria.", "warning");
      return;
    }

    setLoading(true);
    try {
      await createClientRequest(formData, files);
      showToast(successMessage, "success");
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error("Error al crear solicitud de cliente:", error);
      const message = error.response?.data?.message || error.message || "Error al crear la solicitud";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const disabledBody = !formData.data_processing_consent;
  const disableFiles = !canUploadFiles || disabledBody;

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {showIntro && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <FiAlertCircle className="mt-0.5 flex-shrink-0 text-xl" />
          <p className="text-sm leading-relaxed">
            Esta ficha recopila todos los datos necesarios para habilitar a un nuevo cliente. Una vez enviada la solicitud,
            el sistema notificará automáticamente al cliente para que confirme el uso de sus datos (LOPDP).
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-blue-200 bg-white/80 p-4 shadow-sm dark:border-blue-900/40 dark:bg-slate-900/60">
        <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-100">
          <input
            type="checkbox"
            name="data_processing_consent"
            checked={formData.data_processing_consent}
            onChange={handleChange}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Declaro que el cliente ha autorizado el tratamiento de sus datos personales y la recepción de comunicaciones para este proceso.
          </span>
        </label>
        {errors.data_processing_consent && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors.data_processing_consent}</p>
        )}
      </div>

      <fieldset
        disabled={disabledBody}
        className={`space-y-6 ${disabledBody ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <Section title="Tipo de cliente">
          <div className="md:col-span-2">
            <RadioGroup
              name="client_type"
              value={formData.client_type}
              onChange={handleChange}
              options={[
                { label: "Persona natural", value: "persona_natural" },
                { label: "Persona jurídica", value: "persona_juridica" },
              ]}
            />
          </div>
        </Section>

        {formData.client_type === "persona_natural" ? (
          <Section title="Datos del cliente (persona natural)">
            <InputField
              name="natural_person_firstname"
              label="Nombres"
              value={formData.natural_person_firstname}
              onChange={handleChange}
              required
              error={errors.natural_person_firstname}
            />
            <InputField
              name="natural_person_lastname"
              label="Apellidos"
              value={formData.natural_person_lastname}
              onChange={handleChange}
              required
              error={errors.natural_person_lastname}
            />
            <InputField
              name="commercial_name"
              label="Nombre comercial"
              value={formData.commercial_name}
              onChange={handleChange}
              required
              error={errors.commercial_name}
            />
            <InputField
              name="ruc_cedula"
              label="RUC/Cédula"
              value={formData.ruc_cedula}
              onChange={handleChange}
              required
              error={errors.ruc_cedula}
            />
            <InputField
              name="client_email"
              label="Correo de contacto"
              type="email"
              value={formData.client_email}
              onChange={handleChange}
              required
              error={errors.client_email}
            />
          </Section>
        ) : (
          <Section title="Datos del cliente (persona jurídica)">
            <InputField
              name="legal_person_business_name"
              label="Razón social"
              value={formData.legal_person_business_name}
              onChange={handleChange}
              required
              error={errors.legal_person_business_name}
            />
            <InputField
              name="commercial_name"
              label="Nombre comercial"
              value={formData.commercial_name}
              onChange={handleChange}
              required
              error={errors.commercial_name}
            />
            <InputField
              name="ruc_cedula"
              label="RUC"
              value={formData.ruc_cedula}
              onChange={handleChange}
              required
              error={errors.ruc_cedula}
            />
            <InputField
              name="nationality"
              label="Nacionalidad"
              value={formData.nationality}
              onChange={handleChange}
              required
              error={errors.nationality}
            />
            <InputField
              name="client_email"
              label="Correo de contacto"
              type="email"
              value={formData.client_email}
              onChange={handleChange}
              required
              error={errors.client_email}
            />
          </Section>
        )}

        <Section title="Datos del establecimiento">
          <InputField
            name="establishment_name"
            label="Nombre del establecimiento"
            value={formData.establishment_name}
            onChange={handleChange}
            required
            error={errors.establishment_name}
          />
          <InputField
            name="establishment_province"
            label="Provincia"
            value={formData.establishment_province}
            onChange={handleChange}
            required
            error={errors.establishment_province}
          />
          <InputField
            name="establishment_city"
            label="Ciudad"
            value={formData.establishment_city}
            onChange={handleChange}
            required
            error={errors.establishment_city}
          />
          <InputField
            name="establishment_address"
            label="Dirección"
            value={formData.establishment_address}
            onChange={handleChange}
            required
            error={errors.establishment_address}
          />
          <InputField
            name="establishment_reference"
            label="Referencia"
            value={formData.establishment_reference}
            onChange={handleChange}
            required
            error={errors.establishment_reference}
          />
          <InputField
            name="establishment_phone"
            label="Teléfono"
            value={formData.establishment_phone}
            onChange={handleChange}
            required
            error={errors.establishment_phone}
          />
          <InputField
            name="establishment_cellphone"
            label="Celular"
            value={formData.establishment_cellphone}
            onChange={handleChange}
            required
            error={errors.establishment_cellphone}
          />
        </Section>

        <Section title="Representante legal y contacto">
          <InputField
            name="legal_rep_name"
            label="Nombre completo"
            value={formData.legal_rep_name}
            onChange={handleChange}
            required
            error={errors.legal_rep_name}
          />
          <InputField
            name="legal_rep_position"
            label="Cargo"
            value={formData.legal_rep_position}
            onChange={handleChange}
            required
            error={errors.legal_rep_position}
          />
          <InputField
            name="legal_rep_id_document"
            label="Documento de identificación"
            value={formData.legal_rep_id_document}
            onChange={handleChange}
            required
            error={errors.legal_rep_id_document}
          />
          <InputField
            name="legal_rep_cellphone"
            label="Teléfono celular"
            value={formData.legal_rep_cellphone}
            onChange={handleChange}
            required
            error={errors.legal_rep_cellphone}
          />
          <InputField
            name="legal_rep_email"
            label="Correo electrónico"
            type="email"
            value={formData.legal_rep_email}
            onChange={handleChange}
            required
            error={errors.legal_rep_email}
          />
        </Section>
        <Section title="Datos para el envío de mercadería">
          <InputField
            name="shipping_contact_name"
            label="Nombre del encargado"
            value={formData.shipping_contact_name}
            onChange={handleChange}
            required
            error={errors.shipping_contact_name}
          />
          <InputField
            name="shipping_address"
            label="Dirección"
            value={formData.shipping_address}
            onChange={handleChange}
            required
            error={errors.shipping_address}
          />
          <InputField
            name="shipping_city"
            label="Ciudad"
            value={formData.shipping_city}
            onChange={handleChange}
            required
            error={errors.shipping_city}
          />
          <InputField
            name="shipping_province"
            label="Provincia"
            value={formData.shipping_province}
            onChange={handleChange}
            required
            error={errors.shipping_province}
          />
          <InputField
            name="shipping_reference"
            label="Referencia"
            value={formData.shipping_reference}
            onChange={handleChange}
            required
            error={errors.shipping_reference}
          />
          <InputField
            name="shipping_phone"
            label="Teléfono"
            value={formData.shipping_phone}
            onChange={handleChange}
            required
            error={errors.shipping_phone}
          />
          <InputField
            name="shipping_cellphone"
            label="Celular"
            value={formData.shipping_cellphone}
            onChange={handleChange}
            required
            error={errors.shipping_cellphone}
          />
          <InputField
            name="shipping_delivery_hours"
            label="Horario de entregas"
            value={formData.shipping_delivery_hours}
            onChange={handleChange}
            required
            error={errors.shipping_delivery_hours}
          />
        </Section>

        <Section title="Documentos y permisos">
          <div className="md:col-span-2">
            <RadioGroup
              name="operating_permit_status"
              value={formData.operating_permit_status}
              onChange={handleChange}
              options={[
                { label: "No cuenta con permiso", value: "does_not_have_it" },
                { label: "En trámite", value: "in_progress" },
                { label: "Tiene permiso vigente", value: "has_it" },
              ]}
            />
          </div>
          <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(FILE_REQUIREMENTS).map(([key, meta]) => (
              <FileInput
                key={key}
                name={key}
                label={meta.label}
                helper={meta.helper}
                onChange={handleFileChange}
                required={requiredFiles.includes(key)}
                error={errors.files?.[key]}
                disabled={disableFiles}
              />
            ))}
          </div>
          {!canUploadFiles && (
            <p className="md:col-span-2 text-xs text-amber-600 dark:text-amber-300">
              Contacta a tu jefe comercial para habilitar la carga de documentos.
            </p>
          )}
          {errors.filesPermission && (
            <p className="md:col-span-2 text-xs text-red-600 dark:text-red-400">{errors.filesPermission}</p>
          )}
        </Section>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            disabled={loading}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading ? "Enviando solicitud..." : "Enviar solicitud"}
        </button>
      </div>
    </form>
  );
};

const Section = ({ title, children }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
    <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
  </section>
);

const InputField = ({ label, name, value, onChange, type = "text", required = false, error }) => (
  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
    {label} {required && <span className="text-red-500">*</span>}
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-gray-800 dark:text-gray-100 ${
        error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-300 dark:border-gray-600"
      }`}
    />
    {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
  </label>
);

const FileInput = ({ label, name, onChange, required, helper, error, disabled }) => (
  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
    {label} {required && <span className="text-red-500">*</span>}
    <input
      type="file"
      name={name}
      accept="application/pdf"
      onChange={onChange}
      disabled={disabled}
      className={`mt-2 w-full cursor-pointer rounded-xl border border-dashed px-3 py-2 text-sm text-gray-700 transition hover:border-blue-400 dark:border-gray-600 dark:text-gray-200 ${
        error ? "border-red-400" : "border-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    />
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
    {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
  </label>
);

const RadioGroup = ({ name, value, onChange, options }) => (
  <div className="flex flex-wrap gap-4">
    {options.map((option) => (
      <label key={option.value} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={onChange}
          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        {option.label}
      </label>
    ))}
  </div>
);

export default NewClientRequestForm;
