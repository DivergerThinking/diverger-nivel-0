// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import type { OpcionesContexto } from "../../lib/datos.js";
import { darDeAlta } from "./equipos.js";
import type { components } from "./api.gen.js";

export { darDeAlta, type Equipo } from "./equipos.js";

type NuevoEquipo = components["schemas"]["NuevoEquipo"];

/** Rutas del contrato spec/contextos/equipos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.post<{ Body: NuevoEquipo | null }>("/api/equipos", async (request, reply) => {
    const resultado = await darDeAlta(almacen, request.body?.nombre);
    if (!resultado.ok) return reply.code(resultado.repetido ? 409 : 400).send({ error: resultado.error });
    return reply.code(201).send(resultado.equipo);
  });
  return Promise.resolve();
};
