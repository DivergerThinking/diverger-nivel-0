// Contextos de la aplicación: cada uno aporta sus rutas desde su index.ts.
// Cada contexto recibe en sus opciones el almacén de datos (lib/datos.ts): es su única vía a la base.
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../lib/datos.js";
import { rutas as ejemplo } from "../src/ejemplo/index.js";

export const contextos: FastifyPluginAsync<OpcionesContexto>[] = [ejemplo];
