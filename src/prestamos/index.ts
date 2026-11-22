// Interfaz pública del contexto «prestamos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import { listarEquiposConEstado } from "./prestamos.js";

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. El inicio de sesión lo exige el servidor en todo /api. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", () => listarEquiposConEstado(almacen));
  return Promise.resolve();
};
