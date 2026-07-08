import {
  enqueueOfflineMark,
  getQueuedMarks,
  getQueueSize,
  removeQueuedMark,
  clearOfflineQueue,
  flushOfflineQueue,
} from "../attendanceOfflineQueue";

describe("attendanceOfflineQueue", () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  test("enqueues a mark and persists it across reads", () => {
    enqueueOfflineMark({ endpoint: "/attendance/marcar/entrada", payload: { location: "-2.17,-79.9" } });
    expect(getQueueSize()).toBe(1);
    expect(getQueuedMarks()[0]).toMatchObject({
      endpoint: "/attendance/marcar/entrada",
      payload: { location: "-2.17,-79.9" },
    });
  });

  test("preserves insertion order (entry must flush before its exit)", () => {
    enqueueOfflineMark({ endpoint: "/attendance/marcar/entrada", payload: {} });
    enqueueOfflineMark({ endpoint: "/attendance/marcar/salida", payload: {} });
    const items = getQueuedMarks();
    expect(items.map((i) => i.endpoint)).toEqual([
      "/attendance/marcar/entrada",
      "/attendance/marcar/salida",
    ]);
  });

  test("removeQueuedMark removes only the targeted entry", () => {
    const first = enqueueOfflineMark({ endpoint: "/attendance/marcar/entrada", payload: {} });
    enqueueOfflineMark({ endpoint: "/attendance/marcar/salida", payload: {} });
    removeQueuedMark(first.id);
    expect(getQueueSize()).toBe(1);
    expect(getQueuedMarks()[0].endpoint).toBe("/attendance/marcar/salida");
  });

  test("flushOfflineQueue replays every entry in order and clears the queue on full success", async () => {
    enqueueOfflineMark({ endpoint: "/attendance/marcar/entrada", payload: { a: 1 } });
    enqueueOfflineMark({ endpoint: "/attendance/marcar/salida", payload: { b: 2 } });
    const calls = [];
    const post = jest.fn(async (endpoint, payload) => {
      calls.push([endpoint, payload]);
      return { ok: true };
    });

    const result = await flushOfflineQueue({ post });

    expect(calls).toEqual([
      ["/attendance/marcar/entrada", { a: 1 }],
      ["/attendance/marcar/salida", { b: 2 }],
    ]);
    expect(result.flushed).toHaveLength(2);
    expect(result.stillQueued).toBe(0);
    expect(getQueueSize()).toBe(0);
  });

  test("stops at the first network error and keeps remaining entries queued in order", async () => {
    enqueueOfflineMark({ endpoint: "/attendance/marcar/entrada", payload: {} });
    enqueueOfflineMark({ endpoint: "/attendance/marcar/salida", payload: {} });
    const networkError = new Error("Network Error"); // no .response => treated as connectivity failure
    const post = jest.fn().mockRejectedValueOnce(networkError);

    const result = await flushOfflineQueue({ post });

    expect(post).toHaveBeenCalledTimes(1);
    expect(result.flushed).toHaveLength(0);
    expect(result.stillQueued).toBe(2);
    expect(getQueuedMarks().map((i) => i.endpoint)).toEqual([
      "/attendance/marcar/entrada",
      "/attendance/marcar/salida",
    ]);
  });

  test("drops an entry that the server rejects (not a connectivity issue) and continues with the rest", async () => {
    enqueueOfflineMark({ endpoint: "/attendance/marcar/entrada", payload: {} });
    enqueueOfflineMark({ endpoint: "/attendance/marcar/salida", payload: {} });
    const serverError = new Error("Ya has marcado entrada hoy");
    serverError.response = { status: 400, data: { ok: false } };
    const post = jest.fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce({ ok: true });

    const result = await flushOfflineQueue({ post });

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.failed).toHaveLength(1);
    expect(result.flushed).toHaveLength(1);
    expect(getQueueSize()).toBe(0);
  });

  test("flushing an empty queue is a no-op", async () => {
    const post = jest.fn();
    const result = await flushOfflineQueue({ post });
    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({ flushed: [], failed: [], stillQueued: 0 });
  });
});
