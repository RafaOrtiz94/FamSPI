import React, { useMemo } from "react";
import { FiExternalLink, FiFileText, FiAlertCircle } from "react-icons/fi";

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
  if (["si", "sí", "true", "1", "yes"].includes(v)) return "Sí";
  if (["no", "false", "0"].includes(v)) return "No";
  return String(value);
};

const DriveLink = ({ url, label }) => {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Abrir ${label} en Google Drive`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 active:scale-95"
    >
      <FiFileText size={13} />
      {label}
      <FiExternalLink size={11} className="opacity-60" />
    </a>
  );
};

const ApplicantIntakeSummary = ({ applicant }) => {
  const data = useMemo(() => {
    const profile  = applicant?.profile || {};
    const extra    = profile?.extra || {};
    const preguntas = extra?.preguntas_adicionales || {};
    const salud    = extra?.salud || {};
    const docs     = Array.isArray(applicant?.documents) ? applicant.documents : [];

    const cvDoc         = docs.find((d) => d?.doc_type === "HOJA_VIDA");
    const motivationDoc = docs.find((d) => d?.doc_type === "CARTA_MOTIVACION");

    return {
      identidad: [
        ["Puesto aplicado",    firstValue(profile?.laboral?.cargo)],
        ["Aspiracion salarial",firstValue(preguntas.aspiracion_salarial)],
        ["Nombres",            firstValue(applicant?.nombres, profile?.personal?.nombres)],
        ["Apellidos",          firstValue(applicant?.apellidos, profile?.personal?.apellidos)],
        ["Edad",               firstValue(applicant?.edad, profile?.personal?.edad)],
        ["Cedula",             firstValue(applicant?.cedula, profile?.personal?.cedula)],
        ["Nacionalidad",       firstValue(applicant?.nacionalidad, extra?.identificacion?.nacionalidad)],
        ["Estado civil",       firstValue(applicant?.estado_civil, profile?.personal?.estado_civil)],
        ["Genero",             firstValue(applicant?.genero, profile?.personal?.genero)],
        ["Email",              firstValue(applicant?.email, profile?.personal?.email_personal)],
        ["Telefono",           firstValue(applicant?.telefono, profile?.personal?.telefono_personal)],
        ["Tipo sangre",        firstValue(applicant?.tipo_sangre, profile?.personal?.tipo_sangre)],
      ],
      ubicacion: [
        ["Nacimiento",    firstValue(applicant?.lugar_nacimiento, profile?.personal?.lugar_nacimiento)],
        ["Residencia",    firstValue(applicant?.lugar_residencia, profile?.laboral?.residencia)],
        ["Vive con",      firstValue(applicant?.vive_con, preguntas?.vive_con)],
        ["Dependientes",  firstValue(applicant?.dependientes, preguntas?.personas_dependen)],
        ["Hijos",         firstValue(applicant?.numero_hijos, preguntas?.numero_hijos)],
      ],
      adicional: [
        ["Autoidentificacion",    firstValue(applicant?.grupo_etnico, preguntas?.auto_identificacion)],
        ["Tiene licencia",        boolLabel(applicant?.tiene_licencia)],
        ["Tipo licencia",         firstValue(applicant?.tipo_licencia, preguntas?.tipo_licencia)],
        ["Seguro vida/salud",     firstValue(salud?.seguro_vida_salud)],
        ["Conocio vacante por",   firstValue(preguntas?.medio_conocio_vacante)],
        ["Acepta viajar",         firstValue(extra?.movilidad?.acepta_viajar)],
        ["Movilizacion propia",   firstValue(extra?.movilidad?.movilizacion_propia)],
        ["Tiempo incorporacion",  firstValue(preguntas?.tiempo_incorporacion)],
      ],
      salud: [
        ["Enfermedad persistente",        boolLabel(applicant?.enfermedad_persistente)],
        ["Desc. enf. persistente",        firstValue(applicant?.descripcion_enfermedad_persistente, salud?.descripcion_enfermedad_persistente)],
        ["Enfermedad laboral",            boolLabel(applicant?.enfermedad_laboral)],
        ["Desc. enf. laboral",            firstValue(applicant?.descripcion_enfermedad_laboral, salud?.descripcion_enfermedad_laboral)],
        ["Medicacion continua",           boolLabel(applicant?.medicacion_continua)],
        ["Cirugia reciente",              boolLabel(applicant?.cirugia_recent)],
        ["Discapacidad",                  boolLabel(applicant?.discapacidad)],
        ["Tipo discapacidad",             firstValue(applicant?.tipo_discapacidad)],
        ["Porcentaje discapacidad",       firstValue(applicant?.porcentaje_discapacidad)],
        ["No. carnet discapacidad",       firstValue(applicant?.numero_carnet_discapacidad)],
      ],
      experience:        Array.isArray(applicant?.work_experience)      ? applicant.work_experience      : [],
      personalReferences:Array.isArray(applicant?.personal_references)  ? applicant.personal_references  : [],
      workReferences:    Array.isArray(applicant?.work_references)       ? applicant.work_references       : [],
      trainings:         Array.isArray(applicant?.trainings)             ? applicant.trainings             : [],
      education:         Array.isArray(applicant?.education)             ? applicant.education             : [],
      cvDoc,
      motivationDoc,
    };
  }, [applicant]);

  const renderFieldGroup = (title, items) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
        {title}
      </h4>
      <div className="grid grid-cols-1 gap-y-3 gap-x-4 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={`${title}-${label}`} className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">
              {label}
            </p>
            <p className="text-xs font-medium text-gray-900 break-words leading-snug">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">

      {/* Banner de documentos */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-semibold text-blue-900 mb-2">
          Resumen del expediente inicial del postulante
        </p>

        <div className="flex flex-wrap gap-2">
          {data.cvDoc?.drive_url ? (
            <DriveLink url={data.cvDoc.drive_url} label="Ver CV" />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-400">
              <FiAlertCircle size={12} />
              CV pendiente
            </span>
          )}

          {data.motivationDoc?.drive_url ? (
            <DriveLink url={data.motivationDoc.drive_url} label="Ver carta de motivacion" />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-400">
              <FiAlertCircle size={12} />
              Carta pendiente
            </span>
          )}
        </div>
      </div>

      {renderFieldGroup("Identidad", data.identidad)}
      {renderFieldGroup("Ubicacion y familia", data.ubicacion)}
      {renderFieldGroup("Informacion adicional", data.adicional)}
      {renderFieldGroup("Salud", data.salud)}

      {/* Experiencia laboral */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Experiencia laboral
        </h4>
        <div className="space-y-2">
          {data.experience.length === 0 ? (
            <p className="text-xs text-gray-400">
              El postulante no registra experiencia laboral en este formulario.
            </p>
          ) : (
            data.experience.map((item, index) => (
              <div
                key={`exp-${index}`}
                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {firstValue(item?.empresa)}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {firstValue(item?.cargo)} · {firstValue(item?.tiempo_anios)} años
                </p>
                {item?.funciones && (
                  <p className="mt-1 text-[11px] text-gray-400 break-words line-clamp-2">
                    {item.funciones}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Referencias laborales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Referencias laborales
        </h4>
        <div className="space-y-2">
          {data.workReferences.length === 0 ? (
            <p className="text-xs text-gray-400">
              El postulante no registra referencias laborales en este formulario.
            </p>
          ) : (
            data.workReferences.map((item, index) => (
              <div
                key={`wref-${index}`}
                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
              >
                <p className="font-semibold text-gray-800 truncate">
                  {firstValue(item?.empresa)}
                </p>
                <p className="text-gray-500 truncate">
                  {firstValue(item?.nombre_contacto, item?.nombre)} · {firstValue(item?.celular_contacto, item?.celular)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Referencias personales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Referencias personales
        </h4>
        <div className="space-y-2">
          {data.personalReferences.length === 0 ? (
            <p className="text-xs text-gray-400">
              El postulante no registra referencias personales en este formulario.
            </p>
          ) : (
            data.personalReferences.map((item, index) => (
              <div
                key={`pref-${index}`}
                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
              >
                <p className="font-semibold text-gray-800 truncate">
                  {firstValue(item?.nombre)}
                </p>
                <p className="text-gray-500 truncate">
                  {firstValue(item?.ocupacion)} · {firstValue(item?.celular)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default ApplicantIntakeSummary;
