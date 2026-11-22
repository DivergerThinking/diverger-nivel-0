import { afterEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { almacenEnMemoria } from "../../lib/datos.js";
import { rutas as rutasDeEquipos } from "../equipos/index.js";
import { rutas } from "./index.js";

let app: FastifyInstance | undefined;

async function servidor() {
  const almacen = almacenEnMemoria();
  app = Fastify();
  await app.register(rutasDeEquipos, { almacen });
  await app.register(rutas, { almacen });
  return { app, almacen };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /api/equipos", () => {
  it("responde 200 con una lista vacía si no hay equipos", async () => {
    const { app } = await servidor();
    const respuesta = await app.inject({ method: "GET", url: "/api/equipos" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
  });

  it("enseña los equipos sin prestar solo con id, nombre y prestado: false", async () => {
    const { app } = await servidor();
    const alta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Proyector sala 2" } });
    const { id } = alta.json<{ id: string }>();
    const respuesta = await app.inject({ method: "GET", url: "/api/equipos" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([{ id, nombre: "Proyector sala 2", prestado: false }]);
  });

  it("enseña la persona y la devolución de los equipos prestados", async () => {
    const { app, almacen } = await servidor();
    const alta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 07" } });
    const { id } = alta.json<{ id: string }>();
    await almacen.transaccion((tx) => {
      tx.guardar("prestamos_activos", id, { equipoId: id, persona: "Ana Pérez", devolucion: "2026-11-20" });
      return Promise.resolve();
    });
    const respuesta = await app.inject({ method: "GET", url: "/api/equipos" });
    expect(respuesta.json()).toEqual([
      { id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
    ]);
  });
});
