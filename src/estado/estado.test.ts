import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { consultarEstado, rutas } from "./index.js";

describe("consultarEstado", () => {
  it("sin formato responde 200 en marcha", () => {
    expect(consultarEstado()).toEqual({ codigo: 200, cuerpo: { estado: "en marcha" } });
  });

  it("con un formato responde 400 Formato no admitido", () => {
    expect(consultarEstado("xml")).toEqual({ codigo: 400, cuerpo: { error: "Formato no admitido" } });
  });
});

describe("GET /api/estado", () => {
  it("devuelve 200 con el estado", async () => {
    const app = Fastify();
    await app.register(rutas);
    const respuesta = await app.inject("/api/estado");
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: "en marcha" });
    await app.close();
  });

  it("devuelve 400 con formato=xml", async () => {
    const app = Fastify();
    await app.register(rutas);
    const respuesta = await app.inject("/api/estado?formato=xml");
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Formato no admitido" });
    await app.close();
  });
});
