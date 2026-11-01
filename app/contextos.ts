// Contextos de la aplicación: cada uno aporta sus rutas desde su index.ts.
import type { FastifyPluginAsync } from "fastify";
import { rutas as ejemplo } from "../src/ejemplo/index.js";

export const contextos: FastifyPluginAsync[] = [ejemplo];
