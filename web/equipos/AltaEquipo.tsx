import { useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface Equipo {
  id: string;
  nombre: string;
  prestado: boolean;
}

/** Formulario del alta de un equipo con POST /api/equipos; enseña el equipo creado o el mensaje de la API. */
export function AltaEquipo({ sesion }: { sesion: Sesion }) {
  const [nombre, setNombre] = useState("");
  const [creado, setCreado] = useState<Equipo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dar = (evento: SyntheticEvent) => {
    evento.preventDefault();
    setError(null);
    api<Equipo>(sesion, "/api/equipos", { metodo: "POST", cuerpo: { nombre } })
      .then((equipo) => {
        setCreado(equipo);
        setNombre("");
      })
      .catch((motivo: unknown) => {
        setCreado(null);
        setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
  };

  return (
    <section aria-labelledby="alta-equipo">
      <h2 id="alta-equipo">Alta de equipo</h2>
      <form onSubmit={dar}>
        <label>
          Nombre del equipo
          <input value={nombre} onChange={(evento) => {
              setNombre(evento.target.value);
            }} />
        </label>
        <button type="submit">Dar de alta</button>
      </form>
      {creado && (
        <p>
          Equipo «{creado.nombre}» dado de alta, sin prestar.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
