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
