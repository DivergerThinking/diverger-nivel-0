// Pantallas del contexto «equipos» (ADR 0053 del harness): las de spec/contextos/equipos/pantallas.md.
import type { Pantalla } from "../pantallas.js";
import { AltaDeEquipo } from "./AltaDeEquipo.js";

export const pantallas: Pantalla[] = [{ id: "equipos-alta", titulo: "Alta de equipo", Componente: AltaDeEquipo }];
