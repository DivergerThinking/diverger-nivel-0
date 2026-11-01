import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { crearPrestamos, PrestamoError, rutas } from "./index.js";

describe("prestar", () => {
  it("deja el préstamo activo a nombre de la persona", () => {
    expect(crearPrestamos().prestar({ equipo: "PC-07", persona: "Ana Pérez" })).toEqual({
      equipo: "PC-07",
      persona: "Ana Pérez",
      activo: true,
    });
  });

  it("rechaza un equipo ya prestado y no crea el préstamo", () => {
    const prestamos = crearPrestamos();
    prestamos.prestar({ equipo: "PC-07", persona: "Luis Gil" });
    expect(() => prestamos.prestar({ equipo: "PC-07", persona: "Ana Pérez" })).toThrow(
      new PrestamoError(409, "El equipo ya está prestado"),
    );
  });

  it("exige el equipo y la persona", () => {
    const prestamos = crearPrestamos();
    expect(() => prestamos.prestar({ equipo: "PC-07" })).toThrow("Faltan el equipo o la persona");
    expect(() => prestamos.prestar({ equipo: " ", persona: "Ana" })).toThrow("Faltan el equipo o la persona");
  });
});

describe("POST /api/prestamos", () => {
  async function servidor() {
    const app = Fastify();
    await app.register(rutas);
    return app;
  }

  it("crea el préstamo con 201", async () => {
    const app = await servidor();
    const respuesta = await app.inject({
      method: "POST",
      url: "/api/prestamos",
      payload: { equipo: "PC-07", persona: "Ana Pérez" },
    });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({ equipo: "PC-07", persona: "Ana Pérez", activo: true });
  });

  it("responde 409 «El equipo ya está prestado» al prestarlo otra vez", async () => {
    const app = await servidor();
    await app.inject({ method: "POST", url: "/api/prestamos", payload: { equipo: "PC-07", persona: "Luis Gil" } });
    const respuesta = await app.inject({
      method: "POST",
      url: "/api/prestamos",
      payload: { equipo: "PC-07", persona: "Ana Pérez" },
    });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "El equipo ya está prestado" });
  });

  it("responde 400 si faltan datos", async () => {
    const app = await servidor();
    const respuesta = await app.inject({ method: "POST", url: "/api/prestamos", payload: { equipo: "PC-07" } });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Faltan el equipo o la persona" });
  });
});
