// ════════════════════════════════════════════════════════
// FORM 2 — Formulario Genérico (headers dinámicos)
// Todas las declaraciones del proyecto van aquí.
// Código.gs y BulkImport.gs NO deben redeclarar nada.
// ════════════════════════════════════════════════════════

// Sheet del que se importan datos históricos
var SPREADSHEET_ID = "14rdK01zNvPeV5ElUYZ0HJeGXRD8WWq8TCdgn_Gs-Mdo";
var SHEET_NAME     = "Respuestas de formulario 1";

// Backend SPI
var ENDPOINT_SPI = "https://spi-backend-983537733948.us-central1.run.app/api/applicants/import";
var API_KEY      = "AFPSPI2026V1";

// Email — datos únicos de este formulario
var ASUNTO     = "Hemos recibido tu postulación – FAMPROJECT";
var EMPRESA    = "FAMPROJECT CIA. LTDA.";
var AREA       = "Talento Humano";
var COPIA_RRHH = "talento.humano@fam-project.com";

// Bulk import — filas por minuto (límite backend: 10/min)
var BATCH_SIZE = 8;

// Índices 0-based verificados contra headers.md de este formulario
// (86 columnas totales: A1 a CH1 — sin columnas de Document Merge)
var COL_EMAIL         = 1;  // B1: Dirección de correo electrónico
var COL_NOMBRES       = 3;  // D1: Nombres
var COL_APELLIDOS     = 4;  // E1: Apellidos
var COL_CV            = 82; // CE1 (N°83): Curriculum Vitae
var COL_CARTA         = 83; // CF1 (N°84): Carta de motivación
var COL_ACEPTA_VIAJAR = 78; // CA1 (N°79): Si fuese seleccionado(a) aceptaría viajar...
var COL_INCORPORARSE  = 80; // CC1 (N°81): Si fuese seleccionado(a) en cuánto tiempo...

// Claves internas de PropertiesService para el bulk import (no tocar)
var P_ROW     = "BLK_ROW";
var P_RESULTS = "BLK_RES";
var P_TOTAL   = "BLK_TOTAL";
