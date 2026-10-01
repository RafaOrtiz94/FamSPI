/**
 * ProviderEmailChipsInput
 *
 * Campo de destinatarios de proveedor con soporte para varios correos a la
 * vez (chips), correos individuales guardados (useProviderEmails) y grupos
 * de correos guardados (useProviderEmailGroups) para aplicar de una sola vez.
 *
 * `value`/`onChange` siguen usando el mismo formato que ya manejaba el resto
 * del archivo (string separado por comas), asi que no hace falta tocar nada
 * mas del formulario que ya arma el payload con ese string.
 */
import React, { useState } from 'react';
import { FiX, FiPlus, FiUsers, FiSave } from 'react-icons/fi';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (value) =>
  String(value || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

const joinEmails = (emails) => emails.join(', ');

const ProviderEmailChipsInput = ({
  value,
  onChange,
  savedEmails = [],
  onSaveEmail,
  groups = [],
  onSaveGroup,
  onRemoveGroup,
}) => {
  const [draft, setDraft] = useState('');
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [showGroupSave, setShowGroupSave] = useState(false);

  const emails = parseEmails(value);
  const addEmail = (raw) => {
    const email = raw.trim();
    if (!email || !EMAIL_RE.test(email)) return false;
    if (emails.some((e) => e.toLowerCase() === email.toLowerCase())) return true;
    onChange(joinEmails([...emails, email]));
    return true;
  };
  const removeEmail = (email) => {
    onChange(joinEmails(emails.filter((e) => e !== email)));
  };
  const applyGroup = (group) => {
    const merged = Array.from(new Set([...emails, ...group.emails]));
    onChange(joinEmails(merged));
  };

  const handleDraftKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (addEmail(draft)) setDraft('');
    } else if (e.key === 'Backspace' && !draft && emails.length) {
      removeEmail(emails[emails.length - 1]);
    }
  };
  const commitDraft = () => {
    if (draft.trim() && addEmail(draft)) setDraft('');
  };

  const unusedSaved = savedEmails.filter(
    (e) => !emails.some((v) => v.toLowerCase() === e.email.toLowerCase()),
  );

  return (
    <div>
      {/* Chips + input */}
      <div className="min-h-10 w-full rounded-xl border border-slate-200 px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-action-blue">
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 pl-2 pr-1 py-1 text-xs text-slate-700"
          >
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="rounded-full p-0.5 hover:bg-slate-200 cursor-pointer"
              aria-label={`Quitar ${email}`}
            >
              <FiX size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleDraftKeyDown}
          onBlur={commitDraft}
          placeholder={emails.length ? 'Agregar otro correo…' : 'proveedor@empresa.com'}
          className="flex-1 min-w-[140px] border-0 focus:outline-none focus:ring-0 text-sm px-1 py-1"
        />
      </div>

      {/* Correos guardados (agregar de a uno) */}
      {unusedSaved.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">Guardados:</span>
          {unusedSaved.map((e) => (
            <button
              key={e.email}
              type="button"
              onClick={() => addEmail(e.email)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-action-blue hover:text-action-blue cursor-pointer"
            >
              <FiPlus size={10} /> {e.label || e.email}
            </button>
          ))}
        </div>
      )}

      {/* Grupos guardados (agregar todos de una) */}
      {groups.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">Grupos:</span>
          {groups.map((g) => (
            <span
              key={g.name}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 pl-2 pr-1 py-0.5 text-[11px] text-indigo-700"
            >
              <button
                type="button"
                onClick={() => applyGroup(g)}
                className="inline-flex items-center gap-1 cursor-pointer"
                title={g.emails.join(', ')}
              >
                <FiUsers size={10} /> {g.name} ({g.emails.length})
              </button>
              {onRemoveGroup && (
                <button
                  type="button"
                  onClick={() => onRemoveGroup(g.name)}
                  className="rounded-full p-0.5 hover:bg-indigo-100 cursor-pointer"
                  aria-label={`Eliminar grupo ${g.name}`}
                >
                  <FiX size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Guardar selección actual: como contacto nuevo y/o como grupo */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onSaveEmail && draft.trim() && EMAIL_RE.test(draft.trim()) && (
          <button
            type="button"
            onClick={() => { onSaveEmail(draft.trim()); addEmail(draft); setDraft(''); }}
            className="text-[11px] text-action-blue hover:underline cursor-pointer"
          >
            Guardar "{draft.trim()}" como contacto
          </button>
        )}
        {onSaveGroup && emails.length >= 2 && !showGroupSave && (
          <button
            type="button"
            onClick={() => setShowGroupSave(true)}
            className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-action-blue cursor-pointer"
          >
            <FiSave size={11} /> Guardar estos {emails.length} correos como grupo
          </button>
        )}
        {showGroupSave && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={groupNameDraft}
              onChange={(e) => setGroupNameDraft(e.target.value)}
              placeholder="Nombre del grupo (ej. Roche Ecuador)"
              className="min-h-8 rounded-lg border border-slate-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-action-blue"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                if (!groupNameDraft.trim()) return;
                onSaveGroup(groupNameDraft.trim(), emails);
                setGroupNameDraft('');
                setShowGroupSave(false);
              }}
              className="min-h-8 rounded-lg bg-action-blue px-2.5 text-xs font-medium text-white hover:bg-action-blue/90 cursor-pointer"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => { setShowGroupSave(false); setGroupNameDraft(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderEmailChipsInput;
