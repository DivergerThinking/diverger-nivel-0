// El registro de las pantallas se genera desde web/<id>/index.tsx (ADR 0053 del harness): las pantallas de un contexto se
// registran sin cambiar ningún otro fichero, así que dos tareas de contextos distintos no comparten ninguno y sus PR no
// chocan. Se prueba scripts/generar-pantallas.mjs en una carpeta aparte, como lo ejecuta npm run gen.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "generar-pantallas.mjs");

describe("registro de las pantallas", () => {
  let raiz = "";

  function pantallas(id: string, conIndex = true): void {
    mkdirSync(join(raiz, "web", id), { recursive: true });
    if (conIndex) writeFileSync(join(raiz, "web", id, "index.tsx"), "export const pantallas = [];\n");
  }

  function generar() {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: raiz, encoding: "utf8" });
    const destino = join(raiz, "web", "pantallas.gen.ts");
    return { codigo: r.status, salida: r.stdout, errores: r.stderr,
      registro: existsSync(destino) ? readFileSync(destino, "utf8") : undefined };
  }

  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "pantallas-"));
    mkdirSync(join(raiz, "web"));
    writeFileSync(join(raiz, "web", "App.tsx"), "export {};\n");
  });

  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true });
  });

  it("registra las pantallas de cada carpeta de web/ con index.tsx, en orden, y no las que no lo tienen", () => {
    pantallas("prestamos");
    pantallas("equipos");
    pantallas("a-medias", false);
    const r = generar();
    expect(r.codigo, r.errores).toBe(0);
    expect(r.registro).toContain('import { pantallas as pantallas0 } from "./equipos/index.js";');
    expect(r.registro).toContain('import { pantallas as pantallas1 } from "./prestamos/index.js";');
    expect(r.registro).toContain("export const pantallas: Pantalla[] = [...pantallas0, ...pantallas1];");
    expect(r.registro).not.toContain("a-medias");
    expect(r.salida).toContain("equipos, prestamos");
  });

  it("sin pantallas, el registro está vacío", () => {
    const r = generar();
    expect(r.codigo).toBe(0);
    expect(r.registro).toContain("export const pantallas: Pantalla[] = [];");
  });

  it("falla y lo dice si una carpeta con index.tsx no tiene nombre de contexto", () => {
    pantallas("Prestamos");
    const r = generar();
    expect(r.codigo).toBe(1);
    expect(r.errores).toContain("web/Prestamos");
    expect(r.registro).toBeUndefined();
  });

  it("la plantilla registra la pantalla de ejemplo y no versiona el registro", () => {
    expect(readFileSync(join(RAIZ, "package.json"), "utf8")).toContain("node scripts/generar-pantallas.mjs");
    expect(readFileSync(join(RAIZ, ".gitignore"), "utf8")).toMatch(/^web\/pantallas\.gen\.ts$/m);
    expect(existsSync(join(RAIZ, "web", "ejemplo", "index.tsx"))).toBe(true);
  });
});
