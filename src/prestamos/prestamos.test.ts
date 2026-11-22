import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { almacenEnMemoria } from "../../lib/datos.js";
import { rutas } from "./index.js";
import { PRESTAMOS_ACTIVOS } from "./prestamos.js";

async function servidor() {
  const almacen = almacenEnMemoria();
  const app = Fastify();
  await app.register(rutas, { almacen });
  const listar = () => app.inject({ method: "GET", url: "/api/equipos" });
  const prestar = (id: string, cuerpo?: object) =>
    app.inject({ method: "POST", url: `/api/equipos/${id}/prestamo`, ...(cuerpo ? { payload: cuerpo } : {}) });
  return { almacen, listar, prestar };
}

describe("GET /api/equipos", () => {
  it("responde 200 con una lista vacía si no hay equipos", async () => {
    const { listar } = await servidor();
    const respuesta = await listar();
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
  });

  it("responde 200 con los equipos, y de los prestados la persona y la devolución", async () => {
    const { almacen, listar } = await servidor();
    await almacen.guardar("equipos_equipos", "e1", { id: "e1", nombre: "Portátil 07" });
    await almacen.guardar("equipos_equipos", "e2", { id: "e2", nombre: "Proyector sala 2" });
    await almacen.guardar(PRESTAMOS_ACTIVOS, "e1", { persona: "Ana Pérez", devolucion: "2026-12-15" });
    const respuesta = await listar();
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([
      { id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-12-15" },
      { id: "e2", nombre: "Proyector sala 2", prestado: false },
    ]);
  });

  it("un equipo cuyo préstamo se ha cerrado aparece libre, sin persona ni devolución", async () => {
    const { almacen, listar } = await servidor();
    await almacen.guardar("equipos_equipos", "e1", { id: "e1", nombre: "Portátil 07" });
    await almacen.guardar(PRESTAMOS_ACTIVOS, "e1", { persona: "Ana Pérez", devolucion: "2026-12-15" });
    await almacen.borrar(PRESTAMOS_ACTIVOS, "e1");
    const respuesta = await listar();
    expect(respuesta.statusCode).toBe(200);
    const [equipo] = respuesta.json<Record<string, unknown>[]>();
    expect(equipo).toEqual({ id: "e1", nombre: "Portátil 07", prestado: false });
    expect(equipo).not.toHaveProperty("persona");
    expect(equipo).not.toHaveProperty("devolucion");
  });
});

describe("POST /api/equipos/:id/prestamo", () => {
  const sembrar = (almacen: Awaited<ReturnType<typeof servidor>>["almacen"]) =>
    almacen.guardar("equipos_equipos", "e1", { id: "e1", nombre: "Portátil 07" });

  it("responde 201 con el equipo prestado y guarda el préstamo", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    const respuesta = await prestar("e1", { persona: "Ana Pérez", devolucion: "2026-12-15" });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({
      id: "e1",
      nombre: "Portátil 07",
      prestado: true,
      persona: "Ana Pérez",
      devolucion: "2026-12-15",
    });
    expect(await almacen.obtener(PRESTAMOS_ACTIVOS, "e1")).toEqual({ persona: "Ana Pérez", devolucion: "2026-12-15" });
  });

  it("acepta una fecha pasada", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    const respuesta = await prestar("e1", { persona: "Ana Pérez", devolucion: "2020-02-29" });
    expect(respuesta.statusCode).toBe(201);
  });

  it("responde 400 si falta la persona y el equipo sigue libre", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    const respuesta = await prestar("e1", { devolucion: "2026-12-15" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    expect(await almacen.obtener(PRESTAMOS_ACTIVOS, "e1")).toBeUndefined();
  });

  it("responde 400 si la persona está vacía o solo tiene espacios", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    const respuesta = await prestar("e1", { persona: "   ", devolucion: "2026-12-15" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
  });

  it("responde 400 si falta la fecha y el equipo sigue libre", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    const respuesta = await prestar("e1", { persona: "Ana Pérez" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    expect(await almacen.obtener(PRESTAMOS_ACTIVOS, "e1")).toBeUndefined();
  });

  it("responde 400 si no hay cuerpo", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    const respuesta = await prestar("e1");
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
  });

  it.each(["2026-02-30", "2026-13-01", "15/12/2026", "mañana"])(
    "responde 400 «La fecha de devolución no es válida» con la fecha %s",
    async (devolucion) => {
      const { almacen, prestar } = await servidor();
      await sembrar(almacen);
      const respuesta = await prestar("e1", { persona: "Ana Pérez", devolucion });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "La fecha de devolución no es válida" });
      expect(await almacen.obtener(PRESTAMOS_ACTIVOS, "e1")).toBeUndefined();
    },
  );

  it("responde 404 si el equipo no existe y no apunta ningún préstamo", async () => {
    const { almacen, prestar } = await servidor();
    const respuesta = await prestar("zzz-999", { persona: "Ana Pérez", devolucion: "2026-12-15" });
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
    expect(await almacen.listar(PRESTAMOS_ACTIVOS)).toEqual([]);
  });

  it("responde 409 si el equipo ya está prestado y el préstamo anterior no cambia", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    await almacen.guardar(PRESTAMOS_ACTIVOS, "e1", { persona: "Ana Pérez", devolucion: "2026-12-15" });
    const respuesta = await prestar("e1", { persona: "Luis Gómez", devolucion: "2027-01-10" });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo ya está prestado" });
    expect(await almacen.obtener(PRESTAMOS_ACTIVOS, "e1")).toEqual({ persona: "Ana Pérez", devolucion: "2026-12-15" });
  });

  it("con dos peticiones a la vez solo se apunta una", async () => {
    const { almacen, prestar } = await servidor();
    await sembrar(almacen);
    const respuestas = await Promise.all([
      prestar("e1", { persona: "Ana Pérez", devolucion: "2026-12-15" }),
      prestar("e1", { persona: "Luis Gómez", devolucion: "2027-01-10" }),
    ]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });
});
