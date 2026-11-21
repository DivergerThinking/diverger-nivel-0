// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import type { OpcionesContexto } from "../../lib/datos.js";
import type { components } from "./api.gen.js";
import { altaDeEquipo } from "./equipos.js";

export { listarEquipos, obtenerEquipo, type Equipo } from "./equipos.js";

type ErrorDeLaApi = components["schemas"]["Error"];
type EquipoCreado = components["schemas"]["Equipo"];

/** Rutas del contrato spec/contextos/equipos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.post("/api/equipos", async (request, reply) => {
    const cuerpo: unknown = request.body;
    const nombre = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { nombre?: unknown }).nombre : undefined;
    const resultado = await altaDeEquipo(almacen, nombre);
    if (resultado.tipo === "sin-nombre") {
      const error: ErrorDeLaApi = { error: "Falta el nombre del equipo" };
      return reply.code(400).send(error);
    }
    if (resultado.tipo === "repetido") {
      const error: ErrorDeLaApi = { error: "Ya hay un equipo con ese nombre" };
      return reply.code(409).send(error);
    }
    const equipo: EquipoCreado = { id: resultado.equipo.id, nombre: resultado.equipo.nombre, prestado: false };
    return reply.code(201).send(equipo);
  });
  return Promise.resolve();
};
