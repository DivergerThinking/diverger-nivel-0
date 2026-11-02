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
      const headers = { authorization: `Bearer ${token}` };
      const respuesta = await fetch("/api/yo", { headers });
      if (!respuesta.ok) throw new Error("Google no ha confirmado tu sesión.");
      setPersona((await respuesta.json()) as Persona);
      const lista = await fetch("/api/equipos", { headers });
      if (!lista.ok) throw new Error("No se ha podido cargar la lista de equipos.");
      setEquipos((await lista.json()) as Equipo[]);
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
      {equipos && equipos.length === 0 && <p>No hay equipos dados de alta.</p>}
      {equipos && equipos.length > 0 && (
        <ul aria-label="Equipos">
          {equipos.map((equipo) => (
            <li key={equipo.id}>
              {equipo.nombre}:{" "}
              {equipo.prestado ? `prestado a ${equipo.persona ?? ""} hasta el ${equipo.devolucion ?? ""}` : "libre"}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
