import { describe, expect, it } from "vitest";
import { crearServidor } from "../../app/server.js";
import { almacenEnMemoria } from "../../lib/datos.js";
import { COLECCION, type Equipo } from "./equipos.js";
import { rutas } from "./index.js";

async function preparar() {
  const almacen = almacenEnMemoria();
  const app = await crearServidor({
    googleClientId: "cliente",
    verificarToken: (token) =>
      Promise.resolve(token === "valido" ? { nombre: "Ana", email: "ana@example.com" } : null),
    almacen,
    contextos: [rutas],
  });
  const enviar = (payload?: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/equipos",
      headers: { authorization: "Bearer valido" },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  return { almacen, app, enviar };
}

describe("POST /api/equipos/{id}/prestamo", () => {
  async function conEquipo() {
    const { almacen, app, enviar } = await preparar();
    const equipo = (await enviar({ nombre: "Portátil 07" })).json<Equipo>();
    const prestar = (payload?: unknown, id = equipo.id) =>
      app.inject({
        method: "POST",
        url: `/api/equipos/${id}/prestamo`,
        headers: { authorization: "Bearer valido" },
        ...(payload === undefined ? {} : { payload: payload as object }),
      });
    const guardado = () => almacen.obtener<{ prestado: boolean; persona?: string; devolucion?: string }>(COLECCION, equipo.id);
    return { app, equipo, prestar, guardado };
  }

  it("presta un equipo no prestado y lo guarda", async () => {
    const { equipo, prestar, guardado } = await conEquipo();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({
      id: equipo.id,
      nombre: "Portátil 07",
      prestado: true,
      persona: "Ana Pérez",
      devolucion: "2026-11-20",
    });
    expect(await guardado()).toMatchObject({ prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
  });

  it("responde 400 si falta la fecha y el equipo sigue no prestado", async () => {
    const { prestar, guardado } = await conEquipo();
    const respuesta = await prestar({ persona: "Ana Pérez" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    expect((await guardado())?.prestado).toBe(false);
  });

  it("responde 400 si falta la persona, está vacía o no hay cuerpo", async () => {
    const { prestar } = await conEquipo();
    for (const cuerpo of [{ devolucion: "2026-11-20" }, { persona: "  ", devolucion: "2026-11-20" }, {}]) {
      const respuesta = await prestar(cuerpo);
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    }
  });

  it("responde 409 si ya está prestado y no cambia el préstamo", async () => {
    const { prestar, guardado } = await conEquipo();
    await prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" });
    const respuesta = await prestar({ persona: "Luis Gómez", devolucion: "2026-11-25" });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo ya está prestado" });
    expect(await guardado()).toMatchObject({ persona: "Ana Pérez", devolucion: "2026-11-20" });
  });

  it("solo presta una vez si llegan dos préstamos a la vez", async () => {
    const { prestar } = await conEquipo();
    const respuestas = await Promise.all([
      prestar({ persona: "Ana", devolucion: "2026-11-20" }),
      prestar({ persona: "Luis", devolucion: "2026-11-25" }),
    ]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });

  it("responde 404 si el equipo no existe", async () => {
    const { prestar } = await conEquipo();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" }, "no-existe");
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
  });

  it("responde 400 si la fecha no es real o no sigue AAAA-MM-DD y no presta", async () => {
    const { prestar, guardado } = await conEquipo();
    for (const devolucion of ["2026-02-30", "20/11/2026", "2026-13-01", "2026-1-5", "mañana"]) {
      const respuesta = await prestar({ persona: "Ana Pérez", devolucion });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toEqual({ error: "La fecha de devolución no es válida" });
    }
    expect((await guardado())?.prestado).toBe(false);
  });

  it("acepta fechas pasadas y bisiestas", async () => {
    const { prestar } = await conEquipo();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-10-15" });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toMatchObject({ prestado: true, persona: "Ana Pérez", devolucion: "2026-10-15" });
    const otro = await conEquipo();
    expect((await otro.prestar({ persona: "Ana", devolucion: "2028-02-29" })).statusCode).toBe(201);
  });

  it("responde 401 sin token y no presta", async () => {
    const { app, equipo, guardado } = await conEquipo();
    const respuesta = await app.inject({
      method: "POST",
      url: `/api/equipos/${equipo.id}/prestamo`,
      payload: { persona: "Ana", devolucion: "2026-11-20" },
    });
    expect(respuesta.statusCode).toBe(401);
    expect((await guardado())?.prestado).toBe(false);
  });
});

describe("POST /api/equipos", () => {
  it("da de alta un equipo no prestado y lo guarda", async () => {
    const { almacen, enviar } = await preparar();
    const respuesta = await enviar({ nombre: "Portátil 07" });
    expect(respuesta.statusCode).toBe(201);
    const equipo = respuesta.json<Equipo>();
    expect(typeof equipo.id).toBe("string");
    expect(equipo.id).not.toBe("");
    expect({ nombre: equipo.nombre, prestado: equipo.prestado }).toEqual({ nombre: "Portátil 07", prestado: false });
    expect(await almacen.listar(COLECCION)).toHaveLength(1);
  });

  it("responde 400 si el nombre está vacío y no crea nada", async () => {
    const { almacen, enviar } = await preparar();
    const respuesta = await enviar({ nombre: "" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await almacen.listar(COLECCION)).toHaveLength(0);
  });

  it("responde 400 si falta el nombre y no crea nada", async () => {
    const { almacen, enviar } = await preparar();
    const respuesta = await enviar({});
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await almacen.listar(COLECCION)).toHaveLength(0);
  });

  it("responde 400 si el nombre solo tiene espacios", async () => {
    const { enviar } = await preparar();
    expect((await enviar({ nombre: "   " })).statusCode).toBe(400);
  });

  it("da de alta un equipo con otro nombre aunque ya exista «Portátil 07»", async () => {
    const { almacen, enviar } = await preparar();
    await enviar({ nombre: "Portátil 07" });
    const respuesta = await enviar({ nombre: "Proyector sala 2" });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json<Equipo>()).toMatchObject({ nombre: "Proyector sala 2", prestado: false });
    expect(await almacen.listar(COLECCION)).toHaveLength(2);
  });

  it("responde 409 si el nombre ya existe y no crea nada", async () => {
    const { almacen, enviar } = await preparar();
    await enviar({ nombre: "Portátil 07" });
    const respuesta = await enviar({ nombre: "Portátil 07" });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    expect(await almacen.listar(COLECCION)).toHaveLength(1);
  });

  it("responde 409 si solo cambian las mayúsculas y los espacios de los extremos", async () => {
    const { almacen, enviar } = await preparar();
    await enviar({ nombre: "Portátil 07" });
    const respuesta = await enviar({ nombre: "portátil 07 " });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    const equipos = await almacen.listar<{ nombre: string }>(COLECCION);
    expect(equipos.map((e) => e.nombre)).toEqual(["Portátil 07"]);
  });

  it("solo crea uno si llegan dos altas con el mismo nombre a la vez", async () => {
    const { almacen, enviar } = await preparar();
    const respuestas = await Promise.all([enviar({ nombre: "Proyector" }), enviar({ nombre: "PROYECTOR" })]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await almacen.listar(COLECCION)).toHaveLength(1);
  });

  it("admite nombres con barras sin confundirlos", async () => {
    const { enviar } = await preparar();
    expect((await enviar({ nombre: "Sala 1/2" })).statusCode).toBe(201);
    expect((await enviar({ nombre: "Sala 1" })).statusCode).toBe(201);
  });

  it("responde 401 sin token y no crea nada", async () => {
    const { almacen, app } = await preparar();
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "X" } });
    expect(respuesta.statusCode).toBe(401);
    expect(await almacen.listar(COLECCION)).toHaveLength(0);
  });
});
