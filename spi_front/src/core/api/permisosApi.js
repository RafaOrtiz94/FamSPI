import api from "./index";

export const crearPermiso = async (payload) => {
  const { data } = await api.post('/permisos', payload);
  return data;
};

export const aprobarPermisoParcial = async (id) => {
  const { data } = await api.post(`/permisos/${id}/aprobar-parcial`);
  return data;
};

export const subirJustificantes = async (id, payload) => {
  const { data } = await api.post(`/permisos/${id}/justificantes`, payload);
  return data;
};

export const aprobarPermisoFinal = async (id) => {
  const { data } = await api.post(`/permisos/${id}/aprobar-final`);
  return data;
};

export const rechazarPermiso = async (id, observaciones) => {
  const { data } = await api.post(`/permisos/${id}/rechazar`, { observaciones });
  return data;
};

export const listarPendientes = async (stage = 'pending') => {
  const { data } = await api.get('/permisos/pending', { params: { stage } });
  return data;
};

export default {
  crearPermiso,
  aprobarPermisoParcial,
  subirJustificantes,
  aprobarPermisoFinal,
  rechazarPermiso,
  listarPendientes,
};
