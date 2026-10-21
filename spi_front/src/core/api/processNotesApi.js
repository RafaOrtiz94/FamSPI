import api from "./index";

const base = "/process-notes";

export const listProcessNotes = async (entityType, entityId) => {
  const { data } = await api.get(`${base}/${entityType}/${entityId}`);
  return data?.data ?? [];
};

export const createProcessNote = async (entityType, entityId, { body, parentNoteId, mentionedUserIds, files }) => {
  if (files && files.length) {
    const form = new FormData();
    form.append("body", body);
    if (parentNoteId) form.append("parent_note_id", parentNoteId);
    form.append("mentioned_user_ids", JSON.stringify(mentionedUserIds || []));
    files.forEach((file) => form.append("files", file));
    const { data } = await api.post(`${base}/${entityType}/${entityId}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data?.data;
  }
  const { data } = await api.post(`${base}/${entityType}/${entityId}`, {
    body,
    parent_note_id: parentNoteId || null,
    mentioned_user_ids: mentionedUserIds || [],
  });
  return data?.data;
};

export const markProcessNoteRead = async (entityType, entityId, noteId) => {
  await api.post(`${base}/${entityType}/${entityId}/${noteId}/read`);
};

export const listProcessNoteMentionCandidates = async (entityType, entityId) => {
  const { data } = await api.get(`${base}/${entityType}/mention-candidates`, { params: { entity_id: entityId } });
  return data?.data ?? [];
};

export const sendProcessNoteEmail = async (entityType, entityId, { to, cc, subject, body, replyToNoteId, files }) => {
  const form = new FormData();
  form.append("to", to);
  if (cc) form.append("cc", cc);
  form.append("subject", subject);
  form.append("body", body);
  if (replyToNoteId) form.append("reply_to_note_id", replyToNoteId);
  (files || []).forEach((file) => form.append("files", file));
  const { data } = await api.post(`${base}/${entityType}/${entityId}/email`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
};
