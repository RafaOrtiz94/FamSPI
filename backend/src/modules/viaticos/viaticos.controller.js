const service = require("./viaticos.service");

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    message: error?.message || fallbackMessage,
  });
};

async function listCandidates(req, res) {
  try {
    const data = await service.listVisitCandidates({
      actorUser: req.user,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      status: req.query.status,
      requesterEmail: req.query.requester_email,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los candidatos de viaticos");
  }
}

async function list(req, res) {
  try {
    const data = await service.listAllowances({
      actorUser: req.user,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      status: req.query.status,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los viaticos");
  }
}

async function upsert(req, res) {
  try {
    const data = await service.upsertAllowance({
      actorUser: req.user,
      payload: req.body || {},
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar el viatico");
  }
}

async function updateStatus(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.updateAllowanceStatus({
      allowanceId,
      status: req.body?.status,
      workflowStatus: req.body?.workflow_status,
      amount: req.body?.amount,
      approvedAmount: req.body?.approved_amount,
      paymentDate: req.body?.payment_date,
      notes: req.body?.notes,
      destinationCity: req.body?.destination_city,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar el viatico");
  }
}

async function updateWorkflowOperational(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.updateAllowanceWorkflowOperational({
      allowanceId,
      workflowStatus: req.body?.workflow_status,
      tripAuthorized: req.body?.trip_authorized,
      tripAuthorizationRef: req.body?.trip_authorization_ref,
      notes: req.body?.notes,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar flujo operativo del viatico");
  }
}

async function uploadInvoiceXml(req, res) {
   try {
     const allowanceId = Number(req.params.id);
     const xmlItems = Array.isArray(req.body?.items) ? req.body.items : [req.body || {}];
     const results = [];
     for (const item of xmlItems) {
       const data = await service.uploadSriXmlInvoice({
         allowanceId,
         actorUser: req.user,
         xmlText: item.xml_text || item.xml || "",
         documentId: item.document_id || null,
       });
       results.push(data);
     }
     return res.status(201).json({ ok: true, data: results });
   } catch (error) {
     return handleError(res, error, "No se pudo procesar XML de factura SRI");
   }
 }

async function uploadInvoiceZip(req, res) {
   try {
     const allowanceId = Number(req.params.id);
     const { file_base64, file_name } = req.body || {};
     if (!file_base64) {
       const error = new Error("Se requiere file_base64 en el cuerpo de la solicitud");
       error.status = 400;
       throw error;
     }
     const data = await service.uploadSriZipInvoices({
       allowanceId,
       actorUser: req.user,
       file_base64,
       file_name: file_name || "viaticos.zip",
     });
     return res.status(201).json({ ok: true, data });
   } catch (error) {
     return handleError(res, error, "No se pudo procesar ZIP de facturas SRI");
   }
 }

async function syncSri(req, res) {
  try {
    const data = await service.syncSriInvoicesForUser({
      actorUser: req.user,
      startDate: req.body?.start_date,
      endDate: req.body?.end_date,
      phase: req.body?.phase,
      autoMode: req.body?.auto_mode,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo sincronizar comprobantes SRI");
  }
}

async function listInvoices(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.listAllowanceInvoices({
      allowanceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar facturas XML");
  }
}

async function patchInvoice(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    const data = await service.updateInvoiceClassification({
      invoiceId,
      category: req.body?.category,
      includeInAts: req.body?.include_in_ats,
      note: req.body?.note,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar factura XML");
  }
}

async function upsertZone(req, res) {
  try {
    const data = await service.createOrUpdateZone({
      payload: req.body || {},
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo guardar zona");
  }
}

async function upsertFixedProfile(req, res) {
  try {
    const data = await service.upsertFixedProfile({
      payload: req.body || {},
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo guardar perfil de viatico fijo");
  }
}

async function listFixedProfiles(req, res) {
  try {
    const data = await service.listFixedProfiles({
      actorUser: req.user,
      userId: req.query?.user_id,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar perfiles de viatico fijo");
  }
}

async function updatePolicy(req, res) {
  try {
    const data = await service.updatePolicy({
      payload: req.body || {},
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar politica de viaticos");
  }
}

async function reportSummary(req, res) {
  try {
    const data = await service.buildFinanceSummaryReport({
      actorUser: req.user,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      groupBy: req.query.group_by,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo generar reporte de resumen");
  }
}

async function atsXml(req, res) {
  try {
    const data = await service.generateAtsXml({
      actorUser: req.user,
      period: req.query.period,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo generar XML ATS");
  }
}

async function listDocuments(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.listAllowanceDocuments({
      allowanceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar los documentos de viatico");
  }
}

async function addDocument(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.createAllowanceDocument({
      allowanceId,
      actorUser: req.user,
      payload: req.body || {},
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo registrar el documento");
  }
}

async function report(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.buildAllowanceReport({
      allowanceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo generar el reporte de cotejo");
  }
}

async function uploadInvoiceTxt(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const txtContent = req.body?.txt_content || "";
    if (!txtContent.trim()) {
      return res.status(400).json({ ok: false, message: "Se requiere txt_content en el cuerpo" });
    }
    const data = await service.uploadSriTxtInvoices({
      allowanceId,
      actorUser: req.user,
      txtContent,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo procesar TXT de facturas SRI");
  }
}

async function deleteInvoice(req, res) {
  try {
    const invoiceId = Number(req.params.invoiceId);
    const data = await service.deleteAllowanceInvoice({
      invoiceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo eliminar la factura");
  }
}

module.exports = {
  listCandidates,
  list,
  upsert,
  updateStatus,
  updateWorkflowOperational,
  listDocuments,
  addDocument,
  uploadInvoiceXml,
  uploadInvoiceZip,
  uploadInvoiceTxt,
  deleteInvoice,
  syncSri,
  listInvoices,
  patchInvoice,
  upsertZone,
  upsertFixedProfile,
  listFixedProfiles,
  updatePolicy,
  reportSummary,
  atsXml,
  report,
};
