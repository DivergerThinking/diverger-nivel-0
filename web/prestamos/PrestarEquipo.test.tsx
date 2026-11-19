import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Sesion } from "../pantallas.js";
import { PrestarEquipo } from "./PrestarEquipo.js";

const SESION: Sesion = { token: "token-de-ana", persona: { email: "ana@example.com", nombre: "Ana" } };
const LISTA = [{ id: "e1", nombre: "Portátil 07", prestado: false }];

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

/** La lista de equipos al abrir la pantalla y, después, la respuesta del préstamo. */
function servidor(prestamo: Response) {
  const fetch = vi.fn((ruta: string) => Promise.resolve(ruta === "/api/equipos" ? respuesta(LISTA) : prestamo));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function apuntar(persona: string, devolucion: string) {
  await screen.findByRole("option", { name: "Portátil 07" });
  fireEvent.change(screen.getByLabelText("Persona"), { target: { value: persona } });
  fireEvent.change(screen.getByLabelText("Fecha de devolución (AAAA-MM-DD)"), { target: { value: devolucion } });
  fireEvent.click(screen.getByRole("button", { name: "Apuntar préstamo" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pantalla Prestar un equipo", () => {
  it("apunta el préstamo con el token de la sesión y enseña el equipo prestado", async () => {
    const fetch = servidor(
      respuesta({ id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" }, 201),
    );
    render(<PrestarEquipo sesion={SESION} />);
    await apuntar("Ana Pérez", "2026-11-20");
    expect(await screen.findByText("Portátil 07: prestado a Ana Pérez hasta 2026-11-20")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e1/prestamo", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana", "content-type": "application/json" },
      body: JSON.stringify({ persona: "Ana Pérez", devolucion: "2026-11-20" }),
    });
  });

  it("avisa «La fecha de devolución no es válida» con 2026-02-30 y no enseña el equipo como prestado", async () => {
    const fetch = servidor(respuesta({ error: "La fecha de devolución no es válida" }, 400));
    render(<PrestarEquipo sesion={SESION} />);
    await apuntar("Ana Pérez", "2026-02-30");
    expect((await screen.findByRole("alert")).textContent).toBe("La fecha de devolución no es válida");
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e1/prestamo", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana", "content-type": "application/json" },
      body: JSON.stringify({ persona: "Ana Pérez", devolucion: "2026-02-30" }),
    });
    expect(screen.queryByText(/prestado a/)).toBeNull();
  });

  it("enseña el equipo prestado con una fecha de devolución pasada", async () => {
    servidor(
      respuesta({ id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-02" }, 201),
    );
    render(<PrestarEquipo sesion={SESION} />);
    await apuntar("Ana Pérez", "2026-11-02");
    expect(await screen.findByText("Portátil 07: prestado a Ana Pérez hasta 2026-11-02")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    [400, "Faltan la persona o la fecha de devolución"],
    [404, "No existe el equipo"],
    [409, "El equipo ya está prestado"],
  ])("enseña el mensaje de la API con el error %i", async (status, mensaje) => {
    servidor(respuesta({ error: mensaje }, status));
    render(<PrestarEquipo sesion={SESION} />);
    await apuntar("", "2026-11-20");
    expect((await screen.findByRole("alert")).textContent).toBe(mensaje);
    expect(screen.queryByText(/prestado a/)).toBeNull();
  });
});
