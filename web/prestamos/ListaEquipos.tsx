import { useEffect, useState } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Lista de equipos con GET /api/equipos: cuáles están prestados, a quién y hasta cuándo; o el mensaje de la API. */
export function ListaEquipos({ sesion }: { sesion: Sesion }) {
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
    <section aria-labelledby="lista-equipos">
      <h2 id="lista-equipos">Equipos y préstamos</h2>
      {error && <p role="alert">{error}</p>}
      {equipos?.length === 0 && <p>Todavía no hay equipos dados de alta.</p>}
      {equipos && equipos.length > 0 && (
        <ul>
          {equipos.map((equipo) => (
            <li key={equipo.id}>
              {equipo.prestado
                ? `${equipo.nombre}: prestado a ${equipo.persona ?? ""} hasta el ${equipo.devolucion ?? ""}`
                : `${equipo.nombre}: sin prestar`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
