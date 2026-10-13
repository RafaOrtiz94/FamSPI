// Reglas puras del recorrido de una oportunidad (sin base de datos): a partir de los expedientes
// enlazados (compra privada, compra pública, Business Case, solicitud de cliente, ofertas y
// expediente de consumibles) arma los hitos que muestra la tarjeta del embudo.
// Cada hito queda en uno de: done | current | blocked | pending.

const DRIVE_FILE_URL = "https://drive.google.com/file/d/";

const toTime = (value) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

// Fecha más reciente entre varias (ISO) o null.
const latest = (...values) => {
  const times = values.flat(Infinity).map(toTime).filter((t) => t !== null);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
};

const doc = (label, fileId, url = null) => {
  if (url) return { label, url };
  if (!fileId) return null;
  return { label, url: `${DRIVE_FILE_URL}${encodeURIComponent(String(fileId))}/view` };
};

const milestone = (key, label, state, { at = null, detail = null, documents = [] } = {}) => ({
  key, label, state, at, detail, documents: documents.filter(Boolean),
});

const statusIn = (rows, ...statuses) => rows.some((row) => statuses.includes(row.status));

function clientMilestone({ privates, publics, businessCases, clientRequests }) {
  const sources = [...privates, ...publics];
  const registeredAt = latest(sources.map((s) => [s.client_registered_at, s.client_approved_at]));
  const approved = clientRequests.filter((r) => r.status === "approved" || r.approval_status === "approved");
  const hasClient = [...publics, ...businessCases].some((s) => s.client_id);
  if (registeredAt || approved.length || hasClient) {
    return milestone("cliente", "Cliente", "done", {
      at: registeredAt || latest(approved.map((r) => r.approved_at)),
      detail: "Cliente registrado",
    });
  }
  const requestedAt = latest(sources.map((s) => s.client_registration_requested_at), clientRequests.map((r) => r.created_at));
  if (clientRequests.length && clientRequests.every((r) => r.status === "rejected")) {
    return milestone("cliente", "Cliente", "blocked", { at: requestedAt, detail: "Solicitud de cliente rechazada" });
  }
  if (requestedAt || statusIn(privates, "client_registration_requested")) {
    return milestone("cliente", "Cliente", "current", { at: requestedAt, detail: "Registro de cliente solicitado" });
  }
  return milestone("cliente", "Cliente", "pending");
}

function availabilityMilestone({ privates, publics }) {
  const sources = [...privates, ...publics];
  const documents = sources.map((s) => doc("Solicitud de disponibilidad", s.availability_email_file_id));
  if (statusIn(privates, "acp_availability_rejected")) {
    return milestone("disponibilidad", "Disponibilidad", "blocked", {
      at: latest(sources.map((s) => s.provider_response_at)), detail: "Sin disponibilidad", documents,
    });
  }
  const respondedAt = latest(sources.map((s) => s.provider_response_at));
  if (respondedAt || statusIn(privates, "acp_availability_confirmed")) {
    return milestone("disponibilidad", "Disponibilidad", "done", { at: respondedAt, detail: "Disponibilidad confirmada", documents });
  }
  const requestedAt = latest(sources.map((s) => s.availability_email_sent_at));
  if (requestedAt || statusIn(privates, "acp_availability_requested")) {
    return milestone("disponibilidad", "Disponibilidad", "current", { at: requestedAt, detail: "Consultada al proveedor", documents });
  }
  return milestone("disponibilidad", "Disponibilidad", "pending");
}

// Solo aplica cuando hay un Business Case de por medio.
function feasibilityMilestone({ privates, businessCases }) {
  const viaPurchase = privates.some((p) => String(p.status || "").startsWith("business_case"));
  if (!businessCases.length && !viaPurchase) return null;
  const at = latest(businessCases.map((bc) => bc.updated_at));
  if (businessCases.some((bc) => bc.bc_stage === "factible") || statusIn(privates, "business_case_feasibility_approved")) {
    return milestone("factibilidad", "Factibilidad", "done", { at, detail: "Business Case factible" });
  }
  if ((businessCases.length && businessCases.every((bc) => bc.bc_stage === "cerrado_no_factible")) || statusIn(privates, "business_case_rejected")) {
    return milestone("factibilidad", "Factibilidad", "blocked", { at, detail: "Business Case no factible" });
  }
  return milestone("factibilidad", "Factibilidad", "current", { at, detail: "Business Case en análisis" });
}

function offerMilestone({ privates, publics, offers }) {
  const sent = offers.filter((o) => o.sent_at);
  const lastOffer = [...offers].sort((a, b) => (toTime(b.sent_at || b.created_at) || 0) - (toTime(a.sent_at || a.created_at) || 0))[0];
  const documents = [
    ...privates.flatMap((p) => [doc("Oferta", p.offer_document_id), doc("Oferta firmada", p.offer_signed_document_id)]),
    ...publics.flatMap((p) => [doc("Proforma", p.proforma_file_id), doc("Proforma firmada", p.signed_proforma_file_id)]),
    lastOffer ? doc(`Oferta v${lastOffer.version_number || 1}`, lastOffer.pdf_file_id, lastOffer.pdf_url) : null,
  ];
  const signedAt = latest(
    privates.map((p) => [p.offer_signed_uploaded_at, p.signed_offer_received_at]),
    publics.map((p) => [p.signed_proforma_uploaded_at, p.proforma_signed_at]),
  );
  if (signedAt) return milestone("oferta", "Oferta", "done", { at: signedAt, detail: "Oferta firmada por el cliente", documents });
  const sentAt = latest(sent.map((o) => o.sent_at), publics.map((p) => p.proforma_uploaded_at));
  const offerSent = sentAt || privates.some((p) => p.offer_document_id);
  if (offerSent) return milestone("oferta", "Oferta", "current", { at: sentAt, detail: "Oferta enviada, pendiente de firma", documents });
  if (offers.length) return milestone("oferta", "Oferta", "current", { at: latest(offers.map((o) => o.created_at)), detail: "Oferta en preparación", documents });
  return milestone("oferta", "Oferta", "pending");
}

function contractMilestone({ privates, publics }) {
  const documents = [
    ...privates.flatMap((p) => [
      doc("Contrato", p.contract_document_id),
      doc("Contrato firmado", p.contract_signed_document_id),
      doc("Contrato firmado por el cliente", p.contract_client_signed_document_id),
    ]),
    ...publics.map((p) => doc("Contrato", p.contract_file_id)),
  ];
  const signedAt = latest(
    privates.map((p) => [p.contract_client_signed_uploaded_at, p.contract_signed_uploaded_at]),
    publics.map((p) => p.contract_uploaded_at),
  );
  if (signedAt) return milestone("contrato", "Contrato", "done", { at: signedAt, detail: "Contrato firmado", documents });
  if (statusIn(privates, "contract_rejected")) {
    return milestone("contrato", "Contrato", "blocked", { at: latest(privates.map((p) => p.manager_contract_decision_at)), detail: "Contrato rechazado", documents });
  }
  const startedAt = latest(privates.map((p) => p.manager_contract_decision_at));
  const started = startedAt || privates.some((p) => p.contract_document_id)
    || statusIn(privates, "pending_contract_approval", "contract_available", "pending_contract_client_signature");
  if (started) return milestone("contrato", "Contrato", "current", { at: startedAt, detail: "Contrato en firma", documents });
  return milestone("contrato", "Contrato", "pending");
}

function deliveryMilestone({ privates, publics }) {
  const sources = [...privates, ...publics];
  const documents = privates.flatMap((p) => [doc("Acta de entrega", p.delivery_act_document_id), doc("Acta de inspección", p.inspection_acta_document_id)]);
  const deliveredAt = latest(sources.map((s) => [s.delivery_act_delivered_at, s.delivered_at]));
  if (deliveredAt || statusIn(privates, "delivered_signed")) {
    return milestone("entrega", "Entrega", "done", { at: deliveredAt, detail: "Equipo entregado", documents });
  }
  const movingAt = latest(sources.map((s) => [s.equipment_arrived_at, s.dispatch_ready_at, s.delivery_act_generated_at, s.delivery_act_dispatched_at]));
  if (movingAt) return milestone("entrega", "Entrega", "current", { at: movingAt, detail: "Entrega en curso", documents });
  return milestone("entrega", "Entrega", "pending");
}

function consumablesMilestone({ consumables }) {
  if (!consumables.length) return milestone("consumibles", "Consumibles", "pending");
  return milestone("consumibles", "Consumibles", "done", {
    at: latest(consumables.map((c) => c.registered_at || c.created_at)),
    detail: "Expediente de consumibles creado",
  });
}

// Expediente principal: el que el usuario abre desde la tarjeta.
function pickReference({ privates, publics, businessCases }) {
  const byRecent = (rows) => [...rows].sort((a, b) => (toTime(b.updated_at) || 0) - (toTime(a.updated_at) || 0))[0];
  const priv = byRecent(privates);
  if (priv) return { type: "private_purchase", id: priv.id, status: priv.status, offer_kind: priv.offer_kind || null, drive_folder_id: priv.drive_folder_id || null };
  const pub = byRecent(publics);
  if (pub) return { type: "public_purchase", id: pub.id, status: pub.status, code: pub.process_code || null, drive_folder_id: pub.drive_folder_id || null };
  const bc = byRecent(businessCases);
  if (bc) return { type: "business_case", id: bc.id, status: bc.bc_stage || bc.status, code: bc.process_code || null, drive_folder_id: bc.drive_folder_id || null };
  return null;
}

function buildJourney(sources = {}) {
  const data = {
    privates: sources.privates || [],
    publics: sources.publics || [],
    businessCases: sources.businessCases || [],
    clientRequests: sources.clientRequests || [],
    offers: sources.offers || [],
    consumables: sources.consumables || [],
  };
  const reference = pickReference(data);
  if (!reference && !data.clientRequests.length) return null;

  const milestones = [
    clientMilestone(data),
    availabilityMilestone(data),
    feasibilityMilestone(data),
    offerMilestone(data),
    contractMilestone(data),
    deliveryMilestone(data),
    consumablesMilestone(data),
  ].filter(Boolean);

  const done = milestones.filter((m) => m.state === "done").length;
  const lastUpdate = latest(
    [...data.privates, ...data.publics, ...data.businessCases].map((s) => s.updated_at),
    milestones.map((m) => m.at),
  );
  return {
    reference,
    milestones,
    progress: { done, total: milestones.length },
    blocked: milestones.find((m) => m.state === "blocked") || null,
    last_update: lastUpdate,
    documents_count: milestones.reduce((sum, m) => sum + m.documents.length, 0),
  };
}

module.exports = { buildJourney, latest };
