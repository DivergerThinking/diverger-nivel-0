// Interfaz pública del contexto «prestamos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import type { OpcionesContexto } from "../../lib/datos.js";
import type { components } from "./api.gen.js";
import { devolverEquipo, listarEquiposConPrestamo, prestarEquipo } from "./prestamos.js";

export { listarEquiposConPrestamo, type EquipoConPrestamo } from "./prestamos.js";

type EquipoConPrestamo = components["schemas"]["EquipoConPrestamo"];
type EquipoPrestado = components["schemas"]["EquipoPrestado"];
type EquipoDevuelto = components["schemas"]["EquipoDevuelto"];
type ErrorDeLaApi = components["schemas"]["Error"];

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", async (_request, reply) => {
    const equipos: EquipoConPrestamo[] = await listarEquiposConPrestamo(almacen);
    return reply.code(200).send(equipos);
  });
  app.post<{ Params: { id: string } }>("/api/equipos/:id/prestamo", async (request, reply) => {
    const cuerpo: unknown = request.body;
    const datos = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { persona?: unknown; devolucion?: unknown }) : {};
    const resultado = await prestarEquipo(almacen, request.params.id, datos.persona, datos.devolucion);
    const fallos: Record<string, [number, string]> = {
      "faltan-datos": [400, "Faltan la persona o la fecha de devolución"],
      "fecha-no-valida": [400, "La fecha de devolución no es válida"],
      "no-existe": [404, "No existe el equipo"],
      "ya-prestado": [409, "El equipo ya está prestado"],
    };
    if (resultado.tipo !== "prestado") {
      const [codigo, mensaje] = fallos[resultado.tipo] ?? [500, "Error interno"];
      const error: ErrorDeLaApi = { error: mensaje };
      return reply.code(codigo).send(error);
    }
    const equipo: EquipoPrestado = { ...resultado.equipo, prestado: true };
    return reply.code(201).send(equipo);
  });
  app.post<{ Params: { id: string } }>("/api/equipos/:id/devolucion", async (request, reply) => {
    const resultado = await devolverEquipo(almacen, request.params.id);
    if (resultado.tipo === "no-existe") {
      const error: ErrorDeLaApi = { error: "No existe el equipo" };
      return reply.code(404).send(error);
    }
    if (resultado.tipo === "no-prestado") {
      const error: ErrorDeLaApi = { error: "El equipo no está prestado" };
      return reply.code(409).send(error);
    }
    const equipo: EquipoDevuelto = { ...resultado.equipo, prestado: false };
    return reply.code(200).send(equipo);
  });
  return Promise.resolve();
};
