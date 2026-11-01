import { useEffect, useRef, useState } from "react";
import type { BotonDeGoogle } from "./sesion.js";

interface Persona {
  email: string;
  nombre: string;
}

export interface AppProps {
  botonDeGoogle: BotonDeGoogle;
}

/** Pide la configuración, muestra el botón de Google y, con la sesión iniciada, a quién saluda. */
export function App({ botonDeGoogle }: AppProps) {
  const boton = useRef<HTMLDivElement>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const elemento = boton.current;
    if (!elemento) return;
    const entrar = async (token: string) => {
      const respuesta = await fetch("/api/yo", { headers: { authorization: `Bearer ${token}` } });
      if (!respuesta.ok) throw new Error("Google no ha confirmado tu sesión.");
      setPersona((await respuesta.json()) as Persona);
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

  return (
    <main>
      <h1>Aplicación</h1>
      {persona ? <p>Hola, {persona.nombre}</p> : <div ref={boton} />}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
