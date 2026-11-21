import { useEffect, useState } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Enseña la lista de equipos con GET /api/equipos: si están prestados, a quién y hasta cuándo. */
export function EquiposYPrestamos({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<EquipoConPrestamo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api<EquipoConPrestamo[]>(sesion, "/api/equipos")
      .then((lista) => {
        if (vigente) setEquipos(lista);
      })
      .catch((motivo: unknown) => {
        if (vigente) setError(motivo instanceof Error ? motivo.message : String(motivo));
      });
    return () => {
      vigente = false;
    };
  }, [sesion]);

  return (
    <section aria-labelledby="prestamos-equipos">
      <h2 id="prestamos-equipos">Equipos y préstamos</h2>
      {error && <p role="alert">{error}</p>}
      {equipos && equipos.length === 0 && <p>No hay equipos.</p>}
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
    </section>
  );
}
