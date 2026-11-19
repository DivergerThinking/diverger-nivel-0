import { useEffect, useState } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Pide la lista a GET /api/equipos y enseña cada equipo, prestado (a quién y hasta cuándo) o no prestado. */
export function ListaDeEquipos({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<EquipoConPrestamo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<EquipoConPrestamo[]>(sesion, "/api/equipos")
      .then(setEquipos)
      .catch((motivo: unknown) => {
        setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
  }, [sesion]);

  return (
    <section aria-labelledby="equipos-y-prestamos">
      <h2 id="equipos-y-prestamos">Equipos y préstamos</h2>
      {equipos && equipos.length === 0 && <p>Todavía no hay equipos.</p>}
      {equipos && equipos.length > 0 && (
        <ul>
          {equipos.map((equipo) => (
            <li key={equipo.id}>
              {equipo.prestado
                ? `${equipo.nombre}: prestado a ${equipo.persona ?? ""} hasta ${equipo.devolucion ?? ""}`
                : `${equipo.nombre}: no prestado`}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
