import { useEffect, useState } from "react";
import { api, type Sesion } from "../pantallas.js";

interface Equipo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Enseña los equipos con GET /api/equipos; si la API falla, por ejemplo con un 401, enseña su mensaje tal cual. */
export function ListaDeEquipos({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Equipo[]>(sesion, "/api/equipos")
      .then(setEquipos)
      .catch((motivo: unknown) => {
        setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
  }, [sesion]);

  return (
    <section aria-labelledby="equipos-y-prestamos">
      <h2 id="equipos-y-prestamos">Equipos y préstamos</h2>
      {error && <p role="alert">{error}</p>}
      {equipos?.length === 0 && <p>No hay equipos dados de alta.</p>}
      {equipos && equipos.length > 0 && (
        <ul>
          {equipos.map((equipo) => (
            <li key={equipo.id}>
              {equipo.prestado
                ? `${equipo.nombre}: prestado a ${equipo.persona ?? ""} hasta ${equipo.devolucion ?? ""}`
                : `${equipo.nombre}: libre`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
