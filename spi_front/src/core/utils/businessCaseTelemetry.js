import api from "../api";
import logger from "./logger";

const MAX_BATCH_SIZE = 25;
const FLUSH_INTERVAL_MS = 8000;

let queue = [];
let timer = null;
let flushing = false;

const scheduleFlush = () => {
 if (timer) return;
 timer = setTimeout(() => {
 timer = null;
 flushBusinessCaseTelemetry();
 }, FLUSH_INTERVAL_MS);
};

export const recordBusinessCaseTelemetry = (event = {}) => {
 if (!event || typeof event !== "object") return;
 queue.push({
 ...event,
 timestamp: new Date().toISOString(),
 });

 if (queue.length >= MAX_BATCH_SIZE) {
 flushBusinessCaseTelemetry();
 return;
 }
 scheduleFlush();
};

export const flushBusinessCaseTelemetry = async () => {
 if (flushing) return;
 if (!queue.length) return;
 flushing = true;

 const batch = queue.splice(0, MAX_BATCH_SIZE);
 try {
 await api.post("/business-case/observability/frontend-events", { events: batch });
 } catch (error) {
 logger.debug("[BC][OBS] Error enviando métricas frontend", {
 message: error?.message,
 dropped: batch.length,
 });
 } finally {
 flushing = false;
 if (queue.length) scheduleFlush();
 }
};

