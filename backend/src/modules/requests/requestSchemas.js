module.exports = {
  inspection: {
    type: "object",
    required: ["nombre_cliente", "direccion_cliente", "fecha_instalacion"],
    properties: {
      nombre_cliente: { type: "string" },
      direccion_cliente: { type: "string" },
      persona_contacto: { type: "string" },
      celular_contacto: { type: "string" },
      fecha_instalacion: { type: "string" },
      fecha_tope_instalacion: { type: "string" },
      requiere_lis: { type: "boolean" },
      unidad_id: { anyOf: [{ type: "string" }, { type: "number" }] },
      serial: { type: "string" },
      serial_pendiente: { type: "boolean" },
      equipos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nombre_equipo: { type: "string" },
            estado: { type: "string" },
            unidad_id: { anyOf: [{ type: "string" }, { type: "number" }] },
            serial: { type: "string" },
          },
        },
      },
      anotaciones: { type: "string" },
      accesorios: { type: "string" },
      observaciones: { type: "string" },
    },
  },
  retiro: {
    type: "object",
    required: ["nombre_cliente", "fecha_retiro"],
    properties: {
      nombre_cliente: { type: "string" },
      direccion_cliente: { type: "string" },
      persona_contacto: { type: "string" },
      celular_contacto: { type: "string" },
      fecha_retiro: { type: "string" },
      unidad_id: { anyOf: [{ type: "string" }, { type: "number" }] },
      serial: { type: "string" },
      serial_pendiente: { type: "boolean" },
      equipos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nombre_equipo: { type: "string" },
            cantidad: { type: "number" },
            unidad_id: { anyOf: [{ type: "string" }, { type: "number" }] },
            serial: { type: "string" },
          },
        },
      },
      anotaciones: { type: "string" },
      observaciones: { type: "string" },
    },
  },
  compra: {
    type: "object",
    required: ["nombre_cliente", "fecha_tentativa_visita"],
    properties: {
      nombre_cliente: { type: "string" },
      direccion_cliente: { type: "string" },
      persona_contacto: { type: "string" },
      celular_contacto: { type: "string" },
      fecha_tentativa_visita: { type: "string" },
      fecha_instalacion: { type: "string" },
      equipos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nombre_equipo: { type: "string" },
            estado: { type: "string" },
          },
        },
      },
      anotaciones: { type: "string" },
      accesorios: { type: "string" },
      observaciones: { type: "string" },
    },
  },
  cliente: {
    type: "object",
    required: ["nombre_cliente", "direccion_cliente", "persona_contacto"],
    properties: {
      nombre_cliente: { type: "string" },
      direccion_cliente: { type: "string" },
      persona_contacto: { type: "string" },
      celular_contacto: { type: "string" },
      email_cliente: { type: "string", format: "email" },
      observaciones: { type: "string" },
    },
  },
  newClient: {
    type: "object",
    required: [
      "data_processing_consent",
      "consent_capture_method",
      "client_type",
      "commercial_name",
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
    ],
    properties: {
      data_processing_consent: { type: "boolean", const: true },
      consent_capture_method: {
        type: "string",
        enum: ["email_link", "signed_document", "other"],
      },
      consent_capture_details: { type: "string" },
      consent_recipient_email: { type: "string", format: "email" },
      consent_email_token_id: { type: "string", minLength: 10 },
      client_type: { type: "string", enum: ["persona_natural", "persona_juridica"] },

      // Datos comunes
      commercial_name: { type: "string", minLength: 2 },
      ruc_cedula: { type: "string", minLength: 10, maxLength: 13 },
      client_email: { type: "string", format: "email" },

      // Datos del Establecimiento
      establishment_name: { type: "string", minLength: 2 },
      establishment_province: { type: "string", minLength: 2 },
      establishment_city: { type: "string", minLength: 2 },
      establishment_address: { type: "string", minLength: 4 },
      establishment_reference: { type: "string", minLength: 3 },
      establishment_phone: { type: "string", minLength: 6 },
      establishment_cellphone: { type: "string", minLength: 6 },

      // Datos de Envío
      shipping_contact_name: { type: "string", minLength: 3 },
      shipping_address: { type: "string", minLength: 4 },
      shipping_city: { type: "string", minLength: 2 },
      shipping_province: { type: "string", minLength: 2 },
      shipping_reference: { type: "string", minLength: 3 },
      shipping_phone: { type: "string", minLength: 6 },
      shipping_cellphone: { type: "string", minLength: 6 },
      shipping_delivery_hours: { type: "string", minLength: 3 },

      // Permiso de funcionamiento
      operating_permit_status: { type: "string", enum: ["has_it", "in_progress", "does_not_have_it"] },

      // Campos condicionales
      natural_person_firstname: { type: "string" },
      natural_person_lastname: { type: "string" },

      legal_person_business_name: { type: "string" },
      nationality: { type: "string" },
      legal_rep_name: { type: "string", minLength: 3 },
      legal_rep_position: { type: "string", minLength: 2 },
      legal_rep_id_document: { type: "string", minLength: 6 },
      legal_rep_cellphone: { type: "string", minLength: 6 },
      legal_rep_email: { type: "string", format: "email" },
    },
    allOf: [
      {
        if: {
          properties: { client_type: { const: "persona_natural" } },
        },
        then: {
          required: ["natural_person_firstname", "natural_person_lastname"],
        },
      },
      {
        if: {
          properties: { client_type: { const: "persona_juridica" } },
        },
        then: {
          required: ["legal_person_business_name", "nationality"],
        },
      },
      {        
        if: {
          properties: { consent_capture_method: { const: "email_link" } },
        },
        then: {
          required: ["client_email", "consent_recipient_email", "consent_email_token_id"],
          properties: {
            consent_capture_details: { type: "string", minLength: 0 },
          },
        },
      },
      {
        if: {
          properties: { consent_capture_method: { const: "signed_document" } },
        },
        then: {
          required: ["consent_capture_details"],
          properties: {
            consent_capture_details: { type: "string", minLength: 5 },
          },
        },
      },
      {
        if: {
          properties: { consent_capture_method: { const: "other" } },
        },
        then: {
          required: ["consent_capture_details"],
          properties: {
            consent_capture_details: { type: "string", minLength: 5 },
          },
        },
      },
    ],
  },
};
