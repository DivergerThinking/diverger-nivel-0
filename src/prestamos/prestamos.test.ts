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
