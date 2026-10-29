import axios from "axios";

const DEFAULT_PROD_API_ORIGIN = "https://spi-backend-983537733948.us-central1.run.app";
export const WORLD_CUP_PARTICIPANT_TOKEN_KEY = "world_cup_2026_participant_token";
export const WORLD_CUP_PARTICIPANT_HEADER = "x-world-cup-participant-token";

const resolveApiOrigin = () => {
  const raw =
    process.env.REACT_APP_API_ABSOLUTE_URL ||
    process.env.REACT_APP_API_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    "";

  const trimmed = String(raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_PROD_API_ORIGIN;
  return trimmed.replace(/\/api\/v1$/i, "").replace(/\/api$/i, "");
};

const client = axios.create({
  baseURL: `${resolveApiOrigin()}/api/v1/world-cup-2026`,
  withCredentials: false,
});

export function getStoredParticipantToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WORLD_CUP_PARTICIPANT_TOKEN_KEY);
}

export function setStoredParticipantToken(token) {
  if (typeof window === "undefined" || !token) return;
  window.localStorage.setItem(WORLD_CUP_PARTICIPANT_TOKEN_KEY, token);
}

function buildHeaders(participantToken) {
  return participantToken ? { [WORLD_CUP_PARTICIPANT_HEADER]: participantToken } : {};
}

export async function getWorldCupPortal(participantToken = getStoredParticipantToken()) {
  const { data } = await client.get("/public/portal", {
    headers: buildHeaders(participantToken),
  });
  return data;
}

export async function getWorldCupParticipant(participantToken = getStoredParticipantToken()) {
  const { data } = await client.get("/public/participant", {
    headers: buildHeaders(participantToken),
  });
  return data;
}

export async function getWorldCupLiveBoard() {
  const { data } = await client.get("/public/live-board");
  return data;
}

export async function createWorldCupSubmission(payload) {
  const { data } = await client.post("/public/submissions", payload);
  return data;
}

export function createWorldCupLiveStream() {
  return new window.EventSource(`${resolveApiOrigin()}/api/v1/world-cup-2026/public/live-stream`);
}
