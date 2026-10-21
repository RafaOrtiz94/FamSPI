const {
  getProfileWithIdentity,
  updateProfile,
} = require("./userProfile.service");
const {
  addCollaboratorDocument,
  getCollaboratorProfile,
} = require("../collaborators/collaborators.service");
const {
  isProfileOwnedCollaboratorDocumentType,
  normalizeCollaboratorDocumentType,
} = require("../shared/collaboratorDocumentCatalog");

const parseJsonField = (value) => {
  if (!value) return undefined;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return undefined;
  }
};

const getMine = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const data = await getProfileWithIdentity(req.user.id);
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("Error obteniendo perfil", err);
    return res.status(500).json({ ok: false, message: "No se pudo obtener el perfil" });
  }
};

const createMine = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const metadata = parseJsonField(req.body?.metadata) || {};
    const preferences = parseJsonField(req.body?.preferences) || {};
    const avatar = req.file || null;

    const profile = await updateProfile({
      userId: req.user.id,
      metadata,
      preferences,
      avatar,
    });

    return res.status(201).json({ ok: true, data: profile });
  } catch (err) {
    console.error("Error creando perfil", err);
    const status = err.status || 500;
    return res.status(status).json({ ok: false, message: err.message || "No se pudo crear el perfil" });
  }
};

const updateMine = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const metadata = parseJsonField(req.body?.metadata) || {};
    const preferences = parseJsonField(req.body?.preferences) || {};
    const avatar = req.file || null;

    const profile = await updateProfile({
      userId: req.user.id,
      metadata,
      preferences,
      avatar,
    });

    return res.status(200).json({ ok: true, data: profile });
  } catch (err) {
    console.error("Error actualizando perfil", err);
    const status = err.status || 500;
    return res.status(status).json({ ok: false, message: err.message || "No se pudo actualizar el perfil" });
  }
};

const buildProfileOwnedDocuments = (documents = []) => {
  const filtered = Array.isArray(documents)
    ? documents.filter((document) =>
        isProfileOwnedCollaboratorDocumentType(
          document?.canonical_doc_type || document?.doc_type,
        ),
      )
    : [];

  return filtered.reduce((accumulator, document) => {
    const canonicalType = normalizeCollaboratorDocumentType(
      document?.canonical_doc_type || document?.doc_type,
    );
    if (!canonicalType) return accumulator;
    if (accumulator.some((item) => item?.canonical_doc_type === canonicalType)) {
      return accumulator;
    }
    accumulator.push({
      ...document,
      canonical_doc_type: canonicalType,
    });
    return accumulator;
  }, []);
};

const getMyDocuments = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const collaboratorProfile = await getCollaboratorProfile(req.user.id);
    const documents = buildProfileOwnedDocuments(collaboratorProfile?.documents);

    return res.status(200).json({ ok: true, data: documents });
  } catch (err) {
    console.error("Error obteniendo documentos de perfil", err);
    return res
      .status(500)
      .json({ ok: false, message: "No se pudieron obtener los documentos" });
  }
};

const uploadMyDocument = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const docType = req.body?.docType || req.body?.doc_type;
    const file = req.file || null;

    if (!docType) {
      return res
        .status(400)
        .json({ ok: false, message: "docType es requerido" });
    }

    if (!isProfileOwnedCollaboratorDocumentType(docType)) {
      return res.status(403).json({
        ok: false,
        message: "Este tipo de documento no puede cargarse desde Mi Perfil",
      });
    }

    if (!file) {
      return res.status(400).json({ ok: false, message: "Archivo requerido" });
    }

    const result = await addCollaboratorDocument(
      req.user.id,
      docType,
      file,
      req.user.id,
    );
    const documents = buildProfileOwnedDocuments(result?.documents);

    return res.status(200).json({
      ok: true,
      data: {
        document: result?.document || null,
        documents,
      },
    });
  } catch (err) {
    console.error("Error subiendo documento de perfil", err);
    const status = err.status || 500;
    return res.status(status).json({
      ok: false,
      message: err.message || "No se pudo subir el documento",
    });
  }
};

module.exports = {
  getMine,
  createMine,
  getMyDocuments,
  updateMine,
  uploadMyDocument,
};
