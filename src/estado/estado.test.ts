import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { consultarEstado, rutas } from "./index.js";

describe("consultarEstado", () => {
  it("sin formato responde que el servicio está en marcha", () => {
    expect(consultarEstado()).toEqual({ codigo: 200, cuerpo: { estado: "en marcha" } });
  });

  it("con un formato no admitido responde «Formato no admitido»", () => {
    expect(consultarEstado("xml")).toEqual({ codigo: 400, cuerpo: { error: "Formato no admitido" } });
  });
});

describe("GET /api/estado", () => {
  it("criterio 1: devuelve 200 con el estado en marcha", async () => {
    const app = Fastify();
    await app.register(rutas);
    const respuesta = await app.inject("/api/estado");
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: "en marcha" });
    await app.close();
  });

  it("criterio 2: con formato=xml devuelve 400 «Formato no admitido»", async () => {
    const app = Fastify();
    await app.register(rutas);
    const respuesta = await app.inject("/api/estado?formato=xml");
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Formato no admitido" });
    await app.close();
  });
});
