// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import "../../lib/auth.js";
import { crearEquipo, listarEquipos } from "./equipos.js";

export { type Equipo } from "./equipos.js";

/** Rutas del contrato spec/contextos/equipos/api.openapi.json. El servidor ya exige el token en todas. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", () => listarEquipos(almacen));
  app.post("/api/equipos", async (request, reply) => {
    const cuerpo = request.body;
    const nombre = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { nombre?: unknown }).nombre : undefined;
    const resultado = await crearEquipo(almacen, nombre);
    if ("equipo" in resultado) return reply.code(201).send(resultado.equipo);
    if (resultado.error === "FALTA_NOMBRE") return reply.code(400).send({ error: "Falta el nombre del equipo" });
    return reply.code(409).send({ error: "Ya hay un equipo con ese nombre" });
  });
  return Promise.resolve();
};
