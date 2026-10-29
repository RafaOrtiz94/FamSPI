// Diálogos de actividad: registrar una nueva y cerrar el seguimiento (resultado + evidencia).
import { useEffect, useState } from "react";
import Modal from "../../../core/ui/components/Modal";
import FileUploadZone from "../../../core/ui/components/FileUploadZone";
import { completeActivity, createActivity, fetchAccounts, fetchOpportunities, uploadDocument } from "../../../core/api/crmFamApi";
import { Btn, ErrorNote, Field, SelectInput, TextArea, TextInput } from "../ui/kit";
import { errorMessage } from "../ui/format";
import { ACTIVITY_TYPES } from "../ui/status";
import { listOf } from "../ui/useLoad";

// `defaults` permite abrirla ya ligada a una oportunidad o cuenta (desde su ficha).
export function ActivityFormModal({ defaults = {}, onClose, onSaved }) {
  const [form, setForm] = useState({
    activity_type: defaults.activity_type || "",
    subject: "",
    scheduled_at: "",
    duration_minutes: "",
    description: "",
    opportunity_id: defaults.opportunity_id || "",
    account_id: defaults.account_id || "",
  });
  const [opportunities, setOpportunities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const lockedLink = Boolean(defaults.opportunity_id || defaults.account_id);

  useEffect(() => {
    if (lockedLink) return undefined;
    let cancelled = false;
    Promise.allSettled([fetchOpportunities({ status: "open", limit: 500 }), fetchAccounts({ limit: 500 })]).then(([opps, accs]) => {
      if (cancelled) return;
      setOpportunities(opps.status === "fulfilled" ? listOf(opps.value) : []);
      setAccounts(accs.status === "fulfilled" ? listOf(accs.value) : []);
    });
    return () => { cancelled = true; };
  }, [lockedLink]);

  // Al elegir oportunidad, la cuenta queda la de esa oportunidad.
  const pickOpportunity = (e) => {
    const id = e.target.value;
    const opp = opportunities.find((o) => o.id === id);
    setForm((f) => ({ ...f, opportunity_id: id, account_id: opp?.account_id || f.account_id }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.activity_type) { setError("Elige el tipo de actividad."); return; }
    if (!form.subject.trim()) { setError("Escribe el asunto."); return; }
    setSaving(true); setError("");
    try {
      const saved = await createActivity({
        activity_type: form.activity_type,
        subject: form.subject.trim(),
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        description: form.description.trim() || null,
        opportunity_id: form.opportunity_id || null,
        account_id: form.account_id || null,
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "No se pudo registrar la actividad."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Nueva actividad" onClose={onClose} maxWidth="max-w-xl" disableClose={saving}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        {defaults.context && <p className="mb-4 text-sm text-fam-muted">Para: <span className="text-fam-text">{defaults.context}</span></p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            {(p) => (
              <SelectInput {...p} value={form.activity_type} onChange={set("activity_type")} autoFocus>
                <option value="">Seleccionar</option>
                {Object.entries(ACTIVITY_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Fecha y hora" optional hint="Si la programas, se agenda en el calendario.">
            {(p) => <TextInput {...p} type="datetime-local" value={form.scheduled_at} onChange={set("scheduled_at")} />}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Asunto">{(p) => <TextInput {...p} value={form.subject} onChange={set("subject")} maxLength={255} placeholder="Llamar para confirmar la demo" />}</Field>
          </div>
          {!lockedLink && (
            <>
              <Field label="Oportunidad" optional>
                {(p) => (
                  <SelectInput {...p} value={form.opportunity_id} onChange={pickOpportunity}>
                    <option value="">Ninguna</option>
                    {opportunities.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </SelectInput>
                )}
              </Field>
              <Field label="Cuenta" optional>
                {(p) => (
                  <SelectInput {...p} value={form.account_id} onChange={set("account_id")}>
                    <option value="">Ninguna</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                  </SelectInput>
                )}
              </Field>
            </>
          )}
          <Field label="Duración (minutos)" optional>
            {(p) => <TextInput {...p} type="number" min="0" value={form.duration_minutes} onChange={set("duration_minutes")} placeholder="60" className="fam-numeric" />}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción" optional>{(p) => <TextArea {...p} value={form.description} onChange={set("description")} />}</Field>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={saving}>{saving ? "Guardando…" : "Registrar actividad"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// Cierre comercial: qué se logró, comentarios, próximo paso y evidencia opcional.
export function ActivityCloseModal({ activity, onClose, onSaved }) {
  const [form, setForm] = useState({
    outcome: activity?.outcome || "",
    notes: activity?.outcome_notes || "",
    nextStep: activity?.next_step || "",
    documentName: "",
    documentType: "evidencia_visita",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const save = async () => {
    if (!form.outcome.trim()) { setError("Registra qué se logró."); return; }
    if (!form.notes.trim()) { setError("Agrega los comentarios."); return; }
    setSaving(true); setError("");
    try {
      await completeActivity(activity.id, {
        outcome: form.outcome.trim(),
        outcome_notes: form.notes.trim(),
        next_step: form.nextStep.trim() || null,
      });
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el cierre."));
      setSaving(false);
      return;
    }
    // El cierre ya quedó guardado; si falla el adjunto se avisa sin perderlo.
    let uploadFailed = false;
    if (file) {
      try {
        const data = new FormData();
        data.append("file", file);
        data.append("activity_id", activity.id);
        data.append("account_id", activity.account_id || "");
        data.append("opportunity_id", activity.opportunity_id || "");
        data.append("document_name", form.documentName.trim() || file.name);
        data.append("document_type", form.documentType);
        await uploadDocument(data);
      } catch (_err) {
        uploadFailed = true;
      }
    }
    setSaving(false);
    onSaved({ uploadFailed });
  };

  return (
    <Modal open title="Registrar cierre" onClose={onClose} maxWidth="max-w-2xl" disableClose={saving}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <p className="mb-4 text-sm text-fam-muted">{activity.subject}</p>
        {activity.visit_client_name && (
          <p className="mb-4 rounded-lg bg-fam-warning-bg px-3 py-2 text-sm text-fam-warning">
            La visita a <strong>{activity.visit_client_name}</strong> ya quedó registrada en asistencia. Falta el resultado comercial.
          </p>
        )}
        <ErrorNote message={error} className="mb-4" />
        <div className="space-y-4">
          <Field label="Qué se logró">
            {(p) => <TextArea {...p} value={form.outcome} onChange={set("outcome")} autoFocus placeholder="Se validó la necesidad, hay compromiso de compra, se levantó el requerimiento técnico…" />}
          </Field>
          <Field label="Comentarios">
            {(p) => <TextArea {...p} rows={4} value={form.notes} onChange={set("notes")} placeholder="Acuerdos, objeciones, personas contactadas y contexto relevante." />}
          </Field>
          <Field label="Próximo paso" optional>
            {(p) => <TextArea {...p} rows={2} value={form.nextStep} onChange={set("nextStep")} placeholder="Enviar cotización, coordinar demo, levantar Business Case…" />}
          </Field>
          <fieldset className="rounded-xl border border-fam-border p-4">
            <legend className="px-1 text-[13px] font-medium text-fam-text">Evidencia <span className="font-normal text-fam-muted">(opcional)</span></legend>
            <div className="mb-3 grid gap-4 sm:grid-cols-2">
              <Field label="Nombre del documento" optional>
                {(p) => <TextInput {...p} value={form.documentName} onChange={set("documentName")} placeholder={file?.name || "Acta de visita"} />}
              </Field>
              <Field label="Tipo">
                {(p) => (
                  <SelectInput {...p} value={form.documentType} onChange={set("documentType")}>
                    <option value="evidencia_visita">Evidencia de visita</option>
                    <option value="acta_reunion">Acta o minuta</option>
                    <option value="requerimiento">Requerimiento</option>
                    <option value="cotizacion">Cotización</option>
                  </SelectInput>
                )}
              </Field>
            </div>
            <FileUploadZone
              id={`crm-activity-evidence-${activity.id}`}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              label="Guardar cierre y adjuntar"
              description="PDF, Office o imagen. Máximo 15 MB."
              file={file}
              onFileChange={setFile}
              onUpload={save}
              uploading={saving && Boolean(file)}
              disabled={saving}
            />
          </fieldset>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={saving}>{saving ? "Guardando…" : "Guardar cierre"}</Btn>
        </div>
      </form>
    </Modal>
  );
}
