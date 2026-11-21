import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import type { Almacen } from "../../lib/datos.js";
import { crearServidor } from "../../app/server.js";
import { listarEquipos, obtenerEquipo, rutas } from "./index.js";

async function servidor(almacen: Almacen = almacenEnMemoria()) {
  const app = await crearServidor({
    googleClientId: "cliente",
    verificarToken: (token) =>
      Promise.resolve(token === "bueno" ? { email: "ana.perez@example.com", nombre: "Ana" } : null),
    almacen,
    contextos: [rutas],
  });
  return app;
}

const AUTH = { authorization: "Bearer bueno" };

describe("POST /api/equipos", () => {
  it("da de alta un equipo no prestado con su id y su nombre", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const r = await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre: "Portátil 07" } });
    expect(r.statusCode).toBe(201);
    const cuerpo = r.json<{ id: string; nombre: string; prestado: boolean }>();
    expect(cuerpo.nombre).toBe("Portátil 07");
    expect(cuerpo.prestado).toBe(false);
    expect(cuerpo.id).toBeTruthy();
    expect(await listarEquipos(almacen)).toEqual([{ id: cuerpo.id, nombre: "Portátil 07" }]);
  });

  it("responde 400 con el nombre vacío o de solo espacios y no guarda nada", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    for (const nombre of ["", "   "]) {
      const r = await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre } });
      expect(r.statusCode).toBe(400);
      expect(r.json()).toEqual({ error: "Falta el nombre del equipo" });
    }
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("responde 400 sin el campo nombre y no guarda nada", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const r = await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: {} });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await listarEquipos(almacen)).toEqual([]);
  });

  it("responde 409 con un nombre que solo se diferencia en mayúsculas y espacios", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre: "Portátil 07" } });
    const r = await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre: " portátil 07 " } });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });

  it("guarda el nombre tal como se escribió", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre: " Proyector sala 2 " } });
    expect((await listarEquipos(almacen))[0]?.nombre).toBe(" Proyector sala 2 ");
  });

  it("solo da de alta una vez con dos altas a la vez del mismo nombre", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const peticiones = ["Portátil 09", "PORTÁTIL 09"].map((nombre) =>
      app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre } }),
    );
    const codigos = (await Promise.all(peticiones)).map((r) => r.statusCode).sort();
    expect(codigos).toEqual([201, 409]);
  });

  it("responde 401 sin token, con un token no válido, y no guarda nada", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const sinToken = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "Portátil 08" } });
    expect(sinToken.statusCode).toBe(401);
    expect(sinToken.json()).toEqual({ error: "Inicia sesión con Google." });
    const malo = await app.inject({
      method: "POST",
      url: "/api/equipos",
      headers: { authorization: "Bearer malo" },
      payload: { nombre: "Portátil 08" },
    });
    expect(malo.statusCode).toBe(401);
    expect(malo.json()).toEqual({ error: "Inicia sesión con Google." });
    expect(await listarEquipos(almacen)).toEqual([]);
  });
});

describe("lecturas para otros contextos", () => {
  it("lista los equipos y obtiene uno por su id", async () => {
    const almacen = almacenEnMemoria();
    const app = await servidor(almacen);
    const r = await app.inject({ method: "POST", url: "/api/equipos", headers: AUTH, payload: { nombre: "Portátil 07" } });
    const { id } = r.json<{ id: string }>();
    expect(await obtenerEquipo(almacen, id)).toEqual({ id, nombre: "Portátil 07" });
    expect(await obtenerEquipo(almacen, "eq-999")).toBeUndefined();
    expect(await listarEquipos(almacen)).toHaveLength(1);
  });
});
