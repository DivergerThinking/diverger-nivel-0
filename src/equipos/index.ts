// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import type { OpcionesContexto } from "../../lib/datos.js";
import { darDeAlta, devolverEquipo, listarEquipos, prestarEquipo } from "./equipos.js";
import type { components } from "./api.gen.js";

export { darDeAlta, type Equipo } from "./equipos.js";

type NuevoEquipo = components["schemas"]["NuevoEquipo"];
type NuevoPrestamo = components["schemas"]["NuevoPrestamo"];

/** Rutas del contrato spec/contextos/equipos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.post<{ Body: NuevoEquipo | null }>("/api/equipos", async (request, reply) => {
    const resultado = await darDeAlta(almacen, request.body?.nombre);
    if (!resultado.ok) return reply.code(resultado.repetido ? 409 : 400).send({ error: resultado.error });
    return reply.code(201).send(resultado.equipo);
  });
  app.get("/api/equipos", async (_request, reply) => reply.code(200).send(await listarEquipos(almacen)));
  app.post<{ Params: { id: string }; Body: NuevoPrestamo | null }>(
    "/api/equipos/:id/prestamo",
    async (request, reply) => {
      const resultado = await prestarEquipo(
        almacen,
        request.params.id,
        request.body?.persona,
        request.body?.devolucion,
      );
      if (!resultado.ok) return reply.code(resultado.codigo).send({ error: resultado.error });
      return reply.code(201).send(resultado.equipo);
    },
  );
  app.post<{ Params: { id: string } }>("/api/equipos/:id/devolucion", async (request, reply) => {
    const resultado = await devolverEquipo(almacen, request.params.id);
    if (!resultado.ok) return reply.code(resultado.codigo).send({ error: resultado.error });
    return reply.code(200).send(resultado.equipo);
  });
  return Promise.resolve();
};
