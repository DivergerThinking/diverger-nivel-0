// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import { createHash, randomUUID } from "node:crypto";
import type { Almacen } from "../../lib/datos.js";

/** Un equipo de la oficina, como se guarda en `equipos_equipos`: sin su préstamo, que es de «prestamos». */
export interface Equipo {
  id: string;
  nombre: string;
}

const EQUIPOS = "equipos_equipos";
const NOMBRES = "equipos_nombres";

interface DocumentoNombre {
  id: string;
}

export type ResultadoAlta =
  | { tipo: "creado"; equipo: Equipo }
  | { tipo: "sin-nombre" }
  | { tipo: "repetido" };

/** El nombre sin espacios al principio ni al final y en minúsculas: solo sirve para comparar. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

function idDelNombre(nombre: string): string {
  return createHash("sha256").update(normalizarNombre(nombre)).digest("hex");
}

/** Da de alta un equipo: el nombre es obligatorio y no puede repetirse (ADR 0001). */
export async function altaDeEquipo(almacen: Almacen, nombre: unknown): Promise<ResultadoAlta> {
  if (typeof nombre !== "string" || normalizarNombre(nombre) === "") return { tipo: "sin-nombre" };
  const idNombre = idDelNombre(nombre);
  return almacen.transaccion<ResultadoAlta>(async (tx) => {
    if (await tx.obtener<DocumentoNombre>(NOMBRES, idNombre)) return { tipo: "repetido" };
    const equipo: Equipo = { id: randomUUID(), nombre };
    tx.guardar(EQUIPOS, equipo.id, equipo);
    tx.guardar(NOMBRES, idNombre, { id: equipo.id });
    return { tipo: "creado", equipo };
  });
}

/** Todos los equipos dados de alta, en cualquier orden. */
export function listarEquipos(almacen: Almacen): Promise<Equipo[]> {
  return almacen.listar<Equipo>(EQUIPOS);
}

/** El equipo con ese id, o undefined si no existe. */
export function obtenerEquipo(almacen: Almacen, id: string): Promise<Equipo | undefined> {
  return almacen.obtener<Equipo>(EQUIPOS, id);
}
