import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { DevolverEquipo } from "./DevolverEquipo.js";

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

describe("pantalla Apuntar la devolución", () => {
  it("enseña solo los equipos prestados con su persona y fecha", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta([PRESTADO, { id: "8", nombre: "Proyector", prestado: false }])));
    render(<DevolverEquipo sesion={SESION} />);
    expect(await screen.findByText("Devolver Portátil 07")).toBeTruthy();
    expect(screen.getByText(/Ana Pérez, hasta el 2026-11-20/)).toBeTruthy();
    expect(screen.queryByText("Devolver Proyector")).toBeNull();
  });

  it("apunta la devolución con el token y enseña el resultado", async () => {
    let devuelto = false;
    const fetch = vi.fn((_ruta: string, opciones: { method: string }) => {
      if (opciones.method === "POST") {
        devuelto = true;
        return Promise.resolve(respuesta(LIBRE));
      }
      return Promise.resolve(respuesta(devuelto ? [LIBRE] : [PRESTADO]));
    });
    vi.stubGlobal("fetch", fetch);
    render(<DevolverEquipo sesion={SESION} />);
    fireEvent.click(await screen.findByText("Devolver Portátil 07"));
    expect(await screen.findByText("«Portátil 07» devuelto: ya consta como libre.")).toBeTruthy();
    expect(await screen.findByText("No hay equipos prestados.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/7/devolucion", {
      method: "POST",
      headers: { authorization: "Bearer token-de-it" },
    });
  });

  it.each([
    [409, "El equipo no está prestado"],
    [404, "No existe el equipo"],
  ])("enseña tal cual el error %i de la API: %s", async (status, error) => {
    vi.stubGlobal("fetch", (_ruta: string, opciones: { method: string }) =>
      Promise.resolve(opciones.method === "POST" ? respuesta({ error }, status) : respuesta([PRESTADO])),
    );
    render(<DevolverEquipo sesion={SESION} />);
    fireEvent.click(await screen.findByText("Devolver Portátil 07"));
    expect((await screen.findByRole("alert")).textContent).toBe(error);
  });
});
