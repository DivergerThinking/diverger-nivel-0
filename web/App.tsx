import { useEffect, useRef, useState } from "react";
import type { BotonDeGoogle } from "./sesion.js";
import type { Pantalla, Persona, Sesion } from "./pantallas.js";
import { pantallas as pantallasDeLaAplicacion } from "./pantallas.gen.js";

export interface AppProps {
  botonDeGoogle: BotonDeGoogle;
  /** Las pantallas de la aplicación; por defecto, las de web/<id>/ (web/pantallas.gen.ts). Los tests pueden pasar otras. */
  pantallas?: Pantalla[];
}

/**
 * Pide la configuración y muestra el botón de Google. Con la sesión iniciada, saluda a la persona y enseña el menú de
 * las pantallas que puede ver y la elegida, que recibe el token y la persona (ADR 0053 del harness).
 */
export function App({ botonDeGoogle, pantallas = pantallasDeLaAplicacion }: AppProps) {
  const boton = useRef<HTMLDivElement>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Las pantallas que la persona de la sesión con ese token puede ver, según van respondiendo sus comprobaciones, y la
   * primera que se enseñó, que es la abierta mientras la persona no elija otra.
   */
  const [visibles, setVisibles] = useState<{ token: string; ids: Record<string, true>; primera: string } | null>(null);

  useEffect(() => {
    const elemento = boton.current;
    if (!elemento) return;
    const entrar = async (token: string) => {
      const respuesta = await fetch("/api/yo", { headers: { authorization: `Bearer ${token}` } });
      if (!respuesta.ok) throw new Error("Google no ha confirmado tu sesión.");
      setSesion({ token, persona: (await respuesta.json()) as Persona });
    };
    const iniciar = async () => {
      const respuesta = await fetch("/api/config");
      const { googleClientId } = (await respuesta.json()) as { googleClientId: string };
      if (!googleClientId) throw new Error("Inicio de sesión sin configurar.");
      await botonDeGoogle(elemento, googleClientId, (token) => {
        entrar(token).catch((motivo: unknown) => {
          setError(motivo instanceof Error ? motivo.message : String(motivo));
        });
      });
    };
    iniciar().catch((motivo: unknown) => {
      setError(motivo instanceof Error ? motivo.message : String(motivo));
    });
  }, [botonDeGoogle]);

  useEffect(() => {
    if (!sesion) return;
    let vigente = true;
    // Cada pantalla dice si la persona puede verla, también preguntando a la API; si falla, no se enseña. Cada una entra
    // en el menú al responder, sin esperar a las demás: una comprobación que no responde no deja a nadie sin menú.
    for (const p of pantallas) {
      void Promise.resolve()
        .then(() => (p.visible ? p.visible(sesion) : true))
        .catch(() => false)
        .then((si) => {
          if (!vigente || !si) return;
          setVisibles((antes) =>
            antes?.token === sesion.token
              ? { ...antes, ids: { ...antes.ids, [p.id]: true } }
              : { token: sesion.token, ids: { [p.id]: true }, primera: p.id });
        });
    }
    return () => {
      vigente = false;
    };
  }, [sesion, pantallas]);

  const deLaSesion = sesion && visibles?.token === sesion.token ? visibles : null;
  const lista = deLaSesion ? pantallas.filter((p) => deLaSesion.ids[p.id]) : [];
  // Sin elegir, la abierta es la primera que se enseñó, para que no cambie si después llega una que va antes en el menú.
  const actual = lista.find((p) => p.id === (elegida ?? deLaSesion?.primera)) ?? lista[0];

  return (
    <main>
      <h1>Aplicación</h1>
      {sesion ? <p>Hola, {sesion.persona.nombre}</p> : <div ref={boton} />}
      {sesion && lista.length > 0 && (
        <nav aria-label="Pantallas">
          <ul>
            {lista.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-current={p.id === actual?.id ? "page" : undefined}
                  onClick={() => {
                    setElegida(p.id);
                  }}
                >
                  {p.titulo}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {sesion && actual && <actual.Componente key={actual.id} sesion={sesion} />}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
