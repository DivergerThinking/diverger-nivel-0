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

/** Apunta la devolución de un equipo prestado con POST /api/equipos/{id}/devolucion; si la API falla, enseña su mensaje tal cual. */
export function ApuntarDevolucion({ sesion }: { sesion: Sesion }) {
  const [prestados, setPrestados] = useState<Equipo[] | null>(null);
  const [equipoId, setEquipoId] = useState("");
  const [devuelto, setDevuelto] = useState<Equipo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = () =>
    api<Equipo[]>(sesion, "/api/equipos")
      .then((equipos) => {
        setPrestados(equipos.filter((equipo) => equipo.prestado));
      })
      .catch((motivo: unknown) => {
        setError(mensajeDe(motivo));
      });

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  const devolver = (evento: SyntheticEvent) => {
    evento.preventDefault();
    setError(null);
    setDevuelto(null);
    if (!equipoId) {
      setError("Elige un equipo prestado");
      return;
    }
    api<Equipo>(sesion, `/api/equipos/${encodeURIComponent(equipoId)}/devolucion`, { metodo: "POST" })
      .then((equipo) => {
        setDevuelto(equipo);
        setEquipoId("");
        return cargar();
      })
      .catch((motivo: unknown) => {
        setError(mensajeDe(motivo));
      });
  };

  return (
    <section aria-labelledby="apuntar-una-devolucion">
      <h2 id="apuntar-una-devolucion">Apuntar una devolución</h2>
      {prestados?.length === 0 && <p>No hay equipos prestados.</p>}
      <form onSubmit={devolver}>
        <label>
          Equipo prestado
          <select
            value={equipoId}
            onChange={(evento) => {
              setEquipoId(evento.target.value);
            }}
          >
            <option value="">Elige un equipo</option>
            {(prestados ?? []).map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {`${equipo.nombre}: ${equipo.persona ?? ""} hasta ${equipo.devolucion ?? ""}`}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apuntar devolución</button>
      </form>
      {devuelto && <p>Devolución apuntada: {devuelto.nombre} está libre</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
