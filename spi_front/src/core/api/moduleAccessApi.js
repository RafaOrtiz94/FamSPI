import api from "./index";

export const getModuleCatalog = async () => {
  const { data } = await api.get("/module-access/catalog");
  return data?.data || [];
};

export const getUserModuleAccess = async (userId) => {
  const { data } = await api.get(`/module-access/users/${userId}`);
  return data?.data || [];
};

export const updateUserModuleAccess = async (userId, modules) => {
  const { data } = await api.put(`/module-access/users/${userId}`, { modules });
  return data?.data || [];
};
