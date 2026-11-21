import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("apunta el préstamo desde la lista y la enseña al día", async () => {
    let prestado = false;
    const fetch = vi.fn((ruta: string) => {
      if (ruta === "/api/equipos/e2/prestamo") {
        prestado = true;
        return Promise.resolve(
          respuesta({ id: "e2", nombre: "Proyector sala 2", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" }, 201),
        );
      }
      return Promise.resolve(
        respuesta([
          prestado
            ? { id: "e2", nombre: "Proyector sala 2", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" }
            : { id: "e2", nombre: "Proyector sala 2", prestado: false },
        ]),
      );
    });
    vi.stubGlobal("fetch", fetch);
    render(<EquiposYPrestamos sesion={SESION} />);
    fireEvent.change(await screen.findByLabelText("Persona de Proyector sala 2"), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByLabelText("Devolución de Proyector sala 2"), { target: { value: "2026-11-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Apuntar préstamo de Proyector sala 2" }));
    expect(await screen.findByText("Proyector sala 2: prestado a Ana Pérez hasta 2026-11-20")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e2/prestamo", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana", "content-type": "application/json" },
      body: JSON.stringify({ persona: "Ana Pérez", devolucion: "2026-11-20" }),
    });
  });

  it("enseña tal cual el mensaje de la API cuando falla apuntar el préstamo", async () => {
    vi.stubGlobal("fetch", (ruta: string) =>
      Promise.resolve(
        ruta.endsWith("/prestamo")
          ? respuesta({ error: "Faltan la persona o la fecha de devolución" }, 400)
          : respuesta([{ id: "e1", nombre: "Portátil 07", prestado: false }]),
      ),
    );
    render(<EquiposYPrestamos sesion={SESION} />);
    fireEvent.click(await screen.findByRole("button", { name: "Apuntar préstamo de Portátil 07" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Faltan la persona o la fecha de devolución");
  });

  it("enseña «La fecha de devolución no es válida» y deja el equipo sin prestar cuando la API responde 400", async () => {
    const fetch = vi.fn((ruta: string) =>
      Promise.resolve(
        ruta === "/api/equipos/e2/prestamo"
          ? respuesta({ error: "La fecha de devolución no es válida" }, 400)
          : respuesta([{ id: "e2", nombre: "Proyector sala 2", prestado: false }]),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<EquiposYPrestamos sesion={SESION} />);
    fireEvent.change(await screen.findByLabelText("Persona de Proyector sala 2"), { target: { value: "Luis Gil" } });
    fireEvent.change(screen.getByLabelText("Devolución de Proyector sala 2"), { target: { value: "2026-11-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Apuntar préstamo de Proyector sala 2" }));
    expect((await screen.findByRole("alert")).textContent).toBe("La fecha de devolución no es válida");
    expect(screen.getByText("Proyector sala 2: no prestado")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e2/prestamo", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana", "content-type": "application/json" },
      body: JSON.stringify({ persona: "Luis Gil", devolucion: "2026-11-20" }),
    });
  });

  it("no enseña el formulario de préstamo en un equipo prestado, solo la devolución", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        respuesta([{ id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" }]),
      ),
    );
    render(<EquiposYPrestamos sesion={SESION} />);
    await screen.findByText("Portátil 07: prestado a Ana Pérez hasta 2026-11-20");
    expect(screen.queryByLabelText("Persona de Portátil 07")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Apuntar devolución de Portátil 07"]);
  });

  it("no enseña la devolución en un equipo sin prestar", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta([{ id: "e2", nombre: "Proyector sala 2", prestado: false }])));
    render(<EquiposYPrestamos sesion={SESION} />);
    await screen.findByText("Proyector sala 2: no prestado");
    expect(screen.queryByRole("button", { name: "Apuntar devolución de Proyector sala 2" })).toBeNull();
  });

  it("apunta la devolución desde la lista y la enseña al día", async () => {
    let devuelto = false;
    const fetch = vi.fn((ruta: string) => {
      if (ruta === "/api/equipos/e1/devolucion") {
        devuelto = true;
        return Promise.resolve(respuesta({ id: "e1", nombre: "Portátil 07", prestado: false }));
      }
      return Promise.resolve(
        respuesta([
          devuelto
            ? { id: "e1", nombre: "Portátil 07", prestado: false }
            : { id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
        ]),
      );
    });
    vi.stubGlobal("fetch", fetch);
    render(<EquiposYPrestamos sesion={SESION} />);
    fireEvent.click(await screen.findByRole("button", { name: "Apuntar devolución de Portátil 07" }));
    expect(await screen.findByText("Portátil 07: no prestado")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/e1/devolucion", {
      method: "POST",
      headers: { authorization: "Bearer token-de-ana" },
    });
  });

  it("enseña «El equipo no está prestado» cuando la API responde 409 a la devolución", async () => {
    vi.stubGlobal("fetch", (ruta: string) =>
      Promise.resolve(
        ruta === "/api/equipos/e1/devolucion"
          ? respuesta({ error: "El equipo no está prestado" }, 409)
          : respuesta([{ id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" }]),
      ),
    );
    render(<EquiposYPrestamos sesion={SESION} />);
    fireEvent.click(await screen.findByRole("button", { name: "Apuntar devolución de Portátil 07" }));
    expect((await screen.findByRole("alert")).textContent).toBe("El equipo no está prestado");
  });

  it("enseña «No existe el equipo» cuando la API responde 404 a la devolución", async () => {
    vi.stubGlobal("fetch", (ruta: string) =>
      Promise.resolve(
        ruta === "/api/equipos/e1/devolucion"
          ? respuesta({ error: "No existe el equipo" }, 404)
          : respuesta([{ id: "e1", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" }]),
      ),
    );
    render(<EquiposYPrestamos sesion={SESION} />);
    fireEvent.click(await screen.findByRole("button", { name: "Apuntar devolución de Portátil 07" }));
    expect((await screen.findByRole("alert")).textContent).toBe("No existe el equipo");
  });

  it("enseña tal cual el mensaje de error de la API", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401)));
    render(<EquiposYPrestamos sesion={SESION} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicia sesión con Google.");
  });
});
