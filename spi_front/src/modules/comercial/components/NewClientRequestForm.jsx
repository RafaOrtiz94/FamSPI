import React, { useEffect, useMemo, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useUI } from "../../../core/ui/useUI";
import {
  createClientRequest,
  updateClientRequest,
  sendConsentEmailToken,
  verifyConsentEmailToken,
} from "../../../core/api/requestsApi";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";
import {
  getCityOptions,
  getCountryOptions,
  getProvinceOptions,
} from "../constants/locationOptions";

const COMMON_REQUIRED_FIELDS = [
  "commercial_name",
  "ruc_cedula",
  "client_email",
  "establishment_country",
  "establishment_name",
  "establishment_province",
  "establishment_city",
  "establishment_address",
  "establishment_reference",
  "establishment_cellphone",
  "shipping_contact_name",
  "shipping_country",
  "shipping_address",
  "shipping_city",
  "shipping_province",
  "shipping_reference",
  "shipping_cellphone",
];

const NATURAL_REQUIRED_FIELDS = ["natural_person_firstname", "natural_person_lastname"];

const LEGAL_REQUIRED_FIELDS = [
  "nationality",
];

const LEGAL_REP_REQUIRED_FIELDS = [
  "legal_rep_name",
  "legal_rep_position",
  "legal_rep_id_document",
  "legal_rep_cellphone",
  "legal_rep_email",
];

const FILE_REQUIREMENTS = {
  id_file: {
    label: "Documento de identificación del cliente",
    helper: "Formato PDF, máximo 10 MB.",
  },
  ruc_file: {
    label: "RUC del cliente",
    helper: "Opcional (PDF).",
  },
  legal_rep_appointment_file: {
    label: "Nombramiento del representante legal",
    helper: "Solo personas jurídicas (PDF).",
  },
  bpadt_certification_file: {
    label: "Certificación BPADT",
    helper: "Solo sub distribuidores (PDF).",
  },
  operating_permit_file: {
    label: "Permiso de funcionamiento",
    helper: "Solo sub distribuidores (PDF).",
  },
  consent_evidence_file: {
    label: "Evidencia del consentimiento",
    helper: "Documento firmado u otro respaldo. Requerido si eliges 'Documento firmado'.",
  },
};

const CONSENT_METHOD_OPTIONS = [
  {
    value: "email_link",
    title: "Correo automático",
    description:
      "El sistema enviará un enlace auditable al cliente y registrará la IP/fecha cuando confirme.",
  },
  {
    value: "signed_document",
    title: "Documento firmado",
    description:
      "Ya cuentas con un documento de aceptación firmado. Adjunta el PDF y registra cómo se obtuvo.",
  },
  {
    value: "other",
    title: "Otro medio verificable",
    description:
      "Describe el medio utilizado (llamada grabada, formulario físico, etc.) y adjunta evidencia opcional.",
  },
];

const initialFormState = {
  data_processing_consent: false,
  consent_capture_method: "email_link",
  consent_capture_details: "",
  consent_email_token_id: "",
  consent_recipient_email: "",
  client_sector: "privado", // Nuevo campo: público o privado
  client_type: "persona_natural",
  natural_person_document_type: "cedula",
  natural_person_firstname: "",
  natural_person_lastname: "",
  legal_person_business_name: "",
  commercial_name: "",
  establishment_country: "Ecuador",
  establishment_name: "",
  ruc_cedula: "",
  nationality: "",
  client_email: "",
  establishment_province: "",
  establishment_city: "",
  establishment_address: "",
  establishment_reference: "",
  establishment_cellphone: "",
  legal_rep_name: "",
  legal_rep_position: "",
  legal_rep_id_document: "",
  legal_rep_cellphone: "",
  legal_rep_email: "",
  shipping_contact_name: "",
  shipping_country: "Ecuador",
  shipping_address: "",
  shipping_city: "",
  shipping_province: "",
  shipping_reference: "",
  shipping_cellphone: "",
  participates_public_procurement: false,
  public_process_codes: "",
  has_specific_delivery_schedule: false,
  shipping_delivery_start_time: "",
  shipping_delivery_end_time: "",
  shipping_delivery_hours: "",
  operating_permit_status: "does_not_have_it",
};

const initialFilesState = {
  id_file: null,
  ruc_file: null,
  legal_rep_appointment_file: null,
  bpadt_certification_file: null,
  operating_permit_file: null,
  consent_evidence_file: null,
};

const requiredFilesByType = (type, clientSector, consentMethod) => {
  const isPublicSector = String(clientSector || "").toLowerCase() === "publico";
  const files = isPublicSector ? [] : ["id_file"];
  const normalizedType = String(type || "").toLowerCase();
  const isSubDistributor = normalizedType === "sub_distribuidor";
  if (!isPublicSector && type === "persona_juridica") {
    files.push("legal_rep_appointment_file");
  }
  if (!isPublicSector && isSubDistributor) {
    files.push(
      "ruc_file",
      "legal_rep_appointment_file",
      "bpadt_certification_file",
      "operating_permit_file",
    );
  }
  if (!isPublicSector && consentMethod === "signed_document") {
    files.push("consent_evidence_file");
  }
  return files;
};

const NewClientRequestForm = ({
  className = "",
  onCancel,
  onSuccess,
  showIntro = true,
  successMessage = "Solicitud registrada. El consentimiento se gestionará según el método elegido.",
  initialData = null,
  isEditing = false,
}) => {
  const { showToast } = useUI();
  const [formData, setFormData] = useState(
    initialData
      ? {
          ...initialFormState,
          ...initialData,
          natural_person_document_type:
            initialData?.natural_person_document_type
            || (String(initialData?.ruc_cedula || "").trim().length === 13 ? "ruc" : "cedula"),
          data_processing_consent: true,
        } // Asumimos consentimiento si ya existe (o se debe volver a pedir?)
      : initialFormState
  );
  const [files, setFiles] = useState(initialFilesState);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(null);
  const [consentTokenState, setConsentTokenState] = useState({
    status: "idle",
    tokenId: null,
    expiresAt: null,
    verifiedAt: null,
    lastEmail: "",
  });
  const [consentTokenCode, setConsentTokenCode] = useState("");

  const countryOptions = useMemo(() => getCountryOptions(), []);
  const establishmentProvinceOptions = useMemo(
    () => getProvinceOptions(formData.establishment_country),
    [formData.establishment_country],
  );
  const establishmentCityOptions = useMemo(
    () => getCityOptions(formData.establishment_country, formData.establishment_province),
    [formData.establishment_country, formData.establishment_province],
  );
  const shippingProvinceOptions = useMemo(
    () => getProvinceOptions(formData.shipping_country),
    [formData.shipping_country],
  );
  const shippingCityOptions = useMemo(
    () => getCityOptions(formData.shipping_country, formData.shipping_province),
    [formData.shipping_country, formData.shipping_province],
  );

  const requiredFiles = useMemo(
    () =>
      requiredFilesByType(
        formData.client_type,
        formData.client_sector,
        formData.consent_capture_method,
      ),
    [formData.client_type, formData.client_sector, formData.consent_capture_method],
  );

  const submissionSteps = useMemo(
    () => [
      { id: "validating", label: "Validando datos críticos" },
      { id: "uploading", label: "Adjuntando evidencias y anexos" },
      { id: "submitting", label: "Registrando solicitud" },
      {
        id: "notifying",
        label: "Confirmando envío",
        description: "Activando recordatorios y flujos de consentimiento",
      },
    ],
    [],
  );

  useEffect(() => {
    if (!initialData?.consent_email_token_id) return;

    setConsentTokenState((prev) => ({
      ...prev,
      status: "verified",
      tokenId: initialData.consent_email_token_id,
      verifiedAt: initialData.consent_email_verified_at || prev.verifiedAt,
      lastEmail: (initialData.consent_recipient_email || initialData.client_email || "").toLowerCase(),
    }));
    setConsentTokenCode("");
  }, [initialData]);

  useEffect(() => {
    const raw = initialData?.shipping_delivery_hours || "";
    if (!raw) return;
    const match = String(raw).match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return;
    const start = `${match[1]}:${match[2]}`;
    const end = `${match[3]}:${match[4]}`;
    setFormData((prev) => ({
      ...prev,
      has_specific_delivery_schedule: true,
      shipping_delivery_start_time: prev.shipping_delivery_start_time || start,
      shipping_delivery_end_time: prev.shipping_delivery_end_time || end,
    }));
  }, [initialData]);

  const resetConsentTokenFlow = () => {
    setConsentTokenState({ status: "idle", tokenId: null, expiresAt: null, verifiedAt: null, lastEmail: "" });
    setConsentTokenCode("");
    setFormData((prev) => ({ ...prev, consent_email_token_id: "" }));
    setErrors((prev) => {
      if (!prev.consent_email_token_id && !prev.consent_recipient_email) return prev;
      const next = { ...prev };
      if (next.consent_email_token_id) delete next.consent_email_token_id;
      if (next.consent_recipient_email) delete next.consent_recipient_email;
      return next;
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => {
      let nextValue = type === "checkbox" ? checked : value;
      if (name === "ruc_cedula") {
        nextValue = String(nextValue).replace(/\D/g, "");
      }
      const nextState = { ...prev, [name]: nextValue };

      // Si cambia el email del cliente, sincronizar con consent_recipient_email
      if (name === "client_email") {
        if (!prev.consent_recipient_email || prev.consent_recipient_email === prev.client_email) {
          nextState.consent_recipient_email = nextValue;
        }
      }

      if (name === "establishment_country") {
        nextState.establishment_province = "";
        nextState.establishment_city = "";
      }

      if (name === "shipping_country") {
        nextState.shipping_province = "";
        nextState.shipping_city = "";
      }

      if (name === "establishment_province") {
        nextState.establishment_city = "";
      }

      if (name === "shipping_province") {
        nextState.shipping_city = "";
      }

      if (name === "has_specific_delivery_schedule" && !nextValue) {
        nextState.shipping_delivery_start_time = "";
        nextState.shipping_delivery_end_time = "";
        nextState.shipping_delivery_hours = "";
      }
      if (name === "participates_public_procurement" && !nextValue) {
        nextState.public_process_codes = "";
      }

      // Si el sector es público, siempre debe ser persona jurídica
      if (name === "client_sector" && value === "publico") {
        nextState.client_type = "persona_juridica";
      }
      if (name === "natural_person_document_type") {
        nextState.ruc_cedula = "";
      }

      return nextState;
    });
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

    if (name === "client_type" && value === "persona_natural") {
      setFiles((prev) => ({
        ...prev,
        legal_rep_appointment_file: null,
        bpadt_certification_file: null,
        operating_permit_file: null,
      }));
    }
    // Solo resetear token si no está verificado aún
    if (name === "client_email" || name === "consent_recipient_email") {
      const normalized = value.trim().toLowerCase();
      if (consentTokenState.lastEmail && normalized !== consentTokenState.lastEmail && consentTokenState.status !== "verified") {
        resetConsentTokenFlow();
      }
    }
    if (name === "data_processing_consent" && !checked) {
      resetConsentTokenFlow();
    }
  };

  const handleConsentMethodChange = (value) => {
    if (!formData.data_processing_consent) return;
    setFormData((prev) => ({
      ...prev,
      consent_capture_method: value,
      consent_capture_details: value === "email_link" ? "" : prev.consent_capture_details,
    }));
    if (value !== "email_link") {
      resetConsentTokenFlow();
    }
    if (value !== "signed_document") {
      setFiles((prev) => ({ ...prev, consent_evidence_file: null }));
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.consent_capture_method;
      delete next.consent_capture_details;
      if (next.files?.consent_evidence_file && value !== "signed_document") {
        const filesErrors = { ...next.files };
        delete filesErrors.consent_evidence_file;
        next.files = Object.keys(filesErrors).length ? filesErrors : undefined;
      }
      return next;
    });
  };

  const guessClientDisplayName = () => {
    if (formData.client_type === "persona_natural") {
      return `${formData.natural_person_firstname || ""} ${formData.natural_person_lastname || ""}`.trim();
    }
    return formData.legal_person_business_name || formData.commercial_name || "";
  };

  const handleSendConsentToken = async () => {
    if (disabledBody) return;
    const email = (formData.consent_recipient_email || formData.client_email || "").trim();
    if (!email) {
      setErrors((prev) => ({
        ...prev,
        consent_recipient_email: "Ingresa el correo al que enviaremos el código",
      }));
      showToast("Necesitas un correo de cliente válido para enviar el código.", "warning");
      return;
    }
    setConsentTokenState((prev) => ({ ...prev, status: "sending" }));
    try {
      const response = await sendConsentEmailToken({
        consent_recipient_email: email,
        client_email: formData.client_email,
        client_name: guessClientDisplayName(),
      });
      setConsentTokenState({
        status: "sent",
        tokenId: response.token_id,
        expiresAt: response.expires_at,
        verifiedAt: null,
        lastEmail: email.toLowerCase(),
      });
      setConsentTokenCode("");
      setFormData((prev) => ({ ...prev, consent_email_token_id: "" }));
      showToast("Enviamos el código al correo del cliente.", "info");
    } catch (error) {
      console.error("Error al enviar token de consentimiento", error);
      setConsentTokenState((prev) => ({ ...prev, status: "idle" }));
      const message = error.response?.data?.message || error.message || "No pudimos enviar el código";
      showToast(message, "error");
    }
  };

  const handleVerifyConsentToken = async () => {
    if (!consentTokenState.tokenId) {
      showToast("Primero envía el código al correo del cliente.", "warning");
      return;
    }
    const code = consentTokenCode.trim();
    if (!code) {
      setErrors((prev) => ({ ...prev, consent_email_token_id: "Ingresa el código enviado al cliente" }));
      return;
    }
    setConsentTokenState((prev) => ({ ...prev, status: "verifying" }));
    try {
      const response = await verifyConsentEmailToken({
        token_id: consentTokenState.tokenId,
        code,
      });
      setConsentTokenState((prev) => ({
        ...prev,
        status: "verified",
        verifiedAt: response.verified_at || new Date().toISOString(),
      }));
      setFormData((prev) => ({
        ...prev,
        consent_email_token_id: response.token_id || consentTokenState.tokenId,
      }));
      setErrors((prev) => {
        if (!prev.consent_email_token_id) return prev;
        const next = { ...prev };
        delete next.consent_email_token_id;
        return next;
      });

      showToast("Código validado correctamente.", "success");
    } catch (error) {
      console.error("Error al validar token", error);
      setConsentTokenState((prev) => ({ ...prev, status: "sent" }));
      const message = error.response?.data?.message || error.message || "El código no coincide";
      showToast(message, "error");
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
    if (!formData.consent_capture_method) {
      validationErrors.consent_capture_method = "Selecciona cómo obtendrás el consentimiento.";
    }
    if (formData.consent_capture_method && formData.consent_capture_method !== "email_link") {
      const detailsValue = (formData.consent_capture_details || "").trim();
      if (!detailsValue) {
        validationErrors.consent_capture_details = "Describe el medio utilizado para el consentimiento.";
      }
    }
    if (formData.consent_capture_method === "email_link") {
      const consentEmail = (formData.consent_recipient_email || formData.client_email || "").trim();
      if (!consentEmail) {
        validationErrors.consent_recipient_email =
          "Indica el correo al que enviaremos el código de autorización.";
      }
      if (!formData.consent_email_token_id) {
        validationErrors.consent_email_token_id =
          "Debes validar el código enviado al cliente antes de continuar. Una vez validado, presiona 'Enviar solicitud'.";
      }
    }

    const checkField = (field) => {
      const value = (formData[field] || "").trim();
      if (!value) {
        validationErrors[field] = "Este campo es obligatorio.";
      }
    };

    COMMON_REQUIRED_FIELDS.forEach(checkField);
    if (formData.has_specific_delivery_schedule) {
      checkField("shipping_delivery_start_time");
      checkField("shipping_delivery_end_time");
      const start = (formData.shipping_delivery_start_time || "").trim();
      const end = (formData.shipping_delivery_end_time || "").trim();
      if (start && end && start >= end) {
        validationErrors.shipping_delivery_end_time = "La hora de fin debe ser mayor a la hora de inicio.";
      }
    }
    if (formData.client_type === "persona_natural") {
      NATURAL_REQUIRED_FIELDS.forEach(checkField);
    } else {
      LEGAL_REQUIRED_FIELDS.forEach(checkField);
      LEGAL_REP_REQUIRED_FIELDS.forEach(checkField);
    }

    const docNumber = (formData.ruc_cedula || "").trim();
    if (docNumber && !/^\d+$/.test(docNumber)) {
      validationErrors.ruc_cedula = "Solo se permiten dígitos.";
    }
    if (formData.client_type === "persona_natural") {
      const docType = formData.natural_person_document_type;
      if (!docType) {
        validationErrors.natural_person_document_type = "Selecciona el tipo de documento.";
      } else if (docType === "ruc" && docNumber.length !== 13) {
        validationErrors.ruc_cedula = "El RUC debe tener exactamente 13 dígitos.";
      } else if (docType === "cedula" && docNumber.length !== 10) {
        validationErrors.ruc_cedula = "La cédula debe tener exactamente 10 dígitos.";
      }
    }

    const missingFiles = requiredFiles.filter((field) => !files[field]);
    if (missingFiles.length) {
      validationErrors.files = missingFiles.reduce((acc, field) => {
        acc[field] = "Adjunta este documento";
        return acc;
      }, {});
    }

    return validationErrors;
  };

  const resetForm = () => {
    setFormData({ ...initialFormState });
    setFiles({ ...initialFilesState });
    setErrors({});
    resetConsentTokenFlow();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      showToast("Por favor completa la información obligatoria.", "warning");
      return;
    }

    const selectedMethod = formData.consent_capture_method;
    setLoading(true);
    setProgressStep("validating");

    try {
      setProgressStep("uploading");
      const payload = { ...formData };
      // Se omite telefono fijo cuando ya se gestiona celular.
      delete payload.establishment_phone;
      delete payload.shipping_phone;
      if (payload.has_specific_delivery_schedule) {
        payload.shipping_delivery_hours = `${payload.shipping_delivery_start_time} - ${payload.shipping_delivery_end_time}`;
      } else {
        payload.shipping_delivery_hours = "";
        payload.shipping_delivery_start_time = "";
        payload.shipping_delivery_end_time = "";
      }
      if (payload.consent_capture_method !== "email_link") {
        delete payload.consent_email_token_id;
      }

      setProgressStep("submitting");

      if (isEditing) {
        await updateClientRequest(initialData.id, payload, files);
        showToast("Solicitud corregida y reenviada correctamente.", "success");
      } else {
        await createClientRequest(payload, files);
        const successCopy =
          selectedMethod === "email_link"
            ? successMessage
            : "Solicitud registrada y el consentimiento quedó auditado con tu evidencia.";
        showToast(successCopy, "success");
      }

      setProgressStep("notifying");
      resetForm();
      onSuccess?.();

    } catch (error) {
      console.error("Error al crear solicitud de cliente:", error);
      const message = error.response?.data?.message || error.message || "Error al crear la solicitud";
      showToast(message, "error");
    } finally {
      setLoading(false);
      setProgressStep(null);
    }
  };

  const disabledBody = !formData.data_processing_consent;
  const disableFiles = disabledBody;
  const previouslyVerifiedByCode = Boolean(initialData?.consent_email_token_id);
  const consentMethodIsEmail = formData.consent_capture_method === "email_link";
  const tokenStatus = consentTokenState.status;
  const tokenExpiresAt = consentTokenState.expiresAt
    ? new Date(consentTokenState.expiresAt)
    : null;
  const isTokenVerified =
    consentMethodIsEmail &&
    tokenStatus === "verified" &&
    Boolean(formData.consent_email_token_id);
  const isSubDistributor = formData.client_type === "sub_distribuidor";
  const isLegalClientType = formData.client_type === "persona_juridica" || isSubDistributor;

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {loading && (
        <ProcessingOverlay
          title="Enviando solicitud de nuevo cliente"
          steps={submissionSteps}
          activeStep={progressStep || "validating"}
        />
      )}
      {showIntro && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <FiAlertCircle className="mt-0.5 flex-shrink-0 text-xl" />
          <p className="text-sm leading-relaxed">
            Esta ficha recopila todos los datos necesarios para habilitar a un nuevo cliente. Una vez enviada la solicitud
            podrás enviar un correo automático de consentimiento o adjuntar la evidencia que ya tengas para cumplir con la
            LOPDP.
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

      <section className="rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Registro del consentimiento</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Selecciona cómo obtendrás la aceptación LOPDP para que quede auditada.
            </p>
          </div>
        </div>
        <div
          className={`mt-4 grid gap-3 md:grid-cols-3 ${disabledBody ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {CONSENT_METHOD_OPTIONS.map((option) => {
            const isSelected = formData.consent_capture_method === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleConsentMethodChange(option.value)}
                disabled={disabledBody}
                className={`text-left rounded-2xl border p-4 transition focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500 ${isSelected
                  ? "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900"
                  } ${disabledBody ? "pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                      }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  {option.title}
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{option.description}</p>
              </button>
            );
          })}
        </div>
        {errors.consent_capture_method && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors.consent_capture_method}</p>
        )}
        {formData.consent_capture_method !== "email_link" && (
          <div className="mt-4">
            <TextAreaField
              name="consent_capture_details"
              label="Describe brevemente cómo y cuándo se obtuvo el consentimiento"
              value={formData.consent_capture_details}
              onChange={handleChange}
              required
              disabled={disabledBody}
              error={errors.consent_capture_details}
            />
          </div>
        )}
        {consentMethodIsEmail && (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm shadow-sm transition ${isTokenVerified
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              : "border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/10"
              } ${disabledBody ? "opacity-60" : ""}`}
          >
            <p className="text-gray-700 dark:text-gray-200">
              Envía un código automático al correo del cliente. Solo podrás continuar cuando el cliente te confirme el código y lo
              registres aquí mismo.
            </p>
            {previouslyVerifiedByCode && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
                Ya se aprobó el consentimiento mediante código anteriormente. Puedes reenviar o validar un nuevo código si el
                cliente lo solicita, sin perder el registro previo.
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <InputField
                name="consent_recipient_email"
                label="Correo que recibirá el código"
                type="email"
                value={formData.consent_recipient_email}
                onChange={handleChange}
                required
                disabled={disabledBody}
                error={errors.consent_recipient_email}
              />
              <button
                type="button"
                onClick={handleSendConsentToken}
                disabled={disabledBody || tokenStatus === "sending"}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {tokenStatus === "sending" ? "Enviando..." : tokenStatus === "sent" ? "Reenviar código" : tokenStatus === "verified" ? "Código verificado" : "Enviar código"}
              </button>
            </div>
            {consentTokenState.tokenId && (
              <div className="mt-4 flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Código recibido por el cliente</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={consentTokenCode}
                    onChange={(e) => setConsentTokenCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    disabled={tokenStatus === "verifying" || isTokenVerified}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyConsentToken}
                    disabled={isTokenVerified || tokenStatus === "verifying"}
                    className="rounded-xl border border-blue-600 px-4 py-2 font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                  >
                    {tokenStatus === "verifying" ? "Validando..." : isTokenVerified ? "Validado" : "Validar"}
                  </button>
                </div>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
              {isTokenVerified && consentTokenState.verifiedAt
                ? `Consentimiento confirmado el ${new Date(consentTokenState.verifiedAt).toLocaleString("es-EC")}.`
                : tokenExpiresAt
                  ? `El código actual vence a las ${tokenExpiresAt.toLocaleTimeString("es-EC", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}.`
                  : "El cliente deberá compartir el código recibido para que puedas continuar."}
            </div>
            {errors.consent_email_token_id && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors.consent_email_token_id}</p>
            )}
          </div>
        )}
      </section>

      <fieldset
        disabled={disabledBody}
        className={`space-y-6 ${disabledBody ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <Section title="Sector del cliente">
          <div className="md:col-span-2">
            <RadioGroup
              name="client_sector"
              value={formData.client_sector}
              onChange={handleChange}
              options={[
                { label: "Privado", value: "privado" },
                { label: "Público", value: "publico" },
              ]}
            />
            {formData.client_sector === "publico" && (
              <p className="mt-2 text-sm text-blue-600">
                Los clientes públicos siempre son personas jurídicas
              </p>
            )}
          </div>
        </Section>

        {formData.client_sector === "privado" && (
          <Section title="Tipo de cliente">
            <div className="md:col-span-2">
              <RadioGroup
                name="client_type"
                value={formData.client_type}
                onChange={handleChange}
                options={[
                  { label: "Persona natural", value: "persona_natural" },
                  { label: "Persona jurídica", value: "persona_juridica" },
                  { label: "Sub distribuidor", value: "sub_distribuidor" },
                ]}
              />
            </div>
          </Section>
        )}

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
            <SelectField
              name="natural_person_document_type"
              label="Tipo de documento"
              value={formData.natural_person_document_type}
              onChange={handleChange}
              options={["cedula", "ruc"]}
              required
              error={errors.natural_person_document_type}
            />
            <InputField
              name="ruc_cedula"
              label={formData.natural_person_document_type === "ruc" ? "RUC" : "Cédula"}
              value={formData.ruc_cedula}
              onChange={handleChange}
              inputMode="numeric"
              maxLength={formData.natural_person_document_type === "ruc" ? 13 : 10}
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
          <Section title={`Datos del cliente (${isSubDistributor ? "sub distribuidor" : "persona jurídica"})`}>
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
              inputMode="numeric"
              maxLength={13}
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
            {isSubDistributor && (
              <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  <input
                    type="checkbox"
                    name="participates_public_procurement"
                    checked={Boolean(formData.participates_public_procurement)}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Participa en compras públicas
                </label>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  Los códigos de proceso son opcionales. Si participa en compras públicas, calidad podrá validarlos desde checklist.
                </p>
                {formData.participates_public_procurement && (
                  <div className="mt-3">
                    <TextAreaField
                      name="public_process_codes"
                      label="Código(s) de proceso (opcional)"
                      value={formData.public_process_codes}
                      onChange={handleChange}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}
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
          <SelectField
            name="establishment_country"
            label="País"
            value={formData.establishment_country}
            onChange={handleChange}
            options={countryOptions}
            required
            error={errors.establishment_country}
          />
          <SelectField
            name="establishment_province"
            label="Provincia"
            value={formData.establishment_province}
            onChange={handleChange}
            options={establishmentProvinceOptions}
            required
            error={errors.establishment_province}
          />
          <SelectField
            name="establishment_city"
            label="Ciudad"
            value={formData.establishment_city}
            onChange={handleChange}
            options={establishmentCityOptions}
            required
            error={errors.establishment_city}
            disabled={!formData.establishment_province}
            placeholder="Selecciona primero una provincia"
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
            name="establishment_cellphone"
            label="Celular"
            value={formData.establishment_cellphone}
            onChange={handleChange}
            required
            error={errors.establishment_cellphone}
          />
        </Section>

        {isLegalClientType && (
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
              label="Documento de identificación del cliente"
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
        )}
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
          <SelectField
            name="shipping_country"
            label="País"
            value={formData.shipping_country}
            onChange={handleChange}
            options={countryOptions}
            required
            error={errors.shipping_country}
          />
          <SelectField
            name="shipping_province"
            label="Provincia"
            value={formData.shipping_province}
            onChange={handleChange}
            options={shippingProvinceOptions}
            required
            error={errors.shipping_province}
          />
          <SelectField
            name="shipping_city"
            label="Ciudad"
            value={formData.shipping_city}
            onChange={handleChange}
            options={shippingCityOptions}
            required
            error={errors.shipping_city}
            disabled={!formData.shipping_province}
            placeholder="Selecciona primero una provincia"
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
            name="shipping_cellphone"
            label="Celular"
            value={formData.shipping_cellphone}
            onChange={handleChange}
            required
            error={errors.shipping_cellphone}
          />
          <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                name="has_specific_delivery_schedule"
                checked={Boolean(formData.has_specific_delivery_schedule)}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              El cliente tiene un horario específico de entregas
            </label>
            {formData.has_specific_delivery_schedule && (
              <details open className="mt-3 rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-900/50 dark:bg-slate-900/50">
                <summary className="cursor-pointer text-sm font-semibold text-blue-700 dark:text-blue-300">
                  Registrar horario de entregas
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <InputField
                    name="shipping_delivery_start_time"
                    label="Hora de inicio"
                    type="time"
                    value={formData.shipping_delivery_start_time}
                    onChange={handleChange}
                    required
                    error={errors.shipping_delivery_start_time}
                  />
                  <InputField
                    name="shipping_delivery_end_time"
                    label="Hora de fin"
                    type="time"
                    value={formData.shipping_delivery_end_time}
                    onChange={handleChange}
                    required
                    error={errors.shipping_delivery_end_time}
                  />
                </div>
              </details>
            )}
          </div>
        </Section>

        <Section title="Documentos">
          <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(FILE_REQUIREMENTS).map(([key, meta]) => {
              const resolvedMeta =
                formData.client_type === "sub_distribuidor" && key === "id_file"
                  ? { ...meta, label: "Cédula del representante legal" }
                  : formData.client_type === "sub_distribuidor" && key === "ruc_file"
                    ? { ...meta, helper: "Obligatorio para sub distribuidores (PDF)." }
                    : meta;
              if (key === "consent_evidence_file" && formData.consent_capture_method === "email_link") {
                return null;
              }
              if (
                key === "legal_rep_appointment_file"
                && formData.client_type !== "persona_juridica"
                && formData.client_type !== "sub_distribuidor"
              ) {
                return null;
              }
              if (key === "bpadt_certification_file" && formData.client_type !== "sub_distribuidor") {
                return null;
              }
              if (key === "operating_permit_file" && formData.client_type !== "sub_distribuidor") {
                return null;
              }
              return (
                <FileInput
                  key={key}
                  name={key}
                  label={resolvedMeta.label}
                  helper={resolvedMeta.helper}
                  onChange={handleFileChange}
                  required={requiredFiles.includes(key)}
                  error={errors.files?.[key]}
                  disabled={disableFiles}
                />
              );
            })}
          </div>
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

const SelectField = ({ label, name, value, onChange, options, required = false, error, disabled = false, placeholder }) => (
  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
    {label} {required && <span className="text-red-500">*</span>}
    <select
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-gray-800 dark:text-gray-100 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-300 dark:border-gray-600"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <option value="">{placeholder || "Selecciona una opción"}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replace(/_/g, " ")}
        </option>
      ))}
    </select>
    {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
  </label>
);

const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  error,
  disabled = false,
  ...inputProps
}) => (
  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
    {label} {required && <span className="text-red-500">*</span>}
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      {...inputProps}
      className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-gray-800 dark:text-gray-100 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-300 dark:border-gray-600"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    />
    {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
  </label>
);

const TextAreaField = ({ label, name, value, onChange, required = false, error, rows = 3, disabled = false }) => (
  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
    {label} {required && <span className="text-red-500">*</span>}
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      disabled={disabled}
      className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-gray-800 dark:text-gray-100 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "border-gray-300 dark:border-gray-600"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
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
      className={`mt-2 w-full cursor-pointer rounded-xl border border-dashed px-3 py-2 text-sm text-gray-700 transition hover:border-blue-400 dark:border-gray-600 dark:text-gray-200 ${error ? "border-red-400" : "border-gray-300"
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
