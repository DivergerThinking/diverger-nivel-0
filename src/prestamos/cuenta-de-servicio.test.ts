import { beforeEach, describe, expect, it, vi } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import { crearServidor } from "../../app/server.js";
import { verificadorGoogle } from "../../lib/auth.js";
import { rutas as rutasDeEquipos } from "../equipos/index.js";
import { rutas } from "./index.js";

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
    return Promise.reject(new Error("Wrong recipient"));
  });
});

const SERVICIO = { authorization: "Bearer servicio" };

async function servidor() {
  return crearServidor({
    googleClientId: CLIENTE_DE_LA_APLICACION,
    verificarToken: verificadorGoogle(CLIENTE_DE_LA_APLICACION),
    almacen: almacenEnMemoria(),
    contextos: [rutasDeEquipos, rutas],
  });
}

async function darDeAlta(app: Awaited<ReturnType<typeof servidor>>, nombre: string): Promise<string> {
  const r = await app.inject({ method: "POST", url: "/api/equipos", headers: SERVICIO, payload: { nombre } });
  return r.json<{ id: string }>().id;
}

describe("la API de préstamos con el token de una cuenta de servicio de Google", () => {
  it("GET /api/equipos responde 200 con «Portátil 07» sin prestar", async () => {
    const app = await servidor();
    const id = await darDeAlta(app, "Portátil 07");
    const r = await app.inject({ method: "GET", url: "/api/equipos", headers: SERVICIO });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([{ id, nombre: "Portátil 07", prestado: false }]);
  });

  it("POST /api/equipos/{id}/prestamo responde 201 con el equipo prestado", async () => {
    const app = await servidor();
    const id = await darDeAlta(app, "Portátil 07");
    const r = await app.inject({
      method: "POST",
      url: `/api/equipos/${id}/prestamo`,
      headers: SERVICIO,
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({ id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
  });

  it("POST /api/equipos/{id}/devolucion responde 200 con prestado: false", async () => {
    const app = await servidor();
    const id = await darDeAlta(app, "Portátil 07");
    await app.inject({
      method: "POST",
      url: `/api/equipos/${id}/prestamo`,
      headers: SERVICIO,
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    const r = await app.inject({ method: "POST", url: `/api/equipos/${id}/devolucion`, headers: SERVICIO });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ id, nombre: "Portátil 07", prestado: false });
  });

  it("responde 401 en las tres rutas si el token se emitió para otro cliente OAuth, sin ningún equipo", async () => {
    const app = await servidor();
    const id = await darDeAlta(app, "Portátil 07");
    const otro = { authorization: "Bearer de-otro-cliente" };
    const respuestas = await Promise.all([
      app.inject({ method: "GET", url: "/api/equipos", headers: otro }),
      app.inject({
        method: "POST",
        url: `/api/equipos/${id}/prestamo`,
        headers: otro,
        payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
      }),
      app.inject({ method: "POST", url: `/api/equipos/${id}/devolucion`, headers: otro }),
    ]);
    for (const r of respuestas) {
      expect(r.statusCode).toBe(401);
      expect(r.json()).toEqual({ error: "Inicia sesión con Google." });
    }
    // Sigue sin prestar: el rechazo no cambió nada.
    const lista = await app.inject({ method: "GET", url: "/api/equipos", headers: SERVICIO });
    expect(lista.json()).toEqual([{ id, nombre: "Portátil 07", prestado: false }]);
  });
});
