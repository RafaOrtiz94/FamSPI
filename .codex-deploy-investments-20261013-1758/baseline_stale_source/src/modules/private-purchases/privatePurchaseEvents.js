const EventEmitter = require("events");
const logger = require("../../config/logger");

class PrivatePurchaseEventEmitter extends EventEmitter {}

const privatePurchaseEventEmitter = new PrivatePurchaseEventEmitter();
privatePurchaseEventEmitter.setMaxListeners(0);

const buildPayload = ({ request, action = "updated", user, meta = {} } = {}) => {
  if (!request || !request.id) return null;
  return {
    action,
    request,
    meta,
    source: "private_purchases",
    timestamp: new Date().toISOString(),
    user: {
      id: user?.id || null,
      email: user?.email || null,
      role: user?.role || null,
    },
  };
};

const broadcastPrivatePurchaseUpdate = ({ request, action, user, meta } = {}) => {
  const payload = buildPayload({ request, action, user, meta });
  if (!payload) return;
  privatePurchaseEventEmitter.emit("private-purchase-update", payload);
};

const streamPrivatePurchaseUpdates = (_req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.write("retry: 10000\n");
  res.write("event: connected\n");
  res.write("data: {}\n\n");

  const sendEvent = (payload) => {
    try {
      res.write(`event: private-purchase-update\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      logger.warn("No se pudo enviar evento SSE (private purchases):", error);
    }
  };

  const handler = (payload) => sendEvent(payload);
  privatePurchaseEventEmitter.on("private-purchase-update", handler);

  const heartbeat = setInterval(() => {
    res.write(":\n\n");
  }, 25000);

  res.on("close", () => {
    clearInterval(heartbeat);
    privatePurchaseEventEmitter.removeListener("private-purchase-update", handler);
    try {
      res.end();
    } catch (error) {
      logger.warn("Error cerrando stream de eventos privados:", error);
    }
  });
};

module.exports = {
  privatePurchaseEventEmitter,
  broadcastPrivatePurchaseUpdate,
  streamPrivatePurchaseUpdates,
};
