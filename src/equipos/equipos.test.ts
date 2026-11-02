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

describe("GET /api/equipos", () => {
  async function conEquipos() {
    const { app, enviar } = await preparar();
    const cabeceras = { authorization: "Bearer valido" };
    const portatil = (await enviar({ nombre: "Portátil 07" })).json<Equipo>();
    const proyector = (await enviar({ nombre: "Proyector sala 2" })).json<Equipo>();
    const prestar = (id: string) =>
      app.inject({
        method: "POST",
        url: `/api/equipos/${id}/prestamo`,
        headers: cabeceras,
        payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
      });
    const listar = () => app.inject({ method: "GET", url: "/api/equipos", headers: cabeceras });
    return { app, portatil, proyector, prestar, listar, cabeceras };
  }

  it("lista los equipos; el prestado lleva persona y devolucion y el libre solo id, nombre y prestado", async () => {
    const { portatil, proyector, prestar, listar } = await conEquipos();
    await prestar(portatil.id);
    const respuesta = await listar();
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([
      { id: portatil.id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
      { id: proyector.id, nombre: "Proyector sala 2", prestado: false },
    ]);
  });

  it("un equipo devuelto aparece no prestado y sin el préstamo anterior", async () => {
    const { app, portatil, prestar, listar, cabeceras } = await conEquipos();
    await prestar(portatil.id);
    await app.inject({ method: "POST", url: `/api/equipos/${portatil.id}/devolucion`, headers: cabeceras });
    const equipos = (await listar()).json<Equipo[]>();
    const devuelto = equipos.find((e) => e.id === portatil.id);
    expect(devuelto).toEqual({ id: portatil.id, nombre: "Portátil 07", prestado: false });
  });

  it("responde 200 con una lista vacía si no hay equipos", async () => {
    const { app } = await preparar();
    const respuesta = await app.inject({ method: "GET", url: "/api/equipos", headers: { authorization: "Bearer valido" } });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
  });

  it("responde 401 sin token", async () => {
    const { app } = await conEquipos();
    const respuesta = await app.inject({ method: "GET", url: "/api/equipos" });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
  });
});

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

describe("POST /api/equipos/{id}/devolucion", () => {
  async function conPrestado() {
    const { almacen, app, enviar } = await preparar();
    const equipo = (await enviar({ nombre: "Portátil 07" })).json<Equipo>();
    const cabeceras = { authorization: "Bearer valido" };
    await app.inject({
      method: "POST",
      url: `/api/equipos/${equipo.id}/prestamo`,
      headers: cabeceras,
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    const devolver = (id = equipo.id) =>
      app.inject({ method: "POST", url: `/api/equipos/${id}/devolucion`, headers: cabeceras });
    const guardado = () => almacen.obtener<Record<string, unknown>>(COLECCION, equipo.id);
    return { app, equipo, devolver, guardado };
  }

  it("apunta la devolución, responde 200 con prestado false y lo guarda sin préstamo", async () => {
    const { equipo, devolver, guardado } = await conPrestado();
    const respuesta = await devolver();
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ id: equipo.id, nombre: "Portátil 07", prestado: false });
    const documento = await guardado();
    expect(documento?.prestado).toBe(false);
    expect(documento).not.toHaveProperty("persona");
    expect(documento).not.toHaveProperty("devolucion");
  });

  it("responde 409 si el equipo no está prestado", async () => {
    const { devolver } = await conPrestado();
    await devolver();
    const respuesta = await devolver();
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo no está prestado" });
  });

  it("responde 404 si el equipo no existe", async () => {
    const { devolver } = await conPrestado();
    const respuesta = await devolver("no-existe");
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
  });

  it("solo devuelve una vez si llegan dos devoluciones a la vez", async () => {
    const { devolver } = await conPrestado();
    const respuestas = await Promise.all([devolver(), devolver()]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });

  it("permite volver a prestar el equipo devuelto", async () => {
    const { app, equipo, devolver } = await conPrestado();
    await devolver();
    const respuesta = await app.inject({
      method: "POST",
      url: `/api/equipos/${equipo.id}/prestamo`,
      headers: { authorization: "Bearer valido" },
      payload: { persona: "Luis Gómez", devolucion: "2026-12-01" },
    });
    expect(respuesta.statusCode).toBe(201);
  });

  it("responde 401 sin token y no devuelve el equipo", async () => {
    const { app, equipo, guardado } = await conPrestado();
    const respuesta = await app.inject({ method: "POST", url: `/api/equipos/${equipo.id}/devolucion` });
    expect(respuesta.statusCode).toBe(401);
    expect((await guardado())?.prestado).toBe(true);
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

describe("sesión en la API de equipos (HU-ACC-02)", () => {
  const SIN_SESION = { error: "Inicia sesión con Google." };

  async function conSesiones() {
    const almacen = almacenEnMemoria();
    const app = await crearServidor({
      googleClientId: "cliente",
      verificarToken: (token) =>
        Promise.resolve(
          token === "valido"
            ? { nombre: "Ana", email: "ana@example.com" }
            : token === "cuenta-de-servicio"
              ? { nombre: "Inventario de IT", email: "inventario@proyecto.iam.gserviceaccount.com" }
              : null,
        ),
      almacen,
      contextos: [rutas],
    });
    return { almacen, app };
  }

  it("la cuenta de servicio del inventario con token válido lista los equipos", async () => {
    const { app } = await conSesiones();
    const respuesta = await app.inject({
      method: "GET",
      url: "/api/equipos",
      headers: { authorization: "Bearer cuenta-de-servicio" },
    });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
  });

  it("responde 401 con un token no válido al dar de alta y no crea el equipo", async () => {
    const { almacen, app } = await conSesiones();
    const respuesta = await app.inject({
      method: "POST",
      url: "/api/equipos",
      headers: { authorization: "Bearer token-no-valido" },
      payload: { nombre: "Portátil 09" },
    });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual(SIN_SESION);
    expect(await almacen.listar(COLECCION)).toHaveLength(0);
  });

  it("responde 401 con una cabecera que no es Bearer", async () => {
    const { app } = await conSesiones();
    const respuesta = await app.inject({
      method: "GET",
      url: "/api/equipos",
      headers: { authorization: "Basic valido" },
    });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual(SIN_SESION);
  });

  it("sin token no presta ni devuelve: el equipo conserva su estado", async () => {
    const { almacen, app } = await conSesiones();
    const cabeceras = { authorization: "Bearer valido" };
    const equipo = (
      await app.inject({ method: "POST", url: "/api/equipos", headers: cabeceras, payload: { nombre: "Portátil 07" } })
    ).json<Equipo>();

    const prestamo = await app.inject({
      method: "POST",
      url: `/api/equipos/${equipo.id}/prestamo`,
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    expect(prestamo.statusCode).toBe(401);
    expect(prestamo.json()).toEqual(SIN_SESION);
    expect((await almacen.obtener<{ prestado: boolean }>(COLECCION, equipo.id))?.prestado).toBe(false);

    await app.inject({
      method: "POST",
      url: `/api/equipos/${equipo.id}/prestamo`,
      headers: cabeceras,
      payload: { persona: "Ana Pérez", devolucion: "2026-11-20" },
    });
    const devolucion = await app.inject({ method: "POST", url: `/api/equipos/${equipo.id}/devolucion` });
    expect(devolucion.statusCode).toBe(401);
    expect(devolucion.json()).toEqual(SIN_SESION);
    expect(await almacen.obtener(COLECCION, equipo.id)).toMatchObject({
      prestado: true,
      persona: "Ana Pérez",
      devolucion: "2026-11-20",
    });
  });
});
