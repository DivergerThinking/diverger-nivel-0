import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { AltaEquipo } from "./AltaEquipo.js";

const SESION: Sesion = { token: "token-de-it", persona: { email: "it@empresa.example", nombre: "IT" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

function darDeAlta(nombre: string) {
  fireEvent.change(screen.getByLabelText("Nombre del equipo"), { target: { value: nombre } });
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pantalla Alta de equipo", () => {
  it("llama a la API con el token y enseña el equipo creado sin prestar", async () => {
    const fetch = vi.fn(() => Promise.resolve(respuesta({ id: "1", nombre: "Portátil 07", prestado: false }, 201)));
    vi.stubGlobal("fetch", fetch);
    render(<AltaEquipo sesion={SESION} />);
    darDeAlta("Portátil 07");
    expect(await screen.findByText("Equipo «Portátil 07» dado de alta, sin prestar.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos", {
      method: "POST",
      headers: { authorization: "Bearer token-de-it", "content-type": "application/json" },
      body: JSON.stringify({ nombre: "Portátil 07" }),
    });
  });

  it.each([
    [400, "Falta el nombre del equipo"],
    [409, "Ya hay un equipo con ese nombre"],
  ])("enseña tal cual el error %i de la API", async (status, mensaje) => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: mensaje }, status)));
    render(<AltaEquipo sesion={SESION} />);
    darDeAlta("");
    expect((await screen.findByRole("alert")).textContent).toBe(mensaje);
  });
});
