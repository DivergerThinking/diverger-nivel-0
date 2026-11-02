// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import "../../lib/auth.js";
import { crearEquipo, devolverEquipo, listarEquipos, prestarEquipo } from "./equipos.js";

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
  app.post<{ Params: { id: string } }>("/api/equipos/:id/prestamo", async (request, reply) => {
    const cuerpo = request.body;
    const datos = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { persona?: unknown; devolucion?: unknown }) : {};
    const resultado = await prestarEquipo(almacen, request.params.id, datos.persona, datos.devolucion);
    if ("equipo" in resultado) return reply.code(201).send(resultado.equipo);
    if (resultado.error === "NO_EXISTE") return reply.code(404).send({ error: "No existe el equipo" });
    if (resultado.error === "FALTAN_DATOS") return reply.code(400).send({ error: "Faltan la persona o la fecha de devolución" });
    if (resultado.error === "FECHA_NO_VALIDA") return reply.code(400).send({ error: "La fecha de devolución no es válida" });
    return reply.code(409).send({ error: "El equipo ya está prestado" });
  });
  app.post<{ Params: { id: string } }>("/api/equipos/:id/devolucion", async (request, reply) => {
    const resultado = await devolverEquipo(almacen, request.params.id);
    if ("equipo" in resultado) return reply.code(200).send(resultado.equipo);
    if (resultado.error === "NO_EXISTE") return reply.code(404).send({ error: "No existe el equipo" });
    return reply.code(409).send({ error: "El equipo no está prestado" });
  });
  return Promise.resolve();
};
