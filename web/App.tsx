import { useEffect, useRef, useState } from "react";
import type { BotonDeGoogle } from "./sesion.js";

interface Persona {
  email: string;
  nombre: string;
}

interface Equipo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

export interface AppProps {
  botonDeGoogle: BotonDeGoogle;
}

/** Pide la configuración, muestra el botón de Google y, con la sesión iniciada, a quién saluda. */
export function App({ botonDeGoogle }: AppProps) {
  const boton = useRef<HTMLDivElement>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const elemento = boton.current;
    if (!elemento) return;
    const entrar = async (token: string) => {
      const cabeceras = { authorization: `Bearer ${token}` };
      const respuesta = await fetch("/api/yo", { headers: cabeceras });
      if (!respuesta.ok) throw new Error("Google no ha confirmado tu sesión.");
      const quien = (await respuesta.json()) as Persona;
      const lista = await fetch("/api/equipos", { headers: cabeceras });
      if (!lista.ok) throw new Error("No se ha podido cargar la lista de equipos. Vuelve a intentarlo.");
      setEquipos((await lista.json()) as Equipo[]);
      setPersona(quien);
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
      {equipos && (
        <section>
          <h2>Equipos de la oficina</h2>
          {equipos.length === 0 ? (
            <p>Todavía no hay equipos.</p>
          ) : (
            <ul>
              {equipos.map((equipo) => (
                <li key={equipo.id}>
                  {equipo.nombre}
                  {equipo.prestado ? ` — prestado a ${equipo.persona ?? ""} hasta ${equipo.devolucion ?? ""}` : " — disponible"}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
