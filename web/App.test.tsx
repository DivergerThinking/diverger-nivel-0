import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  it("pide el ID de cliente y, tras iniciar sesión, saluda a la persona y muestra los equipos", async () => {
    const fetch = vi.fn((url: string) => {
      if (url === "/api/config") return Promise.resolve(respuesta({ googleClientId: "cliente" }));
      if (url === "/api/equipos") {
        return Promise.resolve(
          respuesta([
            { id: "1", nombre: "Portátil", prestado: false },
            { id: "2", nombre: "Proyector", prestado: true, persona: "Luis", devolucion: "2026-12-01" },
          ]),
        );
      }
      return Promise.resolve(respuesta({ email: "ana@example.com", nombre: "Ana" }));
    });
    vi.stubGlobal("fetch", fetch);
    const boton: BotonDeGoogle = (_elemento, clientId, alEntrar) => {
      expect(clientId).toBe("cliente");
      alEntrar("token-bueno");
      return Promise.resolve();
    };
    render(<App botonDeGoogle={boton} />);
    expect(await screen.findByText("Hola, Ana")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/yo", { headers: { authorization: "Bearer token-bueno" } });
    expect(fetch).toHaveBeenCalledWith("/api/equipos", { headers: { authorization: "Bearer token-bueno" } });
    expect(screen.getByText("Portátil — disponible")).toBeTruthy();
    expect(screen.getByText("Proyector — prestado a Luis hasta 2026-12-01")).toBeTruthy();
  });

  it("avisa cuando todavía no hay equipos", async () => {
    vi.stubGlobal("fetch", (url: string) => {
      if (url === "/api/config") return Promise.resolve(respuesta({ googleClientId: "cliente" }));
      if (url === "/api/equipos") return Promise.resolve(respuesta([]));
      return Promise.resolve(respuesta({ email: "ana@example.com", nombre: "Ana" }));
    });
    const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
      alEntrar("token-bueno");
      return Promise.resolve();
    };
    render(<App botonDeGoogle={boton} />);
    expect(await screen.findByText("Todavía no hay equipos.")).toBeTruthy();
  });

  it("avisa y no muestra equipos cuando la lista no se puede cargar", async () => {
    vi.stubGlobal("fetch", (url: string) => {
      if (url === "/api/config") return Promise.resolve(respuesta({ googleClientId: "cliente" }));
      if (url === "/api/equipos") return Promise.resolve(respuesta({ error: "Inicia sesión con Google." }, 401));
      return Promise.resolve(respuesta({ email: "ana@example.com", nombre: "Ana" }));
    });
    const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
      alEntrar("token-bueno");
      return Promise.resolve();
    };
    render(<App botonDeGoogle={boton} />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "No se ha podido cargar la lista de equipos. Vuelve a intentarlo.",
    );
    expect(screen.queryByText("Equipos de la oficina")).toBeNull();
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
