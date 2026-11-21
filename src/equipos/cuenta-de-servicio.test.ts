import { beforeEach, describe, expect, it, vi } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import { crearServidor } from "../../app/server.js";
import { verificadorGoogle } from "../../lib/auth.js";
import { listarEquipos, rutas } from "./index.js";

const CLIENTE_DE_LA_APLICACION = "cliente-de-la-aplicacion";
const CUENTA_DE_SERVICIO = "inventario@proyecto.iam.gserviceaccount.com";

// Simula a Google: el token de la cuenta de servicio solo vale para el cliente de la aplicación,
// y no trae `name`, como los de las cuentas de servicio.
const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

beforeEach(() => {
  verifyIdToken.mockReset();
  verifyIdToken.mockImplementation(({ idToken, audience }: { idToken: string; audience: string }) => {
    if (idToken === "servicio" && audience === CLIENTE_DE_LA_APLICACION) {
      return Promise.resolve({ getPayload: () => ({ email: CUENTA_DE_SERVICIO, email_verified: true }) });
    }
    if (idToken === "sin-verificar") {
      return Promise.resolve({ getPayload: () => ({ email: CUENTA_DE_SERVICIO, email_verified: false }) });
    }
    return Promise.reject(new Error("Wrong recipient"));
  });
});

async function servidor() {
  const almacen = almacenEnMemoria();
  const app = await crearServidor({
    googleClientId: CLIENTE_DE_LA_APLICACION,
    verificarToken: verificadorGoogle(CLIENTE_DE_LA_APLICACION),
    almacen,
    contextos: [rutas],
  });
  return { app, almacen };
}

describe("POST /api/equipos con el token de una cuenta de servicio de Google", () => {
  it("da de alta «Portátil 08» sin prestar", async () => {
    const { app, almacen } = await servidor();
    const r = await app.inject({
      method: "POST",
      url: "/api/equipos",
      headers: { authorization: "Bearer servicio" },
      payload: { nombre: "Portátil 08" },
    });
    expect(r.statusCode).toBe(201);
    const cuerpo = r.json<{ id: string; nombre: string; prestado: boolean }>();
    expect(cuerpo).toEqual({ id: expect.any(String) as string, nombre: "Portátil 08", prestado: false });
    expect(await listarEquipos(almacen)).toEqual([{ id: cuerpo.id, nombre: "Portátil 08" }]);
  });

  it("responde 401 si el token se emitió para otro cliente OAuth y no guarda nada", async () => {
    const { app, almacen } = await servidor();
    const r = await app.inject({
      method: "POST",
      url: "/api/equipos",
      headers: { authorization: "Bearer de-otro-cliente" },
      payload: { nombre: "Portátil 08" },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ error: "Inicia sesión con Google." });
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("responde 401 si el correo de la cuenta no está verificado", async () => {
    const { app, almacen } = await servidor();
    const r = await app.inject({
      method: "POST",
      url: "/api/equipos",
      headers: { authorization: "Bearer sin-verificar" },
      payload: { nombre: "Portátil 08" },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ error: "Inicia sesión con Google." });
    expect(await listarEquipos(almacen)).toEqual([]);
  });
});
