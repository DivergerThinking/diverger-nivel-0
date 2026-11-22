import { useEffect, useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface Equipo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

const mensajeDe = (motivo: unknown): string => (motivo instanceof Error ? motivo.message : String(motivo));

/** Apunta el préstamo de un equipo libre con POST /api/equipos/{id}/prestamo; si la API falla, enseña su mensaje tal cual. */
export function ApuntarPrestamo({ sesion }: { sesion: Sesion }) {
  const [libres, setLibres] = useState<Equipo[] | null>(null);
  const [equipoId, setEquipoId] = useState("");
  const [persona, setPersona] = useState("");
  const [devolucion, setDevolucion] = useState("");
  const [apuntado, setApuntado] = useState<Equipo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = () =>
    api<Equipo[]>(sesion, "/api/equipos")
      .then((equipos) => {
        setLibres(equipos.filter((equipo) => !equipo.prestado));
      })
      .catch((motivo: unknown) => {
        setError(mensajeDe(motivo));
      });

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  const apuntar = (evento: SyntheticEvent) => {
    evento.preventDefault();
    setError(null);
    setApuntado(null);
    if (!equipoId) {
      setError("Elige un equipo libre");
      return;
    }
    api<Equipo>(sesion, `/api/equipos/${encodeURIComponent(equipoId)}/prestamo`, {
      metodo: "POST",
      cuerpo: { persona, devolucion },
    })
      .then((equipo) => {
        setApuntado(equipo);
        setPersona("");
        setDevolucion("");
        setEquipoId("");
        return cargar();
      })
      .catch((motivo: unknown) => {
        setError(mensajeDe(motivo));
      });
  };

  return (
    <section aria-labelledby="apuntar-un-prestamo">
      <h2 id="apuntar-un-prestamo">Apuntar un préstamo</h2>
      {libres?.length === 0 && <p>No hay equipos libres.</p>}
      <form onSubmit={apuntar}>
        <label>
          Equipo
          <select
            value={equipoId}
            onChange={(evento) => {
              setEquipoId(evento.target.value);
            }}
          >
            <option value="">Elige un equipo</option>
            {(libres ?? []).map((equipo) => (
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
            onChange={(evento) => {
              setPersona(evento.target.value);
            }}
          />
        </label>
        <label>
          Fecha de devolución (AAAA-MM-DD)
          <input
            value={devolucion}
            onChange={(evento) => {
              setDevolucion(evento.target.value);
            }}
          />
        </label>
        <button type="submit">Apuntar préstamo</button>
      </form>
      {apuntado && (
        <p>
          Préstamo apuntado: {apuntado.nombre} a {apuntado.persona ?? ""} hasta {apuntado.devolucion ?? ""}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
