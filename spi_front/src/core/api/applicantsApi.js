import axios from "axios";

const resolveApplicantsBase = () => {
  const base =
    process.env.REACT_APP_APPLICANTS_API_URL ||
    "https://spi-backend-983537733948.us-central1.run.app/api/applicants";
  return base.replace(/\/$/, "");
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getApplicants = async (params = {}) => {
  const { data } = await axios.get(resolveApplicantsBase(), {
    params,
    headers: getAuthHeaders(),
  });
  return data;
};

export const getApplicantById = async (id) => {
  const { data } = await axios.get(`${resolveApplicantsBase()}/${id}`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export default {
  getApplicants,
  getApplicantById,
};
