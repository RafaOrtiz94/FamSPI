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

export const listMyProfileDocuments = async () => {
 const { data } = await api.get("/users/me/profile/documents");
 if (!data?.ok) throw new Error(data?.message || "No se pudieron obtener los documentos del perfil");
 return Array.isArray(data.data) ? data.data : [];
};

export const uploadMyProfileDocument = async (docType, file, options = {}) => {
 const formData = new FormData();
 formData.append("docType", docType);
 formData.append("file", file);
 const { data } = await api.post("/users/me/profile/documents", formData, {
 headers: { "Content-Type": "multipart/form-data" },
 ...options,
 });
 if (!data?.ok) throw new Error(data?.message || "No se pudo subir el documento");
 return data.data;
};
