import { useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoCreado {
  id: string;
  nombre: string;
  prestado: boolean;
}

/** Da de alta un equipo con POST /api/equipos; enseña el equipo creado o el mensaje de error de la API. */
export function AltaDeEquipo({ sesion }: { sesion: Sesion }) {
  const [nombre, setNombre] = useState("");
  const [creado, setCreado] = useState<EquipoCreado | null>(null);
  const [error, setError] = useState<string | null>(null);

  function darDeAlta(evento: SyntheticEvent) {
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
  }

  return (
    <section aria-labelledby="equipos-alta">
      <h2 id="equipos-alta">Alta de equipo</h2>
      <form onSubmit={darDeAlta}>
        <label>
          Nombre
          <input
            value={nombre}
            onChange={(evento) => {
              setNombre(evento.target.value);
            }}
          />
        </label>
        <button type="submit">Dar de alta</button>
      </form>
      {creado && (
        <p>
          {creado.nombre}: {creado.prestado ? "prestado" : "no prestado"}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
