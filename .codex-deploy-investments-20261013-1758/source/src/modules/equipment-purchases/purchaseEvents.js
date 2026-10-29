const EventEmitter = require("events");
const logger = require("../../config/logger");

class PurchaseEventEmitter extends EventEmitter {}

const purchaseEventEmitter = new PurchaseEventEmitter();
purchaseEventEmitter.setMaxListeners(0);

const buildPayload = ({ request, action = "updated", user, meta = {} } = {}) => {
  if (!request || !request.id) return null;
  return {
    action,
    request,
    meta,
    source: "equipment_purchases",
    timestamp: new Date().toISOString(),
    user: {
      id: user?.id || null,
      email: user?.email || null,
      role: user?.role || null,
    },
  };
};

const broadcastPurchaseUpdate = ({ request, action, user, meta } = {}) => {
  const payload = buildPayload({ request, action, user, meta });
  if (!payload) return;
  purchaseEventEmitter.emit("purchase-update", payload);
};

const streamPurchaseUpdates = (req, res) => {
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
      res.write(`event: purchase-update\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      logger.warn("No se pudo enviar evento SSE:", error);
    }
  };

  const handler = (payload) => sendEvent(payload);
  purchaseEventEmitter.on("purchase-update", handler);

  const heartbeat = setInterval(() => {
    res.write(":\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    purchaseEventEmitter.removeListener("purchase-update", handler);
    try {
      res.end();
    } catch (error) {
      logger.warn("Error cerrando stream de eventos:", error);
    }
  });
};

module.exports = {
  purchaseEventEmitter,
  broadcastPurchaseUpdate,
  streamPurchaseUpdates,
};
