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
      "client_sector",
      "client_type",
      "commercial_name",
      "client_email",
      "establishment_name",
      "establishment_province",
      "establishment_city",
      "establishment_address",
      "establishment_reference",
      "establishment_cellphone",
      "shipping_contact_name",
      "shipping_address",
      "shipping_city",
      "shipping_province",
      "shipping_reference",
      "shipping_cellphone",
      "legal_rep_name",
      "legal_rep_position",
      "legal_rep_id_document",
      "legal_rep_cellphone",
      "legal_rep_email",
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
      client_sector: { type: "string", enum: ["privado", "publico"] },
      client_type: { type: "string", enum: ["persona_natural", "persona_juridica", "sub_distribuidor"] },
      natural_person_document_type: { type: "string", enum: ["cedula", "ruc"] },

      // Datos comunes
      commercial_name: { type: "string", minLength: 2 },
      ruc_cedula: { type: "string", minLength: 10, maxLength: 13, pattern: "^[0-9]+$" },
      client_email: { type: "string", format: "email" },

      // Datos del Establecimiento
      establishment_name: { type: "string", minLength: 2 },
      establishment_province: { type: "string", minLength: 2 },
      establishment_city: { type: "string", minLength: 2 },
      establishment_address: { type: "string", minLength: 4 },
      establishment_reference: { type: "string", minLength: 3 },
      establishment_phone: {
        anyOf: [
          { type: "string", minLength: 6 },
          { type: "string", maxLength: 0 },
        ],
      },
      establishment_cellphone: { type: "string", minLength: 6 },

      // Datos de Envío
      shipping_contact_name: { type: "string", minLength: 3 },
      shipping_address: { type: "string", minLength: 4 },
      shipping_city: { type: "string", minLength: 2 },
      shipping_province: { type: "string", minLength: 2 },
      shipping_reference: { type: "string", minLength: 3 },
      shipping_phone: {
        anyOf: [
          { type: "string", minLength: 6 },
          { type: "string", maxLength: 0 },
        ],
      },
      shipping_cellphone: { type: "string", minLength: 6 },
      participates_public_procurement: { type: "boolean" },
      public_process_codes: { type: "string" },
      has_specific_delivery_schedule: { type: "boolean" },
      shipping_delivery_start_time: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" },
      shipping_delivery_end_time: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" },
      shipping_delivery_hours: {
        anyOf: [
          { type: "string", minLength: 3 },
          { type: "string", maxLength: 0 },
        ],
      },

      // Permiso de funcionamiento
      operating_permit_status: { type: "string", enum: ["has_it", "in_progress", "does_not_have_it"] },

      // Campos condicionales
      natural_person_firstname: { type: "string" },
      natural_person_lastname: { type: "string" },

      nationality: { type: "string" },
      legal_rep_name: {
        anyOf: [
          { type: "string", minLength: 3 },
          { type: "string", maxLength: 0 },
        ],
      },
      legal_rep_position: {
        anyOf: [
          { type: "string", minLength: 2 },
          { type: "string", maxLength: 0 },
        ],
      },
      legal_rep_id_document: {
        anyOf: [
          { type: "string", minLength: 6 },
          { type: "string", maxLength: 0 },
        ],
      },
      legal_rep_cellphone: {
        anyOf: [
          { type: "string", minLength: 6 },
          { type: "string", maxLength: 0 },
        ],
      },
      legal_rep_email: {
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", maxLength: 0 },
        ],
      },
    },
    allOf: [
      {
        if: {
          properties: { client_type: { const: "persona_natural" } },
        },
        then: {
          required: ["natural_person_firstname", "natural_person_lastname", "natural_person_document_type"],
        },
      },
      {
        if: {
          properties: {
            client_type: { const: "persona_natural" },
            natural_person_document_type: { const: "ruc" },
          },
        },
        then: {
          properties: {
            ruc_cedula: { type: "string", minLength: 13, maxLength: 13, pattern: "^[0-9]{13}$" },
          },
        },
      },
      {
        if: {
          properties: {
            client_type: { const: "persona_natural" },
            natural_person_document_type: { const: "cedula" },
          },
        },
        then: {
          properties: {
            ruc_cedula: { type: "string", minLength: 10, maxLength: 10, pattern: "^[0-9]{10}$" },
          },
        },
      },
      {
        if: {
          properties: { client_type: { const: "persona_juridica" } },
        },
        then: {
          required: ["nationality"],
        },
      },
      {
        if: {
          properties: { client_type: { const: "sub_distribuidor" } },
        },
        then: {
          required: ["nationality"],
        },
      },
      {
        if: {
          properties: { client_sector: { const: "publico" } },
        },
        then: {
          properties: { client_type: { const: "persona_juridica" } },
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
      {
        if: {
          properties: { has_specific_delivery_schedule: { const: true } },
        },
        then: {
          required: ["shipping_delivery_start_time", "shipping_delivery_end_time"],
        },
      },
    ],
  },
};
