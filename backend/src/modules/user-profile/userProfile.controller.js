const {
  getProfileWithIdentity,
  updateProfile,
} = require("./userProfile.service");

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

module.exports = {
  getMine,
  createMine,
  updateMine,
};
