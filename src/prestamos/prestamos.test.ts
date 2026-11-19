import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { almacenEnMemoria } from "../../lib/datos.js";
import { rutas as rutasEquipos } from "../equipos/index.js";
import { rutas } from "./index.js";
import { COLECCION_PRESTAMOS, type PrestamoActivo } from "./prestamos.js";

// La sesión la comprueba el servidor (app/server.ts) antes de llegar a las rutas del contexto.
async function servidor() {
  const almacen = almacenEnMemoria();
  const app = Fastify();
  app.decorateRequest("persona", null);
  await app.register(rutasEquipos, { almacen });
  await app.register(rutas, { almacen });
  const alta = async (nombre: string) =>
    (await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre } })).json<{ id: string }>().id;
  const prestar = (equipoId: string, persona: string, devolucion: string) =>
    almacen.guardar(COLECCION_PRESTAMOS, equipoId, { equipoId, persona, devolucion } satisfies PrestamoActivo);
  const lista = () => app.inject({ method: "GET", url: "/api/equipos" });
  return { alta, prestar, lista };
}

describe("GET /api/equipos", () => {
  it("responde 200 con una lista vacía si no hay equipos", async () => {
    const { lista } = await servidor();
    const respuesta = await lista();
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
  });

  it("enseña el equipo prestado con persona y devolucion, y el libre sin ellos", async () => {
    const { alta, prestar, lista } = await servidor();
    const portatil = await alta("Portátil 07");
    const proyector = await alta("Proyector sala 2");
    await prestar(portatil, "Ana Pérez", "2026-11-20");
    const respuesta = await lista();
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<Record<string, unknown>[]>();
    expect(cuerpo).toHaveLength(2);
    expect(cuerpo).toContainEqual({
      id: portatil,
      nombre: "Portátil 07",
      prestado: true,
      persona: "Ana Pérez",
      devolucion: "2026-11-20",
    });
    const libre = cuerpo.find((e) => e["id"] === proyector);
    expect(libre).toEqual({ id: proyector, nombre: "Proyector sala 2", prestado: false });
    expect(libre).not.toHaveProperty("persona");
    expect(libre).not.toHaveProperty("devolucion");
  });

  it("un equipo dado de alta sin préstamo aparece como no prestado", async () => {
    const { alta, lista } = await servidor();
    const id = await alta("Portátil 08");
    expect((await lista()).json()).toEqual([{ id, nombre: "Portátil 08", prestado: false }]);
  });
});
