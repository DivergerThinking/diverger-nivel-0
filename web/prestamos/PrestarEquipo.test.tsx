import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { PrestarEquipo } from "./PrestarEquipo.js";

const SESION: Sesion = { token: "token-de-it", persona: { email: "it@empresa.example", nombre: "IT" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

const LIBRE = { id: "7", nombre: "Portátil 07", prestado: false };
const PRESTADO = { ...LIBRE, prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function rellenar(persona: string, devolucion: string) {
  fireEvent.click(screen.getByText("Prestar Portátil 07"));
  fireEvent.change(screen.getByLabelText("Persona"), { target: { value: persona } });
  fireEvent.change(screen.getByLabelText("Fecha de devolución (AAAA-MM-DD)"), { target: { value: devolucion } });
  fireEvent.click(screen.getByText("Apuntar préstamo"));
}

describe("pantalla Prestar un equipo", () => {
  it("enseña solo los equipos sin prestar", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta([LIBRE, { id: "8", nombre: "Proyector", ...{ prestado: true } }])));
    render(<PrestarEquipo sesion={SESION} />);
    expect(await screen.findByText("Prestar Portátil 07")).toBeTruthy();
    expect(screen.queryByText("Prestar Proyector")).toBeNull();
  });

  it("apunta el préstamo con el token y enseña el resultado", async () => {
    const fetch = vi.fn((_ruta: string, opciones: { method: string }) =>
      Promise.resolve(opciones.method === "POST" ? respuesta(PRESTADO, 201) : respuesta([LIBRE])),
    );
    vi.stubGlobal("fetch", fetch);
    render(<PrestarEquipo sesion={SESION} />);
    await screen.findByText("Prestar Portátil 07");
    rellenar("Ana Pérez", "2026-11-20");
    expect(await screen.findByText("«Portátil 07» prestado a Ana Pérez hasta el 2026-11-20.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/7/prestamo", {
      method: "POST",
      headers: { authorization: "Bearer token-de-it", "content-type": "application/json" },
      body: JSON.stringify({ persona: "Ana Pérez", devolucion: "2026-11-20" }),
    });
  });

  it.each([
    [400, "Faltan la persona o la fecha de devolución"],
    [400, "La fecha de devolución no es válida"],
    [409, "El equipo ya está prestado"],
    [404, "No existe el equipo"],
  ])("enseña tal cual el error %i de la API: %s", async (status, error) => {
    vi.stubGlobal("fetch", (_ruta: string, opciones: { method: string }) =>
      Promise.resolve(opciones.method === "POST" ? respuesta({ error }, status) : respuesta([LIBRE])),
    );
    render(<PrestarEquipo sesion={SESION} />);
    await screen.findByText("Prestar Portátil 07");
    rellenar("Ana Pérez", "2026-02-30");
    expect((await screen.findByRole("alert")).textContent).toBe(error);
  });
});
