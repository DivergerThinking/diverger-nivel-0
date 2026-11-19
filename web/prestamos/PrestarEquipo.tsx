import { useEffect, useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Formulario de POST /api/equipos/{id}/prestamo: enseña el equipo prestado o el mensaje de la API. */
export function PrestarEquipo({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<EquipoConPrestamo[]>([]);
  const [equipoId, setEquipoId] = useState("");
  const [persona, setPersona] = useState("");
  const [devolucion, setDevolucion] = useState("");
  const [prestado, setPrestado] = useState<EquipoConPrestamo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<EquipoConPrestamo[]>(sesion, "/api/equipos")
      .then((lista) => {
        setEquipos(lista);
        setEquipoId((actual) => actual || (lista[0]?.id ?? ""));
      })
      .catch((motivo: unknown) => {
        setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
  }, [sesion]);

  const enviar = (evento: SyntheticEvent) => {
    evento.preventDefault();
    setError(null);
    setPrestado(null);
    api<EquipoConPrestamo>(sesion, `/api/equipos/${encodeURIComponent(equipoId)}/prestamo`, {
      metodo: "POST",
      cuerpo: { persona, devolucion },
    })
      .then((equipo) => {
        setPrestado(equipo);
        setEquipos((lista) => lista.map((e) => (e.id === equipo.id ? equipo : e)));
        setPersona("");
        setDevolucion("");
      })
      .catch((motivo: unknown) => {
        setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
  };

  return (
    <section aria-labelledby="prestar-un-equipo">
      <h2 id="prestar-un-equipo">Prestar un equipo</h2>
      <form onSubmit={enviar}>
        <label>
          Equipo
          <select
            value={equipoId}
            onChange={(e) => {
              setEquipoId(e.target.value);
            }}
          >
            {equipos.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Persona
          <input
            value={persona}
            onChange={(e) => {
              setPersona(e.target.value);
            }}
          />
        </label>
        <label>
          Fecha de devolución (AAAA-MM-DD)
          <input
            value={devolucion}
            onChange={(e) => {
              setDevolucion(e.target.value);
            }}
          />
        </label>
        <button type="submit">Apuntar préstamo</button>
      </form>
      {prestado && <p>{`${prestado.nombre}: prestado a ${prestado.persona ?? ""} hasta ${prestado.devolucion ?? ""}`}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
