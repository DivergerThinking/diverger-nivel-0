// Pantallas del contexto «prestamos» (ADR 0053 del harness): las que describe spec/contextos/prestamos/pantallas.md.
import type { Pantalla } from "../pantallas.js";
import { ListaEquipos } from "./ListaEquipos.js";

export const pantallas: Pantalla[] = [{ id: "prestamos-lista", titulo: "Equipos y préstamos", Componente: ListaEquipos }];
