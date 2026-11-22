import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { AltaDeEquipo } from "./AltaDeEquipo.js";

const SESION: Sesion = { token: "token-de-it", persona: { email: "it@empresa.example", nombre: "IT" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

function darDeAlta(nombre: string) {
  render(<AltaDeEquipo sesion={SESION} />);
  fireEvent.change(screen.getByLabelText("Nombre del equipo"), { target: { value: nombre } });
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pantalla Alta de equipo", () => {
  it("da de alta el equipo con el token de la sesión y enseña su nombre", async () => {
    const fetch = vi.fn(() => Promise.resolve(respuesta({ id: "e1", nombre: "Portátil 07", prestado: false }, 201)));
    vi.stubGlobal("fetch", fetch);
    darDeAlta("Portátil 07");
    expect(await screen.findByText("Equipo dado de alta: Portátil 07")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos", {
      method: "POST",
      headers: { authorization: "Bearer token-de-it", "content-type": "application/json" },
      body: JSON.stringify({ nombre: "Portátil 07" }),
    });
  });

  it("enseña «Falta el nombre del equipo» tal cual si el nombre está vacío", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Falta el nombre del equipo" }, 400)));
    darDeAlta("");
    expect((await screen.findByRole("alert")).textContent).toBe("Falta el nombre del equipo");
  });

  it("enseña «Ya hay un equipo con ese nombre» tal cual si el nombre está repetido", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Ya hay un equipo con ese nombre" }, 409)));
    darDeAlta(" portátil 07 ");
    expect((await screen.findByRole("alert")).textContent).toBe("Ya hay un equipo con ese nombre");
  });
});
