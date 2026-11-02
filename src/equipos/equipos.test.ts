import { describe, expect, it } from "vitest";
import { crearServidor } from "../../app/server.js";
import { almacenEnMemoria } from "../../lib/datos.js";
import { COLECCION, type Equipo } from "./equipos.js";
import { rutas } from "./index.js";

async function preparar() {
  const almacen = almacenEnMemoria();
  const app = await crearServidor({
    googleClientId: "cliente",
    verificarToken: (token) =>
      Promise.resolve(token === "valido" ? { nombre: "Ana", email: "ana@example.com" } : null),
    almacen,
    contextos: [rutas],
  });
  const enviar = (payload?: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/equipos",
      headers: { authorization: "Bearer valido" },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  return { almacen, app, enviar };
}

describe("POST /api/equipos", () => {
  it("da de alta un equipo no prestado y lo guarda", async () => {
    const { almacen, enviar } = await preparar();
    const respuesta = await enviar({ nombre: "Portátil 07" });
    expect(respuesta.statusCode).toBe(201);
    const equipo = respuesta.json<Equipo>();
    expect(typeof equipo.id).toBe("string");
    expect(equipo.id).not.toBe("");
    expect({ nombre: equipo.nombre, prestado: equipo.prestado }).toEqual({ nombre: "Portátil 07", prestado: false });
    expect(await almacen.listar(COLECCION)).toHaveLength(1);
  });

  it("responde 400 si el nombre está vacío y no crea nada", async () => {
    const { almacen, enviar } = await preparar();
    const respuesta = await enviar({ nombre: "" });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await almacen.listar(COLECCION)).toHaveLength(0);
  });

  it("responde 400 si falta el nombre y no crea nada", async () => {
    const { almacen, enviar } = await preparar();
    const respuesta = await enviar({});
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({ error: "Falta el nombre del equipo" });
    expect(await almacen.listar(COLECCION)).toHaveLength(0);
  });

  it("responde 400 si el nombre solo tiene espacios", async () => {
    const { enviar } = await preparar();
    expect((await enviar({ nombre: "   " })).statusCode).toBe(400);
  });

  it("da de alta un equipo con otro nombre aunque ya exista «Portátil 07»", async () => {
    const { almacen, enviar } = await preparar();
    await enviar({ nombre: "Portátil 07" });
    const respuesta = await enviar({ nombre: "Proyector sala 2" });
    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json<Equipo>()).toMatchObject({ nombre: "Proyector sala 2", prestado: false });
    expect(await almacen.listar(COLECCION)).toHaveLength(2);
  });

  it("responde 409 si el nombre ya existe y no crea nada", async () => {
    const { almacen, enviar } = await preparar();
    await enviar({ nombre: "Portátil 07" });
    const respuesta = await enviar({ nombre: "Portátil 07" });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    expect(await almacen.listar(COLECCION)).toHaveLength(1);
  });

  it("responde 409 si solo cambian las mayúsculas y los espacios de los extremos", async () => {
    const { almacen, enviar } = await preparar();
    await enviar({ nombre: "Portátil 07" });
    const respuesta = await enviar({ nombre: "portátil 07 " });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toEqual({ error: "Ya hay un equipo con ese nombre" });
    const equipos = await almacen.listar<{ nombre: string }>(COLECCION);
    expect(equipos.map((e) => e.nombre)).toEqual(["Portátil 07"]);
  });

  it("solo crea uno si llegan dos altas con el mismo nombre a la vez", async () => {
    const { almacen, enviar } = await preparar();
    const respuestas = await Promise.all([enviar({ nombre: "Proyector" }), enviar({ nombre: "PROYECTOR" })]);
    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await almacen.listar(COLECCION)).toHaveLength(1);
  });

  it("admite nombres con barras sin confundirlos", async () => {
    const { enviar } = await preparar();
    expect((await enviar({ nombre: "Sala 1/2" })).statusCode).toBe(201);
    expect((await enviar({ nombre: "Sala 1" })).statusCode).toBe(201);
  });

  it("responde 401 sin token y no crea nada", async () => {
    const { almacen, app } = await preparar();
    const respuesta = await app.inject({ method: "POST", url: "/api/equipos", payload: { nombre: "X" } });
    expect(respuesta.statusCode).toBe(401);
    expect(await almacen.listar(COLECCION)).toHaveLength(0);
  });
});
