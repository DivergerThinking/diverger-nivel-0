// Interfaz pública del contexto «prestamos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import type { OpcionesContexto } from "../../lib/datos.js";
import type { components } from "./api.gen.js";
import { listarEquiposConPrestamo } from "./prestamos.js";

export { listarEquiposConPrestamo, type EquipoConPrestamo } from "./prestamos.js";

type EquipoConPrestamo = components["schemas"]["EquipoConPrestamo"];

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", async (_request, reply) => {
    const equipos: EquipoConPrestamo[] = await listarEquiposConPrestamo(almacen);
    return reply.code(200).send(equipos);
  });
  return Promise.resolve();
};
