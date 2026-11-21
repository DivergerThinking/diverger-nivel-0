import { useEffect, useState, type SyntheticEvent } from "react";
import { api, type Sesion } from "../pantallas.js";

interface Equipo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Formulario de un equipo sin prestar: la persona y la fecha de devolución (POST /api/equipos/{id}/prestamo). */
function FormularioDePrestamo({ equipo, alPrestar }: { equipo: Equipo; alPrestar: (datos: { persona: string; devolucion: string }) => void }) {
  const [persona, setPersona] = useState("");
  const [devolucion, setDevolucion] = useState("");

  const enviar = (evento: SyntheticEvent) => {
    evento.preventDefault();
    alPrestar({ persona, devolucion });
  };

  return (
    <form onSubmit={enviar}>
      <input aria-label={`Persona de ${equipo.nombre}`} value={persona} onChange={(e) => {
          setPersona(e.target.value);
        }}
      />
      <input
        type="date"
        aria-label={`Devolución de ${equipo.nombre}`}
        value={devolucion}
        onChange={(e) => {
          setDevolucion(e.target.value);
        }}
      />
      <button type="submit">Apuntar préstamo de {equipo.nombre}</button>
    </form>
  );
}

/** Lista de equipos (GET /api/equipos) con la persona y la fecha de devolución de los prestados, y el alta de préstamos. */
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

  const prestar = async (equipo: Equipo, cuerpo: { persona: string; devolucion: string }) => {
    try {
      const prestado = await api<Equipo>(sesion, `/api/equipos/${encodeURIComponent(equipo.id)}/prestamo`, { metodo: "POST", cuerpo });
      setEquipos((actuales) => actuales.map((actual) => (actual.id === prestado.id ? prestado : actual)));
      setError(null);
    } catch (motivo: unknown) {
      setError(motivo instanceof Error ? motivo.message : String(motivo));
    }
  };

  return (
    <section aria-labelledby="equipos-y-prestamos">
      <h2 id="equipos-y-prestamos">Equipos y préstamos</h2>
      {error && <p role="alert">{error}</p>}
      <ul>
        {equipos.map((equipo) => (
          <li key={equipo.id}>
            <span>
              {equipo.prestado
                ? `${equipo.nombre} · Prestado a ${equipo.persona ?? ""} hasta el ${equipo.devolucion ?? ""}`
                : `${equipo.nombre} · No prestado`}
            </span>
            {!equipo.prestado && <FormularioDePrestamo equipo={equipo} alPrestar={(cuerpo) => void prestar(equipo, cuerpo)} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
