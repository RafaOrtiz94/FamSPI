import axios from "axios";

const DEFAULT_PROD_API_ORIGIN = "https://spi-backend-983537733948.us-central1.run.app";

function resolveApiOrigin() {
  const raw = process.env.REACT_APP_API_ABSOLUTE_URL || process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || "";
  const value = String(raw).trim().replace(/\/+$/, "");
  return (value || DEFAULT_PROD_API_ORIGIN).replace(/\/api\/v1$/i, "").replace(/\/api$/i, "");
}

const client = axios.create({
  baseURL: `${resolveApiOrigin()}/api/v1/suggestion-box/public`,
  withCredentials: false,
  timeout: 15000,
});

export async function createPublicSuggestionBoxSubmission(payload) {
  const { data } = await client.post("/submissions", payload);
  return data;
}
