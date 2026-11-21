import { useEffect, useState } from "react";
import { api, type Sesion } from "../pantallas.js";

interface Equipo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Lista de equipos (GET /api/equipos) con la persona y la fecha de devolución de los prestados. */
export function EquiposYPrestamos({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api<Equipo[]>(sesion, "/api/equipos")
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
    <section aria-labelledby="equipos-y-prestamos">
      <h2 id="equipos-y-prestamos">Equipos y préstamos</h2>
      {error && <p role="alert">{error}</p>}
      <ul>
        {equipos.map((equipo) => (
          <li key={equipo.id}>
            {equipo.prestado
              ? `${equipo.nombre} · Prestado a ${equipo.persona ?? ""} hasta el ${equipo.devolucion ?? ""}`
              : `${equipo.nombre} · No prestado`}
          </li>
        ))}
      </ul>
    </section>
  );
}
