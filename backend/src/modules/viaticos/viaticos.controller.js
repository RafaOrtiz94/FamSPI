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

async function createManualNote(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const { file_base64, file_name } = req.body || {};

    let driveFileId = req.body?.drive_file_id || null;
    let driveLink = req.body?.drive_link || null;

    // Si se proporciona file_base64, simplemente almacenarlo como referencia
    // (en una implementación real, esto guardaría en storage y obtendría un ID)
    if (file_base64 && file_name) {
      // Por ahora, solo guardamos el nombre del archivo como referencia
      // Un true implementation guardaría en Google Drive o storage
      driveLink = `data:application/octet-stream;base64,${file_base64.substring(0, 50)}...`;
    }

    const data = await service.createManualNote({
      allowanceId,
      issueDate: req.body?.issue_date,
      supplierRuc: req.body?.supplier_ruc,
      supplierName: req.body?.supplier_name,
      subtotal12: req.body?.subtotal_12,
      subtotal0: req.body?.subtotal_0,
      iva: req.body?.iva,
      total: req.body?.total,
      expenseDescription: req.body?.expense_description,
      documentState: req.body?.document_state,
      emissionPoint: req.body?.emission_point,
      sequential: req.body?.sequential,
      driveFileId,
      driveLink,
      notes: req.body?.notes,
      actorUser: req.user,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo crear la nota de venta manual");
  }
}

async function listManualNotes(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.listManualNotes({
      allowanceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar las notas de venta manual");
  }
}

async function updateManualNote(req, res) {
  try {
    const noteId = Number(req.params.noteId);
    const data = await service.updateManualNote({
      noteId,
      issueDate: req.body?.issue_date,
      supplierRuc: req.body?.supplier_ruc,
      supplierName: req.body?.supplier_name,
      subtotal12: req.body?.subtotal_12,
      subtotal0: req.body?.subtotal_0,
      iva: req.body?.iva,
      total: req.body?.total,
      expenseDescription: req.body?.expense_description,
      documentState: req.body?.document_state,
      emissionPoint: req.body?.emission_point,
      sequential: req.body?.sequential,
      notes: req.body?.notes,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo actualizar la nota de venta manual");
  }
}

async function deleteManualNote(req, res) {
  try {
    const noteId = Number(req.params.noteId);
    const data = await service.deleteManualNote({
      noteId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo eliminar la nota de venta manual");
  }
}

async function createPurchaseNoInvoice(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const { file_base64, file_name } = req.body || {};

    let driveFileId = req.body?.drive_file_id || null;

    // Si se proporciona file_base64, simplemente almacenarlo como referencia
    if (file_base64 && file_name) {
      // Nota: En una implementación real, esto guardaría en Google Drive o storage
      // Por ahora solo aceptamos el archivo sin guardarlo
    }

    const data = await service.createPurchaseNoInvoice({
      allowanceId,
      description: req.body?.description,
      total: req.body?.total,
      purchaseDate: req.body?.purchase_date,
      justification: req.body?.justification,
      driveFileId,
      actorUser: req.user,
    });
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo crear la compra sin factura");
  }
}

async function listPurchasesNoInvoice(req, res) {
  try {
    const allowanceId = Number(req.params.id);
    const data = await service.listPurchasesNoInvoice({
      allowanceId,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudieron listar las compras sin factura");
  }
}

async function approvePurchaseNoInvoice(req, res) {
  try {
    const purchaseId = Number(req.params.id);
    const data = await service.approvePurchaseNoInvoice({
      purchaseId,
      status: req.body?.status,
      approvedBy: req.body?.approved_by,
      actorUser: req.user,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo aprobar la compra");
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
  createManualNote,
  listManualNotes,
  updateManualNote,
  deleteManualNote,
  createPurchaseNoInvoice,
  listPurchasesNoInvoice,
  approvePurchaseNoInvoice,
};
