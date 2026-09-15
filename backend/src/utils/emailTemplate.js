// Mismo lenguaje visual que notificationManager.generateEmailHTML (header
// degradado oscuro->verde, tarjeta blanca, footer con disclaimer) -- antes
// este correo (el unico que ve gente FUERA de la empresa) usaba un estilo
// plano distinto al resto del sistema.
function renderProviderEmail({ title, greeting, bodyHtml, user, footerNote }) {
  const senderName = user?.fullname || user?.name || user?.email || "Famproject Cia. Ltda.";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background:#eef4f1;">
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 32px auto; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 45px rgba(15,23,42,0.12); border:1px solid #dbe7e2;">
    <div style="background:linear-gradient(135deg, #0f172a 0%, #1f3b2d 58%, #3B82F6 120%); color:white; padding: 28px 32px;">
      <div style="font-size:11px; font-weight:800; letter-spacing:2.8px; text-transform:uppercase; color:#cdebd8; margin-bottom:10px;">Famproject Cia. Ltda.</div>
      <h2 style="margin:0; font-size:24px; line-height:1.25; font-weight:900;">${title}</h2>
    </div>
    <div style="background:#ffffff; padding: 30px 32px;">
      <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#334155;">${greeting || "Estimado proveedor,"}</p>
      <div style="font-size:15px; line-height:1.7; color:#334155;">${bodyHtml}</div>
      ${footerNote ? `<div style="border-radius:16px; background:#f8fafc; border:1px solid #e2e8f0; padding:14px 16px; margin-top:18px;"><p style="margin:0; color:#64748b; font-size:12px; line-height:1.5;">${footerNote}</p></div>` : ""}
      <p style="margin:24px 0 0; font-size:14px; line-height:1.6; color:#334155;">
        Saludos,<br/>
        <strong>${senderName}</strong><br/>
        ${user?.email ? `<a href="mailto:${user.email}" style="color:#1f3b2d;text-decoration:none;">${user.email}</a>` : ""}
      </p>
    </div>
    <div style="background:#f8fafc; padding:16px 28px; border-top:1px solid #e2e8f0;">
      <p style="margin:0; font-size:12px; color:#94a3b8; text-align:center; line-height:1.5;">
        Este es un mensaje de Famproject Cia. Ltda.
      </p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderProviderEmail };
