import { useEffect, useState } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Apunta la devolución de un equipo prestado con POST /api/equipos/{id}/devolucion; enseña el resultado o el mensaje de la API. */
export function DevolverEquipo({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<EquipoConPrestamo[] | null>(null);
  const [devuelto, setDevuelto] = useState<EquipoConPrestamo | null>(null);
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

  const devolver = (equipo: EquipoConPrestamo) => {
    setError(null);
    setDevuelto(null);
    api<EquipoConPrestamo>(sesion, `/api/equipos/${encodeURIComponent(equipo.id)}/devolucion`, { metodo: "POST" })
      .then((apuntado) => {
        setDevuelto(apuntado);
        return cargar();
      })
      .catch((motivo: unknown) => {
        setError(mensaje(motivo));
      });
  };

  const prestados = equipos?.filter((equipo) => equipo.prestado) ?? [];

  return (
    <section aria-labelledby="devolver-equipo">
      <h2 id="devolver-equipo">Apuntar la devolución</h2>
      {equipos && prestados.length === 0 && <p>No hay equipos prestados.</p>}
      {prestados.length > 0 && (
        <ul>
          {prestados.map((equipo) => (
            <li key={equipo.id}>
              {equipo.nombre}: {equipo.persona ?? ""}, hasta el {equipo.devolucion ?? ""}{" "}
              <button
                type="button"
                onClick={() => {
                  devolver(equipo);
                }}
              >
                Devolver {equipo.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      {devuelto && <p>«{devuelto.nombre}» devuelto: ya consta como libre.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
