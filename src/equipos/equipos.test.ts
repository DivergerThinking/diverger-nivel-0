import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import Fastify from "fastify";
import { listarEquipos, obtenerEquipo, rutas } from "./index.js";

async function servidor() {
  const almacen = almacenEnMemoria();
  const app = Fastify();
  await app.register(rutas, { almacen });
  const alta = (cuerpo?: unknown) =>
    app.inject({ method: "POST", url: "/api/equipos", ...(cuerpo === undefined ? {} : { payload: cuerpo as object }) });
  return { almacen, alta };
}

describe("POST /api/equipos", () => {
  it("da de alta «Portátil 07» con 201, prestado: false e identificador, y aparece en la lista", async () => {
    const { almacen, alta } = await servidor();
    const respuesta = await alta({ nombre: "Portátil 07" });
    expect(respuesta.statusCode).toBe(201);
    const equipo = respuesta.json<{ id: string; nombre: string; prestado: boolean }>();
    expect(equipo).toEqual({ id: expect.any(String) as string, nombre: "Portátil 07", prestado: false });
    expect(equipo.id).not.toBe("");
    expect(await listarEquipos(almacen)).toEqual([{ id: equipo.id, nombre: "Portátil 07" }]);
    expect(await obtenerEquipo(almacen, equipo.id)).toEqual({ id: equipo.id, nombre: "Portátil 07" });
  });

  it("guarda el nombre sin espacios al principio ni al final", async () => {
    const { alta } = await servidor();
    const respuesta = await alta({ nombre: "  Proyector sala 2 " });
    expect(respuesta.json<{ nombre: string }>().nombre).toBe("Proyector sala 2");
  });

  it("con el nombre vacío responde 400 «Falta el nombre del equipo» y no crea ningún equipo", async () => {
    const { almacen, alta } = await servidor();
    for (const nombre of ["", "   "]) {
      const respuesta = await alta({ nombre });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    }
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("sin el campo nombre responde 400 «Falta el nombre del equipo» y no crea ningún equipo", async () => {
    const { almacen, alta } = await servidor();
    for (const cuerpo of [{}, undefined, { nombre: 7 }]) {
      const respuesta = await alta(cuerpo);
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    }
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("con un nombre repetido, en minúsculas y con espacios, responde 409 y la lista sigue con uno solo", async () => {
    const { almacen, alta } = await servidor();
    await alta({ nombre: "Portátil 07" });
    const respuesta = await alta({ nombre: " portátil 07 " });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    const equipos = await listarEquipos(almacen);
    expect(equipos).toHaveLength(1);
    expect(equipos[0]?.nombre).toBe("Portátil 07");
  });

  it("dos altas a la vez con el mismo nombre crean un solo equipo", async () => {
    const { almacen, alta } = await servidor();
    const respuestas = await Promise.all([alta({ nombre: "Monitor" }), alta({ nombre: "MONITOR" })]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });

});

describe("lecturas para otros contextos", () => {
  it("obtenerEquipo devuelve undefined si el equipo no existe", async () => {
    const { almacen } = await servidor();
    expect(await obtenerEquipo(almacen, "zzz-999")).toBeUndefined();
  });
});
