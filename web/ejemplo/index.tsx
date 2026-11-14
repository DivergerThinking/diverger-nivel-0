// Pantallas del contexto «ejemplo» (ADR 0053 del harness): las que describe spec/contextos/ejemplo/pantallas.md. El
// arquitecto sustituye este contexto por los de la aplicación, y cada uno exporta aquí sus pantallas.
import type { Pantalla } from "../pantallas.js";
import { Saludo } from "./Saludo.js";

export const pantallas: Pantalla[] = [{ id: "ejemplo-saludo", titulo: "Saludo", Componente: Saludo }];
