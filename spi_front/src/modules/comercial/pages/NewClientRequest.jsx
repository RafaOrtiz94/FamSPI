import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../../core/layout/DashboardLayout";
import { useUI } from "../../../core/ui/useUI";
import { createClientRequest } from "../../../core/api/requestsApi";

const NewClientRequest = () => {
  const { showToast } = useUI();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    client_type: "persona_natural",
    natural_person_firstname: "",
    natural_person_lastname: "",
    legal_person_business_name: "",
    commercial_name: "",
    ruc_cedula: "",
    nationality: "",
    client_email: "",
    establishment_province: "",
    establishment_city: "",
    establishment_address: "",
    establishment_reference: "",
    establishment_phone: "",
    establishment_cellphone: "",
    domicile_province: "",
    domicile_city: "",
    domicile_address: "",
    domicile_phone_cellphone: "",
    legal_rep_name: "",
    legal_rep_position: "",
    legal_rep_id_document: "",
    legal_rep_cellphone: "",
    legal_rep_email: "",
    treasury_name: "",
    treasury_email: "",
    treasury_conventional_phone: "",
    treasury_cellphone: "",
    shipping_contact_name: "",
    shipping_address: "",
    shipping_city: "",
    shipping_province: "",
    shipping_reference: "",
    shipping_phone: "",
    shipping_cellphone: "",
    shipping_delivery_hours: "",
    operating_permit_status: "does_not_have_it",
  });
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: inputFiles } = e.target;
    setFiles((prev) => ({ ...prev, [name]: inputFiles[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createClientRequest(formData, files);
      showToast("Solicitud creada con éxito. Se ha enviado un correo al cliente para su autorización.", "success");
      // Reset form or navigate away
      setFormData({ client_type: "persona_natural" }); // simplified reset
      setFiles({});
      navigate("/dashboard/comercial");
    } catch (error) {
      logger.error("Error al crear solicitud de cliente:", error);
      const errorMsg = error.response?.data?.message || error.message || "Error al crear la solicitud";
      showToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };
  
  const renderCommonFields = () => (
    <>
        <InputField name="commercial_name" label="Nombre Comercial" value={formData.commercial_name} onChange={handleChange} required />
        <InputField name="ruc_cedula" label="RUC/Cédula" value={formData.ruc_cedula} onChange={handleChange} required />
        <InputField name="client_email" label="Email del Cliente (para LOPDP)" value={formData.client_email} onChange={handleChange} type="email" required />
    </>
  );

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Solicitud de Creación de Nuevo Cliente
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RadioGroup
              label="Tipo de Cliente"
              name="client_type"
              value={formData.client_type}
              onChange={handleChange}
              options={[
                { label: "Persona Natural", value: "persona_natural" },
                { label: "Persona Jurídica", value: "persona_juridica" },
              ]}
            />
          </div>

          {/* Campos Condicionales */}
          {formData.client_type === "persona_natural" ? (
            <Section title="Datos del Cliente (Persona Natural)">
              <InputField name="natural_person_firstname" label="Nombres" value={formData.natural_person_firstname} onChange={handleChange} required />
              <InputField name="natural_person_lastname" label="Apellidos" value={formData.natural_person_lastname} onChange={handleChange} required />
              {renderCommonFields()}
            </Section>
          ) : (
            <Section title="Datos del Cliente (Persona Jurídica)">
              <InputField name="legal_person_business_name" label="Razón Social" value={formData.legal_person_business_name} onChange={handleChange} required />
              {renderCommonFields()}
              <InputField name="nationality" label="Nacionalidad" value={formData.nationality} onChange={handleChange} required />
            </Section>
          )}

          {/* Resto de secciones... placeholder */}
          <Section title="Datos del Establecimiento">
            <InputField name="establishment_province" label="Provincia" value={formData.establishment_province} onChange={handleChange} required />
            <InputField name="establishment_city" label="Ciudad" value={formData.establishment_city} onChange={handleChange} required />
            <InputField name="establishment_address" label="Dirección" value={formData.establishment_address} onChange={handleChange} required />
            <InputField name="establishment_reference" label="Referencia" value={formData.establishment_reference} onChange={handleChange} />
            <InputField name="establishment_phone" label="Teléfono" value={formData.establishment_phone} onChange={handleChange} />
            <InputField name="establishment_cellphone" label="Celular" value={formData.establishment_cellphone} onChange={handleChange} />
          </Section>

          {formData.client_type === "persona_natural" && (
            <Section title="Datos del Domicilio">
              <InputField name="domicile_province" label="Provincia" value={formData.domicile_province} onChange={handleChange} />
              <InputField name="domicile_city" label="Ciudad" value={formData.domicile_city} onChange={handleChange} />
              <InputField name="domicile_address" label="Dirección" value={formData.domicile_address} onChange={handleChange} />
              <InputField name="domicile_phone_cellphone" label="Teléfono o Celular" value={formData.domicile_phone_cellphone} onChange={handleChange} />
            </Section>
          )}

          {formData.client_type === "persona_juridica" && (
            <Section title="Datos del Representante Legal">
              <InputField name="legal_rep_name" label="Nombres Completos" value={formData.legal_rep_name} onChange={handleChange} required />
              <InputField name="legal_rep_position" label="Cargo" value={formData.legal_rep_position} onChange={handleChange} />
              <InputField name="legal_rep_id_document" label="Documento de Identificación" value={formData.legal_rep_id_document} onChange={handleChange} required />
              <InputField name="legal_rep_cellphone" label="Celular" value={formData.legal_rep_cellphone} onChange={handleChange} />
              <InputField name="legal_rep_email" label="Email" value={formData.legal_rep_email} onChange={handleChange} type="email" required />
            </Section>
          )}

          <Section title="Datos de Tesorería">
            <InputField name="treasury_name" label="Nombre de Contacto" value={formData.treasury_name} onChange={handleChange} required />
            <InputField name="treasury_email" label="Email" value={formData.treasury_email} onChange={handleChange} type="email" required />
            <InputField name="treasury_conventional_phone" label="Teléfono Convencional" value={formData.treasury_conventional_phone} onChange={handleChange} />
            <InputField name="treasury_cellphone" label="Teléfono Celular" value={formData.treasury_cellphone} onChange={handleChange} />
          </Section>

          <Section title="Datos para Envío de Mercadería">
            <InputField name="shipping_contact_name" label="Nombre de Encargado" value={formData.shipping_contact_name} onChange={handleChange} required />
            <InputField name="shipping_address" label="Dirección" value={formData.shipping_address} onChange={handleChange} required />
            <InputField name="shipping_city" label="Ciudad" value={formData.shipping_city} onChange={handleChange} required />
            <InputField name="shipping_province" label="Provincia" value={formData.shipping_province} onChange={handleChange} required />
            <InputField name="shipping_reference" label="Referencia" value={formData.shipping_reference} onChange={handleChange} />
            <InputField name="shipping_phone" label="Teléfono" value={formData.shipping_phone} onChange={handleChange} />
            <InputField name="shipping_cellphone" label="Celular" value={formData.shipping_cellphone} onChange={handleChange} />
            <InputField name="shipping_delivery_hours" label="Horario de Entregas" value={formData.shipping_delivery_hours} onChange={handleChange} />
          </Section>

          <Section title="Documentos Adjuntos">
            {formData.client_type === 'persona_juridica' && (
              <>
                <FileInput name="ruc_file" label="RUC (PDF)" onChange={handleFileChange} required accept=".pdf" />
                <FileInput name="legal_rep_appointment_file" label="Nombramiento Representante Legal (PDF)" onChange={handleFileChange} required accept=".pdf" />
              </>
            )}
            <FileInput name="id_file" label="Documento de Identificación (PDF)" onChange={handleFileChange} required accept=".pdf" />
            
            <div className="md:col-span-2">
              <RadioGroup
                label="Permiso de Funcionamiento"
                name="operating_permit_status"
                value={formData.operating_permit_status}
                onChange={handleChange}
                options={[
                  { label: "No lo tiene", value: "does_not_have_it" },
                  { label: "En trámite", value: "in_progress" },
                  { label: "Sí lo tiene", value: "has_it" },
                ]}
              />
            </div>
            
            {formData.operating_permit_status === 'has_it' && (
              <FileInput name="operating_permit_file" label="Subir Permiso de Funcionamiento (PDF)" onChange={handleFileChange} required accept=".pdf" />
            )}
          </Section>
          
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Enviando..." : "Crear Solicitud"}
            </button>
          </div>
        </form>
      </motion.div>
    </DashboardLayout>
  );
};

// --- Componentes de UI Helpers ---

const Section = ({ title, children }) => (
  <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {children}
    </div>
  </div>
);

const InputField = ({ label, name, value, onChange, type = "text", required = false }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

const FileInput = ({ label, name, onChange, required = false, accept }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type="file"
            id={name}
            name={name}
            onChange={onChange}
            required={required}
            accept={accept}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
    </div>
);

const RadioGroup = ({ label, name, value, onChange, options }) => (
  <div>
    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</span>
    <div className="flex items-center gap-x-6">
      {options.map((option) => (
        <div key={option.value} className="flex items-center">
          <input
            type="radio"
            id={`${name}_${option.value}`}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <label htmlFor={`${name}_${option.value}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
            {option.label}
          </label>
        </div>
      ))}
    </div>
  </div>
);

export default NewClientRequest;
