import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rutas } from "./index.js";

describe("GET /api/estado", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(rutas);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("responde 200 con el estado en marcha", async () => {
    const respuesta = await app.inject({ method: "GET", url: "/api/estado" });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: "en marcha" });
  });

  it("responde 400 con el error de formato si el formato no está admitido", async () => {
    const respuesta = await app.inject({ method: "GET", url: "/api/estado?formato=xml" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Formato no admitido" });
  });
});
