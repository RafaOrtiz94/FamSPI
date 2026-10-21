"use strict";

// Cliente minimo de Roche eLabDoc (documentos publicos de productos).
// Busqueda: POST api/documents/search con searchType "Metadata" (el unico valido).
// Descarga: GET api/downloads/<id>?countryIsoCode=<cc>; gb/de/be funcionan sin
// login, us/ec devuelven 401.

const fs = require("fs");

const BASE = "https://elabdoc-prod.roche.com/eLD/api";
const HEADERS = { "Content-Type": "application/json", "User-Agent": "FamSPI consumable-specs" };
const COUNTRIES = ["gb", "de", "be"];
const USABLE_DOC = /method_sheet|package_insert|instructions|quick_reference|product_information/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function search(term, countryCode) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/documents/search`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ searchTerm: term, searchType: "Metadata", countryCode, languageCode: "en",
          offset: 0, pageSize: 100, filters: [], noDefaults: true }),
      });
      if (res.ok) return (await res.json()).items || [];
      if (res.status === 400) return [];
    } catch {
      // reintento
    }
    await sleep(1500 * (attempt + 1));
  }
  return [];
}

// Documentos utiles (Method Sheet, etc.) en ingles para un termino; recorre
// paises hasta encontrar alguno que no sea solo certificados de lote.
async function findDocuments(term) {
  for (const cc of COUNTRIES) {
    const items = await search(term, cc);
    const usable = items
      .filter((i) => USABLE_DOC.test(`${i.documentTypeTechnicalName} ${i.documentType}`) && (i.languages || []).includes("en"))
      .map((i) => ({
        id: i.id,
        title: i.title,
        type: i.documentType,
        version: i.version,
        date: toIsoDate(i.date),
        systems: i.systems || [],
        materials: (i.materials || []).map((m) => ({ code: m.materialNumber, name: m.name })),
        countryCode: cc,
        url: `${BASE}/downloads/${i.id}?countryIsoCode=${cc}`,
      }));
    if (usable.length) return usable;
  }
  return [];
}

// Prefiere el documento que lista el codigo exacto y, entre esos, el Method Sheet.
function pickDocument(documents, code) {
  const code11 = String(code).padStart(11, "0");
  return [...documents].sort((a, b) =>
    (b.materials.some((m) => m.code === code11) - a.materials.some((m) => m.code === code11))
    || (/method/i.test(b.type) - /method/i.test(a.type)))[0] || null;
}

async function download(document, targetPath) {
  if (fs.existsSync(targetPath)) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(document.url, { headers: HEADERS });
      if (res.ok) {
        fs.writeFileSync(targetPath, Buffer.from(await res.arrayBuffer()));
        return true;
      }
      if (res.status === 401 || res.status === 404) return false;
    } catch {
      // reintento
    }
    await sleep(1500 * (attempt + 1));
  }
  return false;
}

function toIsoDate(ddmmyyyy) {
  const [dd, mm, yyyy] = String(ddmmyyyy || "").split("/");
  return yyyy ? `${yyyy}-${mm}-${dd}` : null;
}

module.exports = { findDocuments, pickDocument, download };
