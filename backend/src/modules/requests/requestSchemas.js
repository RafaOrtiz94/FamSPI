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
      // Etiqueta elegida antes del formulario (normal | costos) para
      // solicitudes independientes, o fija segun el flujo para las
      // generadas automaticamente desde business_case/compras. No cambia
      // ningun otro campo de la solicitud, solo la clasifica.
      tipo_inspeccion: { type: "string", enum: ["normal", "costos"] },
      // Origen de la solicitud cuando se genera automaticamente desde otro
      // flujo (business_case | compras). Ausente en solicitudes independientes
      // creadas directamente desde el formulario.
      origen: { type: "string", enum: ["business_case", "compras"] },
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
  credito: {
    type: "object",
    required: [
      "razon_social",
      "ruc_id",
      "telefono_contacto",
      "correo_electronico",
      "cupo_credito_sugerido",
      "plazo_pago_acordado",
      "direccion_fisica",
      "ciudad",
      "provincia",
      "telefono_celular",
      "ruc_ci_firmante",
    ],
    properties: {
      asesor_comercial: { type: "string" },
      fecha_solicitud: { type: "string" },
      razon_social: { type: "string", minLength: 2 },
      ruc_id: { type: "string", minLength: 6 },
      telefono_contacto: { type: "string", minLength: 6 },
      correo_electronico: { type: "string", format: "email" },
      cupo_credito_sugerido: { anyOf: [{ type: "number" }, { type: "string", minLength: 1 }] },
      plazo_pago_acordado: { anyOf: [{ type: "number" }, { type: "string", minLength: 1 }] },
      activos: { anyOf: [{ type: "number" }, { type: "string" }] },
      pasivos: { anyOf: [{ type: "number" }, { type: "string" }] },
      patrimonio: { anyOf: [{ type: "number" }, { type: "string" }] },
      ingresos_negocio: { anyOf: [{ type: "number" }, { type: "string" }] },
      egresos_negocio: { anyOf: [{ type: "number" }, { type: "string" }] },
      ingresos_relacion_dependencia: { anyOf: [{ type: "number" }, { type: "string" }] },
      gastos_familiares: { anyOf: [{ type: "number" }, { type: "string" }] },
      otros_ingresos: { anyOf: [{ type: "number" }, { type: "string" }] },
      prestamos_obligaciones: { anyOf: [{ type: "number" }, { type: "string" }] },
      total_ingresos: { anyOf: [{ type: "number" }, { type: "string" }] },
      total_egresos: { anyOf: [{ type: "number" }, { type: "string" }] },
      justificacion_otros_ingresos: { type: "string" },
      utilidad_perdida_neta: { anyOf: [{ type: "number" }, { type: "string" }] },
      banco_1: { type: "string" },
      banco_2: { type: "string" },
      cuenta_corriente_1: { type: "string" },
      cuenta_corriente_2: { type: "string" },
      cuenta_ahorros_1: { type: "string" },
      cuenta_ahorros_2: { type: "string" },
      proveedor_1: { type: "string" },
      proveedor_2: { type: "string" },
      contacto_proveedor_1: { type: "string" },
      contacto_proveedor_2: { type: "string" },
      telefono_proveedor_1: { type: "string" },
      telefono_proveedor_2: { type: "string" },
      ref_personal_nombre_1: { type: "string" },
      ref_personal_nombre_2: { type: "string" },
      ref_personal_parentesco_1: { type: "string" },
      ref_personal_parentesco_2: { type: "string" },
      ref_personal_telefono_1: { type: "string" },
      ref_personal_telefono_2: { type: "string" },
      nombre_responsable_cobros: { type: "string" },
      direccion_fisica: { type: "string", minLength: 3 },
      ciudad: { type: "string", minLength: 2 },
      provincia: { type: "string", minLength: 2 },
      telefono_fijo: { type: "string" },
      telefono_celular: { type: "string", minLength: 6 },
      ruc_ci_firmante: { type: "string", minLength: 6 },
      monto_sugerido_jefe_comercial: { anyOf: [{ type: "number" }, { type: "string" }] },
      validacion_referencias: { type: "string" },
      decision_solicitud: { type: "string" },
      monto_credito_autorizado: { anyOf: [{ type: "number" }, { type: "string" }] },
      plazo_credito_autorizado: { anyOf: [{ type: "number" }, { type: "string" }] },
      fecha_resolucion: { type: "string" },
      observaciones_validacion: { type: "string" },
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
        // El formulario solo pide/muestra representante legal para persona_juridica
        // y sub_distribuidor -- para persona_natural estos campos quedan vacios y
        // el frontend ni siquiera los envia, así que exigirlos siempre rechazaba
        // toda solicitud de persona natural.
        if: {
          properties: { client_type: { enum: ["persona_juridica", "sub_distribuidor"] } },
        },
        then: {
          required: ["legal_rep_name", "legal_rep_position", "legal_rep_id_document", "legal_rep_cellphone", "legal_rep_email"],
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
