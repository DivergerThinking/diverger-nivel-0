import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { AltaDeEquipos } from "./AltaDeEquipos.js";

const SESION: Sesion = { token: "token-de-ana", persona: { email: "ana.perez@empresa.example", nombre: "Ana Pérez" } };

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

describe("pantalla Alta de equipos", () => {
  it("da de alta el equipo con el token de la sesión y lo enseña como no prestado", async () => {
    const fetch = vi.fn(() => Promise.resolve(respuesta({ id: "e1", nombre: "Portátil 07", prestado: false }, 201)));
    vi.stubGlobal("fetch", fetch);
    render(<AltaDeEquipos sesion={SESION} />);
    darDeAlta("Portátil 07");
    expect(await screen.findByText("Portátil 07 · No prestado")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana", "content-type": "application/json" },
      body: JSON.stringify({ nombre: "Portátil 07" }),
    });
  });

  it("enseña los dos equipos cuando se dan de alta con nombres distintos", async () => {
    const equipos = [
      { id: "e1", nombre: "Portátil 07", prestado: false },
      { id: "e2", nombre: "Portátil 08", prestado: false },
    ];
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta(equipos.shift(), 201)));
    render(<AltaDeEquipos sesion={SESION} />);
    darDeAlta("Portátil 07");
    await screen.findByText("Portátil 07 · No prestado");
    darDeAlta("Portátil 08");
    expect(await screen.findByText("Portátil 08 · No prestado")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("con un nombre repetido enseña el aviso de la API y la lista sigue con un solo equipo", async () => {
    const respuestas = [
      respuesta({ id: "e1", nombre: "Portátil 07", prestado: false }, 201),
      respuesta({ error: "Ya hay un equipo con ese nombre" }, 409),
    ];
    const fetch = vi.fn(() => Promise.resolve(respuestas.shift() as Response));
    vi.stubGlobal("fetch", fetch);
    render(<AltaDeEquipos sesion={SESION} />);
    darDeAlta("Portátil 07");
    await screen.findByText("Portátil 07 · No prestado");
    darDeAlta(" portátil 07 ");
    expect((await screen.findByRole("alert")).textContent).toBe("Ya hay un equipo con ese nombre");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Portátil 07 · No prestado")).toBeTruthy();
  });

  it.each([
    [400, "Falta el nombre del equipo"],
    [409, "Ya hay un equipo con ese nombre"],
    [401, "Inicia sesión con Google."],
  ])("enseña el mensaje de la API con el código %i tal cual", async (status, mensaje) => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: mensaje }, status)));
    render(<AltaDeEquipos sesion={SESION} />);
    darDeAlta("Portátil 07");
    expect((await screen.findByRole("alert")).textContent).toBe(mensaje);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
