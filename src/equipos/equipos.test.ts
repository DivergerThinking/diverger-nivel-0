import { afterEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { almacenEnMemoria } from "../../lib/datos.js";
import { listarEquipos, obtenerEquipo, rutas } from "./index.js";

let app: FastifyInstance | undefined;

async function servidor(almacen = almacenEnMemoria()) {
  app = Fastify();
  await app.register(rutas, { almacen });
  return { app, almacen };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /api/equipos", () => {
  it("da de alta un equipo no prestado con el nombre tal como llega", async () => {
    const { app, almacen } = await servidor();
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 07" } });
    expect(respuesta.statusCode).toBe(201);
    const cuerpo = respuesta.json<{ id: string; nombre: string; prestado: boolean }>();
    expect(cuerpo.id).not.toBe("");
    expect({ nombre: cuerpo.nombre, prestado: cuerpo.prestado }).toEqual({ nombre: "Portátil 07", prestado: false });
    expect(await listarEquipos(almacen)).toEqual([{ id: cuerpo.id, nombre: "Portátil 07" }]);
  });

  it.each([[{ nombre: "" }], [{ nombre: "   " }], [{}], [{ nombre: 7 }]])("rechaza %j con 400", async (payload) => {
    const { app, almacen } = await servidor();
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", payload });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("rechaza con 409 un nombre repetido sin distinguir mayúsculas ni espacios", async () => {
    const { app, almacen } = await servidor();
    await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 07" } });
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: " portátil 07 " } });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });

  it("solo da de alta uno con dos altas a la vez del mismo nombre", async () => {
    const { app, almacen } = await servidor();
    const altas = await Promise.all(
      ["Proyector", "PROYECTOR "].map((nombre) => app.inject({ method: "POST", url: "/api/equipos", payload: { nombre } })),
    );
    expect(altas.map((a) => a.statusCode).sort()).toEqual([201, 409]);
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });
});

describe("lectura para otros contextos", () => {
  it("obtenerEquipo devuelve el equipo o undefined si no existe", async () => {
    const { app, almacen } = await servidor();
    const alta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Proyector sala 2" } });
    const { id } = alta.json<{ id: string }>();
    expect(await obtenerEquipo(almacen, id)).toEqual({ id, nombre: "Proyector sala 2" });
    expect(await obtenerEquipo(almacen, "no-existe")).toBeUndefined();
  });

  it("listarEquipos devuelve todos los equipos", async () => {
    const { app, almacen } = await servidor();
    for (const nombre of ["A", "B"]) await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre } });
    expect((await listarEquipos(almacen)).map((e) => e.nombre).sort()).toEqual(["A", "B"]);
  });
});
