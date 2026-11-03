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
  it("pide el ID de cliente y, tras iniciar sesión, saluda a la persona", async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(url === "/api/config" ? respuesta({ googleClientId: "cliente" }) : respuesta({ email: "ana@example.com", nombre: "Ana" })),
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
