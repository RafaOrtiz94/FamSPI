// ════════════════════════════════════════════════════════
// FORM 1 — Formulario Estructurado (con índices fijos)
// Todas las declaraciones del proyecto van aquí.
// Código.gs y BulkImport.gs NO deben redeclarar nada.
// ════════════════════════════════════════════════════════

// Sheet del que se importan datos históricos
var SPREADSHEET_ID = "1fyPpESJjvqE1_WA-FwxUQ8MHAN4J848h7v7nHKY0yqE";
var SHEET_NAME     = "Respuestas de formulario 1";

// Backend SPI
var ENDPOINT_SPI = "https://spi-backend-983537733948.us-central1.run.app/api/applicants/import";
var API_KEY      = "AFPSPI2026V1";

// Email — datos únicos de este formulario
var EMPRESA    = "FAMPROJECT CIA. LTDA.";
var AREA       = "Talento Humano";
var CORREO_RRHH = "valeria.revelo@fam-project.com";

// Bulk import — filas por minuto (límite backend: 10/min)
var BATCH_SIZE = 8;

// Índices 0-based de columnas clave (verificados contra headers reales)
var COL_EMAIL         = 1;  // B: Dirección de correo electrónico
var COL_NOMBRES       = 3;  // D: Nombres
var COL_APELLIDOS     = 4;  // E: Apellidos
var COL_CV            = 82; // CE: Curriculum Vitae
var COL_CARTA         = 83; // CF: Carta de motivación
var COL_ACEPTA_VIAJAR = 78; // CA: Si fuese seleccionado(a) aceptaría viajar...
var COL_INCORPORARSE  = 80; // CC: En cuánto tiempo podría incorporarse

// Claves internas de PropertiesService para el bulk import (no tocar)
var P_ROW     = "BLK_ROW";
var P_RESULTS = "BLK_RES";
var P_TOTAL   = "BLK_TOTAL";
