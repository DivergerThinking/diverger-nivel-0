import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { EquiposYPrestamos } from "./EquiposYPrestamos.js";

const SESION: Sesion = { token: "token-de-ana", persona: { email: "ana.perez@example.com", nombre: "Ana" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pantalla Equipos y préstamos", () => {
  it("enseña los equipos prestados con la persona y la fecha, y los demás como no prestados", async () => {
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
    expect(await screen.findByText("Portátil 07: prestado a Ana Pérez hasta 2026-11-20")).toBeTruthy();
    expect(screen.getByText("Proyector sala 2: no prestado")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos", {
      method: "GET",
      headers: { authorization: "Bearer token-de-ana" },
    });
  });

  it("enseña la lista sin ningún equipo cuando no hay", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta([])));
    render(<EquiposYPrestamos sesion={SESION} />);
    expect(await screen.findByText("No hay equipos.")).toBeTruthy();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("enseña tal cual el mensaje de error de la API", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401)));
    render(<EquiposYPrestamos sesion={SESION} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicia sesión con Google.");
  });
});
