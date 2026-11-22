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
  return { almacen, listar };
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
});
