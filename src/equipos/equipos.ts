// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import { randomUUID } from "node:crypto";
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

export const COLECCION_NOMBRES = "equipos_nombres";

/** Resultado de dar de alta un equipo: el equipo creado o el motivo por el que no se crea. */
export type ResultadoAlta = { equipo: Equipo } | { error: "FALTA_NOMBRE" | "NOMBRE_REPETIDO" };

/** Nombre normalizado: sin espacios al principio ni al final y en minúsculas. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Da de alta un equipo sin prestar; el nombre es único una vez normalizado. */
export async function crearEquipo(almacen: Almacen, nombre: unknown): Promise<ResultadoAlta> {
  if (typeof nombre !== "string") return { error: "FALTA_NOMBRE" };
  const nombreLimpio = nombre.trim();
  if (nombreLimpio === "") return { error: "FALTA_NOMBRE" };
  const nombreNormalizado = normalizarNombre(nombreLimpio);

  return almacen.transaccion<ResultadoAlta>(async (tx) => {
    if ((await tx.obtener(COLECCION_NOMBRES, nombreNormalizado)) !== undefined) {
      return { error: "NOMBRE_REPETIDO" };
    }
    const documento: DocumentoEquipo = { id: randomUUID(), nombre: nombreLimpio, nombreNormalizado, prestado: false };
    tx.guardar(COLECCION_NOMBRES, nombreNormalizado, { id: documento.id });
    tx.guardar(COLECCION_EQUIPOS, documento.id, documento);
    return { equipo: aEquipo(documento) };
  });
}

/** Resultado de apuntar un préstamo: el equipo prestado o el motivo por el que no se presta. */
export type ResultadoPrestamo = { equipo: Equipo } | { error: "NO_EXISTE" | "FALTAN_DATOS" | "FECHA_NO_VALIDA" | "YA_PRESTADO" };

/** Una fecha AAAA-MM-DD es válida si corresponde a un día que existe en el calendario; puede ser pasada. */
export function esFechaValida(fecha: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (partes === null) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const real = new Date(Date.UTC(anio, mes - 1, dia));
  return real.getUTCFullYear() === anio && real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia;
}

/** Presta un equipo libre a una persona hasta la fecha de devolución, que se guarda tal como llega. */
export async function prestarEquipo(
  almacen: Almacen,
  id: string,
  persona: unknown,
  devolucion: unknown,
): Promise<ResultadoPrestamo> {
  return almacen.transaccion<ResultadoPrestamo>(async (tx) => {
    const documento = await tx.obtener<DocumentoEquipo>(COLECCION_EQUIPOS, id);
    if (documento === undefined) return { error: "NO_EXISTE" };
    if (typeof persona !== "string" || persona.trim() === "" || typeof devolucion !== "string" || devolucion.trim() === "") {
      return { error: "FALTAN_DATOS" };
    }
    if (!esFechaValida(devolucion)) return { error: "FECHA_NO_VALIDA" };
    if (documento.prestado) return { error: "YA_PRESTADO" };
    const prestado: DocumentoEquipo = { ...documento, prestado: true, persona: persona.trim(), devolucion };
    tx.guardar(COLECCION_EQUIPOS, id, prestado);
    return { equipo: aEquipo(prestado) };
  });
}

/** Resultado de apuntar una devolución: el equipo libre o el motivo por el que no se devuelve. */
export type ResultadoDevolucion = { equipo: Equipo } | { error: "NO_EXISTE" | "NO_PRESTADO" };

/** Devuelve un equipo prestado: vuelve a figurar libre, sin persona ni devolucion. */
export async function devolverEquipo(almacen: Almacen, id: string): Promise<ResultadoDevolucion> {
  return almacen.transaccion<ResultadoDevolucion>(async (tx) => {
    const documento = await tx.obtener<DocumentoEquipo>(COLECCION_EQUIPOS, id);
    if (documento === undefined) return { error: "NO_EXISTE" };
    if (!documento.prestado) return { error: "NO_PRESTADO" };
    const libre: DocumentoEquipo = {
      id: documento.id,
      nombre: documento.nombre,
      nombreNormalizado: documento.nombreNormalizado,
      prestado: false,
    };
    tx.guardar(COLECCION_EQUIPOS, id, libre);
    return { equipo: aEquipo(libre) };
  });
}

export async function listarEquipos(almacen: Almacen): Promise<Equipo[]> {
  const documentos = await almacen.listar<DocumentoEquipo>(COLECCION_EQUIPOS);
  return documentos.map(aEquipo);
}
