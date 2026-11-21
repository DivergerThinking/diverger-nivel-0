// Pantallas del contexto «prestamos» (ADR 0053 del harness): las que describe spec/contextos/prestamos/pantallas.md.
import type { Pantalla } from "../pantallas.js";
import { EquiposYPrestamos } from "./EquiposYPrestamos.js";

export const pantallas: Pantalla[] = [{ id: "prestamos-equipos", titulo: "Equipos y préstamos", Componente: EquiposYPrestamos }];
