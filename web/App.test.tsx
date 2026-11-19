import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App.js";
import { siPuedeLlamar, type Pantalla, type Sesion } from "./pantallas.js";
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
    render(<App botonDeGoogle={boton} pantallas={[]} />);
    expect(await screen.findByText("Hola, Ana")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();  // Sin pantallas, solo saluda.
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

  describe("pantallas (ADR 0053 del harness)", () => {
    function Muestra(texto: string) {
      return function Componente({ sesion }: { sesion: Sesion }) {
        return <p>{`${texto} para ${sesion.persona.nombre} con ${sesion.token}`}</p>;
      };
    }

    const PANTALLAS: Pantalla[] = [
      { id: "equipos-lista", titulo: "Equipos", Componente: Muestra("Lista de equipos") },
      { id: "prestamos-vencidos", titulo: "Vencidos", Componente: Muestra("Préstamos vencidos"), visible: (s) => s.persona.it === true },
      { id: "prestamos-mios", titulo: "Mis préstamos", Componente: Muestra("Mis préstamos") },
    ];

    function entrar(persona: Record<string, unknown>) {
      vi.stubGlobal("fetch", (url: string) =>
        Promise.resolve(url === "/api/config" ? respuesta({ googleClientId: "cliente" }) : respuesta(persona)),
      );
      const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
        alEntrar("token-bueno");
        return Promise.resolve();
      };
      render(<App botonDeGoogle={boton} pantallas={PANTALLAS} />);
    }

    it("con la sesión, enseña el menú y la primera pantalla, que recibe el token y la persona", async () => {
      entrar({ email: "ana@example.com", nombre: "Ana", it: true });
      expect(await screen.findByText("Lista de equipos para Ana con token-bueno")).toBeTruthy();
      const menu = screen.getByRole("navigation", { name: "Pantallas" });
      expect([...menu.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Equipos", "Vencidos", "Mis préstamos"]);
      expect(screen.getByRole("button", { name: "Equipos" }).getAttribute("aria-current")).toBe("page");
    });

    it("cambia de pantalla desde el menú", async () => {
      entrar({ email: "ana@example.com", nombre: "Ana", it: true });
      fireEvent.click(await screen.findByRole("button", { name: "Vencidos" }));
      expect(await screen.findByText("Préstamos vencidos para Ana con token-bueno")).toBeTruthy();
      expect(screen.queryByText("Lista de equipos para Ana con token-bueno")).toBeNull();
      expect(screen.getByRole("button", { name: "Vencidos" }).getAttribute("aria-current")).toBe("page");
    });

    it("no enseña a una persona las pantallas que no puede ver", async () => {
      entrar({ email: "luis@example.com", nombre: "Luis" });
      expect(await screen.findByText("Lista de equipos para Luis con token-bueno")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Vencidos" })).toBeNull();
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Equipos", "Mis préstamos"]);
    });

    it("una pantalla puede preguntar a la API si la persona la ve: con 403, no se enseña", async () => {
      const deIt: Pantalla = { id: "prestamos-vencidos", titulo: "Vencidos", Componente: Muestra("Vencidos"),
        visible: siPuedeLlamar("/api/prestamos/vencidos") };
      const lista: Pantalla = { id: "equipos-lista", titulo: "Equipos", Componente: Muestra("Equipos") };
      for (const [es, nombre] of [[true, "Ana"], [false, "Luis"]] as const) {
        vi.stubGlobal("fetch", (url: string) =>
          Promise.resolve(
            url === "/api/config" ? respuesta({ googleClientId: "cliente" })
              : url === "/api/yo" ? respuesta({ email: "x@example.com", nombre })
                : es ? respuesta([]) : respuesta({ error: "Solo IT puede hacer esto." }, 403),
          ),
        );
        const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
          alEntrar("token-bueno");
          return Promise.resolve();
        };
        render(<App botonDeGoogle={boton} pantallas={[lista, deIt]} />);
        expect(await screen.findByText(`Equipos para ${nombre} con token-bueno`)).toBeTruthy();
        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(es ? ["Equipos", "Vencidos"] : ["Equipos"]);
        cleanup();
      }
    });

    it("una pantalla cuya comprobación falla no se enseña", async () => {
      const rota: Pantalla = { id: "x-rota", titulo: "Rota", Componente: Muestra("Rota"), visible: () => Promise.reject(new Error("x")) };
      vi.stubGlobal("fetch", (url: string) =>
        Promise.resolve(url === "/api/config" ? respuesta({ googleClientId: "cliente" }) : respuesta({ email: "a@b.c", nombre: "Ana" })),
      );
      const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
        alEntrar("t");
        return Promise.resolve();
      };
      render(<App botonDeGoogle={boton} pantallas={[rota, PANTALLAS[0] as Pantalla]} />);
      expect(await screen.findByText("Lista de equipos para Ana con t")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Rota" })).toBeNull();
    });

    it("una pantalla con siPuedeLlamar solo se enseña si la API responde bien: con un 500 o sin red, no (harness#847)", async () => {
      const deIt: Pantalla = { id: "prestamos-vencidos", titulo: "Vencidos", Componente: Muestra("Vencidos"),
        visible: siPuedeLlamar("/api/prestamos/vencidos") };
      const lista: Pantalla = { id: "equipos-lista", titulo: "Equipos", Componente: Muestra("Equipos") };
      const fallos: (() => Promise<Response>)[] = [
        () => Promise.resolve(respuesta({ error: "Error interno" }, 500)),
        () => Promise.resolve(respuesta({ error: "No existe" }, 404)),
        () => Promise.reject(new TypeError("Failed to fetch")),
      ];
      for (const fallo of fallos) {
        vi.stubGlobal("fetch", (url: string) =>
          url === "/api/config" ? Promise.resolve(respuesta({ googleClientId: "cliente" }))
            : url === "/api/yo" ? Promise.resolve(respuesta({ email: "luis@example.com", nombre: "Luis" }))
              : fallo(),
        );
        const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
          alEntrar("token-bueno");
          return Promise.resolve();
        };
        render(<App botonDeGoogle={boton} pantallas={[lista, deIt]} />);
        expect(await screen.findByText("Equipos para Luis con token-bueno")).toBeTruthy();
        await new Promise((r) => setTimeout(r, 0));
        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Equipos"]);
        cleanup();
      }
    });

    it("una comprobación que no responde no deja sin menú: las demás pantallas se enseñan (harness#847)", async () => {
      const colgada: Pantalla = { id: "x-colgada", titulo: "Colgada", Componente: Muestra("Colgada"),
        visible: () => new Promise<boolean>(() => undefined) };
      vi.stubGlobal("fetch", (url: string) =>
        Promise.resolve(url === "/api/config" ? respuesta({ googleClientId: "cliente" }) : respuesta({ email: "a@b.c", nombre: "Ana" })),
      );
      const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
        alEntrar("t");
        return Promise.resolve();
      };
      render(<App botonDeGoogle={boton} pantallas={[colgada, ...PANTALLAS]} />);
      expect(await screen.findByText("Lista de equipos para Ana con t")).toBeTruthy();
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Equipos", "Mis préstamos"]);
    });

    it("la pantalla abierta no cambia cuando llega una que va antes en el menú (harness#847)", async () => {
      let responder: (puede: boolean) => void = () => undefined;
      const tardia: Pantalla = { id: "x-tardia", titulo: "Tardía", Componente: Muestra("Tardía"),
        visible: () => new Promise<boolean>((r) => { responder = r; }) };
      vi.stubGlobal("fetch", (url: string) =>
        Promise.resolve(url === "/api/config" ? respuesta({ googleClientId: "cliente" }) : respuesta({ email: "a@b.c", nombre: "Ana" })),
      );
      const boton: BotonDeGoogle = (_elemento, _clientId, alEntrar) => {
        alEntrar("t");
        return Promise.resolve();
      };
      render(<App botonDeGoogle={boton} pantallas={[tardia, PANTALLAS[0] as Pantalla]} />);
      expect(await screen.findByText("Lista de equipos para Ana con t")).toBeTruthy();
      responder(true);
      expect(await screen.findByRole("button", { name: "Tardía" })).toBeTruthy();
      expect(screen.getByText("Lista de equipos para Ana con t")).toBeTruthy();
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Tardía", "Equipos"]);
    });

    it("sin la sesión no enseña ninguna pantalla", async () => {
      vi.stubGlobal("fetch", () => Promise.resolve(respuesta({ googleClientId: "cliente" })));
      render(<App botonDeGoogle={() => Promise.resolve()} pantallas={PANTALLAS} />);
      await Promise.resolve();
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByText(/Lista de equipos/)).toBeNull();
    });
  });
});
