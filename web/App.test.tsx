import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App.js";
import type { BotonDeGoogle } from "./sesion.js";

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("pide el ID de cliente y, tras iniciar sesión, saluda a la persona", async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url === "/api/config"
          ? respuesta({ googleClientId: "cliente" })
          : url === "/api/equipos"
            ? respuesta([])
            : respuesta({ email: "ana@example.com", nombre: "Ana" }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const boton: BotonDeGoogle = (_elemento, clientId, alEntrar) => {
      expect(clientId).toBe("cliente");
      alEntrar("token-bueno");
      return Promise.resolve();
    };
    render(<App botonDeGoogle={boton} />);
    expect(await screen.findByText("Hola, Ana")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/yo", { headers: { authorization: "Bearer token-bueno" } });
  });

  function conEquipos(equipos: unknown, status = 200) {
    vi.stubGlobal("fetch", (url: string) =>
      Promise.resolve(
        url === "/api/config"
          ? respuesta({ googleClientId: "cliente" })
          : url === "/api/equipos"
            ? respuesta(equipos, status)
            : respuesta({ email: "ana@example.com", nombre: "Ana" }),
      ),
    );
    const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
      alEntrar("token-bueno");
      return Promise.resolve();
    };
    render(<App botonDeGoogle={boton} />);
  }

  it("lista los equipos prestados con a quién y hasta cuándo, y los libres como libres", async () => {
    conEquipos([
      { id: "a", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
      { id: "b", nombre: "Proyector sala 2", prestado: false },
    ]);
    expect(await screen.findByText("Portátil 07: prestado a Ana Pérez hasta el 2026-11-20")).toBeTruthy();
    expect(screen.getByText("Proyector sala 2: libre")).toBeTruthy();
  });

  function conDevolucion(devolucion: Response) {
    const fetch = vi.fn((url: string, opciones?: RequestInit) =>
      Promise.resolve(
        url === "/api/config"
          ? respuesta({ googleClientId: "cliente" })
          : url === "/api/equipos"
            ? respuesta([
                { id: "a", nombre: "Portátil 07", prestado: true, persona: "Ana Pérez", devolucion: "2026-11-20" },
                { id: "b", nombre: "Proyector sala 2", prestado: false },
              ])
            : url === "/api/equipos/a/devolucion" && opciones?.method === "POST"
              ? devolucion
              : respuesta({ email: "ana@example.com", nombre: "Ana" }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
      alEntrar("token-bueno");
      return Promise.resolve();
    };
    render(<App botonDeGoogle={boton} />);
    return fetch;
  }

  it("apunta la devolución de un equipo prestado y lo muestra libre", async () => {
    const fetch = conDevolucion(respuesta({ id: "a", nombre: "Portátil 07", prestado: false }));
    fireEvent.click(await screen.findByRole("button", { name: "Apuntar devolución" }));
    expect(await screen.findByText("Portátil 07: libre")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apuntar devolución" })).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/equipos/a/devolucion", {
      method: "POST",
      headers: { authorization: "Bearer token-bueno" },
    });
  });

  it("solo ofrece apuntar la devolución en los equipos prestados", async () => {
    conDevolucion(respuesta({}));
    await screen.findByText("Proyector sala 2: libre");
    expect(screen.getAllByRole("button", { name: "Apuntar devolución" })).toHaveLength(1);
  });

  it("enseña el motivo cuando el servidor no acepta la devolución", async () => {
    conDevolucion(respuesta({ error: "El equipo no está prestado" }, 409));
    fireEvent.click(await screen.findByRole("button", { name: "Apuntar devolución" }));
    expect((await screen.findByRole("alert")).textContent).toBe("El equipo no está prestado");
    expect(screen.getByText("Portátil 07: prestado a Ana Pérez hasta el 2026-11-20")).toBeTruthy();
  });

  it("avisa cuando no hay equipos dados de alta", async () => {
    conEquipos([]);
    expect(await screen.findByText("No hay equipos dados de alta.")).toBeTruthy();
  });

  it("avisa cuando no se puede cargar la lista de equipos", async () => {
    conEquipos({ error: "Inicia sesión con Google." }, 401);
    expect((await screen.findByRole("alert")).textContent).toBe("No se ha podido cargar la lista de equipos.");
  });

  it("avisa, sin botón de Google, cuando el inicio de sesión no está configurado", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ googleClientId: "" })));
    const boton = vi.fn<BotonDeGoogle>(() => Promise.resolve());
    render(<App botonDeGoogle={boton} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Inicio de sesión sin configurar.");
    expect(boton).not.toHaveBeenCalled();
  });

  it("avisa cuando el servidor no acepta el token", async () => {
    vi.stubGlobal("fetch", (url: string) =>
      Promise.resolve(url === "/api/config" ? respuesta({ googleClientId: "cliente" }) : respuesta({ error: "Inicia sesión con Google." }, 401)),
    );
    const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
      alEntrar("token-malo");
      return Promise.resolve();
    };
    render(<App botonDeGoogle={boton} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Google no ha confirmado tu sesión.");
  });
});
