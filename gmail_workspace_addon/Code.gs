const SPI_API_PROPERTY = "SPI_GMAIL_CONTEXT_API_ORIGIN";

function onHomepage() {
  return buildInfoCard_(
    "Registrar correo en SPI",
    "Abre un correo y selecciona FamSPI para registrar la comunicación. No se crea ningún cliente ni proceso automáticamente."
  );
}

function onGmailMessageOpen(event) {
  try {
    const message = getCurrentMessage_(event);
    const section = CardService.newCardSection()
      .addWidget(CardService.newKeyValue().setTopLabel("Remitente").setContent(message.sender_email || "No disponible"))
      .addWidget(CardService.newKeyValue().setTopLabel("Asunto").setContent(message.subject || "Sin asunto"))
      .addWidget(
        CardService.newTextButton()
          .setText("Registrar como comunicación pendiente")
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
          .setOnClickAction(CardService.newAction().setFunctionName("registerOpenMessage"))
      );
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("FamSPI"))
      .addSection(section)
      .build();
  } catch (error) {
    return buildInfoCard_("FamSPI", safeErrorMessage_(error));
  }
}

function registerOpenMessage(event) {
  try {
    const message = getCurrentMessage_(event);
    const response = callSpi_("/api/v1/gmail-context/addon/communications", "post", message);
    const result = response.data || {};
    const communication = result.communication || {};
    let autoLinked = null;
    let autoLinkMessage = "";
    if (communication.id) {
      try {
        const autoLinkResponse = callSpi_("/api/v1/gmail-context/addon/communications/" + encodeURIComponent(communication.id) + "/auto-link", "post", {});
        autoLinked = autoLinkResponse.data || null;
      } catch (error) {
        autoLinkMessage = safeErrorMessage_(error);
      }
    }
    let suggestions = [];
    if (communication.id) {
      try {
        const suggestionsResponse = callSpi_("/api/v1/gmail-context/addon/communications/" + encodeURIComponent(communication.id) + "/client-suggestions", "get");
        suggestions = suggestionsResponse.data || [];
      } catch (_error) {
        // La comunicación quedó registrada aunque una revisión anterior de SPI
        // aún no exponga las sugerencias; la vinculación manual sigue disponible.
      }
    }
    const detail = autoLinked && autoLinked.status === "linked"
      ? "Cliente y proceso vinculados automáticamente en SPI."
      : result.created
        ? "La comunicación quedó registrada, pero no se vinculó automáticamente."
        : "Este correo ya estaba registrado; se reutilizó el registro existente.";
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Comunicación registrada"))
      .addSection(
        CardService.newCardSection()
          .addWidget(CardService.newTextParagraph().setText(detail))
          .addWidget(CardService.newKeyValue().setTopLabel("ID SPI").setContent(String(communication.id || "No disponible")))
          .addWidget(CardService.newKeyValue()
            .setTopLabel("Cliente detectado")
            .setContent(suggestions.length ? String(suggestions[0].label || "Coincidencia disponible") : "Sin coincidencia verificable")
            .setBottomLabel(suggestions.length ? String((suggestions[0].evidence || []).join(" · ") || "Coincidencia verificada") : "Incluye el nombre o identificador exacto del cliente en el correo"))
          .addWidget(autoLinked && autoLinked.status === "linked"
            ? CardService.newKeyValue().setTopLabel("Proceso vinculado").setContent(processLabel_(autoLinked.linked_entity_type))
            : CardService.newTextParagraph().setText(autoLinkMessage || "Se requiere una coincidencia única de cliente y proceso para vincular automáticamente."))
      )
      .build();
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(card))
      .build();
  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(safeErrorMessage_(error)))
      .build();
  }
}

function processLabel_(entityType) {
  if (entityType === "public_purchase") return "Compra pública";
  if (entityType === "private_purchase") return "Compra privada";
  return "Proceso SPI";
}

function getCurrentMessage_(event) {
  const accessToken = event && event.gmail && event.gmail.accessToken;
  const messageId = event && event.gmail && event.gmail.messageId;
  if (!accessToken || !messageId) throw new Error("Gmail no entregó el contexto del mensaje abierto.");

  GmailApp.setCurrentMessageAccessToken(accessToken);
  const message = GmailApp.getMessageById(messageId);
  const thread = message.getThread();
  return {
    gmail_message_id: message.getId(),
    gmail_thread_id: thread ? thread.getId() : null,
    sender_email: extractEmail_(message.getFrom()),
    recipient_emails: parseRecipients_(message.getTo()),
    subject: String(message.getSubject() || "").slice(0, 998),
    received_at: message.getDate() ? message.getDate().toISOString() : null,
    body_preview: String(message.getPlainBody() || "").trim().slice(0, 4000)
  };
}

function callSpi_(path, method, payload) {
  const origin = String(PropertiesService.getScriptProperties().getProperty(SPI_API_PROPERTY) || "").replace(/\/+$/, "");
  if (!origin) throw new Error("Falta configurar la URL segura de SPI para este Add-on.");
  const identityToken = ScriptApp.getIdentityToken();
  if (!identityToken) throw new Error("No fue posible obtener tu identidad Google verificada.");

  const response = UrlFetchApp.fetch(origin + path, {
    method: method,
    contentType: "application/json",
    payload: JSON.stringify(payload || {}),
    headers: { Authorization: "Bearer " + identityToken },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let body;
  try {
    body = JSON.parse(response.getContentText() || "{}");
  } catch (_error) {
    throw new Error("SPI devolvió una respuesta inválida.");
  }
  if (status < 200 || status >= 300 || body.ok !== true) {
    throw new Error(body.message || "SPI no pudo registrar la comunicación.");
  }
  return body;
}

function extractEmail_(value) {
  const match = String(value || "").match(/<([^<>\s]+@[^<>\s]+)>/);
  return (match ? match[1] : String(value || "")).trim().toLowerCase();
}

function parseRecipients_(value) {
  return String(value || "")
    .split(",")
    .map(extractEmail_)
    .filter(function(email) { return email.indexOf("@") > 0; });
}

function buildInfoCard_(title, message) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title))
    .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(message)))
    .build();
}

function safeErrorMessage_(error) {
  return String((error && error.message) || "No se pudo completar la operación.").slice(0, 500);
}
