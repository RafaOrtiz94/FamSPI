jest.mock("../../../config/db", () => ({
  query: jest.fn(async (sql, params) => {
    if (sql.includes("FROM equipment_purchase_requests") || sql.includes("FROM private_purchase_requests")) {
      return { rows: [{ id: params[0], label: "Cliente de prueba" }] };
    }
    if (sql.includes("SELECT id, fullname, email, role FROM users")) {
      return { rows: [{ id: 99, fullname: "Mencionado Uno", email: "m1@fam-project.com", role: "acp_comercial" }] };
    }
    if (sql.includes("JOIN gmail_context_communications c ON c.id = n.source_communication_id")) {
      return {
        rows: [{
          id: params[0],
          mailbox_email: "administrador@fam-project.com",
          gmail_thread_id: "gmail-thread-1",
          sender_email: "cliente@externo.com",
          subject: "Seguimiento comercial",
        }],
      };
    }
    if (sql.startsWith("SELECT id, author_id, author_name_snapshot FROM process_notes")) {
      const parent = global.__mockNotes.find((n) => n.id === params[0]);
      return { rows: parent ? [parent] : [] };
    }
    if (sql.startsWith("SELECT note_hash_sha256 FROM process_notes")) {
      const last = global.__mockNotes[global.__mockNotes.length - 1];
      return { rows: last ? [{ note_hash_sha256: last.note_hash_sha256 }] : [] };
    }
    if (sql.startsWith("INSERT INTO process_notes")) {
      const [
        entityType, entityId, parentNoteId, authorId, authorName, authorRole,
        body, mentions, noteType, emailMeta, attachments, sourceCommunicationId, payloadHash, prevHash, noteHash, createdAt,
      ] = params;
      const row = {
        id: global.__mockNotes.length + 1,
        entity_type: entityType,
        entity_id: entityId,
        parent_note_id: parentNoteId,
        author_id: authorId,
        author_name_snapshot: authorName,
        author_role_snapshot: authorRole,
        body,
        mentioned_user_ids: mentions,
        note_type: noteType,
        email_meta: emailMeta ? JSON.parse(emailMeta) : null,
        attachments: attachments ? JSON.parse(attachments) : [],
        source_communication_id: sourceCommunicationId,
        payload_hash_sha256: payloadHash,
        previous_note_hash_sha256: prevHash,
        note_hash_sha256: noteHash,
        created_at: createdAt,
      };
      global.__mockNotes.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }),
}));

jest.mock("../../notifications/notificationManager", () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
}));

const mockSendMail = jest.fn();
jest.mock("../../../utils/mailer", () => ({
  sendMail: (...args) => mockSendMail(...args),
}));

const service = require("../processNotes.service");

describe("process-notes service", () => {
  beforeEach(() => {
    global.__mockNotes = [];
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ delivered: true, via: "service_account" });
  });

  test("chains each note's hash to the previous one in the same thread", async () => {
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial" };
    const first = await service.createNote({
      entityType: "public_purchase",
      entityId: "abc-123",
      author,
      body: "Primera nota del hilo",
    });
    expect(first.previous_note_hash_sha256).toBeNull();
    expect(first.note_hash_sha256).toHaveLength(64);
    expect(first.note_type).toBe("note");

    const second = await service.createNote({
      entityType: "public_purchase",
      entityId: "abc-123",
      author,
      body: "Respondo a la primera",
      parentNoteId: first.id,
    });
    expect(second.previous_note_hash_sha256).toBe(first.note_hash_sha256);
    expect(second.note_hash_sha256).not.toBe(first.note_hash_sha256);
  });

  test("rejects a role with no access to the entity type", async () => {
    const outsider = { id: 2, fullname: "Sin acceso", role: "pasante" };
    await expect(
      service.createNote({ entityType: "public_purchase", entityId: "abc-123", author: outsider, body: "hola" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test("rejects an empty note body", async () => {
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial" };
    await expect(
      service.createNote({ entityType: "public_purchase", entityId: "abc-123", author, body: "   " }),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("sends an email and records it as an append-only note in the same chain", async () => {
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial", email: "autor@fam-project.com" };
    const note = await service.createNote({
      entityType: "public_purchase", entityId: "abc-123", author, body: "nota previa",
    });

    const emailNote = await service.sendProcessEmail({
      entityType: "public_purchase",
      entityId: "abc-123",
      author,
      to: "cliente@externo.com, otro@fam-project.com",
      subject: "Propuesta actualizada",
      body: "Adjunto la propuesta revisada.",
      attachments: [{ filename: "propuesta.pdf", contentType: "application/pdf", contentBase64: Buffer.from("hola").toString("base64") }],
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sentArgs = mockSendMail.mock.calls[0][0];
    expect(sentArgs.to).toEqual(["cliente@externo.com", "otro@fam-project.com"]);
    expect(sentArgs.attachments).toHaveLength(1);

    expect(emailNote.note_type).toBe("email");
    expect(emailNote.email_meta.to).toEqual(["cliente@externo.com", "otro@fam-project.com"]);
    expect(emailNote.email_meta.attachments[0].filename).toBe("propuesta.pdf");
    expect(emailNote.previous_note_hash_sha256).toBe(note.note_hash_sha256);
  });

  test("rejects sending an email with an invalid recipient address", async () => {
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial", email: "autor@fam-project.com" };
    await expect(
      service.sendProcessEmail({
        entityType: "public_purchase", entityId: "abc-123", author,
        to: "no-es-un-correo", subject: "Asunto", body: "Cuerpo",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test("replies to a linked Gmail communication in its original thread and records it as a child note", async () => {
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial", email: "autor@fam-project.com" };
    const reply = await service.sendProcessEmail({
      entityType: "public_purchase",
      entityId: "abc-123",
      author,
      to: "no-debe-usarse@externo.com",
      subject: "Asunto alterado",
      body: "Respuesta enviada desde SPI.",
      replyToNoteId: 81,
    });

    const sentArgs = mockSendMail.mock.calls[0][0];
    expect(sentArgs.to).toEqual(["cliente@externo.com"]);
    expect(sentArgs.subject).toBe("Re: Seguimiento comercial");
    expect(sentArgs.threadId).toBe("gmail-thread-1");
    expect(sentArgs.delegatedUser).toBe("administrador@fam-project.com");
    expect(sentArgs.requireThreading).toBe(true);
    expect(reply.parent_note_id).toBe(81);
    expect(reply.email_meta.reply_to_note_id).toBe(81);
  });

  test("surfaces a clean error when the mailer fails to deliver", async () => {
    mockSendMail.mockResolvedValue({ delivered: false, via: "none" });
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial", email: "autor@fam-project.com" };
    await expect(
      service.sendProcessEmail({
        entityType: "public_purchase", entityId: "abc-123", author,
        to: "cliente@externo.com", subject: "Asunto", body: "Cuerpo",
      }),
    ).rejects.toMatchObject({ status: 502 });
  });

  test("allows attaching an image to a plain note", async () => {
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial" };
    const note = await service.createNote({
      entityType: "public_purchase",
      entityId: "abc-123",
      author,
      body: "Mira esta foto",
      attachments: [{ filename: "foto.png", contentType: "image/png", contentBase64: Buffer.from("img").toString("base64") }],
    });
    expect(note.attachments).toHaveLength(1);
    expect(note.attachments[0].filename).toBe("foto.png");
  });

  test("rejects a non-image attachment on a plain note", async () => {
    const author = { id: 1, fullname: "Autor Uno", role: "acp_comercial" };
    await expect(
      service.createNote({
        entityType: "public_purchase",
        entityId: "abc-123",
        author,
        body: "Mira este archivo",
        attachments: [{ filename: "reporte.pdf", contentType: "application/pdf", contentBase64: Buffer.from("pdf").toString("base64") }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
