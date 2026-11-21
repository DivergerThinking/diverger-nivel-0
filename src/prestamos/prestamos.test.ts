import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { almacenEnMemoria } from "../../lib/datos.js";
import { rutas as rutasEquipos } from "../equipos/index.js";
import { rutas } from "./index.js";

// El 401 de los tokens (cliente OAuth distinto, correo sin verificar, caducado) lo da el servidor para todas las
// rutas de /api (app/server.test.ts); aquí solo las rutas del contexto, con el almacén que recibe del servidor.
async function servidor() {
  const almacen = almacenEnMemoria();
  const app = Fastify();
  await app.register(rutasEquipos, { almacen });
  await app.register(rutas, { almacen });
  return { app, almacen };
}

describe("prestar un equipo", () => {
  async function conPortatil() {
    const contexto = await servidor();
    const id = (await contexto.app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 07" } })).json<{ id: string }>().id;
    const prestar = (payload: unknown, equipo = id) =>
      contexto.app.inject({ method: "POST", url: `/api/equipos/${equipo}/prestamo`, payload: payload as object });
    const lista = async () => (await contexto.app.inject({ method: "GET", url: "/api/equipos" })).json<object[]>();
    return { id, prestar, lista };
  }

  it("responde 201 con el equipo prestado y la lista lo muestra", async () => {
    const { id, prestar, lista } = await conPortatil();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-12-04" });
    expect(respuesta.statusCode).toBe(201);
    const esperado = { id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-12-04" };
    expect(respuesta.json()).toEqual(esperado);
    expect(await lista()).toEqual([esperado]);
  });

  it("acepta una fecha pasada", async () => {
    const { prestar } = await conPortatil();
    expect((await prestar({ persona: "Ana Pérez", devolucion: "2020-01-31" })).statusCode).toBe(201);
  });

  it("acepta la fecha pasada «2026-11-20», la devuelve igual y la lista la muestra", async () => {
    const { id, prestar, lista } = await conPortatil();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(respuesta.statusCode).toBe(201);
    const esperado = { id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" };
    expect(respuesta.json()).toEqual(esperado);
    expect(await lista()).toEqual([esperado]);
  });

  it("responde 400 con la fecha «20/11/2026» en otro formato", async () => {
    const { prestar, lista } = await conPortatil();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "20/11/2026" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "La fecha de devolución no es válida" });
    expect(await lista()).toEqual([expect.objectContaining({ prestado: false })]);
  });

  it.each([
    ["la persona vacía", { persona: "", devolucion: "2026-12-04" }],
    ["la persona con solo espacios", { persona: "  ", devolucion: "2026-12-04" }],
    ["sin persona", { devolucion: "2026-12-04" }],
    ["sin fecha", { persona: "Ana Pérez" }],
    ["la fecha vacía", { persona: "Ana Pérez", devolucion: "" }],
  ])("responde 400 con %s y el equipo sigue sin prestar", async (_caso, cuerpo) => {
    const { id, prestar, lista } = await conPortatil();
    const respuesta = await prestar(cuerpo);
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    expect(await lista()).toEqual([{ id, nombre: "Portátil 07", prestado: false }]);
  });

  it.each(["2026-02-30", "04-12-2026", "2026-13-01", "mañana", "2026-12-4"])("responde 400 con la fecha %s", async (devolucion) => {
    const { prestar, lista } = await conPortatil();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "La fecha de devolución no es válida" });
    expect(await lista()).toEqual([expect.objectContaining({ prestado: false })]);
  });

  it("responde 409 si el equipo ya está prestado y conserva el préstamo", async () => {
    const { id, prestar, lista } = await conPortatil();
    await prestar({ persona: "Ana Pérez", devolucion: "2026-12-04" });
    const respuesta = await prestar({ persona: "Luis Gómez", devolucion: "2026-12-11" });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo ya está prestado" });
    expect(await lista()).toEqual([{ id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-12-04" }]);
  });

  it("con dos peticiones a la vez solo una presta el equipo", async () => {
    const { prestar } = await conPortatil();
    const respuestas = await Promise.all([
      prestar({ persona: "Ana Pérez", devolucion: "2026-12-04" }),
      prestar({ persona: "Luis Gómez", devolucion: "2026-12-11" }),
    ]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });

  it("responde 404 si el equipo no existe", async () => {
    const { prestar } = await conPortatil();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-12-04" }, "no-existe");
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
  });
});

describe("apuntar la devolución", () => {
  async function conEquipos() {
    const { app } = await servidor();
    const alta = async (nombre: string) =>
      (await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre } })).json<{ id: string }>().id;
    const portatil = await alta("Portátil 07");
    const proyector = await alta("Proyector sala 2");
    await app.inject({ method: "POST", url: `/api/equipos/${portatil}/prestamo`, payload: { persona: "Ana Pérez", devolucion: "2026-12-04" } });
    const devolver = (id: string) => app.inject({ method: "POST", url: `/api/equipos/${id}/devolucion` });
    const lista = async () => (await app.inject({ method: "GET", url: "/api/equipos" })).json<object[]>();
    return { portatil, proyector, devolver, lista };
  }

  it("responde 200 con el equipo sin prestar y la lista lo muestra sin persona ni fecha", async () => {
    const { portatil, devolver, lista } = await conEquipos();
    const respuesta = await devolver(portatil);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ id: portatil, nombre: "Portátil 07", prestado: false });
    expect(await lista()).toContainEqual({ id: portatil, nombre: "Portátil 07", prestado: false });
  });

  it("el equipo devuelto se puede volver a prestar", async () => {
    const { app } = await servidor();
    const id = (await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 07" } })).json<{ id: string }>().id;
    const prestar = () =>
      app.inject({ method: "POST", url: `/api/equipos/${id}/prestamo`, payload: { persona: "Ana Pérez", devolucion: "2026-12-04" } });
    await prestar();
    await app.inject({ method: "POST", url: `/api/equipos/${id}/devolucion` });
    expect((await prestar()).statusCode).toBe(201);
  });

  it("responde 409 si el equipo no está prestado y sigue sin prestar", async () => {
    const { proyector, devolver, lista } = await conEquipos();
    const respuesta = await devolver(proyector);
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo no está prestado" });
    expect(await lista()).toContainEqual({ id: proyector, nombre: "Proyector sala 2", prestado: false });
  });

  it("responde 409 si se devuelve dos veces", async () => {
    const { portatil, devolver } = await conEquipos();
    await devolver(portatil);
    const respuesta = await devolver(portatil);
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo no está prestado" });
  });

  it("responde 404 si el equipo no existe", async () => {
    const { devolver } = await conEquipos();
    const respuesta = await devolver("no-existe");
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
  });
});

describe("lista de equipos", () => {
  it("responde 200 con una lista vacía si no hay equipos", async () => {
    const { app } = await servidor();
    const respuesta = await app.inject({ method: "GET", url: "/api/equipos" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
  });

  it("muestra el préstamo solo en los equipos prestados", async () => {
    const { app, almacen } = await servidor();
    const alta = async (nombre: string) =>
      (await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre } })).json<{ id: string }>().id;
    const portatil = await alta("Portátil 07");
    const proyector = await alta("Proyector sala 2");
    await almacen.guardar("prestamos_activos", portatil, { persona: "Ana Pérez", devolucion: "2026-11-20" });

    const respuesta = await app.inject({ method: "GET", url: "/api/equipos" });
    expect(respuesta.statusCode).toBe(200);
    const equipos = respuesta.json<object[]>();
    expect(equipos).toHaveLength(2);
    expect(equipos).toContainEqual({ id: portatil, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(equipos).toContainEqual({ id: proyector, nombre: "Proyector sala 2", prestado: false });
  });
});
