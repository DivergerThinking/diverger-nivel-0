import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { ApuntarDevolucion } from "./ApuntarDevolucion.js";

const SESION: Sesion = { token: "token-de-it", persona: { email: "it@empresa.example", nombre: "IT" } };

const EQUIPOS = [
  { id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-12-15" },
  { id: "e2", nombre: "Proyector sala 2", prestado: false },
];

const OPCION_PORTATIL = "Portátil 07: Ana Pérez hasta 2026-12-15";

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function devolver() {
  fireEvent.change(screen.getByLabelText("Equipo prestado"), { target: { value: "e1" } });
  fireEvent.click(screen.getByRole("button", { name: "Apuntar devolución" }));
}

describe("pantalla Apuntar una devolución", () => {
  it("ofrece solo los equipos prestados, con la persona y la fecha", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta(EQUIPOS)));
    render(<ApuntarDevolucion sesion={SESION} />);
    expect(await screen.findByRole("option", { name: OPCION_PORTATIL })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Proyector sala 2/ })).toBeNull();
  });

  it("apunta la devolución con el token de la sesión y enseña que el equipo está libre", async () => {
    const fetch = vi.fn((_ruta: string, opciones: { method: string }) =>
      Promise.resolve(
        opciones.method === "POST" ? respuesta({ id: "e1", nombre: "Portátil 07", prestado: false }) : respuesta(EQUIPOS),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<ApuntarDevolucion sesion={SESION} />);
    await screen.findByRole("option", { name: OPCION_PORTATIL });
    devolver();
    expect(await screen.findByText("Devolución apuntada: Portátil 07 está libre")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e1/devolucion", {
      method: "POST",
      headers: { authorization: "Bearer token-de-it" },
    });
  });

  it.each([
    [409, "El equipo no está prestado"],
    [404, "No existe el equipo"],
  ])("enseña tal cual el mensaje de la API con un %i: %s", async (status, mensaje) => {
    vi.stubGlobal("fetch", (_ruta: string, opciones: { method: string }) =>
      Promise.resolve(opciones.method === "POST" ? respuesta({ error: mensaje }, status) : respuesta(EQUIPOS)),
    );
    render(<ApuntarDevolucion sesion={SESION} />);
    await screen.findByRole("option", { name: OPCION_PORTATIL });
    devolver();
    expect((await screen.findByRole("alert")).textContent).toBe(mensaje);
  });

  it("enseña «Inicia sesión con Google.» si la lista responde 401", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401)));
    render(<ApuntarDevolucion sesion={SESION} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicia sesión con Google.");
  });

  it("avisa si no se ha elegido equipo y no llama a la API", async () => {
    const fetch = vi.fn(() => Promise.resolve(respuesta(EQUIPOS)));
    vi.stubGlobal("fetch", fetch);
    render(<ApuntarDevolucion sesion={SESION} />);
    await screen.findByRole("option", { name: OPCION_PORTATIL });
    fireEvent.click(screen.getByRole("button", { name: "Apuntar devolución" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Elige un equipo prestado");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
