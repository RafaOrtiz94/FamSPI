// ════════════════════════════════════════════════════════
// FORM 2 — Trigger del formulario genérico (headers dinámicos)
// Usa las constantes de Config.gs — no redeclarar nada aquí.
// ════════════════════════════════════════════════════════

function onFormSubmit(e) {

  var sh      = e.source.getActiveSheet();
  var row     = e.range.getRow();
  var lastCol = sh.getLastColumn();

  // Datos fijos para el correo (columnas 1-based en getRange)
  var fecha   = sh.getRange(row, 1).getDisplayValue();  // A1: Marca temporal
  var correo  = sh.getRange(row, 2).getValue();         // B1: Correo electrónico
  var puesto  = sh.getRange(row, 3).getValue();         // C1: Puesto al que aplica
  var nombres = sh.getRange(row, 4).getValue();         // D1: Nombres
  var apells  = sh.getRange(row, 5).getValue();         // E1: Apellidos
  var nombreCompleto = (nombres + " " + apells).trim();

  // Leer todos los headers y valores de la fila
  var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var values  = sh.getRange(row, 1, 1, lastCol).getDisplayValues()[0];

  // Payload dinámico: cada header → clave normalizada
  var applicantData = {};
  headers.forEach(function(h, i) {
    if (h && h.trim()) applicantData[normalizeKey(h)] = values[i] || "";
  });

  // Correcciones de claves críticas — el header normalizado no coincide
  // exactamente con lo que el backend busca en estos 4 casos
  if (values[COL_CV])            applicantData["curriculum_vitae_url"]    = values[COL_CV];
  if (values[COL_CARTA])         applicantData["carta_de_motivacion_url"] = values[COL_CARTA];
  if (values[COL_ACEPTA_VIAJAR]) applicantData["aceptaria_viajar_eventualmente_fuera_y_dentro_de_la_ciudad"] = values[COL_ACEPTA_VIAJAR];
  if (values[COL_INCORPORARSE])  applicantData["en_cuanto_tiempo_podria_incorporarse"] = values[COL_INCORPORARSE];

  applicantData["estado"] = "postulante";

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
    Logger.log("Error SPI: " + err);
  }

  // Correo al postulante
  var asunto = puesto
    ? ("Hemos recibido tu postulación – " + puesto + " – FAMPROJECT")
    : ASUNTO;

  var html = '<div style="font-family:Arial,Helvetica,sans-serif; line-height:1.6">'
    + '<h2 style="color:#1f3c88">¡Gracias por tu postulación, ' + nombreCompleto + '!</h2>'
    + '<p>Recibimos tu información el <b>' + fecha + '</b>'
    + (puesto ? ' para el puesto de <b>' + puesto + '</b>' : '') + '.</p>'
    + '<p>El equipo de <b>' + AREA + '</b> revisará tu perfil y se pondrá en contacto'
    + ' contigo en caso de continuar con el proceso de selección.</p>'
    + '<br><p style="color:#666">Saludos cordiales<br>' + AREA + '<br>' + EMPRESA + '</p>'
    + '</div>';

  GmailApp.sendEmail(correo, asunto, "Gracias por tu postulación.", {
    htmlBody: html,
    cc: COPIA_RRHH
  });
}


function normalizeKey(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[?¿()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
