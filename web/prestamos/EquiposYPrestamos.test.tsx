import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
