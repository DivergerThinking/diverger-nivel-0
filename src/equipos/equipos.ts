// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import type { components } from "./api.gen.js";

export type Equipo = components["schemas"]["Equipo"];

export const COLECCION_EQUIPOS = "equipos_equipos";

/** Documento guardado de un equipo (spec/contextos/equipos/contexto.md, «Persistencia»). */
interface DocumentoEquipo {
  id: string;
  nombre: string;
  nombreNormalizado: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Un equipo libre se lista sin persona ni devolucion; uno prestado, con las dos. */
function aEquipo(documento: DocumentoEquipo): Equipo {
  const equipo: Equipo = { id: documento.id, nombre: documento.nombre, prestado: documento.prestado };
  if (documento.prestado && documento.persona !== undefined && documento.devolucion !== undefined) {
    equipo.persona = documento.persona;
    equipo.devolucion = documento.devolucion;
  }
  return equipo;
}

export async function listarEquipos(almacen: Almacen): Promise<Equipo[]> {
  const documentos = await almacen.listar<DocumentoEquipo>(COLECCION_EQUIPOS);
  return documentos.map(aEquipo);
}
