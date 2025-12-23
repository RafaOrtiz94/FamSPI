const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { uploadJustificante } = require("./permisos.drive");

const TEMPLATE_PATH = path.join(__dirname, "../../data/plantillas/F.RH-10_V01_SOLICITUD DE PERMISO.pdf");

/**
 * Generar PDF F.RH-10 con datos de la solicitud
 */
async function generateFRH10(solicitud) {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.warn("Plantilla F.RH-10 no encontrada:", TEMPLATE_PATH);
      return null;
    }

    // Cargar plantilla
    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Llenar campos según tipo de solicitud
    if (solicitud.tipo_solicitud === "permiso") {
      fillPermisoFields(form, solicitud);
    } else if (solicitud.tipo_solicitud === "vacaciones") {
      fillVacacionesFields(form, solicitud);
    }

    // Llenar datos comunes
    fillCommonFields(form, solicitud);

    // Guardar PDF
    const pdfBytes = await pdfDoc.save();

    // Subir a Drive
    const user = {
      email: solicitud.user_email,
      fullname: solicitud.user_fullname,
      id: solicitud.user_id,
    };

    const driveFile = await uploadJustificante({
      user,
      solicitudId: solicitud.id,
      tipoJustificante: "F.RH-10",
      fileBuffer: Buffer.from(pdfBytes),
      fileName: `F.RH-10_${solicitud.id}.pdf`,
      mimeType: "application/pdf",
    });

    return driveFile.webViewLink;
  } catch (error) {
    console.error("Error generando PDF F.RH-10:", error);
    return null;
  }
}

/**
 * Llenar campos de permiso
 */
function fillPermisoFields(form, solicitud) {
  try {
    // Marcar tipo de permiso
    const checkboxes = {
      estudios: "per_est",
      personal: "per_ap",
      salud: "per_sal",
      calamidad: "per_cd",
    };

    const checkboxField = checkboxes[solicitud.tipo_permiso];
    if (checkboxField) {
      try {
        form.getCheckBox(checkboxField).check();
      } catch (e) {
        console.warn(`Checkbox ${checkboxField} no encontrado en formulario`);
      }
    }

    // Fechas
    if (solicitud.fecha_inicio) {
      try {
        form.getTextField("per_desde").setText(formatDate(solicitud.fecha_inicio));
      } catch (e) {
        console.warn("Campo per_desde no encontrado");
      }
    }

    if (solicitud.fecha_fin) {
      try {
        form.getTextField("per_hasta").setText(formatDate(solicitud.fecha_fin));
      } catch (e) {
        console.warn("Campo per_hasta no encontrado");
      }
    }

    // Duración
    if (solicitud.duracion_dias) {
      try {
        form.getTextField("per_dia").setText(solicitud.duracion_dias.toString());
      } catch (e) {
        console.warn("Campo per_dia no encontrado");
      }
    }

    if (solicitud.duracion_horas) {
      try {
        form.getTextField("per_horas").setText(solicitud.duracion_horas.toString());
      } catch (e) {
        console.warn("Campo per_horas no encontrado");
      }
    }
  } catch (error) {
    console.error("Error llenando campos de permiso:", error);
  }
}

/**
 * Llenar campos de vacaciones
 */
function fillVacacionesFields(form, solicitud) {
  try {
    if (solicitud.periodo_vacaciones) {
      try {
        form.getTextField("vac_periodo").setText(solicitud.periodo_vacaciones);
      } catch (e) {
        console.warn("Campo vac_periodo no encontrado");
      }
    }

    if (solicitud.fecha_inicio) {
      try {
        form.getTextField("vac_fecha_inicio").setText(formatDate(solicitud.fecha_inicio));
      } catch (e) {
        console.warn("Campo vac_fecha_inicio no encontrado");
      }
    }

    if (solicitud.fecha_fin) {
      try {
        form.getTextField("vac_fecha_fin").setText(formatDate(solicitud.fecha_fin));
      } catch (e) {
        console.warn("Campo vac_fecha_fin no encontrado");
      }
    }

    if (solicitud.duracion_dias) {
      try {
        form.getTextField("total_dias").setText(solicitud.duracion_dias.toString());
      } catch (e) {
        console.warn("Campo total_dias no encontrado");
      }
    }
  } catch (error) {
    console.error("Error llenando campos de vacaciones:", error);
  }
}

/**
 * Llenar campos comunes
 */
function fillCommonFields(form, solicitud) {
  try {
    // Observaciones
    if (solicitud.observaciones && Array.isArray(solicitud.observaciones)) {
      try {
        if (solicitud.observaciones[0]) form.getTextField("ob_1").setText(solicitud.observaciones[0]);
      } catch (e) { }
      try {
        if (solicitud.observaciones[1]) form.getTextField("ob_2").setText(solicitud.observaciones[1]);
      } catch (e) { }
      try {
        if (solicitud.observaciones[2]) form.getTextField("ob_3").setText(solicitud.observaciones[2]);
      } catch (e) { }
    }

    // Solicitante
    if (solicitud.user_fullname) {
      try {
        form.getTextField("sol_por").setText(solicitud.user_fullname);
      } catch (e) {
        console.warn("Campo sol_por no encontrado");
      }
    }

    if (solicitud.created_at) {
      try {
        form.getTextField("Fecha").setText(formatDate(solicitud.created_at));
      } catch (e) {
        console.warn("Campo Fecha no encontrado");
      }
    }

    // Aprobador
    if (solicitud.aprobacion_final_por) {
      try {
        form.getTextField("apr_por").setText(solicitud.aprobacion_final_por);
      } catch (e) {
        console.warn("Campo apr_por no encontrado");
      }
    }

    if (solicitud.aprobacion_final_at) {
      try {
        form.getTextField("Fecha_2").setText(formatDate(solicitud.aprobacion_final_at));
      } catch (e) {
        console.warn("Campo Fecha_2 no encontrado");
      }
    }
  } catch (error) {
    console.error("Error llenando campos comunes:", error);
  }
}

/**
 * Formatear fecha
 */
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("es-EC");
}

module.exports = {
  generateFRH10,
};
