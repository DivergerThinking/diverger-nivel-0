import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import type { Almacen } from "../../lib/datos.js";
import { crearServidor } from "../../app/server.js";
import { rutas as rutasDeEquipos } from "../equipos/index.js";
import { listarEquiposConPrestamo, rutas } from "./index.js";

async function servidor(almacen: Almacen = almacenEnMemoria()) {
  return crearServidor({
    googleClientId: "cliente",
    verificarToken: (token) =>
      Promise.resolve(token === "bueno" ? { email: "ana.perez@example.com", nombre: "Ana" } : null),
    almacen,
    contextos: [rutasDeEquipos, rutas],
  });
}

const AUTH = { authorization: "Bearer bueno" };

async function darDeAlta(app: Awaited<ReturnType<typeof servidor>>, nombre: string): Promise<string> {
  const r = await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre } });
  return r.json<{ id: string }>().id;
}

describe("GET /api/equipos", () => {
  it("lista los equipos con su préstamo solo en los prestados", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const portatil = await darDeAlta(app, "Portátil 07");
    const proyector = await darDeAlta(app, "Proyector sala 2");
    await almacen.guardar("prestamos_activos", portatil, { persona: "Ana Pérez", devolucion: "2026-11-20" });

    const r = await app.inject({ method: "GET", url: "/api/equipos", headers: AUTH });
    expect(r.statusCode).toBe(200);
    const cuerpo = r.json<{ id: string }[]>();
    expect(cuerpo).toHaveLength(2);
    expect(cuerpo).toContainEqual({
      id: portatil,
      nombre: "Portátil 07",
      prestado: true,
      persona: "Ana Pérez",
      devolucion: "2026-11-20",
    });
    expect(cuerpo).toContainEqual({ id: proyector, nombre: "Proyector sala 2", prestado: false });
  });

  it("responde 200 con una lista vacía si no hay equipos", async () => {
    const app = await servidor();
    const r = await app.inject({ method: "GET", url: "/api/equipos", headers: AUTH });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([]);
  });

  it("responde 401 sin token o con un token no válido, y sin equipos", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    await darDeAlta(app, "Portátil 07");
    const sinToken = await app.inject({ method: "GET", url: "/api/equipos" });
    expect(sinToken.statusCode).toBe(401);
    expect(sinToken.json()).toEqual({ error: "Inicia sesión con Google." });
    const malo = await app.inject({ method: "GET", url: "/api/equipos", headers: { authorization: "Bearer malo" } });
    expect(malo.statusCode).toBe(401);
    expect(malo.json()).toEqual({ error: "Inicia sesión con Google." });
  });
});

describe("POST /api/equipos/{id}/prestamo", () => {
  const prestar = (app: Awaited<ReturnType<typeof servidor>>, id: string, payload: object, headers = AUTH) =>
    app.inject({ method: "POST", url: `/api/equipos/${id}/prestamo`, headers, payload });

  it("apunta el préstamo y responde 201 con el equipo prestado", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const id = await darDeAlta(app, "Portátil 07");
    const r = await prestar(app, id, { persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({ id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
    const lista = await app.inject({ method: "GET", url: "/api/equipos", headers: AUTH });
    expect(lista.json()).toContainEqual({ id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
  });

  it("acepta una fecha pasada", async () => {
    const app = await servidor();
    const id = await darDeAlta(app, "Portátil 07");
    const r = await prestar(app, id, { persona: "Ana Pérez", devolucion: "2020-01-31" });
    expect(r.statusCode).toBe(201);
  });

  it("responde 400 sin persona o sin fecha y no presta el equipo", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const id = await darDeAlta(app, "Portátil 07");
    for (const payload of [{ devolucion: "2026-11-20" }, { persona: "Ana Pérez" }, { persona: "  ", devolucion: "2026-11-20" }, {}]) {
      const r = await prestar(app, id, payload);
      expect(r.statusCode).toBe(400);
      expect(r.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    }
    expect(await almacen.listar("prestamos_activos")).toEqual([]);
  });

  it("responde 400 si la fecha no es una fecha real", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const id = await darDeAlta(app, "Portátil 07");
    for (const devolucion of ["2026-02-30", "20-11-2026", "mañana"]) {
      const r = await prestar(app, id, { persona: "Ana Pérez", devolucion });
      expect(r.statusCode).toBe(400);
      expect(r.json()).toEqual({ error: "La fecha de devolución no es válida" });
    }
    expect(await almacen.listar("prestamos_activos")).toEqual([]);
  });

  it("responde 409 si el equipo ya está prestado y no cambia su préstamo", async () => {
    const app = await servidor();
    const id = await darDeAlta(app, "Portátil 07");
    await prestar(app, id, { persona: "Ana Pérez", devolucion: "2026-11-20" });
    const r = await prestar(app, id, { persona: "Luis Gil", devolucion: "2026-11-27" });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toEqual({ error: "El equipo ya está prestado" });
    const lista = await app.inject({ method: "GET", url: "/api/equipos", headers: AUTH });
    expect(lista.json()).toEqual([{ id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" }]);
  });

  it("solo presta una vez con dos peticiones a la vez", async () => {
    const app = await servidor();
    const id = await darDeAlta(app, "Portátil 07");
    const respuestas = await Promise.all([
      prestar(app, id, { persona: "Ana Pérez", devolucion: "2026-11-20" }),
      prestar(app, id, { persona: "Luis Gil", devolucion: "2026-11-27" }),
    ]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });

  it("responde 404 si el equipo no existe y no guarda ningún préstamo", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const r = await prestar(app, "eq-999", { persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ error: "No existe el equipo" });
    expect(await almacen.listar("prestamos_activos")).toEqual([]);
  });

  it("responde 401 sin un token válido y no presta el equipo", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const id = await darDeAlta(app, "Portátil 07");
    const r = await prestar(app, id, { persona: "Ana Pérez", devolucion: "2026-11-20" }, { authorization: "Bearer malo" });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ error: "Inicia sesión con Google." });
    expect(await almacen.listar("prestamos_activos")).toEqual([]);
  });
});

describe("listarEquiposConPrestamo", () => {
  it("devuelve los equipos con su préstamo para otros contextos", async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardar("equipos_equipos", "e1", { id: "e1", nombre: "Portátil 07" });
    await almacen.guardar("prestamos_activos", "e1", { persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(await listarEquiposConPrestamo(almacen)).toEqual([
      { id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
    ]);
  });
});
