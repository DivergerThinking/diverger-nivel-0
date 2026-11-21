import { useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoCreado {
  id: string;
  nombre: string;
  prestado: boolean;
}

/** Formulario de alta de equipos (POST /api/equipos) y, debajo, los equipos dados de alta desde que se abrió. */
export function AltaDeEquipos({ sesion }: { sesion: Sesion }) {
  const [nombre, setNombre] = useState("");
  const [equipos, setEquipos] = useState<EquipoCreado[]>([]);
  const [error, setError] = useState<string | null>(null);

  const darDeAlta = (evento: SyntheticEvent) => {
    evento.preventDefault();
    setError(null);
    api<EquipoCreado>(sesion, "/api/equipos", { metodo: "POST", cuerpo: { nombre } })
      .then((equipo) => {
        setEquipos((anteriores) => [...anteriores, equipo]);
        setNombre("");
      })
      .catch((motivo: unknown) => {
        setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
  };

  return (
    <section aria-labelledby="alta-de-equipos">
      <h2 id="alta-de-equipos">Alta de equipos</h2>
      <form onSubmit={darDeAlta}>
        <label>
          Nombre del equipo
          <input
            value={nombre}
            onChange={(evento) => {
              setNombre(evento.target.value);
            }}
          />
        </label>
        <button type="submit">Dar de alta</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {equipos.map((equipo) => (
          <li key={equipo.id}>
            {equipo.nombre} · {equipo.prestado ? "Prestado" : "No prestado"}
          </li>
        ))}
      </ul>
    </section>
  );
}
