// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
// Préstamos usa la lectura de un equipo y la lista de equipos (ADR 0004).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import { crearEquipo, ErrorDeEquipos } from "./equipos.js";
import type { components } from "./api.gen.js";

export { listarEquipos, obtenerEquipo, type Equipo } from "./equipos.js";

type NuevoEquipo = components["schemas"]["NuevoEquipo"];

/** Rutas del contrato spec/contextos/equipos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.post("/api/equipos", async (request, reply) => {
    const cuerpo = request.body as NuevoEquipo | null | undefined;
    try {
      const equipo = await crearEquipo(almacen, cuerpo?.nombre);
      return await reply.code(201).send(equipo);
    } catch (motivo) {
      if (motivo instanceof ErrorDeEquipos) return reply.code(motivo.status).send({ error: motivo.message });
      throw motivo;
    }
  });
  return Promise.resolve();
};
