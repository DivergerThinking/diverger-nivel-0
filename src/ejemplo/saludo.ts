// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { components } from "./api.gen.js";

export type Saludo = components["schemas"]["Saludo"];

export function saludar(nombre: string): Saludo {
  return { mensaje: `Hola, ${nombre}` };
}
