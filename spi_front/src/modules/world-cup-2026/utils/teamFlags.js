const TEAM_FLAG_MAP = {
  argentina: "AR",
  australia: "AU",
  belgium: "BE",
  bolivia: "BO",
  brazil: "BR",
  brasil: "BR",
  canada: "CA",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  costa_rica: "CR",
  "costa rica": "CR",
  croatia: "HR",
  croacia: "HR",
  denmark: "DK",
  dinamarca: "DK",
  ecuador: "EC",
  egypt: "EG",
  egipto: "EG",
  england: "GB-ENG",
  espana: "ES",
  españa: "ES",
  spain: "ES",
  france: "FR",
  francia: "FR",
  germany: "DE",
  alemania: "DE",
  ghana: "GH",
  holland: "NL",
  netherlands: "NL",
  paises_bajos: "NL",
  "paises bajos": "NL",
  países_bajos: "NL",
  "países bajos": "NL",
  iran: "IR",
  italy: "IT",
  italia: "IT",
  japan: "JP",
  japon: "JP",
  korea: "KR",
  "south korea": "KR",
  "corea del sur": "KR",
  mexico: "MX",
  morocco: "MA",
  marruecos: "MA",
  norway: "NO",
  noruega: "NO",
  paraguay: "PY",
  peru: "PE",
  poland: "PL",
  polonia: "PL",
  portugal: "PT",
  qatar: "QA",
  saudi_arabia: "SA",
  "saudi arabia": "SA",
  "arabia saudita": "SA",
  scotland: "GB-SCT",
  senegal: "SN",
  serbia: "RS",
  switzerland: "CH",
  suiza: "CH",
  tunisia: "TN",
  tunez: "TN",
  turkey: "TR",
  turquia: "TR",
  turquía: "TR",
  ukraine: "UA",
  uruguay: "UY",
  usa: "US",
  "united states": "US",
  "estados unidos": "US",
  venezuela: "VE",
  wales: "GB-WLS",
};

const INLINE_FLAG_SVG = {
  FR: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><clipPath id="c"><circle cx="32" cy="32" r="30"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="21.34" height="64" x="0" fill="#1f4db6"/>
        <rect width="21.34" height="64" x="21.33" fill="#ffffff"/>
        <rect width="21.34" height="64" x="42.66" fill="#e53b35"/>
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#e7e5e4" stroke-width="2"/>
    </svg>
  `,
  ES: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><clipPath id="c"><circle cx="32" cy="32" r="30"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="64" height="64" fill="#f0c419"/>
        <rect width="64" height="14" y="0" fill="#c62828"/>
        <rect width="64" height="14" y="50" fill="#c62828"/>
        <rect width="7" height="12" x="18" y="26" rx="1" fill="#9c6b3d"/>
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#e7e5e4" stroke-width="2"/>
    </svg>
  `,
  AR: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><clipPath id="c"><circle cx="32" cy="32" r="30"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="64" height="64" fill="#ffffff"/>
        <rect width="64" height="21.34" y="0" fill="#7dc6f2"/>
        <rect width="64" height="21.34" y="42.66" fill="#7dc6f2"/>
        <circle cx="32" cy="32" r="6" fill="#f0b429"/>
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#e7e5e4" stroke-width="2"/>
    </svg>
  `,
  "GB-ENG": `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><clipPath id="c"><circle cx="32" cy="32" r="30"/></clipPath></defs>
      <g clip-path="url(#c)">
        <rect width="64" height="64" fill="#ffffff"/>
        <rect width="64" height="12" y="26" fill="#cf2027"/>
        <rect width="12" height="64" x="26" fill="#cf2027"/>
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#e7e5e4" stroke-width="2"/>
    </svg>
  `,
};

function normalizeTeamName(teamName) {
  return String(teamName || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function resolveFlagCode(teamName) {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return null;
  return TEAM_FLAG_MAP[normalized] || TEAM_FLAG_MAP[normalized.replace(/\s+/g, "_")] || null;
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

export function getTeamFlag(teamName) {
  const code = resolveFlagCode(teamName);
  const inlineSvg = code ? INLINE_FLAG_SVG[code] || null : null;

  return {
    code,
    emoji: null,
    flagUrl: inlineSvg ? svgToDataUri(inlineSvg) : null,
    svgMarkup: inlineSvg ? inlineSvg.replace(/\s+/g, " ").trim() : null,
  };
}
