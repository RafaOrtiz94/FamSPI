function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return `${date.toLocaleString("es-EC")} (UTC ${date.toISOString()})`;
}

function shouldRespondJson(req) {
  const format = String(req?.query?.format || "").toLowerCase();
  if (format === "json") return true;
  const accept = String(req?.headers?.accept || "").toLowerCase();
  if (accept.includes("application/json") && !accept.includes("text/html")) return true;
  return false;
}

function renderVerificationHtml({
  title = "Verificación Legal",
  subtitle = "FamSign",
  status = "pendiente",
  id = null,
  solicitante = "No disponible",
  aprobador = "No disponible",
  aprobacionFinalAt = null,
  token = null,
  workflow = null,
  sourceType = "Solicitud",
}) {
  const normalizedStatus = String(status || "").toLowerCase();
  const statusLabel =
    normalizedStatus === "approved" || normalizedStatus === "aprobado"
      ? "Aprobado"
      : normalizedStatus === "rejected" || normalizedStatus === "rechazado"
      ? "Rechazado"
      : "En proceso";

  const statusColor =
    statusLabel === "Aprobado"
      ? "#166534"
      : statusLabel === "Rechazado"
      ? "#991b1b"
      : "#92400e";

  const workflowHtml = workflow
    ? `
      <div class="section">
        <h3>Workflow FamSign</h3>
        <p><strong>Estado:</strong> ${escapeHtml(workflow.estado || "pendiente")}</p>
        <p><strong>Solicitante:</strong> ${
          workflow.solicitud_firmada
            ? `${escapeHtml(workflow?.solicitud?.signer_name || "Firmado")} - ${escapeHtml(formatDateTime(workflow?.solicitud?.signed_at))}`
            : "Pendiente"
        }</p>
        <p><strong>Aprobación:</strong> ${
          workflow.aprobacion_firmada
            ? `${escapeHtml(workflow?.aprobacion?.signer_name || "Firmado")} - ${escapeHtml(formatDateTime(workflow?.aprobacion?.signed_at))}`
            : "Pendiente"
        }</p>
      </div>
    `
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(subtitle)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background:#f8fafc; margin:0; color:#0f172a; }
    .wrap { max-width: 760px; margin: 32px auto; padding: 0 16px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:20px; box-shadow: 0 4px 18px rgba(2,6,23,.05); }
    h1 { margin:0 0 4px; font-size:22px; }
    .muted { color:#475569; margin:0 0 16px; font-size:14px; }
    .badge { display:inline-block; border-radius:999px; padding:6px 12px; font-weight:700; font-size:12px; color:${statusColor}; background:#f1f5f9; border:1px solid #cbd5e1; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; margin-top:14px; }
    .row { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; }
    .k { display:block; font-size:12px; color:#64748b; margin-bottom:4px; }
    .v { font-size:14px; color:#0f172a; word-break: break-word; }
    .section { margin-top:14px; border-top:1px dashed #cbd5e1; padding-top:14px; }
    .foot { margin-top:14px; font-size:12px; color:#64748b; }
    @media (max-width: 640px) { .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">${escapeHtml(subtitle)} - Consulta pÃºblica de verificación legal</p>
      <span class="badge">${escapeHtml(statusLabel)}</span>
      <div class="grid">
        <div class="row"><span class="k">Tipo</span><span class="v">${escapeHtml(sourceType)}</span></div>
        <div class="row"><span class="k">Solicitud ID</span><span class="v">${escapeHtml(id || "N/A")}</span></div>
        <div class="row"><span class="k">Solicitante</span><span class="v">${escapeHtml(solicitante)}</span></div>
        <div class="row"><span class="k">Aprobador</span><span class="v">${escapeHtml(aprobador)}</span></div>
        <div class="row"><span class="k">Fecha aprobación</span><span class="v">${escapeHtml(formatDateTime(aprobacionFinalAt))}</span></div>
        <div class="row"><span class="k">Token</span><span class="v">${escapeHtml(token || "No disponible")}</span></div>
      </div>
      ${workflowHtml}
      <p class="foot">Documento validado por SPI Fam - FamSign</p>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  shouldRespondJson,
  renderVerificationHtml,
};


