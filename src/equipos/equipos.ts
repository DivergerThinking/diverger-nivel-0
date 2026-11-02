// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import { randomUUID } from "node:crypto";
import type { Almacen } from "../../lib/datos.js";
import type { components } from "./api.gen.js";

export type Equipo = components["schemas"]["Equipo"];

export const COLECCION = "equipos";

export const ERROR_FALTA_NOMBRE = "Falta el nombre del equipo";

/** Documento de la colección «equipos». */
export interface DocumentoEquipo {
  nombre: string;
  /** Sin los espacios del principio y del final y sin distinguir mayúsculas; es lo que se compara. */
  nombreNormalizado: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

/** Un documento por nombre normalizado en uso; su id es el nombre, así que solo cabe uno. */
export const COLECCION_NOMBRES = "equipos_nombres";

export const ERROR_NOMBRE_REPETIDO = "Ya hay un equipo con ese nombre";

export type ResultadoAlta =
  | { ok: true; equipo: Equipo }
  | { ok: false; error: string; repetido?: boolean };

export const ERROR_FALTAN_DATOS_PRESTAMO = "Faltan la persona o la fecha de devolución";
export const ERROR_FECHA_NO_VALIDA = "La fecha de devolución no es válida";
export const ERROR_YA_PRESTADO = "El equipo ya está prestado";
export const ERROR_NO_EXISTE = "No existe el equipo";

export type ResultadoPrestamo =
  | { ok: true; equipo: Equipo }
  | { ok: false; error: string; codigo: 400 | 404 | 409 };

/** True si el texto es AAAA-MM-DD y una fecha real del calendario. */
export function esFechaReal(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** Presta un equipo no prestado a una persona hasta la fecha de devolución (las fechas pasadas se aceptan). */
export async function prestarEquipo(
  almacen: Almacen,
  id: string,
  persona: unknown,
  devolucion: unknown,
): Promise<ResultadoPrestamo> {
  if (
    typeof persona !== "string" ||
    persona.trim() === "" ||
    typeof devolucion !== "string" ||
    devolucion.trim() === ""
  ) {
    return { ok: false, codigo: 400, error: ERROR_FALTAN_DATOS_PRESTAMO };
  }
  if (!esFechaReal(devolucion)) return { ok: false, codigo: 400, error: ERROR_FECHA_NO_VALIDA };
  // Se lee y se escribe en la misma transacción: dos préstamos a la vez del mismo equipo no se pisan.
  return almacen.transaccion<ResultadoPrestamo>(async (tx) => {
    const equipo = await tx.obtener<DocumentoEquipo>(COLECCION, id);
    if (!equipo) return { ok: false, codigo: 404, error: ERROR_NO_EXISTE };
    if (equipo.prestado) return { ok: false, codigo: 409, error: ERROR_YA_PRESTADO };
    tx.guardar(COLECCION, id, { ...equipo, prestado: true, persona, devolucion });
    return { ok: true, equipo: { id, nombre: equipo.nombre, prestado: true, persona, devolucion } };
  });
}

export const ERROR_NO_PRESTADO = "El equipo no está prestado";

export type ResultadoDevolucion =
  | { ok: true; equipo: Equipo }
  | { ok: false; error: string; codigo: 404 | 409 };

/** Apunta la devolución de un equipo prestado: queda no prestado y sin persona ni fecha. */
export async function devolverEquipo(almacen: Almacen, id: string): Promise<ResultadoDevolucion> {
  // Se lee y se escribe en la misma transacción: dos devoluciones a la vez no se pisan.
  return almacen.transaccion<ResultadoDevolucion>(async (tx) => {
    const equipo = await tx.obtener<DocumentoEquipo>(COLECCION, id);
    if (!equipo) return { ok: false, codigo: 404, error: ERROR_NO_EXISTE };
    if (!equipo.prestado) return { ok: false, codigo: 409, error: ERROR_NO_PRESTADO };
    const documento: DocumentoEquipo = {
      nombre: equipo.nombre,
      nombreNormalizado: equipo.nombreNormalizado,
      prestado: false,
    };
    tx.guardar(COLECCION, id, documento);
    return { ok: true, equipo: { id, nombre: equipo.nombre, prestado: false } };
  });
}

export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

function idReservaNombre(nombreNormalizado: string): string {
  return `n:${encodeURIComponent(nombreNormalizado)}`;
}

/** Lista los equipos por nombre; solo los prestados llevan persona y devolucion. */
export async function listarEquipos(almacen: Almacen): Promise<Equipo[]> {
  const documentos = await almacen.listar<DocumentoEquipo>(COLECCION);
  // Los documentos no guardan su id: se recupera de la reserva de su nombre, que apunta al equipo.
  const equipos = await Promise.all(
    documentos.map(async (documento): Promise<Equipo | null> => {
      const reserva = await almacen.obtener<{ equipoId: string }>(
        COLECCION_NOMBRES,
        idReservaNombre(documento.nombreNormalizado),
      );
      if (!reserva) return null;
      const id = reserva.equipoId;
      if (!documento.prestado) return { id, nombre: documento.nombre, prestado: false };
      return {
        id,
        nombre: documento.nombre,
        prestado: true,
        ...(documento.persona === undefined ? {} : { persona: documento.persona }),
        ...(documento.devolucion === undefined ? {} : { devolucion: documento.devolucion }),
      };
    }),
  );
  return equipos
    .filter((equipo): equipo is Equipo => equipo !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Da de alta un equipo no prestado; sin nombre (o vacío) no crea nada. */
export async function darDeAlta(almacen: Almacen, nombre: unknown): Promise<ResultadoAlta> {
  if (typeof nombre !== "string" || normalizarNombre(nombre) === "") {
    return { ok: false, error: ERROR_FALTA_NOMBRE };
  }
  const id = randomUUID();
  const nombreNormalizado = normalizarNombre(nombre);
  const documento: DocumentoEquipo = { nombre, nombreNormalizado, prestado: false };
  // El nombre normalizado se reserva dentro de la misma transacción que crea el equipo: dos altas
  // simultáneas con el mismo nombre no pueden crear los dos.
  const reservado = await almacen.transaccion(async (tx) => {
    const idReserva = idReservaNombre(nombreNormalizado);
    if (await tx.obtener(COLECCION_NOMBRES, idReserva)) return false;
    tx.guardar(COLECCION_NOMBRES, idReserva, { equipoId: id });
    tx.guardar(COLECCION, id, documento);
    return true;
  });
  if (!reservado) return { ok: false, error: ERROR_NOMBRE_REPETIDO, repetido: true };
  return { ok: true, equipo: { id, nombre, prestado: false } };
}
