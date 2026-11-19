import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { AltaDeEquipo } from "./AltaDeEquipo.js";

const SESION: Sesion = { token: "token-de-ana", persona: { email: "ana@example.com", nombre: "Ana" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function darDeAlta(nombre: string) {
  fireEvent.change(screen.getByLabelText("Nombre del equipo"), { target: { value: nombre } });
  fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }));
}

describe("pantalla Alta de equipo", () => {
  it("da de alta el equipo con el token de la sesión y lo enseña como no prestado", async () => {
    const fetch = vi.fn(() => Promise.resolve(respuesta({ id: "e1", nombre: "Portátil 07", prestado: false }, 201)));
    vi.stubGlobal("fetch", fetch);
    render(<AltaDeEquipo sesion={SESION} />);
    darDeAlta("Portátil 07");
    expect(await screen.findByText("Portátil 07: no prestado")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana", "content-type": "application/json" },
      body: JSON.stringify({ nombre: "Portátil 07" }),
    });
  });

  it("enseña «Falta el nombre del equipo» con el nombre vacío", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Falta el nombre del equipo" }, 400)));
    render(<AltaDeEquipo sesion={SESION} />);
    darDeAlta("");
    expect((await screen.findByRole("alert")).textContent).toBe("Falta el nombre del equipo");
  });

  it("enseña «Ya hay un equipo con ese nombre» cuando el nombre está repetido", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Ya hay un equipo con ese nombre" }, 409)));
    render(<AltaDeEquipo sesion={SESION} />);
    darDeAlta(" portátil 07 ");
    expect((await screen.findByRole("alert")).textContent).toBe("Ya hay un equipo con ese nombre");
    expect(screen.queryByText(/no prestado/)).toBeNull();
  });
});
