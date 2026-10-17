const MOJIBAKE_REPLACEMENTS = [
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã", "Á"],
  ["Ã‰", "É"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã±", "ñ"],
  ["Ã‘", "Ñ"],
  ["Â¿", "¿"],
  ["Â¡", "¡"],
  ["Â·", "·"],
  ["â€œ", "\""],
  ["â€", "\""],
  ["â€™", "'"],
  ["â€“", "-"],
  ["â€”", "-"],
  ["â€¦", "..."],
];

function normalizeHumanText(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  for (const [search, replacement] of MOJIBAKE_REPLACEMENTS) {
    text = text.split(search).join(replacement);
  }
  return text.normalize("NFC");
}

function normalizeEmailAddress(value) {
  if (value === null || value === undefined) return value;
  return String(value).trim();
}

module.exports = {
  normalizeHumanText,
  normalizeEmailAddress,
};
