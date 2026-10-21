// Alta y edición de contacto. Con `accountId` fijo (desde la ficha de cuenta) no se pide la cuenta.
// Con `leadId` el contacto nace ligado a ese lead (createLeadContact); `initial` precarga datos.
import { useEffect, useState } from "react";
import Modal from "../../../core/ui/components/Modal";
import { createContact, createLeadContact, fetchAccounts, updateContact } from "../../../core/api/crmFamApi";
import { Btn, ErrorNote, Field, SelectInput, TextInput } from "../ui/kit";
import { errorMessage } from "../ui/format";
import { listOf } from "../ui/useLoad";

export default function ContactFormModal({ contact, accountId, leadId, initial, onClose, onSaved }) {
  const editing = Boolean(contact?.id);
  const [form, setForm] = useState(() => ({
    first_name: contact?.first_name || initial?.first_name || "",
    last_name: contact?.last_name || initial?.last_name || "",
    job_title: contact?.job_title || initial?.job_title || "",
    email: contact?.email || initial?.email || "",
    phone: contact?.phone || initial?.phone || "",
    account_id: accountId || contact?.account_id || initial?.account_id || "",
  }));
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  useEffect(() => {
    if (accountId) return undefined;
    let cancelled = false;
    fetchAccounts({ limit: 500 })
      .then((res) => { if (!cancelled) setAccounts(listOf(res)); })
      .catch(() => { if (!cancelled) setAccounts([]); });
    return () => { cancelled = true; };
  }, [accountId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) { setError("Escribe nombre y apellido."); return; }
    setSaving(true); setError("");
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      job_title: form.job_title.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      account_id: form.account_id || null,
    };
    try {
      const saved = editing
        ? await updateContact(contact.id, payload)
        : leadId ? await createLeadContact(leadId, payload) : await createContact(payload);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el contacto."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? "Editar contacto" : "Nuevo contacto"} onClose={onClose} maxWidth="max-w-lg" disableClose={saving}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">{(p) => <TextInput {...p} value={form.first_name} onChange={set("first_name")} maxLength={100} autoFocus />}</Field>
          <Field label="Apellido">{(p) => <TextInput {...p} value={form.last_name} onChange={set("last_name")} maxLength={100} />}</Field>
          <div className="sm:col-span-2">
            <Field label="Cargo" optional>{(p) => <TextInput {...p} value={form.job_title} onChange={set("job_title")} maxLength={150} />}</Field>
          </div>
          <Field label="Correo" optional>{(p) => <TextInput {...p} type="email" value={form.email} onChange={set("email")} maxLength={255} />}</Field>
          <Field label="Teléfono" optional>{(p) => <TextInput {...p} type="tel" value={form.phone} onChange={set("phone")} maxLength={50} />}</Field>
          {!accountId && (
            <div className="sm:col-span-2">
              <Field label="Cuenta" optional>
                {(p) => (
                  <SelectInput {...p} value={form.account_id || ""} onChange={set("account_id")}>
                    <option value="">Sin cuenta</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                  </SelectInput>
                )}
              </Field>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear contacto"}</Btn>
        </div>
      </form>
    </Modal>
  );
}
