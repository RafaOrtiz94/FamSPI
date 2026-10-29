// Alta y edición de cuenta en el diálogo del sistema (acción breve y autocontenida, DESIGN.md §9).
import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../../../core/ui/components/Modal";
import { createAccount, updateAccount } from "../../../core/api/crmFamApi";
import { Btn, ErrorNote, Field, SelectInput, TextArea, TextInput } from "../ui/kit";
import { errorMessage } from "../ui/format";
import { ACCOUNT_TYPES } from "../ui/status";

const FIELDS = ["account_name", "legal_name", "ruc", "account_type", "classification", "industry", "city", "province", "address", "email", "phone", "website", "notes"];

export default function AccountFormModal({ account, onClose, onSaved }) {
  const editing = Boolean(account?.id);
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f, account?.[f] ?? ""])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState(null);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.account_name.trim()) { setError("Escribe el nombre de la cuenta."); return; }
    setSaving(true); setError(""); setExisting(null);
    try {
      // Vacío se envía como null para no guardar cadenas en blanco.
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]));
      payload.account_name = form.account_name.trim();
      const saved = editing ? await updateAccount(account.id, payload) : await createAccount(payload);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar la cuenta."));
      setExisting(err?.response?.data?.existing || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? "Editar cuenta" : "Nueva cuenta"} onClose={onClose} maxWidth="max-w-2xl" disableClose={saving}>
      <form onSubmit={submit} noValidate>
        <ErrorNote message={error} className="mb-4" />
        {existing?.id && (
          <p className="mb-4 text-sm text-fam-text">
            Ya existe: <Link to={`/dashboard/crm-fam/accounts/${existing.id}`} className="text-fam-action underline">{existing.account_name}</Link>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre de la cuenta">
              {(p) => <TextInput {...p} value={form.account_name} onChange={set("account_name")} maxLength={255} required autoFocus />}
            </Field>
          </div>
          <Field label="RUC" optional hint="13 dígitos. No puede repetirse.">
            {(p) => <TextInput {...p} value={form.ruc} onChange={set("ruc")} maxLength={13} inputMode="numeric" className="fam-id" />}
          </Field>
          <Field label="Razón social" optional>
            {(p) => <TextInput {...p} value={form.legal_name} onChange={set("legal_name")} maxLength={255} />}
          </Field>
          <Field label="Tipo" optional>
            {(p) => (
              <SelectInput {...p} value={form.account_type || ""} onChange={set("account_type")}>
                <option value="">Sin definir</option>
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label="Clasificación" optional>
            {(p) => (
              <SelectInput {...p} value={form.classification || ""} onChange={set("classification")}>
                <option value="">Sin clasificar</option>
                <option value="oro">Oro</option>
                <option value="plata">Plata</option>
                <option value="bronce">Bronce</option>
                <option value="normal">Normal</option>
              </SelectInput>
            )}
          </Field>
          <Field label="Industria" optional>
            {(p) => <TextInput {...p} value={form.industry} onChange={set("industry")} maxLength={100} />}
          </Field>
          <Field label="Ciudad" optional>
            {(p) => <TextInput {...p} value={form.city} onChange={set("city")} maxLength={100} />}
          </Field>
          <Field label="Correo" optional>
            {(p) => <TextInput {...p} type="email" value={form.email} onChange={set("email")} maxLength={255} />}
          </Field>
          <Field label="Teléfono" optional>
            {(p) => <TextInput {...p} type="tel" value={form.phone} onChange={set("phone")} maxLength={50} />}
          </Field>
          {editing && (
            <>
              <Field label="Provincia" optional>
                {(p) => <TextInput {...p} value={form.province} onChange={set("province")} maxLength={100} />}
              </Field>
              <Field label="Sitio web" optional>
                {(p) => <TextInput {...p} type="url" value={form.website} onChange={set("website")} maxLength={255} placeholder="https://" />}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Dirección" optional>
                  {(p) => <TextInput {...p} value={form.address} onChange={set("address")} />}
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notas" optional>
                  {(p) => <TextArea {...p} value={form.notes} onChange={set("notes")} />}
                </Field>
              </div>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={saving}>Cancelar</Btn>
          <Btn type="submit" variant="primary" loading={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear cuenta"}</Btn>
        </div>
      </form>
    </Modal>
  );
}
