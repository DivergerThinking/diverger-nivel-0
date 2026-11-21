import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import Fastify from "fastify";
import { listarEquipos, obtenerEquipo, rutas } from "./index.js";

// El 401 sin token lo da el servidor para todas las rutas de /api (app/server.test.ts); aquí solo las rutas del contexto.
async function servidor() {
  const almacen = almacenEnMemoria();
  const app = Fastify();
  await app.register(rutas, { almacen });
  return { app, almacen };
}

const CON_TOKEN = {};

describe("alta de equipos", () => {
  it("da de alta un equipo sin prestar", async () => {
    const { app, almacen } = await servidor();
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", headers: CON_TOKEN, payload: { nombre: "Portátil 07" } });
    expect(respuesta.statusCode).toBe(201);
    const equipo = respuesta.json<{ id: string; nombre: string; prestado: boolean }>();
    expect(equipo.id).not.toBe("");
    expect({ nombre: equipo.nombre, prestado: equipo.prestado }).toEqual({ nombre: "Portátil 07", prestado: false });
    expect(await obtenerEquipo(almacen, equipo.id)).toEqual({ id: equipo.id, nombre: "Portátil 07" });
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });

  it.each([{ payload: {} }, { payload: { nombre: "" } }, { payload: { nombre: "   " } }, { payload: { nombre: 7 } }])(
    "responde 400 con $payload y no guarda nada",
    async ({ payload }) => {
      const { app, almacen } = await servidor();
      const respuesta = await app.inject({ method: "POST", url: "/api/equipos", headers: CON_TOKEN, payload });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
      expect(await listarEquipos(almacen)).toEqual([]);
    },
  );

  it("responde 409 con un nombre repetido sin distinguir mayúsculas ni espacios", async () => {
    const { app, almacen } = await servidor();
    await app.inject({ method: "POST", url: "/api/equipos", headers: CON_TOKEN, payload: { nombre: "Portátil 07" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", headers: CON_TOKEN, payload: { nombre: " portátil 07 " } });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });

  it("permite dos equipos con nombres distintos", async () => {
    const { app, almacen } = await servidor();
    await app.inject({ method: "POST", url: "/api/equipos", headers: CON_TOKEN, payload: { nombre: "Portátil 07" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", headers: CON_TOKEN, payload: { nombre: "Portátil 08" } });
    expect(respuesta.statusCode).toBe(201);
    expect((await listarEquipos(almacen)).map((e) => e.nombre).sort()).toEqual(["Portátil 07", "Portátil 08"]);
  });

  it("obtenerEquipo devuelve undefined si el equipo no existe", async () => {
    const { almacen } = await servidor();
    expect(await obtenerEquipo(almacen, "no-existe")).toBeUndefined();
  });
});
