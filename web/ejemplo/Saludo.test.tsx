// Así se prueba una pantalla (ADR 0053 del harness): con Testing Library, la API simulada con fetch y una sesión de
// prueba. Se comprueba lo que ve la persona y que la llamada lleva el token.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { Saludo } from "./Saludo.js";

const SESION: Sesion = { token: "token-de-ana", persona: { email: "ana@example.com", nombre: "Ana" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pantalla Saludo", () => {
  it("enseña el saludo de la API, pedido con el token de la sesión", async () => {
    const fetch = vi.fn(() => Promise.resolve(respuesta({ mensaje: "Hola, Ana" })));
    vi.stubGlobal("fetch", fetch);
    render(<Saludo sesion={SESION} />);
    expect(await screen.findByText("Hola, Ana")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/ejemplo/saludo", { method: "GET", headers: { authorization: "Bearer token-de-ana" } });
  });

  it("enseña el mensaje de error de la API tal cual", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401)));
    render(<Saludo sesion={SESION} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicia sesión con Google.");
  });
});
