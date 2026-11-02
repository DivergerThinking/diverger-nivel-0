import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import { crearServidor } from "../../app/server.js";
import { rutas } from "./index.js";

const TECNICO = { email: "tecnico@empresa.example", nombre: "Técnico" };
const verificarToken = (token: string) => Promise.resolve(token === "token-bueno" ? TECNICO : null);
const headers = { authorization: "Bearer token-bueno" };

async function servidor(almacen = almacenEnMemoria()) {
  return crearServidor({ googleClientId: "cliente", verificarToken, almacen, contextos: [rutas] });
}

describe("GET /api/equipos", () => {
  it("con sesión iniciada devuelve 200 y la lista vacía si no hay equipos", async () => {
    const app = await servidor();
    const respuesta = await app.inject({ url: "/api/equipos", headers });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
    await app.close();
  });

  it("lista los equipos libres sin persona ni devolucion y los prestados con las dos", async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardar("equipos_equipos", "a", {
      id: "a", nombre: "Portátil 07", nombreNormalizado: "portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20",
    });
    await almacen.guardar("equipos_equipos", "b", {
      id: "b", nombre: "Proyector sala 2", nombreNormalizado: "proyector sala 2", prestado: false,
    });
    const app = await servidor(almacen);
    const lista = (await app.inject({ url: "/api/equipos", headers })).json<{ id: string }[]>();
    expect(lista).toHaveLength(2);
    expect(lista).toContainEqual({ id: "a", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(lista).toContainEqual({ id: "b", nombre: "Proyector sala 2", prestado: false });
    await app.close();
  });

  it("sin token responde 401 «Inicia sesión con Google.»", async () => {
    const app = await servidor();
    const respuesta = await app.inject("/api/equipos");
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
    await app.close();
  });

  it("con un token no válido (otro cliente o correo sin verificar) responde 401", async () => {
    const app = await servidor();
    const respuesta = await app.inject({ url: "/api/equipos", headers: { authorization: "Bearer token-malo" } });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
    await app.close();
  });

  it("POST /api/equipos sin token responde 401 y no crea ningún equipo", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 07" } });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
    expect(await almacen.listar("equipos_equipos")).toEqual([]);
    await app.close();
  });
});
