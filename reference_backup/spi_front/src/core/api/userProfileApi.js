import api from "./index";

export const fetchMyProfile = async () => {
  const { data } = await api.get("/users/me/profile");
  if (!data?.ok) throw new Error(data?.message || "No se pudo obtener el perfil");
  return data.data;
};

export const upsertMyProfile = async ({ metadata = {}, preferences = {}, avatarFile = null }) => {
  // Si hay archivo, usamos multipart; caso contrario, JSON plano
  if (avatarFile) {
    const form = new FormData();
    form.append("metadata", JSON.stringify(metadata || {}));
    form.append("preferences", JSON.stringify(preferences || {}));
    form.append("avatar", avatarFile);

    const { data } = await api.put("/users/me/profile", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (!data?.ok) throw new Error(data?.message || "No se pudo actualizar el perfil");
    return data.data;
  }

  const { data } = await api.put("/users/me/profile", { metadata, preferences });
  if (!data?.ok) throw new Error(data?.message || "No se pudo actualizar el perfil");
  return data.data;
};
