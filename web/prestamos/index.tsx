// Pantallas del contexto «prestamos» (ADR 0053 del harness): las que describe spec/contextos/prestamos/pantallas.md.
import type { Pantalla } from "../pantallas.js";
import { ApuntarPrestamo } from "./ApuntarPrestamo.js";
import { ListaDeEquipos } from "./ListaDeEquipos.js";

export const pantallas: Pantalla[] = [
  { id: "prestamos-lista", titulo: "Equipos y préstamos", Componente: ListaDeEquipos },
  { id: "prestamos-prestar", titulo: "Apuntar un préstamo", Componente: ApuntarPrestamo },
];
