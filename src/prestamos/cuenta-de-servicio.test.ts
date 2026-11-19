// HU-ACC-02: el inventario de IT usa las cuatro operaciones del anexo con el token de su cuenta de servicio.
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
}

// Una cuenta de servicio no tiene nombre: su token solo trae el correo.
const TOKENS: Record<string, Datos> = {
  "token-de-servicio": {
    aud: CLIENTE_DE_LA_APLICACION,
    email: "inventario@proyecto.iam.gserviceaccount.com",
    email_verified: true,
  },
  "token-de-servicio-sin-verificar": {
    aud: CLIENTE_DE_LA_APLICACION,
    email: "inventario@proyecto.iam.gserviceaccount.com",
    email_verified: false,
  },
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
  app = await crearServidor({
    googleClientId: CLIENTE_DE_LA_APLICACION,
    verificarToken: verificadorGoogle(CLIENTE_DE_LA_APLICACION),
    almacen: almacenEnMemoria(),
    contextos: [rutasEquipos, rutas],
  });
  const llamar = (token: string, method: "GET" | "POST", url: string, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
  return { llamar };
}

describe("el inventario de IT con el token de su cuenta de servicio", () => {
  it("da de alta, presta, lista y devuelve un equipo con los códigos y campos del anexo", async () => {
    const { llamar } = await servidor();
    const token = "token-de-servicio";

    const alta = await llamar(token, "POST", "/api/equipos", { nombre: "Portátil 07" });
    expect(alta.statusCode).toBe(201);
    const { id } = alta.json<{ id: string }>();
    expect(alta.json()).toEqual({ id, nombre: "Portátil 07", prestado: false });

    const prestamo = await llamar(token, "POST", `/api/equipos/${id}/prestamo`, {
      persona: "Ana Pérez",
      devolucion: "2026-11-20",
    });
    const prestado = { id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" };
    expect(prestamo.statusCode).toBe(201);
    expect(prestamo.json()).toEqual(prestado);

    const lista = await llamar(token, "GET", "/api/equipos");
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toEqual([prestado]);

    const devolucion = await llamar(token, "POST", `/api/equipos/${id}/devolucion`);
    expect(devolucion.statusCode).toBe(200);
    expect(devolucion.json()).toEqual({ id, nombre: "Portátil 07", prestado: false });
  });

  it("ve en la lista el equipo «Portátil 07»", async () => {
    const { llamar } = await servidor();
    await llamar("token-de-servicio", "POST", "/api/equipos", { nombre: "Portátil 07" });
    const lista = await llamar("token-de-servicio", "GET", "/api/equipos");
    expect(lista.statusCode).toBe(200);
    expect(lista.json<{ nombre: string }[]>().map((equipo) => equipo.nombre)).toContain("Portátil 07");
  });

  it("con el correo sin verificar recibe 401 «Inicia sesión con Google.» y ningún equipo", async () => {
    const { llamar } = await servidor();
    await llamar("token-de-servicio", "POST", "/api/equipos", { nombre: "Portátil 07" });
    const respuesta = await llamar("token-de-servicio-sin-verificar", "GET", "/api/equipos");
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
  });

  it("devolver un equipo que no existe responde 404 con un objeto cuyo único campo es error", async () => {
    const { llamar } = await servidor();
    const respuesta = await llamar("token-de-servicio", "POST", "/api/equipos/no-existe/devolucion");
    expect(respuesta.statusCode).toBe(404);
    expect(Object.keys(respuesta.json<object>())).toEqual(["error"]);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
  });

  it.each([
    ["alta sin nombre", "POST", "/api/equipos", {}, 400, "Falta el nombre del equipo"],
    [
      "préstamo sin persona",
      "POST",
      "/api/equipos/no-existe/prestamo",
      { devolucion: "2026-11-20" },
      400,
      "Faltan la persona o la fecha de devolución",
    ],
    [
      "préstamo de un equipo que no existe",
      "POST",
      "/api/equipos/no-existe/prestamo",
      { persona: "Ana Pérez", devolucion: "2026-11-20" },
      404,
      "No existe el equipo",
    ],
  ] as const)("el error de %s es un objeto JSON {error} con el mensaje exacto", async (_caso, metodo, url, cuerpo, codigo, mensaje) => {
    const { llamar } = await servidor();
    const respuesta = await llamar("token-de-servicio", metodo, url, cuerpo);
    expect(respuesta.statusCode).toBe(codigo);
    expect(respuesta.json()).toEqual({ error: mensaje });
  });
});
