// Interfaz pública del contexto «prestamos»: sus rutas (ADR 0003 y 0004).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import { listarEquiposConPrestamo } from "./prestamos.js";

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", () => listarEquiposConPrestamo(almacen));
  return Promise.resolve();
};
