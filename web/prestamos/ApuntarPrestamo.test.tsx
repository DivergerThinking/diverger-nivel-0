import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { ApuntarPrestamo } from "./ApuntarPrestamo.js";

const SESION: Sesion = { token: "token-de-it", persona: { email: "it@empresa.example", nombre: "IT" } };

const EQUIPOS = [
  { id: "e1", nombre: "Portátil 07", prestado: false },
  { id: "e2", nombre: "Proyector sala 2", prestado: true, persona: "Luis Gómez", devolucion: "2027-01-10" },
];

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function rellenar() {
  fireEvent.change(screen.getByLabelText("Equipo"), { target: { value: "e1" } });
  fireEvent.change(screen.getByLabelText("Persona"), { target: { value: "Ana Pérez" } });
  fireEvent.change(screen.getByLabelText("Fecha de devolución (AAAA-MM-DD)"), { target: { value: "2026-12-15" } });
  fireEvent.click(screen.getByRole("button", { name: "Apuntar préstamo" }));
}

describe("pantalla Apuntar un préstamo", () => {
  it("ofrece solo los equipos libres", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta(EQUIPOS)));
    render(<ApuntarPrestamo sesion={SESION} />);
    expect(await screen.findByRole("option", { name: "Portátil 07" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Proyector sala 2" })).toBeNull();
  });

  it("apunta el préstamo con el token de la sesión y enseña que consta", async () => {
    const fetch = vi.fn((ruta: string, opciones: { method: string }) =>
      Promise.resolve(
        opciones.method === "POST"
          ? respuesta({ id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-12-15" }, 201)
          : respuesta(EQUIPOS),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<ApuntarPrestamo sesion={SESION} />);
    await screen.findByRole("option", { name: "Portátil 07" });
    rellenar();
    expect(await screen.findByText("Préstamo apuntado: Portátil 07 a Ana Pérez hasta 2026-12-15")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e1/prestamo", {
      method: "POST",
      headers: { authorization: "Bearer token-de-it", "content-type": "application/json" },
      body: JSON.stringify({ persona: "Ana Pérez", devolucion: "2026-12-15" }),
    });
  });

  it.each([
    [400, "Faltan la persona o la fecha de devolución"],
    [400, "La fecha de devolución no es válida"],
    [409, "El equipo ya está prestado"],
  ])("enseña tal cual el mensaje de la API con un %i: %s", async (status, mensaje) => {
    vi.stubGlobal("fetch", (_ruta: string, opciones: { method: string }) =>
      Promise.resolve(opciones.method === "POST" ? respuesta({ error: mensaje }, status) : respuesta(EQUIPOS)),
    );
    render(<ApuntarPrestamo sesion={SESION} />);
    await screen.findByRole("option", { name: "Portátil 07" });
    rellenar();
    expect((await screen.findByRole("alert")).textContent).toBe(mensaje);
  });

  it("enseña «Inicia sesión con Google.» si la lista responde 401", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401)));
    render(<ApuntarPrestamo sesion={SESION} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicia sesión con Google.");
  });

  it("avisa si no se ha elegido equipo y no llama a la API", async () => {
    const fetch = vi.fn(() => Promise.resolve(respuesta(EQUIPOS)));
    vi.stubGlobal("fetch", fetch);
    render(<ApuntarPrestamo sesion={SESION} />);
    await screen.findByRole("option", { name: "Portátil 07" });
    fireEvent.click(screen.getByRole("button", { name: "Apuntar préstamo" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Elige un equipo libre");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
