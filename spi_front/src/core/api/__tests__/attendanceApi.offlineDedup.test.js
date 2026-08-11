// Regresion: cuando una marca ya quedo encolada offline por falta de
// conexion, un segundo toque del mismo boton (posible porque la UI no
// siempre refleja de inmediato que la primera marca se guardo) no debe
// generar una segunda entrada en la cola ni un segundo intento de red --
// eso es lo que causaba marcaciones duplicadas una vez que volvia la senal.
jest.mock("../index", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import api from "../index";
import { marcarEntrada } from "../attendanceApi";
import { clearOfflineQueue, getQueueSize } from "../../../shared/utils/attendanceOfflineQueue";

describe("attendanceApi — dedup de marcas offline", () => {
  beforeEach(() => {
    clearOfflineQueue();
    api.post.mockReset();
  });

  test("primer toque sin internet encola la marca", async () => {
    api.post.mockRejectedValueOnce(new Error("Network Error"));

    const res = await marcarEntrada({ latitude: -2.9, longitude: -79.0 });

    expect(res.queued).toBe(true);
    expect(res.alreadyQueued).toBeUndefined();
    expect(getQueueSize()).toBe(1);
  });

  test("segundo toque del mismo boton no vuelve a llamar a la red ni duplica la cola", async () => {
    api.post.mockRejectedValueOnce(new Error("Network Error"));
    await marcarEntrada({ latitude: -2.9, longitude: -79.0 });

    api.post.mockClear();
    const res = await marcarEntrada({ latitude: -2.9, longitude: -79.0 });

    expect(api.post).not.toHaveBeenCalled();
    expect(res.queued).toBe(true);
    expect(res.alreadyQueued).toBe(true);
    expect(getQueueSize()).toBe(1);
  });

  test("pasa un timeout al POST de marcacion (conexion mala no debe colgarse indefinidamente)", async () => {
    api.post.mockResolvedValueOnce({ data: { ok: true } });

    await marcarEntrada({ latitude: -2.9, longitude: -79.0 });

    expect(api.post).toHaveBeenCalledWith(
      "/attendance/marcar/entrada",
      expect.any(Object),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  test("conexion mala (timeout, sin err.response) se encola igual que sin internet", async () => {
    const timeoutErr = new Error("timeout of 10000ms exceeded");
    timeoutErr.code = "ECONNABORTED";
    api.post.mockRejectedValueOnce(timeoutErr);

    const res = await marcarEntrada({ latitude: -2.9, longitude: -79.0 });

    expect(res.queued).toBe(true);
    expect(getQueueSize()).toBe(1);
  });
});
