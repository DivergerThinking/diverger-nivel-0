// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import type { OpcionesContexto } from "../../lib/datos.js";
import { crearEquipo } from "./equipos.js";

export { listarEquipos, obtenerEquipo, type Equipo } from "./equipos.js";

/** Rutas del contrato spec/contextos/equipos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.post("/api/equipos", async (request, reply) => {
    const cuerpo = request.body;
    const nombre = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { nombre?: unknown }).nombre : undefined;
    const resultado = await crearEquipo(almacen, nombre);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.code(201).send(resultado.equipo);
  });
  return Promise.resolve();
};
