const EventEmitter = require("events");
const logger = require("../../config/logger");

class WorldCupEventEmitter extends EventEmitter {}

const worldCupEventEmitter = new WorldCupEventEmitter();
worldCupEventEmitter.setMaxListeners(0);

function broadcastWorldCupBoardRefresh(meta = {}) {
  worldCupEventEmitter.emit("world-cup-board-refresh", {
    timestamp: new Date().toISOString(),
    meta,
  });
}

function streamWorldCupBoard(req, res, getSnapshot) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.write("retry: 10000\n");
  res.write("event: connected\n");
  res.write("data: {}\n\n");

  const sendSnapshot = async () => {
    try {
      const payload = await getSnapshot();
      res.write("event: board-snapshot\n");
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      logger.warn({ err: error }, "No se pudo enviar snapshot SSE de Mundial 2026");
    }
  };

  void sendSnapshot();

  const refreshHandler = () => {
    void sendSnapshot();
  };

  worldCupEventEmitter.on("world-cup-board-refresh", refreshHandler);

  const heartbeat = setInterval(() => {
    res.write(":\n\n");
  }, 25000);

  const pollingRefresh = setInterval(() => {
    void sendSnapshot();
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(pollingRefresh);
    worldCupEventEmitter.removeListener("world-cup-board-refresh", refreshHandler);
    try {
      res.end();
    } catch (error) {
      logger.warn({ err: error }, "Error cerrando SSE de Mundial 2026");
    }
  });
}

module.exports = {
  broadcastWorldCupBoardRefresh,
  streamWorldCupBoard,
};
