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

async function altaDe(app: FastifyInstance, nombre: string): Promise<string> {
  const alta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre } });
  return alta.json<{ id: string }>().id;
}

async function equipoEnLista(app: FastifyInstance, id: string): Promise<unknown> {
  const lista = await app.inject({ method: "GET", url: "/api/equipos" });
  return lista.json<{ id: string }[]>().find((equipo) => equipo.id === id);
}

describe("POST /api/equipos/{id}/prestamo", () => {
  it("presta un equipo sin prestar y la lista lo muestra prestado", async () => {
    const { app } = await servidor();
    const id = await altaDe(app, "Portátil 07");
    const respuesta = await app.inject({
      method: "POST",
      url: `/api/equipos/${id}/prestamo`,
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    const esperado = { id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" };
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual(esperado);
    expect(await equipoEnLista(app, id)).toEqual(esperado);
  });

  it("acepta una fecha de devolución pasada", async () => {
    const { app } = await servidor();
    const id = await altaDe(app, "Proyector sala 2");
    const respuesta = await app.inject({
      method: "POST",
      url: `/api/equipos/${id}/prestamo`,
      payload: { persona: "Luis Gómez", devolucion: "2026-11-10" },
    });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json<{ devolucion: string }>().devolucion).toBe("2026-11-10");
  });

  it.each(["20/11/2026", "2026-02-30", "2026-13-01", "2026-1-5", "mañana"])(
    "responde 400 con la fecha %s y el equipo sigue sin prestar",
    async (devolucion) => {
      const { app } = await servidor();
      const id = await altaDe(app, "Portátil 07");
      const respuesta = await app.inject({
        method: "POST",
        url: `/api/equipos/${id}/prestamo`,
        payload: { persona: "Ana Pérez", devolucion },
      });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "La fecha de devolución no es válida" });
      expect(await equipoEnLista(app, id)).toEqual({ id, nombre: "Portátil 07", prestado: false });
    },
  );

  it.each([
    ["sin persona", { devolucion: "2026-11-20" }],
    ["sin devolución", { persona: "Ana Pérez" }],
    ["con la persona vacía", { persona: "  ", devolucion: "2026-11-20" }],
    ["sin cuerpo", undefined],
  ])("responde 400 %s y el equipo sigue sin prestar", async (_caso, payload) => {
    const { app } = await servidor();
    const id = await altaDe(app, "Portátil 07");
    const respuesta = await app.inject({ method: "POST", url: `/api/equipos/${id}/prestamo`, payload });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    expect(await equipoEnLista(app, id)).toEqual({ id, nombre: "Portátil 07", prestado: false });
  });

  it("responde 404 si el equipo no existe", async () => {
    const { app } = await servidor();
    const respuesta = await app.inject({
      method: "POST",
      url: "/api/equipos/no-existe/prestamo",
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
  });

  it("responde 409 si el equipo ya está prestado y el préstamo anterior no cambia", async () => {
    const { app } = await servidor();
    const id = await altaDe(app, "Portátil 07");
    await app.inject({ method: "POST", url: `/api/equipos/${id}/prestamo`, payload: { persona: "Ana Pérez", devolucion: "2026-11-20" } });
    const respuesta = await app.inject({
      method: "POST",
      url: `/api/equipos/${id}/prestamo`,
      payload: { persona: "Luis Gómez", devolucion: "2026-12-01" },
    });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo ya está prestado" });
    expect(await equipoEnLista(app, id)).toEqual({
      id,
      nombre: "Portátil 07",
      prestado: true,
      persona: "Ana Pérez",
      devolucion: "2026-11-20",
    });
  });
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
