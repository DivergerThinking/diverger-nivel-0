import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import { listarEquipos, obtenerEquipo, rutas } from "./index.js";

// La sesión la comprueba el servidor (app/server.ts) antes de llegar a las rutas del contexto.
async function servidor() {
  const almacen = almacenEnMemoria();
  const app = Fastify();
  app.decorateRequest("persona", null);
  await app.register(rutas, { almacen });
  const alta = (cuerpo?: unknown) =>
    app.inject({ method: "POST", url: "/api/equipos", ...(cuerpo !== undefined ? { payload: cuerpo as object } : {}) });
  return { almacen, alta };
}

describe("POST /api/equipos", () => {
  it("da de alta un equipo y responde 201 con id, nombre y prestado false", async () => {
    const { almacen, alta } = await servidor();
    const respuesta = await alta({ nombre: "Proyector sala 2" });
    expect(respuesta.statusCode).toBe(201);
    const cuerpo = respuesta.json<{ id: string; nombre: string; prestado: boolean }>();
    expect(cuerpo).toEqual({ id: expect.any(String) as string, nombre: "Proyector sala 2", prestado: false });
    expect(await listarEquipos(almacen)).toEqual([{ id: cuerpo.id, nombre: "Proyector sala 2" }]);
  });

  it("responde 400 «Falta el nombre del equipo» sin nombre y no guarda nada", async () => {
    const { almacen, alta } = await servidor();
    const respuesta = await alta({});
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("responde 400 con el nombre vacío o solo con espacios y sin cuerpo", async () => {
    const { almacen, alta } = await servidor();
    for (const cuerpo of [{ nombre: "" }, { nombre: "   " }, { nombre: 7 }, undefined]) {
      const respuesta = await alta(cuerpo);
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    }
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("responde 409 «Ya hay un equipo con ese nombre» aunque cambien mayúsculas o espacios", async () => {
    const { almacen, alta } = await servidor();
    await alta({ nombre: "Portátil 07" });
    const respuesta = await alta({ nombre: " PORTÁTIL 07 " });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });

  it("admite otro nombre junto al existente", async () => {
    const { almacen, alta } = await servidor();
    await alta({ nombre: "Portátil 07" });
    expect((await alta({ nombre: "Portátil 08" })).statusCode).toBe(201);
    expect((await listarEquipos(almacen)).map((e) => e.nombre).sort()).toEqual(["Portátil 07", "Portátil 08"]);
  });

  it("dos altas a la vez con el mismo nombre dejan un solo equipo", async () => {
    const { almacen, alta } = await servidor();
    const respuestas = await Promise.all([alta({ nombre: "Portátil 07" }), alta({ nombre: "portátil 07" })]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });

});

describe("lectura para otros contextos", () => {
  it("obtenerEquipo devuelve el equipo por su id y undefined si no existe", async () => {
    const { almacen, alta } = await servidor();
    const { id } = (await alta({ nombre: "Portátil 07" })).json<{ id: string }>();
    expect(await obtenerEquipo(almacen, id)).toEqual({ id, nombre: "Portátil 07" });
    expect(await obtenerEquipo(almacen, "no-existe")).toBeUndefined();
  });
});
