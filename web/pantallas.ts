// Lo común a todas las pantallas de la aplicación (ADR 0053 del harness): qué es una pantalla, la sesión que recibe y
// cómo llama a la API. Las pantallas de cada contexto viven en web/<id>/ y se exportan desde su index.tsx; npm run gen
// las junta en web/pantallas.gen.ts. Este fichero no lo cambia ninguna tarea.
import type { ComponentType } from "react";

/** Quien ha iniciado sesión, como lo devuelve GET /api/yo. Un contexto puede añadir campos, por ejemplo su rol. */
export interface Persona {
  email: string;
  nombre: string;
  [campo: string]: unknown;
}

/** Lo que recibe cada pantalla: el token de Google, para llamar a la API, y la persona. */
export interface Sesion {
  token: string;
  persona: Persona;
}

export interface Pantalla {
  /** Único en la aplicación: el id del contexto y el de la pantalla, por ejemplo «prestamos-vencidos». */
  id: string;
  /** El texto del menú. */
  titulo: string;
  Componente: ComponentType<{ sesion: Sesion }>;
  /**
   * Si la persona puede verla. Sin ella, la ve cualquiera que haya iniciado sesión. Puede preguntar a la API, por
   * ejemplo con siPuedeLlamar. Si falla, la pantalla no se enseña. Ocultarla no protege nada: la API sigue respondiendo
   * 403 a quien no puede hacer la operación.
   */
  visible?: (sesion: Sesion) => boolean | Promise<boolean>;
}

/** Un error de la API con su código y el mensaje de su cuerpo ({"error": "…"}), para enseñarlo tal cual. */
export class ErrorDeLaApi extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDeLaApi";
  }
}

/**
 * Llama a la API con el token de la sesión y devuelve el cuerpo JSON. Con un código de error, lanza ErrorDeLaApi con
 * el mensaje que da la API, o uno genérico si no lo da.
 */
export async function api<T>(sesion: Sesion, ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const cabeceras: Record<string, string> = { authorization: `Bearer ${sesion.token}` };
  if (opciones.cuerpo !== undefined) cabeceras["content-type"] = "application/json";
  const respuesta = await fetch(ruta, {
    method: opciones.metodo ?? "GET",
    headers: cabeceras,
    ...(opciones.cuerpo !== undefined ? { body: JSON.stringify(opciones.cuerpo) } : {}),
  });
  const texto = await respuesta.text();
  let cuerpo: unknown;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = null;
  }
  if (!respuesta.ok) {
    const mensaje = cuerpo && typeof cuerpo === "object" && typeof (cuerpo as { error?: unknown }).error === "string"
      ? (cuerpo as { error: string }).error
      : `La aplicación ha respondido ${respuesta.status}.`;
    throw new ErrorDeLaApi(respuesta.status, mensaje);
  }
  return cuerpo as T;
}

/**
 * Una pantalla solo para quien puede hacer una operación de lectura: la llama, y la pantalla no se enseña si la API
 * responde 401 o 403. Sirve, por ejemplo, para las pantallas de IT sin añadir al contrato una ruta que diga el rol: la de
 * los préstamos vencidos, que solo puede leer IT, dice si la persona es de IT.
 */
export function siPuedeLlamar(ruta: string): (sesion: Sesion) => Promise<boolean> {
  return (sesion) =>
    api(sesion, ruta).then(
      () => true,
      (motivo: unknown) => !(motivo instanceof ErrorDeLaApi && (motivo.status === 401 || motivo.status === 403)),
    );
}
