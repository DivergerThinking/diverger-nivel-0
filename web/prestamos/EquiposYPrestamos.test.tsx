import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { EquiposYPrestamos } from "./EquiposYPrestamos.js";

const SESION: Sesion = { token: "token-de-ana", persona: { email: "ana.perez@empresa.example", nombre: "Ana Pérez" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("apuntar un préstamo", () => {
  const LIBRE = { id: "e1", nombre: "Portátil 07", prestado: false };

  function rellenar(persona: string, devolucion: string) {
    fireEvent.change(screen.getByLabelText("Persona de Portátil 07"), { target: { value: persona } });
    fireEvent.change(screen.getByLabelText("Devolución de Portátil 07"), { target: { value: devolucion } });
    fireEvent.click(screen.getByRole("button", { name: "Apuntar préstamo de Portátil 07" }));
  }

  it("llama a la operación con el token y actualiza la lista con la respuesta", async () => {
    const prestado = { ...LIBRE, prestado: true, persona: "Ana Pérez", devolucion: "2026-12-04" };
    const fetch = vi.fn((ruta: string) => Promise.resolve(ruta === "/api/equipos" ? respuesta([LIBRE]) : respuesta(prestado, 201)));
    vi.stubGlobal("fetch", fetch);
    render(<EquiposYPrestamos sesion={SESION} />);
    await screen.findByText("Portátil 07 · No prestado");
    rellenar("Ana Pérez", "2026-12-04");
    expect(await screen.findByText("Portátil 07 · Prestado a Ana Pérez hasta el 2026-12-04")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e1/prestamo", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana", "content-type": "application/json" },
      body: JSON.stringify({ persona: "Ana Pérez", devolucion: "2026-12-04" }),
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    [400, "Faltan la persona o la fecha de devolución"],
    [400, "La fecha de devolución no es válida"],
    [404, "No existe el equipo"],
    [409, "El equipo ya está prestado"],
  ])("con un %i enseña el mensaje de la API y el equipo sigue sin prestar", async (status, mensaje) => {
    vi.stubGlobal("fetch", (ruta: string) =>
      Promise.resolve(ruta === "/api/equipos" ? respuesta([LIBRE]) : respuesta({ error: mensaje }, status)),
    );
    render(<EquiposYPrestamos sesion={SESION} />);
    await screen.findByText("Portátil 07 · No prestado");
    rellenar("", "2026-12-04");
    expect((await screen.findByRole("alert")).textContent).toBe(mensaje);
    expect(screen.getByText("Portátil 07 · No prestado")).toBeTruthy();
  });
});

describe("pantalla Equipos y préstamos", () => {
  it("enseña los prestados con la persona y la fecha, y los libres como no prestados, con el token de la sesión", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        respuesta([
          { id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
          { id: "e2", nombre: "Proyector sala 2", prestado: false },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<EquiposYPrestamos sesion={SESION} />);
    expect(await screen.findByText("Portátil 07 · Prestado a Ana Pérez hasta el 2026-11-20")).toBeTruthy();
    expect(screen.getByText("Proyector sala 2 · No prestado")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith("/api/equipos", { method: "GET", headers: { authorization: "Bearer token-de-ana" } });
  });

  it("sin sesión enseña el mensaje de la API y ningún equipo", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401)));
    render(<EquiposYPrestamos sesion={SESION} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicia sesión con Google.");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
