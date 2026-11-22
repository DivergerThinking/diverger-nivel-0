import { useEffect, useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Apunta el préstamo de un equipo sin prestar con POST /api/equipos/{id}/prestamo; enseña el resultado o el mensaje de la API. */
export function PrestarEquipo({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<EquipoConPrestamo[] | null>(null);
  const [elegido, setElegido] = useState<EquipoConPrestamo | null>(null);
  const [persona, setPersona] = useState("");
  const [devolucion, setDevolucion] = useState("");
  const [apuntado, setApuntado] = useState<EquipoConPrestamo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mensaje = (motivo: unknown) => (motivo instanceof Error ? motivo.message : String(motivo));

  const cargar = () =>
    api<EquipoConPrestamo[]>(sesion, "/api/equipos")
      .then(setEquipos)
      .catch((motivo: unknown) => {
        setError(mensaje(motivo));
      });

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  const prestar = (evento: SyntheticEvent) => {
    evento.preventDefault();
    if (!elegido) return;
    setError(null);
    api<EquipoConPrestamo>(sesion, `/api/equipos/${encodeURIComponent(elegido.id)}/prestamo`, {
      metodo: "POST",
      cuerpo: { persona, devolucion },
    })
      .then((equipo) => {
        setApuntado(equipo);
        setElegido(null);
        setPersona("");
        setDevolucion("");
        return cargar();
      })
      .catch((motivo: unknown) => {
        setApuntado(null);
        setError(mensaje(motivo));
      });
  };

  const libres = equipos?.filter((equipo) => !equipo.prestado) ?? [];

  return (
    <section aria-labelledby="prestar-equipo">
      <h2 id="prestar-equipo">Prestar un equipo</h2>
      {equipos && libres.length === 0 && <p>No hay equipos sin prestar.</p>}
      {libres.length > 0 && (
        <ul>
          {libres.map((equipo) => (
            <li key={equipo.id}>
              {equipo.nombre}{" "}
              <button
                type="button"
                onClick={() => {
                  setElegido(equipo);
                  setApuntado(null);
                  setError(null);
                }}
              >
                Prestar {equipo.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      {elegido && (
        <form onSubmit={prestar}>
          <h3>Préstamo de «{elegido.nombre}»</h3>
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
      )}
      {apuntado && (
        <p>
          «{apuntado.nombre}» prestado a {apuntado.persona ?? ""} hasta el {apuntado.devolucion ?? ""}.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
