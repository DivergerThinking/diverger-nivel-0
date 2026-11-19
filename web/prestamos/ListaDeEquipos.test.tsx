import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { ListaDeEquipos } from "./ListaDeEquipos.js";

const SESION: Sesion = { token: "token-de-ana", persona: { email: "ana@example.com", nombre: "Ana" } };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pantalla Equipos y préstamos", () => {
  it("pide la lista con el token de la sesión y enseña los equipos prestados y no prestados", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        respuesta([
          { id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
          { id: "e2", nombre: "Proyector sala 2", prestado: false },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<ListaDeEquipos sesion={SESION} />);
    expect(await screen.findByText("Portátil 07: prestado a Ana Pérez hasta 2026-11-20")).toBeTruthy();
    expect(screen.getByText("Proyector sala 2: no prestado")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos", {
      method: "GET",
      headers: { authorization: "Bearer token-de-ana" },
    });
  });

  it("enseña que no hay equipos con la lista vacía", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta([])));
    render(<ListaDeEquipos sesion={SESION} />);
    expect(await screen.findByText("Todavía no hay equipos.")).toBeTruthy();
  });

  it("enseña «Inicia sesión con Google.» y ningún equipo si la API responde 401", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401)));
    render(<ListaDeEquipos sesion={SESION} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicia sesión con Google.");
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
