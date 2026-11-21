import { useEffect, useState } from "react";
import { api, type Sesion } from "../pantallas.js";

interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

function FormularioDePrestamo({
  equipo,
  alApuntar,
}: {
  equipo: EquipoConPrestamo;
  alApuntar: (id: string, persona: string, devolucion: string) => Promise<void>;
}) {
  const [persona, setPersona] = useState("");
  const [devolucion, setDevolucion] = useState("");
  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void alApuntar(equipo.id, persona, devolucion);
      }}
    >
      <label>
        Persona de {equipo.nombre}
        <input
          value={persona}
          onChange={(e) => {
            setPersona(e.target.value);
          }}
        />
      </label>
      <label>
        Devolución de {equipo.nombre}
        <input
          type="date"
          value={devolucion}
          onChange={(e) => {
            setDevolucion(e.target.value);
          }}
        />
      </label>
      <button type="submit">Apuntar préstamo de {equipo.nombre}</button>
    </form>
  );
}

/** Enseña la lista de equipos con GET /api/equipos: si están prestados, a quién y hasta cuándo. */
export function EquiposYPrestamos({ sesion }: { sesion: Sesion }) {
  const [equipos, setEquipos] = useState<EquipoConPrestamo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);

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
  }, [sesion, version]);

  /** Apunta el préstamo con POST /api/equipos/{id}/prestamo y recarga la lista; si falla, enseña el mensaje de la API. */
  async function prestar(id: string, persona: string, devolucion: string): Promise<void> {
    setError(null);
    try {
      await api(sesion, `/api/equipos/${encodeURIComponent(id)}/prestamo`, {
        metodo: "POST",
        cuerpo: { persona, devolucion },
      });
      setVersion((v) => v + 1);
    } catch (motivo: unknown) {
      setError(motivo instanceof Error ? motivo.message : String(motivo));
    }
  }

  return (
    <section aria-labelledby="prestamos-equipos">
      <h2 id="prestamos-equipos">Equipos y préstamos</h2>
      {error && <p role="alert">{error}</p>}
      {equipos && equipos.length === 0 && <p>No hay equipos.</p>}
      {equipos && equipos.length > 0 && (
        <ul>
          {equipos.map((equipo) => (
            <li key={equipo.id}>
              <span>
                {equipo.prestado
                  ? `${equipo.nombre}: prestado a ${equipo.persona ?? ""} hasta ${equipo.devolucion ?? ""}`
                  : `${equipo.nombre}: no prestado`}
              </span>
              {!equipo.prestado && <FormularioDePrestamo equipo={equipo} alApuntar={prestar} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
