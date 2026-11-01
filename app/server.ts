// Servidor de la aplicación: API en /api (con inicio de sesión) y el frontend construido en dist/web.
import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import fastifyStatic from "@fastify/static";
import { tokenDeCabecera, type VerificarToken } from "../lib/auth.js";
import { almacenEnMemoria, type Almacen, type OpcionesContexto } from "../lib/datos.js";
import { contextos as contextosDeLaAplicacion } from "./contextos.js";

export interface Opciones {
  /** ID de cliente OAuth de Google; lo usa el frontend para pedir el token. Vacío, nadie inicia sesión. */
  googleClientId: string;
  verificarToken: VerificarToken;
  /** Almacén de datos que reciben los contextos (lib/datos.ts); sin él, uno en memoria. */
  almacen?: Almacen;
  /** Contextos que se registran; por defecto, los de app/contextos.ts. Los tests pueden pasar otros. */
  contextos?: FastifyPluginAsync<OpcionesContexto>[];
  /** Carpeta del frontend construido; sin ella solo se sirve la API. */
  webRoot?: string;
  logger?: boolean;
}

/** Rutas que no piden inicio de sesión. */
const PUBLICAS = new Set(["/api/salud", "/api/config"]);

export async function crearServidor(opciones: Opciones): Promise<FastifyInstance> {
  const app = Fastify({ logger: opciones.logger ?? false });
  app.decorateRequest("persona", null);

  app.addHook("onRequest", async (request, reply) => {
    const ruta = request.url.split("?")[0] ?? "";
    if (!ruta.startsWith("/api/") || PUBLICAS.has(ruta)) return;
    if (!opciones.googleClientId) {
      return reply.code(503).send({ error: "Inicio de sesión sin configurar." });
    }
    const token = tokenDeCabecera(request.headers.authorization);
    const persona = token ? await opciones.verificarToken(token) : null;
    if (!persona) {
      return reply.code(401).send({ error: "Inicia sesión con Google." });
    }
    request.persona = persona;
  });

  app.get("/api/salud", () => ({ estado: "ok" }));
  app.get("/api/config", () => ({ googleClientId: opciones.googleClientId }));
  app.get("/api/yo", (request) => request.persona);

  const almacen = opciones.almacen ?? almacenEnMemoria();
  for (const rutas of opciones.contextos ?? contextosDeLaAplicacion) await app.register(rutas, { almacen });

  if (opciones.webRoot && existsSync(opciones.webRoot)) {
    await app.register(fastifyStatic, { root: opciones.webRoot, wildcard: false });
    // Aplicación de una sola página: lo que no es /api ni un fichero devuelve index.html.
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "No existe." });
    });
  }
  return app;
}
