import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiMessageCircle, FiX, FiCornerUpLeft, FiShield, FiSend, FiAtSign, FiMail, FiPaperclip, FiFile, FiExternalLink, FiCheck } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { useUI } from "../UIContext";
import Modal from "./Modal";
import {
  listProcessNotes,
  createProcessNote,
  markProcessNoteRead,
  listProcessNoteMentionCandidates,
  sendProcessNoteEmail,
} from "../../api/processNotesApi";

// Boton flotante de notas por proceso (Business Case / compra publica /
// compra privada). Hilo append-only: ninguna nota se edita ni se borra (el
// backend lo rechaza incluso a nivel de base de datos), solo se puede
// responder -- igual que un hilo de WhatsApp/Telegram. Cada nota trae su
// hash de integridad encadenado con la anterior del mismo hilo. Tambien
// permite enviar un correo (internos o externos, con adjuntos) desde el
// mismo panel -- queda registrado como una nota mas del hilo, append-only
// igual que las demas.

function formatTimestamp(value) {
  try {
    return new Date(value).toLocaleString("es-EC", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function getAttachmentOpenUrl(attachment) {
  if (attachment?.drive_url) return attachment.drive_url;
  return attachment?.drive_file_id
    ? `https://drive.google.com/open?id=${encodeURIComponent(attachment.drive_file_id)}`
    : null;
}

function AttachmentCards({ attachments = [], tone = "indigo" }) {
  if (!attachments.length) return null;
  const isEmail = tone === "emerald";
  const iconClass = isEmail ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700";
  const interactiveClass = isEmail
    ? "border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50"
    : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50";

  return (
    <section className="mt-3" aria-label="Archivos adjuntos">
      <p className="mb-2 text-xs font-medium text-slate-600">Archivos adjuntos</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {attachments.map((attachment, idx) => {
          const openUrl = getAttachmentOpenUrl(attachment);
          const filename = attachment.filename || "Archivo adjunto";
          const details = [attachment.content_type, formatBytes(attachment.size_bytes)].filter(Boolean).join(" · ");
          const content = (
            <>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                <FiFile size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{filename}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{details}</span>
              </span>
              {openUrl ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-700">
                  Abrir <FiExternalLink size={13} aria-hidden="true" />
                </span>
              ) : null}
            </>
          );

          return openUrl ? (
            <a
              key={idx}
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200 cursor-pointer ${interactiveClass}`}
              aria-label={`Abrir archivo adjunto: ${filename}`}
            >
              {content}
            </a>
          ) : (
            <div
              key={idx}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              title="Este adjunto histórico no tiene una copia accesible en Drive"
            >
              {content}
              <span className="shrink-0 text-xs font-medium text-slate-500">Sin acceso</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function highlightMentions(body, candidatesById) {
  const parts = String(body || "").split(/(@\[[^\]]+\]\(\d+\))/g);
  return parts.map((part, idx) => {
    const match = part.match(/^@\[([^\]]+)\]\((\d+)\)$/);
    if (!match) return <React.Fragment key={idx}>{part}</React.Fragment>;
    const userId = Number(match[2]);
    const known = candidatesById.get(userId);
    return (
      <span key={idx} className="font-semibold text-blue-700">
        @{known?.fullname || match[1]}
      </span>
    );
  });
}

const MAX_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

export default function ProcessNotesFab({ entityType, entityId, title = "Notas del proceso" }) {
  const { user } = useAuth();
  const { showToast } = useUI();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("note"); // "note" | "email"
  const [notes, setNotes] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [composeFiles, setComposeFiles] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const markedReadRef = useRef(new Set());
  const [readersOpenFor, setReadersOpenFor] = useState(null);

  const candidatesById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const load = async ({ notifyOnError = true } = {}) => {
    if (!entityType || !entityId) return;
    setLoading(true);
    try {
      const [notesData, candidatesData] = await Promise.all([
        listProcessNotes(entityType, entityId),
        listProcessNoteMentionCandidates(entityType, entityId),
      ]);
      setNotes(notesData);
      setCandidates(candidatesData);
    } catch {
      if (notifyOnError) showToast("No se pudieron cargar las notas de este proceso.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // La primera consulta es silenciosa y permite mostrar el contador del
    // botón flotante sin obligar al usuario a abrir el panel.
    load({ notifyOnError: open });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityType, entityId]);

  // Marca como leidas las notas que aun no tienen recibo de lectura del
  // usuario actual -- silencioso, no bloquea la UI si falla.
  useEffect(() => {
    if (!open || !user?.id) return;
    notes.forEach((note) => {
      if (markedReadRef.current.has(note.id)) return;
      const alreadyRead = (note.read_by || []).some((r) => Number(r.user_id) === Number(user.id));
      if (alreadyRead || Number(note.author_id) === Number(user.id)) {
        markedReadRef.current.add(note.id);
        return;
      }
      markedReadRef.current.add(note.id);
      markProcessNoteRead(entityType, entityId, note.id).catch(() => null);
    });
  }, [open, notes, user?.id, entityType, entityId]);

  const handleBodyChange = (event) => {
    const value = event.target.value;
    setBody(value);
    const caret = event.target.selectionStart;
    const uptoCaret = value.slice(0, caret);
    const match = uptoCaret.match(/@([\wáéíóúñ]*)$/i);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (candidate) => {
    const caret = textareaRef.current?.selectionStart ?? body.length;
    const uptoCaret = body.slice(0, caret);
    const afterCaret = body.slice(caret);
    const replaced = uptoCaret.replace(/@([\wáéíóúñ]*)$/i, `@[${candidate.fullname}](${candidate.id}) `);
    setBody(`${replaced}${afterCaret}`);
    setMentionQuery(null);
    setSelectedMentions((prev) => (prev.includes(candidate.id) ? prev : [...prev, candidate.id]));
    textareaRef.current?.focus();
  };

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return candidates.filter((c) => c.fullname.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, candidates]);

  const handleAddFiles = (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (mode === "note") {
      const nonImage = picked.find((f) => !f.type.startsWith("image/"));
      if (nonImage) {
        showToast("En una nota solo se pueden adjuntar imagenes.", "warning");
        return;
      }
    }
    const combined = [...composeFiles, ...picked];
    const totalBytes = combined.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_ATTACHMENTS_BYTES) {
      showToast("Los adjuntos no pueden superar 20MB combinados.", "warning");
      return;
    }
    setComposeFiles(combined);
  };

  const removeFile = (idx) => setComposeFiles((prev) => prev.filter((_, i) => i !== idx));

  const resetCompose = () => {
    setBody("");
    setReplyingTo(null);
    setSelectedMentions([]);
    setEmailTo("");
    setEmailCc("");
    setEmailSubject("");
    setComposeFiles([]);
  };

  const handleSendNote = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const created = await createProcessNote(entityType, entityId, {
        body: trimmed,
        parentNoteId: replyingTo?.id || null,
        mentionedUserIds: selectedMentions,
        files: composeFiles,
      });
      setNotes((prev) => [...prev, created]);
      markedReadRef.current.add(created.id);
      resetCompose();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo enviar la nota.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !body.trim()) {
      showToast("Completa destinatario, asunto y mensaje del correo.", "warning");
      return;
    }
    setSending(true);
    try {
      const created = await sendProcessNoteEmail(entityType, entityId, {
        to: emailTo.trim(),
        cc: emailCc.trim() || undefined,
        subject: emailSubject.trim(),
        body: body.trim(),
        files: composeFiles,
      });
      setNotes((prev) => [...prev, created]);
      markedReadRef.current.add(created.id);
      resetCompose();
      setMode("note");
      showToast("Correo enviado y registrado en el hilo.", "success");
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo enviar el correo.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        className="fixed bottom-[19rem] right-4 z-[44] flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 active:scale-95 sm:bottom-[20rem] sm:right-6"
      >
        <FiMessageCircle size={22} />
        {notes.length > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-indigo-700 shadow">
            {notes.length}
          </span>
        ) : null}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={title} maxWidth="max-w-2xl">
        <div className="flex max-h-[75vh] flex-col gap-3">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Cargando notas…</p>
            ) : notes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Aun no hay notas en este proceso. Se el primero en dejar una.</p>
            ) : (
              notes.map((note) => {
                const parent = note.parent_note_id ? notesById.get(note.parent_note_id) : null;
                const readers = (note.read_by || []).filter((r) => Number(r.user_id) !== Number(note.author_id));
                const isEmail = note.note_type === "email";
                return (
                  <div key={note.id} className={`rounded-xl border p-3 shadow-sm ${isEmail ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                    {parent ? (
                      <div className="mb-1.5 rounded-lg border-l-2 border-indigo-300 bg-indigo-50/70 px-2 py-1 text-xs text-slate-600">
                        <FiCornerUpLeft className="mr-1 inline" size={11} />
                        En respuesta a <span className="font-medium">{parent.author_name_snapshot}</span>: {parent.body.slice(0, 80)}
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-1.5">
                        {isEmail ? <FiMail className="shrink-0 text-emerald-600" size={13} /> : null}
                        <span className="text-sm font-semibold text-slate-900">{note.author_name_snapshot}</span>
                        {note.author_role_snapshot ? (
                          <span className="ml-1 text-[11px] uppercase tracking-wide text-slate-400">{note.author_role_snapshot}</span>
                        ) : null}
                      </div>
                      <span
                        title={`Hash de integridad: ${note.note_hash_sha256}`}
                        className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-400"
                      >
                        <FiShield size={11} />
                        {note.note_hash_sha256.slice(0, 8)}
                      </span>
                    </div>

                    {isEmail && note.email_meta ? (
                      <div className="mt-1.5 space-y-1 rounded-lg bg-white/70 p-2 text-xs text-slate-600">
                        <p><span className="font-semibold">Para:</span> {note.email_meta.to?.join(", ")}</p>
                        {note.email_meta.cc?.length ? <p><span className="font-semibold">CC:</span> {note.email_meta.cc.join(", ")}</p> : null}
                        <p><span className="font-semibold">Asunto:</span> {note.email_meta.subject}</p>
                        <AttachmentCards attachments={note.email_meta.attachments} tone="emerald" />
                      </div>
                    ) : null}

                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                      {highlightMentions(note.body, candidatesById)}
                    </p>

                    {!isEmail ? <AttachmentCards attachments={note.attachments} /> : null}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                      <span>{formatTimestamp(note.created_at)}</span>
                      <div className="relative flex items-center gap-2">
                        {readers.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setReadersOpenFor((prev) => (prev === note.id ? null : note.id))}
                            aria-expanded={readersOpenFor === note.id}
                            aria-controls={`note-readers-${note.id}`}
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none"
                          >
                            <span className="relative h-4 w-5 text-indigo-600" aria-hidden="true">
                              <FiCheck className="absolute left-0 top-0" size={14} />
                              <FiCheck className="absolute left-1.5 top-0" size={14} />
                            </span>
                            <span>Leído por {readers.length}</span>
                            <span className="flex -space-x-1.5" aria-hidden="true">
                              {readers.slice(0, 3).map((reader) => (
                                <span key={reader.user_id} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-50 bg-indigo-100 text-[9px] font-semibold text-indigo-700">
                                  {String(reader.name || "?").trim().slice(0, 1).toUpperCase()}
                                </span>
                              ))}
                            </span>
                          </button>
                        ) : null}
                        {readersOpenFor === note.id ? (
                          <div id={`note-readers-${note.id}`} className="absolute bottom-full right-0 z-10 mb-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                <span className="relative h-4 w-5 text-indigo-600" aria-hidden="true"><FiCheck className="absolute left-0 top-0" size={14} /><FiCheck className="absolute left-1.5 top-0" size={14} /></span>
                                Leído por
                              </span>
                              <button type="button" onClick={() => setReadersOpenFor(null)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar detalle de lecturas">
                                <FiX size={12} />
                              </button>
                            </div>
                            <ul className="divide-y divide-slate-100">
                              {readers.map((reader) => (
                                <li key={reader.user_id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                                    {String(reader.name || "?").trim().slice(0, 1).toUpperCase()}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-slate-800">{reader.name}</span>
                                    <span className="block text-[11px] text-slate-500">Leído {formatTimestamp(reader.read_at)}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => { setMode("note"); setReplyingTo(note); textareaRef.current?.focus(); }}
                          className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          <FiCornerUpLeft size={12} /> Responder
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => { setMode("note"); setComposeFiles([]); }}
              className={`flex-1 rounded-lg py-1.5 transition ${mode === "note" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Nota
            </button>
            <button
              type="button"
              onClick={() => { setMode("email"); setReplyingTo(null); setComposeFiles([]); }}
              className={`flex-1 rounded-lg py-1.5 transition ${mode === "email" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <FiMail className="mr-1 inline" size={13} /> Correo
            </button>
          </div>

          {mode === "note" && replyingTo ? (
            <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
              <span>Respondiendo a <strong>{replyingTo.author_name_snapshot}</strong></span>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-indigo-500 hover:text-indigo-700">
                <FiX size={14} />
              </button>
            </div>
          ) : null}

          {mode === "email" ? (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <input
                type="text"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Para: correos separados por coma (internos o externos)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <input
                type="text"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                placeholder="CC (opcional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Asunto"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          ) : null}

          <div className="relative">
            {mode === "note" && mentionQuery !== null && mentionMatches.length > 0 ? (
              <div className="absolute bottom-full mb-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {mentionMatches.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => insertMention(candidate)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                  >
                    <FiAtSign size={12} className="text-indigo-500" />
                    {candidate.fullname}
                    <span className="text-xs text-slate-400">{candidate.role}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              value={body}
              onChange={mode === "note" ? handleBodyChange : (e) => setBody(e.target.value)}
              placeholder={mode === "note" ? "Escribe una nota para los demas participantes. Usa @ para mencionar a alguien." : "Mensaje del correo…"}
              rows={3}
              maxLength={4000}
              className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={mode === "note" ? "image/*" : undefined}
              className="hidden"
              onChange={handleAddFiles}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <FiPaperclip size={12} /> {mode === "note" ? "Adjuntar imagenes" : "Adjuntar archivos"}
            </button>
            {composeFiles.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {composeFiles.map((file, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                    <FiFile size={10} /> {file.name} ({formatBytes(file.size)})
                    <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500">
                      <FiX size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {mode === "note" ? "Las notas no se pueden editar ni borrar una vez enviadas." : "El correo tambien queda registrado como nota en el hilo."}
            </span>
            <button
              type="button"
              onClick={mode === "note" ? handleSendNote : handleSendEmail}
              disabled={sending || !body.trim() || (mode === "email" && (!emailTo.trim() || !emailSubject.trim()))}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${mode === "note" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {mode === "note" ? <FiSend size={14} /> : <FiMail size={14} />}
              {sending ? "Enviando…" : mode === "note" ? "Enviar nota" : "Enviar correo"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
