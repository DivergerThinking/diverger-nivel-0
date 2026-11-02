import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import { crearServidor } from "../../app/server.js";
import { rutas } from "./index.js";

const TECNICO = { email: "tecnico@empresa.example", nombre: "Técnico" };
const verificarToken = (token: string) => Promise.resolve(token === "token-bueno" ? TECNICO : null);
const headers = { authorization: "Bearer token-bueno" };

async function servidor(almacen = almacenEnMemoria()) {
  return crearServidor({ googleClientId: "cliente", verificarToken, almacen, contextos: [rutas] });
}

describe("POST /api/equipos", () => {
  const alta = (app: Awaited<ReturnType<typeof servidor>>, payload?: unknown) =>
    app.inject({ method: "POST", url: "/api/equipos", headers, payload: payload as object | undefined });

  it("da de alta «Portátil 07»: 201 con id, nombre y prestado false, y aparece en la lista", async () => {
    const app = await servidor();
    const respuesta = await alta(app, { nombre: "Portátil 07" });
    expect(respuesta.statusCode).toBe(201);
    const equipo = respuesta.json<{ id: string }>();
    expect(equipo).toEqual({ id: expect.any(String) as string, nombre: "Portátil 07", prestado: false });
    const lista = (await app.inject({ url: "/api/equipos", headers })).json<unknown[]>();
    expect(lista).toEqual([equipo]);
    await app.close();
  });

  it.each([{ nombre: "" }, { nombre: "   " }, {}, { nombre: 7 }])("con %j responde 400 y no crea ningún equipo", async (cuerpo) => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const respuesta = await alta(app, cuerpo);
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await almacen.listar("equipos_equipos")).toEqual([]);
    await app.close();
  });

  it("sin cuerpo responde 400 «Falta el nombre del equipo»", async () => {
    const app = await servidor();
    const respuesta = await alta(app);
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    await app.close();
  });

  it("un nombre repetido sin distinguir mayúsculas ni espacios responde 409 y deja un solo equipo", async () => {
    const app = await servidor();
    await alta(app, { nombre: "Portátil 07" });
    const respuesta = await alta(app, { nombre: " portátil 07 " });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    const lista = (await app.inject({ url: "/api/equipos", headers })).json<{ nombre: string }[]>();
    expect(lista.map((e) => e.nombre)).toEqual(["Portátil 07"]);
    await app.close();
  });

  it("dos altas a la vez con el mismo nombre crean un solo equipo", async () => {
    const app = await servidor();
    const respuestas = await Promise.all([alta(app, { nombre: "Proyector" }), alta(app, { nombre: "proyector " })]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    await app.close();
  });
});

describe("POST /api/equipos/:id/prestamo", () => {
  async function conPortatil(almacen = almacenEnMemoria()) {
    const app = await servidor(almacen);
    const { id } = (await app.inject({ method: "POST", url: "/api/equipos", headers, payload: { nombre: "Portátil 07" } })).json<{ id: string }>();
    const prestar = (payload?: object, url = `/api/equipos/${id}/prestamo`) => app.inject({ method: "POST", url, headers, payload });
    const equipo = async () => (await app.inject({ url: "/api/equipos", headers })).json<unknown[]>()[0];
    return { app, id, prestar, equipo };
  }

  it("presta «Portátil 07» a Ana Pérez: 201 con persona y devolucion, y la lista lo muestra prestado", async () => {
    const { app, id, prestar, equipo } = await conPortatil();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" });
    const esperado = { id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" };
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual(esperado);
    expect(await equipo()).toEqual(esperado);
    await app.close();
  });

  it.each([
    { devolucion: "2026-11-20" },
    { persona: "Ana Pérez" },
    { persona: "  ", devolucion: "2026-11-20" },
    { persona: "Ana Pérez", devolucion: 7 },
    {},
  ])("con %j responde 400 y el equipo sigue sin prestar", async (cuerpo) => {
    const { app, id, prestar, equipo } = await conPortatil();
    const respuesta = await prestar(cuerpo);
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    expect(await equipo()).toEqual({ id, nombre: "Portátil 07", prestado: false });
    await app.close();
  });

  it("sin cuerpo responde 400", async () => {
    const { app, prestar } = await conPortatil();
    const respuesta = await prestar();
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan la persona o la fecha de devolución" });
    await app.close();
  });

  it("un equipo que no existe responde 404 «No existe el equipo»", async () => {
    const { app, prestar } = await conPortatil();
    const respuesta = await prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" }, "/api/equipos/no-existe/prestamo");
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toEqual({ error: "No existe el equipo" });
    await app.close();
  });

  it("un equipo ya prestado responde 409 y sigue prestado a la primera persona", async () => {
    const { app, id, prestar, equipo } = await conPortatil();
    await prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" });
    const respuesta = await prestar({ persona: "Luis Gómez", devolucion: "2026-11-27" });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo ya está prestado" });
    expect(await equipo()).toEqual({ id, nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
    await app.close();
  });

  it("dos préstamos a la vez prestan el equipo una sola vez", async () => {
    const { app, prestar } = await conPortatil();
    const respuestas = await Promise.all([
      prestar({ persona: "Ana Pérez", devolucion: "2026-11-20" }),
      prestar({ persona: "Luis Gómez", devolucion: "2026-11-27" }),
    ]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    await app.close();
  });

  it("sin token responde 401 y no presta el equipo", async () => {
    const { app, id, equipo } = await conPortatil();
    const respuesta = await app.inject({ method: "POST", url: `/api/equipos/${id}/prestamo`, payload: { persona: "Ana Pérez", devolucion: "2026-11-20" } });
    expect(respuesta.statusCode).toBe(401);
    expect(await equipo()).toEqual({ id, nombre: "Portátil 07", prestado: false });
    await app.close();
  });
});

describe("GET /api/equipos", () => {
  it("con sesión iniciada devuelve 200 y la lista vacía si no hay equipos", async () => {
    const app = await servidor();
    const respuesta = await app.inject({ url: "/api/equipos", headers });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
    await app.close();
  });

  it("lista los equipos libres sin persona ni devolucion y los prestados con las dos", async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardar("equipos_equipos", "a", {
      id: "a", nombre: "Portátil 07", nombreNormalizado: "portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20",
    });
    await almacen.guardar("equipos_equipos", "b", {
      id: "b", nombre: "Proyector sala 2", nombreNormalizado: "proyector sala 2", prestado: false,
    });
    const app = await servidor(almacen);
    const lista = (await app.inject({ url: "/api/equipos", headers })).json<{ id: string }[]>();
    expect(lista).toHaveLength(2);
    expect(lista).toContainEqual({ id: "a", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" });
    expect(lista).toContainEqual({ id: "b", nombre: "Proyector sala 2", prestado: false });
    await app.close();
  });

  it("sin token responde 401 «Inicia sesión con Google.»", async () => {
    const app = await servidor();
    const respuesta = await app.inject("/api/equipos");
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
    await app.close();
  });

  it("con un token no válido (otro cliente o correo sin verificar) responde 401", async () => {
    const app = await servidor();
    const respuesta = await app.inject({ url: "/api/equipos", headers: { authorization: "Bearer token-malo" } });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
    await app.close();
  });

  it("POST /api/equipos sin token responde 401 y no crea ningún equipo", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 07" } });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: "Inicia sesión con Google." });
    expect(await almacen.listar("equipos_equipos")).toEqual([]);
    await app.close();
  });
});
