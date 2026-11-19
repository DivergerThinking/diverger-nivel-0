// HU-ACC-01: las rutas de «prestamos» solo responden con una sesión de Google válida.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { crearServidor } from "../../app/server.js";
import { almacenEnMemoria } from "../../lib/datos.js";
import { verificadorGoogle } from "../../lib/auth.js";
import { rutas as rutasEquipos } from "../equipos/index.js";
import { rutas } from "./index.js";

const CLIENTE_DE_LA_APLICACION = "cliente-de-la-aplicacion";

interface Datos {
  aud: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

// Google firma los tokens: aquí cada token es el nombre de unos datos ya «firmados», y se comprueba la audiencia como Google.
const TOKENS: Record<string, Datos> = {
  "token-de-it": { aud: CLIENTE_DE_LA_APLICACION, email: "it@empresa.example", email_verified: true, name: "IT" },
  "token-de-otro-cliente": { aud: "otro-cliente", email: "it@empresa.example", email_verified: true },
  "token-sin-verificar": { aud: CLIENTE_DE_LA_APLICACION, email: "it@empresa.example", email_verified: false },
};

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken({ idToken, audience }: { idToken: string; audience: string }) {
      const datos = TOKENS[idToken];
      if (!datos || datos.aud !== audience) return Promise.reject(new Error("Token no válido"));
      return Promise.resolve({ getPayload: () => datos });
    }
  },
}));

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

async function servidor() {
  const almacen = almacenEnMemoria();
  app = await crearServidor({
    googleClientId: CLIENTE_DE_LA_APLICACION,
    verificarToken: verificadorGoogle(CLIENTE_DE_LA_APLICACION),
    almacen,
    contextos: [rutasEquipos, rutas],
  });
  const conToken = (token: string) => ({ authorization: `Bearer ${token}` });
  const alta = async (nombre: string) =>
    (await app.inject({ method: "POST", url: "/api/equipos", headers: conToken("token-de-it"), payload: { nombre } }))
      .json<{ id: string }>().id;
  return { alta, conToken };
}

const SIN_SESION = { error: "Inicia sesión con Google." };

describe("acceso con la cuenta de Google de la empresa", () => {
  it("con un token válido de la cuenta de la empresa entra y ve la lista de equipos", async () => {
    const { alta, conToken } = await servidor();
    const id = await alta("Portátil 07");
    const respuesta = await app.inject({ url: "/api/equipos", headers: conToken("token-de-it") });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([{ id, nombre: "Portátil 07", prestado: false }]);
  });

  it("sin token responde 401 «Inicia sesión con Google.»", async () => {
    await servidor();
    const respuesta = await app.inject({ url: "/api/equipos" });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual(SIN_SESION);
  });

  it("con un token emitido para otro cliente OAuth responde 401 «Inicia sesión con Google.»", async () => {
    const { conToken } = await servidor();
    const respuesta = await app.inject({ url: "/api/equipos", headers: conToken("token-de-otro-cliente") });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual(SIN_SESION);
  });

  it("con el correo sin verificar responde 401 en el préstamo y el equipo sigue sin prestar", async () => {
    const { alta, conToken } = await servidor();
    const id = await alta("Portátil 07");
    const respuesta = await app.inject({
      method: "POST",
      url: `/api/equipos/${id}/prestamo`,
      headers: conToken("token-sin-verificar"),
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual(SIN_SESION);
    const lista = await app.inject({ url: "/api/equipos", headers: conToken("token-de-it") });
    expect(lista.json()).toEqual([{ id, nombre: "Portátil 07", prestado: false }]);
  });

  it("las rutas de préstamo y de devolución también piden sesión", async () => {
    await servidor();
    for (const url of ["/api/equipos/x/prestamo", "/api/equipos/x/devolucion"]) {
      const respuesta = await app.inject({ method: "POST", url });
      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.json()).toEqual(SIN_SESION);
    }
  });
});
