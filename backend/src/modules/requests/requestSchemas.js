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
  retiro: {
    type: "object",
    required: ["nombre_cliente", "fecha_retiro"],
    properties: {
      nombre_cliente: { type: "string" },
      direccion_cliente: { type: "string" },
      persona_contacto: { type: "string" },
      celular_contacto: { type: "string" },
      fecha_retiro: { type: "string" },
      equipos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nombre_equipo: { type: "string" },
            cantidad: { type: "number" },
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
      "client_type",
      "ruc_cedula",
      "commercial_name",
      "establishment_province",
      "establishment_city",
      "establishment_address",
      "treasury_name",
      "treasury_email",
      "shipping_contact_name",
      "shipping_address",
      "shipping_city",
      "shipping_province",
      "client_email",
    ],
    properties: {
      client_type: { type: "string", enum: ["persona_natural", "persona_juridica"] },
      
      // Datos comunes
      commercial_name: { type: "string", minLength: 2 },
      ruc_cedula: { type: "string", minLength: 10, maxLength: 13 },
      client_email: { type: "string", format: "email" },

      // Datos del Establecimiento
      establishment_province: { type: "string" },
      establishment_city: { type: "string" },
      establishment_address: { type: "string" },
      establishment_reference: { type: "string" },
      establishment_phone: { type: "string" },
      establishment_cellphone: { type: "string" },
      
      // Datos de Tesorería
      treasury_name: { type: "string" },
      treasury_email: { type: "string", format: "email" },
      treasury_conventional_phone: { type: "string" },
      treasury_cellphone: { type: "string" },

      // Datos de Envío
      shipping_contact_name: { type: "string" },
      shipping_address: { type: "string" },
      shipping_city: { type: "string" },
      shipping_province: { type: "string" },
      shipping_reference: { type: "string" },
      shipping_phone: { type: "string" },
      shipping_cellphone: { type: "string" },
      shipping_delivery_hours: { type: "string" },

      // Permiso de funcionamiento
      operating_permit_status: { type: "string", enum: ["has_it", "in_progress", "does_not_have_it"] },

      // Campos condicionales
      natural_person_firstname: { type: "string" },
      natural_person_lastname: { type: "string" },
      domicile_province: { type: "string" },
      domicile_city: { type: "string" },
      domicile_address: { type: "string" },
      domicile_phone_cellphone: { type: "string" },

      legal_person_business_name: { type: "string" },
      nationality: { type: "string" },
      legal_rep_name: { type: "string" },
      legal_rep_position: { type: "string" },
      legal_rep_id_document: { type: "string" },
      legal_rep_cellphone: { type: "string" },
      legal_rep_email: { type: "string", format: "email" },
    },
    if: {
      properties: { client_type: { const: "persona_natural" } },
    },
    then: {
      required: ["natural_person_firstname", "natural_person_lastname"],
    },
    else: {
      if: {
        properties: { client_type: { const: "persona_juridica" } },
      },
      then: {
        required: ["legal_person_business_name", "nationality", "legal_rep_name", "legal_rep_id_document", "legal_rep_email"],
      },
    },
  },
};
