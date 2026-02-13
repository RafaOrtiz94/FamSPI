import React, { useMemo } from "react";

const emptyValue = (value) => value === null || value === undefined || String(value).trim() === "";

const firstValue = (...values) => {
  for (const value of values) {
    if (!emptyValue(value)) return value;
  }
  return "N/A";
};

const boolLabel = (value) => {
  if (emptyValue(value)) return "N/A";
  const v = String(value).trim().toLowerCase();
  if (["si", "sí", "true", "1", "yes"].includes(v)) return "Si";
  if (["no", "false", "0"].includes(v)) return "No";
  return String(value);
};

const ApplicantIntakeSummary = ({ applicant }) => {
  const data = useMemo(() => {
    const profile = applicant?.profile || {};
    const extra = profile?.extra || {};
    const preguntas = extra?.preguntas_adicionales || {};
    const salud = extra?.salud || {};
    const docs = Array.isArray(applicant?.documents) ? applicant.documents : [];
    const hasCv = docs.some((d) => d?.doc_type === "HOJA_VIDA");
    const hasMotivation = docs.some((d) => d?.doc_type === "CARTA_MOTIVACION");

    return {
      identidad: [
        ["Aspiracion salarial", firstValue(preguntas.aspiracion_salarial)],
        ["Puesto aplicado", firstValue(profile?.laboral?.cargo)],
        ["Nombres", firstValue(applicant?.nombres, profile?.personal?.nombres)],
        ["Apellidos", firstValue(applicant?.apellidos, profile?.personal?.apellidos)],
        ["Edad", firstValue(applicant?.edad, profile?.personal?.edad)],
        ["Cedula", firstValue(applicant?.cedula, profile?.personal?.cedula)],
        ["Nacionalidad", firstValue(applicant?.nacionalidad, extra?.identificacion?.nacionalidad)],
        ["Estado civil", firstValue(applicant?.estado_civil, profile?.personal?.estado_civil)],
        ["Genero", firstValue(applicant?.genero, profile?.personal?.genero)],
        ["Email", firstValue(applicant?.email, profile?.personal?.email_personal)],
        ["Telefono", firstValue(applicant?.telefono, profile?.personal?.telefono_personal)],
        ["Tipo sangre", firstValue(applicant?.tipo_sangre, profile?.personal?.tipo_sangre)],
      ],
      ubicacion: [
        ["Nacimiento", firstValue(applicant?.lugar_nacimiento, profile?.personal?.lugar_nacimiento)],
        ["Residencia", firstValue(applicant?.lugar_residencia, profile?.laboral?.residencia)],
        ["Vive con", firstValue(applicant?.vive_con, preguntas?.vive_con)],
        ["Dependientes", firstValue(applicant?.dependientes, preguntas?.personas_dependen)],
        ["Numero de hijos", firstValue(applicant?.numero_hijos, preguntas?.numero_hijos)],
      ],
      adicional: [
        ["Autoidentificacion", firstValue(applicant?.grupo_etnico, preguntas?.auto_identificacion)],
        ["Tiene licencia", boolLabel(applicant?.tiene_licencia)],
        ["Tipo licencia", firstValue(applicant?.tipo_licencia, preguntas?.tipo_licencia)],
        ["Seguro de vida/salud", firstValue(salud?.seguro_vida_salud)],
        ["Conocio la vacante por", firstValue(preguntas?.medio_conocio_vacante)],
        ["Acepta viajar", firstValue(extra?.movilidad?.acepta_viajar)],
        ["Movilizacion propia", firstValue(extra?.movilidad?.movilizacion_propia)],
        ["Tiempo de incorporacion", firstValue(preguntas?.tiempo_incorporacion)],
      ],
      salud: [
        ["Enfermedad persistente", boolLabel(applicant?.enfermedad_persistente)],
        ["Desc. enfermedad persistente", firstValue(applicant?.descripcion_enfermedad_persistente, salud?.descripcion_enfermedad_persistente)],
        ["Enfermedad laboral", boolLabel(applicant?.enfermedad_laboral)],
        ["Desc. enfermedad laboral", firstValue(applicant?.descripcion_enfermedad_laboral, salud?.descripcion_enfermedad_laboral)],
        ["Medicacion continua", boolLabel(applicant?.medicacion_continua)],
        ["Cirugia reciente", boolLabel(applicant?.cirugia_recent)],
        ["Discapacidad", boolLabel(applicant?.discapacidad)],
        ["Tipo discapacidad", firstValue(applicant?.tipo_discapacidad)],
        ["Porcentaje discapacidad", firstValue(applicant?.porcentaje_discapacidad)],
        ["No. carnet discapacidad", firstValue(applicant?.numero_carnet_discapacidad)],
      ],
      experience: Array.isArray(applicant?.work_experience) ? applicant.work_experience : [],
      personalReferences: Array.isArray(applicant?.personal_references) ? applicant.personal_references : [],
      workReferences: Array.isArray(applicant?.work_references) ? applicant.work_references : [],
      trainings: Array.isArray(applicant?.trainings) ? applicant.trainings : [],
      education: Array.isArray(applicant?.education) ? applicant.education : [],
      docs,
      hasCv,
      hasMotivation,
    };
  }, [applicant]);

  const renderFieldGroup = (title, items) => (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h4>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={`${title}-${label}`}>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
            <p className="text-xs font-medium text-gray-900 break-words">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-semibold text-blue-900">Resumen de formulario del postulante</p>
        <p className="mt-1 text-[11px] text-blue-700">
          CV: <strong>{data.hasCv ? "Subido" : "Pendiente"}</strong> · Carta de motivacion: <strong>{data.hasMotivation ? "Subida" : "Pendiente"}</strong>
        </p>
      </div>

      {renderFieldGroup("Identidad", data.identidad)}
      {renderFieldGroup("Ubicacion y familia", data.ubicacion)}
      {renderFieldGroup("Informacion adicional", data.adicional)}
      {renderFieldGroup("Salud", data.salud)}

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Experiencia laboral</h4>
        <div className="mt-2 space-y-2">
          {data.experience.length === 0 ? (
            <p className="text-xs text-gray-500">Sin experiencia registrada</p>
          ) : (
            data.experience.map((item, index) => (
              <div key={`exp-${index}`} className="rounded border border-gray-100 bg-gray-50 p-2 text-xs text-gray-800">
                {firstValue(item?.empresa)} · {firstValue(item?.cargo)} · {firstValue(item?.tiempo_anios)} anos
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Referencias laborales</h4>
        <div className="mt-2 space-y-2">
          {data.workReferences.length === 0 ? (
            <p className="text-xs text-gray-500">Sin referencias laborales</p>
          ) : (
            data.workReferences.map((item, index) => (
              <div key={`wref-${index}`} className="rounded border border-gray-100 bg-gray-50 p-2 text-xs text-gray-800">
                {firstValue(item?.empresa)} · {firstValue(item?.nombre_contacto, item?.nombre)} · {firstValue(item?.celular_contacto, item?.celular)}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Referencias personales</h4>
        <div className="mt-2 space-y-2">
          {data.personalReferences.length === 0 ? (
            <p className="text-xs text-gray-500">Sin referencias personales</p>
          ) : (
            data.personalReferences.map((item, index) => (
              <div key={`pref-${index}`} className="rounded border border-gray-100 bg-gray-50 p-2 text-xs text-gray-800">
                {firstValue(item?.nombre)} · {firstValue(item?.celular)} · {firstValue(item?.ocupacion)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplicantIntakeSummary;
