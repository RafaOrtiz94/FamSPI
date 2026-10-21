const PDFDocument = require("pdfkit");
const { uploadBase64File } = require("./drive");
const { sendMail } = require("./mailer");

function stripHtml(text) {
  if (!text) return "";
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAcceptedItems(request) {
  if (!request?.provider_response?.items) return [];
  return request.provider_response.items.filter(
    (item) => item && item.decision !== "reject" && item.available_type !== "none",
  );
}

async function buildReport({ subject, html, request, actionLabel, user }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const acceptedItems = getAcceptedItems(request);
    const requestedItems = Array.isArray(request?.equipment) ? request.equipment : [];
    const now = new Date();
    const clientName =
      request?.client_name ||
      request?.client_snapshot?.commercial_name ||
      request?.client_snapshot?.name ||
      null;

    doc.fontSize(18).text(actionLabel || "Informe de disponibilidad", {
      underline: true,
    });
    doc.moveDown();
    doc.fontSize(12).text(`Fecha y hora: ${now.toLocaleString("es-ES")}`);
    if (subject) doc.text(`Asunto: ${subject}`);
    if (user?.fullname || user?.name || user?.email) {
      const author = user.fullname || user.name || user.email;
      doc.text(`Usuario: ${author}${user.email && author !== user.email ? ` (${user.email})` : ""}`);
    }
    if (clientName) doc.text(`Cliente: ${clientName}`);
    if (request?.provider_email) doc.text(`Proveedor: ${request.provider_email}`);
    if (request?.id) doc.text(`Solicitud: ${request.id}`);
    if (request?.provider_response?.notes) doc.text(`Notas del proveedor: ${request.provider_response.notes}`);

    doc.moveDown();
    doc.fontSize(14).text("Equipos aceptados");
    doc.fontSize(12);
    if (acceptedItems.length) {
      acceptedItems.forEach((item, idx) => {
        const label = item.available_type === "cu" ? "CU" : "Nuevo";
        const name = item.name || item.sku || item.id || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`- ${name}${serial} (${label})`);
      });
    } else {
      doc.text("Sin equipos aceptados registrados");
    }

    if (requestedItems.length) {
      doc.moveDown();
      doc.fontSize(14).text("Equipos solicitados");
      doc.fontSize(12);
      requestedItems.forEach((item, idx) => {
        const label = item.type === "cu" ? "CU" : "Nuevo";
        const name = item.name || item.sku || item.id || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`- ${name}${serial} (${label})`);
      });
    }

    const body = stripHtml(html) || "Sin detalle de mensaje";
    doc.moveDown();
    doc.fontSize(14).text("Detalle del mensaje enviado");
    doc.fontSize(12).text(body, { align: "left" });

    doc.end();
  });
}

async function archiveEmail({ html, subject, folderId, prefix = "correo", request, actionLabel, user }) {
  const report = await buildReport({ subject, html, request, actionLabel, user });
  const base64 = report.toString("base64");
  const stored = await uploadBase64File(
    `${prefix}-${new Date().toISOString()}.pdf`,
    base64,
    "application/pdf",
    folderId,
  );
  return stored?.id || null;
}

// threadContext encadena los correos de una misma solicitud como respuestas
// del mismo hilo de Gmail en vez de crear un correo nuevo en cada etapa.
async function sendAndArchive({
  user,
  to,
  subject,
  html,
  cc,
  folderId,
  prefix,
  request,
  actionLabel,
  threadContext = null,
}) {
  const sendResult = await sendMail({
    to,
    cc,
    subject,
    html,
    gmailUserId: user?.id,
    from: user?.email,
    replyTo: user?.email,
    threadId: threadContext?.threadId || undefined,
    inReplyTo: threadContext?.lastMessageId || undefined,
    references: threadContext?.lastMessageId || undefined,
  });
  const fileId = await archiveEmail({ html, subject, folderId, prefix, request, actionLabel, user });
  return {
    fileId,
    threadId: sendResult?.providerThreadId || threadContext?.threadId || null,
    lastMessageId: sendResult?.rfc822MessageId || threadContext?.lastMessageId || null,
  };
}

module.exports = {
  sendAndArchive,
};
