// ════════════════════════════════════════════════════════
// FORM 1 — Importación masiva de datos históricos del Sheet
// Usa las constantes de Config.gs — no redeclarar nada aquí.
// ════════════════════════════════════════════════════════

/* ────────────────────────────────────────────────────────
   PASO 1 — Ejecuta iniciarBulkImport() UNA VEZ.
   El sistema corre solo cada minuto hasta terminar.
   Consulta el avance con verProgresoBulkImport().
──────────────────────────────────────────────────────── */

function iniciarBulkImport() {
  var props = PropertiesService.getScriptProperties();
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

  if (!sheet) {
    Logger.log("❌ No se encontró la hoja: " + SHEET_NAME);
    return;
  }

  var total = sheet.getLastRow() - 1;

  props.setProperty(P_ROW,   "2");
  props.setProperty(P_TOTAL, String(total));
  props.deleteProperty(P_RESULTS);

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "_bulkImportBatch") ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("_bulkImportBatch").timeBased().everyMinutes(1).create();

  Logger.log("✅ Bulk import iniciado.");
  Logger.log("   Total filas : " + total);
  Logger.log("   Velocidad   : " + BATCH_SIZE + " filas/minuto");
  Logger.log("   Tiempo est. : ~" + Math.ceil(total / BATCH_SIZE) + " minutos");
}


function _bulkImportBatch() {
  var props    = PropertiesService.getScriptProperties();
  var startRow = parseInt(props.getProperty(P_ROW) || "2");
  var total    = parseInt(props.getProperty(P_TOTAL) || "0");
  var results  = JSON.parse(props.getProperty(P_RESULTS) ||
    '{"ok":0,"skip":0,"error":0,"errores":[]}');

  var sheet   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();

  if (startRow > lastRow) {
    _finalizarBulkImport(results);
    return;
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var endRow  = Math.min(startRow + BATCH_SIZE - 1, lastRow);

  Logger.log("[BulkImport] Filas " + startRow + "–" + endRow + " de " + lastRow);

  for (var row = startRow; row <= endRow; row++) {
    var values = sheet.getRange(row, 1, 1, lastCol).getDisplayValues()[0];
    var email  = (values[COL_EMAIL]     || "").trim();
    var noms   = (values[COL_NOMBRES]   || "").trim();
    var ape    = (values[COL_APELLIDOS] || "").trim();

    if (!email || !email.includes("@") || !noms || !ape) {
      Logger.log("  F" + row + " SKIP — sin email/nombres válidos");
      results.skip++;
      continue;
    }

    // Payload dinámico desde headers de la hoja
    var payload = {};
    headers.forEach(function(h, i) {
      if (h && h.trim()) payload[_normalizeKey(h)] = values[i] || "";
    });

    // Correcciones de claves críticas
    if (values[COL_CV])            payload["curriculum_vitae_url"]    = values[COL_CV];
    if (values[COL_CARTA])         payload["carta_de_motivacion_url"] = values[COL_CARTA];
    if (values[COL_ACEPTA_VIAJAR]) payload["aceptaria_viajar_eventualmente_fuera_y_dentro_de_la_ciudad"] = values[COL_ACEPTA_VIAJAR];
    if (values[COL_INCORPORARSE])  payload["en_cuanto_tiempo_podria_incorporarse"] = values[COL_INCORPORARSE];
    payload["estado"] = "postulante";

    try {
      var resp = UrlFetchApp.fetch(ENDPOINT_SPI, {
        method          : "post",
        contentType     : "application/json",
        headers         : { "x-api-key": API_KEY },
        payload         : JSON.stringify(payload),
        muteHttpExceptions: true
      });
      var code = resp.getResponseCode();
      if (code === 200 || code === 201) {
        Logger.log("  F" + row + " OK — " + email);
        results.ok++;
      } else {
        Logger.log("  F" + row + " ERROR " + code + " — " + email + " | " + resp.getContentText().substring(0, 150));
        results.error++;
        if (results.errores.length < 100) results.errores.push("F" + row + ":" + email + "(" + code + ")");
      }
    } catch (err) {
      Logger.log("  F" + row + " EXCEPTION — " + email + " | " + err.toString());
      results.error++;
      results.errores.push("F" + row + ":" + email + "(exc)");
    }

    Utilities.sleep(600);
  }

  props.setProperty(P_ROW,     String(endRow + 1));
  props.setProperty(P_RESULTS, JSON.stringify(results));

  var pct = Math.round(((endRow - 1) / total) * 100);
  Logger.log("[BulkImport] " + pct + "% | ok=" + results.ok + " skip=" + results.skip + " error=" + results.error);
}


function verProgresoBulkImport() {
  var props   = PropertiesService.getScriptProperties();
  var row     = props.getProperty(P_ROW);
  var total   = props.getProperty(P_TOTAL);
  var results = JSON.parse(props.getProperty(P_RESULTS) || '{"ok":0,"skip":0,"error":0,"errores":[]}');

  if (!row) { Logger.log("No hay import en curso. Ejecuta iniciarBulkImport()."); return; }

  var pct = total ? Math.round(((parseInt(row) - 2) / parseInt(total)) * 100) : "?";
  Logger.log("═══════════ PROGRESO ═══════════");
  Logger.log("Próxima fila : " + row + " / " + (parseInt(total) + 1));
  Logger.log("Progreso     : " + pct + "%");
  Logger.log("Importados   : " + results.ok);
  Logger.log("Omitidos     : " + results.skip);
  Logger.log("Errores      : " + results.error);
  if (results.errores.length > 0) results.errores.slice(-20).forEach(function(e) { Logger.log("  " + e); });
  Logger.log("════════════════════════════════");
}


function cancelarBulkImport() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "_bulkImportBatch") ScriptApp.deleteTrigger(t);
  });
  var props   = PropertiesService.getScriptProperties();
  var results = JSON.parse(props.getProperty(P_RESULTS) || '{"ok":0,"skip":0,"error":0}');
  Logger.log("Import cancelado en fila " + props.getProperty(P_ROW));
  Logger.log("ok=" + results.ok + " skip=" + results.skip + " error=" + results.error);
  props.deleteProperty(P_ROW);
  props.deleteProperty(P_RESULTS);
  props.deleteProperty(P_TOTAL);
}


function _finalizarBulkImport(results) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "_bulkImportBatch") ScriptApp.deleteTrigger(t);
  });
  Logger.log("══════════════════════════════════════");
  Logger.log("✅ BULK IMPORT COMPLETADO");
  Logger.log("   Importados : " + results.ok);
  Logger.log("   Omitidos   : " + results.skip);
  Logger.log("   Errores    : " + results.error);
  if (results.errores.length > 0) results.errores.forEach(function(e) { Logger.log("  " + e); });
  Logger.log("══════════════════════════════════════");
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(P_ROW);
  props.deleteProperty(P_RESULTS);
  props.deleteProperty(P_TOTAL);
}


function _normalizeKey(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[?¿()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
