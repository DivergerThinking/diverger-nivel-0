import { useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoCreado {
  id: string;
  nombre: string;
  prestado: boolean;
}

/** Formulario de POST /api/equipos: enseña el equipo creado como no prestado o el mensaje de la API. */
export function AltaDeEquipo({ sesion }: { sesion: Sesion }) {
  const [nombre, setNombre] = useState("");
  const [creado, setCreado] = useState<EquipoCreado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enviar = (evento: SyntheticEvent) => {
    evento.preventDefault();
    setError(null);
    setCreado(null);
    api<EquipoCreado>(sesion, "/api/equipos", { metodo: "POST", cuerpo: { nombre } })
      .then((equipo) => {
        setCreado(equipo);
        setNombre("");
      })
      .catch((motivo: unknown) => {
        setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
  };

  return (
    <section aria-labelledby="alta-de-equipo">
      <h2 id="alta-de-equipo">Alta de equipo</h2>
      <form onSubmit={enviar}>
        <label>
          Nombre del equipo
          <input value={nombre} onChange={(e) => {
              setNombre(e.target.value);
            }}
          />
        </label>
        <button type="submit">Dar de alta</button>
      </form>
      {creado && <p>{`${creado.nombre}: no prestado`}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
