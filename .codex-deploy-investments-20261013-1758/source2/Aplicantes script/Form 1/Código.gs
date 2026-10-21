// ════════════════════════════════════════════════════════
// FORM 1 — Trigger del formulario estructurado
// Usa las constantes de Config.gs — no redeclarar nada aquí.
// ════════════════════════════════════════════════════════

function onFormSubmit(e) {

  if (!e || !e.values) {
    Logger.log("Ejecutar desde un trigger de formulario, no manualmente.");
    return;
  }

  var v = e.values;

  var fecha    = v[0];   // A: Marca temporal
  var correo   = v[1];   // B: Dirección de correo electrónico
  var puesto   = v[2];   // C: Puesto al que aplica
  var nombres  = v[3];   // D: Nombres
  var apells   = v[4];   // E: Apellidos
  var telefono = v[6];   // G: Teléfono Celular
  var cv       = v[COL_CV];    // CE: Curriculum Vitae
  var carta    = v[COL_CARTA]; // CF: Carta de motivación

  var nombreCompleto = (nombres + " " + apells).trim();

  // Payload completo — claves exactas que el backend reconoce
  var applicantData = {
    direccion_de_correo_electronico:                    v[1],
    puesto_al_que_aplica:                               v[2],
    nombres:                                            v[3],
    apellidos:                                          v[4],
    edad:                                               v[5],
    telefono_celular:                                   v[6],
    lugar_de_nacimiento_provincia_ciudad:               v[7],
    fecha_de_nacimiento:                                v[8],
    lugar_de_residencia_provincia_ciudad:               v[9],
    estado_civil:                                       v[10],
    vive_con:                                           v[11],
    personas_que_dependen_de_usted:                     v[12],
    numero_de_hijos:                                    v[13],
    cedula_de_ciudadania:                               v[14],
    pasaporte_no:                                       v[15],
    nacionalidad:                                       v[16],
    genero:                                             v[17],
    tipo_de_sangre:                                     v[18],
    tiene_licencia_de_manejo:                           v[19],
    escoja_tipo_licencia:                               v[20],
    auto_identificacion:                                v[21],
    padece_actualmente_alguna_enfermedad_persistente:   v[22],
    describa_la_enfermedad_persistente:                 v[23],
    padece_o_ha_padecido_alguna_enfermedad_laboral:     v[24],
    describa_la_enfermedad_laboral:                     v[25],
    toma_actualmente_alguna_medicacion_de_uso_continuo: v[26],
    ha_sido_sometido_a_alguna_cirugia_en_los_ultimos_seis_meses: v[27],
    tiene_alguna_discapacidad:                          v[28],
    tipo_de_discapacidad:                               v[29],
    porcentaje_de_discapacidad:                         v[30],
    no_carnet:                                          v[31],
    institucion_educativa_colegio:                      v[32],
    ciudad_pais_colegio:                                v[33],
    titulo_recibido_colegio:                            v[34],
    institucion_educativa_universidad:                  v[35],
    ciudad_pais_universidad:                            v[36],
    titulo_recibido_universidad:                        v[37],
    posee_formacion_superior_cuarto_nivel:              v[38],
    institucion_educativa_cuarto_nivel:                 v[39],
    ciudad_pais_cuarto_nivel:                           v[40],
    titulo_recibido_cuarto_nivel:                       v[41],
    institucion_capacitacion_1:                         v[42],
    tema_capacitacion_1:                                v[43],
    ciudad_pais_capacitacion_1:                         v[44],
    numero_horas_capacitacion_1:                        v[45],
    institucion_capacitacion_2:                         v[46],
    tema_capacitacion_2:                                v[47],
    ciudad_pais_capacitacion_2:                         v[48],
    numero_horas_capacitacion_2:                        v[49],
    nombres_persona_1:                                  v[50],
    celular_persona_1:                                  v[51],
    ocupacion_persona_1:                                v[52],
    tiempo_de_conocerlo_persona_1:                      v[53],
    nombres_persona_2:                                  v[54],
    celular_persona_2:                                  v[55],
    ocupacion_persona_2:                                v[56],
    tiempo_de_conocerlo_persona_2:                      v[57],
    posee_experiencia_laboral:                          v[58],
    nombre_empresa_1:                                   v[59],
    tiempo_empresa_1:                                   v[60],
    cargo_empresa_1:                                    v[61],
    funciones_empresa_1:                                v[62],
    nombre_empresa_2:                                   v[63],
    tiempo_empresa_2:                                   v[64],
    cargo_empresa_2:                                    v[65],
    funciones_empresa_2:                                v[66],
    empresa_contacto_1:                                 v[67],
    nombre_contacto_1:                                  v[68],
    celular_contacto_1:                                 v[69],
    cargo_contacto_1:                                   v[70],
    empresa_contacto_2:                                 v[71],
    nombre_contacto_2:                                  v[72],
    celular_contacto_2:                                 v[73],
    cargo_contacto_2:                                   v[74],
    tiene_seguro_de_vida_o_salud:                       v[75],
    medio_por_el_que_conocio_de_la_vacante:             v[76],
    estaria_dispuesto_a_cambiar_de_lugar_de_residencia: v[77],
    aceptaria_viajar_eventualmente_fuera_y_dentro_de_la_ciudad: v[78],
    posee_movilizacion_propia:                          v[79],
    en_cuanto_tiempo_podria_incorporarse:               v[80],
    aspiracion_salarial:                                v[81],
    curriculum_vitae_url:                               v[COL_CV],
    carta_de_motivacion_url:                            v[COL_CARTA],
    estado: "postulante"
  };

  // Envío al backend SPI — PRIMERO, para asegurar los datos aunque el correo falle
  try {
    var resp = UrlFetchApp.fetch(ENDPOINT_SPI, {
      method          : "post",
      contentType     : "application/json",
      headers         : { "x-api-key": API_KEY },
      payload         : JSON.stringify(applicantData),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code !== 200 && code !== 201) {
      Logger.log("SPI error " + code + ": " + resp.getContentText());
    } else {
      Logger.log("SPI OK: " + correo);
    }
  } catch (err) {
    Logger.log("Error al llamar SPI: " + err);
  }

  // Correo 1: Al postulante
  var ASUNTO_POST = "Hemos recibido tu postulación – " + puesto + " – FAMPROJECT";
  var htmlPost = '<div style="font-family:Arial,Helvetica,sans-serif; line-height:1.6">'
    + '<h2 style="color:#1f3c88">¡Gracias por tu postulación, ' + nombreCompleto + '!</h2>'
    + '<p>Hemos recibido correctamente tu información el día <b>' + fecha + '</b> para el puesto de:</p>'
    + '<p style="font-size:16px; color:#1f3c88"><b>' + puesto + '</b></p>'
    + '<p>Nuestro departamento de <b>' + AREA + '</b> revisará tu perfil y se pondrá en contacto'
    + ' contigo en caso de continuar con el proceso de selección.</p>'
    + '<br><p style="color:#666">Saludos cordiales<br>' + AREA + '<br>' + EMPRESA + '</p>'
    + '</div>';

  GmailApp.sendEmail(correo, ASUNTO_POST, "Gracias por tu postulación.", {
    htmlBody: htmlPost
  });

  // Correo 2: A Talento Humano
  var ASUNTO_RRHH = "Nueva postulación recibida – " + puesto + " – FAMPROJECT";
  var cvLink    = cv    ? '<a href="' + cv    + '" target="_blank">Ver CV</a>'    : 'No adjuntado';
  var cartaLink = carta ? '<a href="' + carta + '" target="_blank">Ver carta</a>' : 'No adjuntada';

  var htmlRRHH = '<div style="font-family:Arial,Helvetica,sans-serif; line-height:1.6">'
    + '<h2 style="color:#1f3c88">Nueva postulación recibida</h2>'
    + '<table style="border-collapse:collapse; width:100%; max-width:600px">'
    + '<tr style="background:#f0f4ff"><td style="padding:8px 12px; font-weight:bold; width:40%">Fecha</td><td style="padding:8px 12px">'           + fecha          + '</td></tr>'
    + '<tr><td style="padding:8px 12px; font-weight:bold">Puesto</td><td style="padding:8px 12px; color:#1f3c88"><b>'                               + puesto         + '</b></td></tr>'
    + '<tr style="background:#f0f4ff"><td style="padding:8px 12px; font-weight:bold">Nombre</td><td style="padding:8px 12px">'                      + nombreCompleto  + '</td></tr>'
    + '<tr><td style="padding:8px 12px; font-weight:bold">Correo</td><td style="padding:8px 12px"><a href="mailto:' + correo + '">'                  + correo          + '</a></td></tr>'
    + '<tr style="background:#f0f4ff"><td style="padding:8px 12px; font-weight:bold">Teléfono</td><td style="padding:8px 12px">'                    + telefono        + '</td></tr>'
    + '<tr><td style="padding:8px 12px; font-weight:bold">Currículum</td><td style="padding:8px 12px">'                                             + cvLink          + '</td></tr>'
    + '<tr style="background:#f0f4ff"><td style="padding:8px 12px; font-weight:bold">Carta motivación</td><td style="padding:8px 12px">'            + cartaLink       + '</td></tr>'
    + '</table>'
    + '<br><p style="color:#666; font-size:13px">Generado automáticamente — ' + EMPRESA + '</p>'
    + '</div>';

  GmailApp.sendEmail(CORREO_RRHH, ASUNTO_RRHH, "Nueva postulación recibida.", {
    htmlBody: htmlRRHH
  });
}


function testOnFormSubmit() {
  var vals = new Array(92).fill("");
  vals[0]  = "10/06/2025 11:44:00";
  vals[1]  = "correo.postulante@gmail.com";
  vals[2]  = "ASESOR COMERCIAL DISPOSITIVOS MEDICOS";
  vals[3]  = "Juan";
  vals[4]  = "Pérez";
  vals[5]  = "28";
  vals[6]  = "0991234567";
  vals[7]  = "Pichincha / Quito";
  vals[8]  = "15/03/1997";
  vals[14] = "1712345678";
  vals[35] = "Universidad Central del Ecuador";
  vals[37] = "Ingeniería Comercial";
  vals[COL_CV]    = "https://drive.google.com/file/d/ejemplo-cv";
  vals[COL_CARTA] = "https://drive.google.com/file/d/ejemplo-carta";
  onFormSubmit({ values: vals });
}
