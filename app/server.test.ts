import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { almacenEnMemoria, type OpcionesContexto } from "../lib/datos.js";
import { crearServidor } from "./server.js";

const ANA = { email: "ana@example.com", nombre: "Ana" };
const verificarToken = (token: string) => Promise.resolve(token === "token-bueno" ? ANA : null);

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

describe("servidor", () => {
  it("responde a la comprobación de salud sin sesión", async () => {
    app = await crearServidor({ googleClientId: "cliente", verificarToken });
    const respuesta = await app.inject("/api/salud");
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: "ok" });
  });

  it("da el ID de cliente de Google al frontend", async () => {
    app = await crearServidor({ googleClientId: "cliente", verificarToken });
    expect((await app.inject("/api/config")).json()).toEqual({ googleClientId: "cliente" });
  });

  it("rechaza la API sin token o con un token no válido", async () => {
    app = await crearServidor({ googleClientId: "cliente", verificarToken });
    expect((await app.inject("/api/yo")).statusCode).toBe(401);
    const malo = await app.inject({ url: "/api/yo", headers: { authorization: "Bearer token-malo" } });
    expect(malo.statusCode).toBe(401);
    expect(malo.json()).toEqual({ error: "Inicia sesión con Google." });
  });

  it("sin ID de cliente arranca y cierra la API con 503", async () => {
    app = await crearServidor({ googleClientId: "", verificarToken });
    expect((await app.inject("/api/salud")).statusCode).toBe(200);
    expect((await app.inject("/api/config")).json()).toEqual({ googleClientId: "" });
    const conToken = await app.inject({ url: "/api/yo", headers: { authorization: "Bearer token-bueno" } });
    expect(conToken.statusCode).toBe(503);
    expect(conToken.json()).toEqual({ error: "Inicio de sesión sin configurar." });
  });

  it("identifica a la persona y sirve las rutas de los contextos", async () => {
    app = await crearServidor({ googleClientId: "cliente", verificarToken });
    const headers = { authorization: "Bearer token-bueno" };
    expect((await app.inject({ url: "/api/yo", headers })).json()).toEqual(ANA);
    expect((await app.inject({ url: "/api/ejemplo/saludo", headers })).json()).toEqual({ mensaje: "Hola, Ana" });
  });

  it("cada contexto recibe el almacén de datos en sus opciones (HU-GP-01)", async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardar("prueba_equipos", "pc-07", { nombre: "Portátil 07" });
    const contexto: FastifyPluginAsync<OpcionesContexto> = (instancia, opciones) => {
      instancia.get("/api/prueba/equipos", () => opciones.almacen.listar("prueba_equipos"));
      return Promise.resolve();
    };
    app = await crearServidor({ googleClientId: "cliente", verificarToken, almacen, contextos: [contexto] });
    const respuesta = await app.inject({ url: "/api/prueba/equipos", headers: { authorization: "Bearer token-bueno" } });
    expect(respuesta.json()).toEqual([{ nombre: "Portátil 07" }]);
  });

  it("sirve el frontend y devuelve index.html en las rutas de la aplicación", async () => {
    const web = mkdtempSync(join(tmpdir(), "web-"));
    try {
      writeFileSync(join(web, "index.html"), "<!doctype html><title>App</title>");
      app = await crearServidor({ googleClientId: "cliente", verificarToken, webRoot: web });
      expect((await app.inject("/")).body).toContain("<title>App</title>");
      expect((await app.inject("/prestamos/42")).body).toContain("<title>App</title>");
      const headers = { authorization: "Bearer token-bueno" };
      expect((await app.inject({ url: "/api/no-existe", headers })).statusCode).toBe(404);
    } finally {
      rmSync(web, { recursive: true, force: true });
    }
  });
});
