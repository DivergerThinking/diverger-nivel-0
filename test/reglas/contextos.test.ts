// El registro de los contextos se genera desde src/<id>/index.ts (golden-path#71): un contexto nuevo se registra sin
// cambiar ningún otro fichero, así que dos tareas de contextos distintos no comparten ninguno y sus PR no chocan.
// Se prueba scripts/generar-contextos.mjs en una carpeta aparte, como lo ejecuta npm run gen.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "generar-contextos.mjs");

describe("registro de los contextos", () => {
  let raiz = "";

  function contexto(id: string, conIndex = true): void {
    mkdirSync(join(raiz, "src", id), { recursive: true });
    if (conIndex) writeFileSync(join(raiz, "src", id, "index.ts"), "export const rutas = () => Promise.resolve();\n");
  }

  function generar() {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: raiz, encoding: "utf8" });
    const destino = join(raiz, "app", "contextos.gen.ts");
    return { codigo: r.status, salida: r.stdout, errores: r.stderr,
      registro: existsSync(destino) ? readFileSync(destino, "utf8") : undefined };
  }

  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "registro-"));
    mkdirSync(join(raiz, "app"));
  });

  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true });
  });

  it("registra cada carpeta de src/ con index.ts, en orden, y no las que no lo tienen", () => {
    contexto("prestamos");
    contexto("equipos");
    contexto("a-medias", false);
    const r = generar();
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain("app/contextos.gen.ts: equipos, prestamos");
    expect(r.registro).toContain('import { rutas as contexto0 } from "../src/equipos/index.js";');
    expect(r.registro).toContain('import { rutas as contexto1 } from "../src/prestamos/index.js";');
    expect(r.registro).toContain("export const contextos: FastifyPluginAsync<OpcionesContexto>[] = [contexto0, contexto1];");
    expect(r.registro).not.toContain("a-medias");
  });

  it("un contexto nuevo solo añade su carpeta: el registro sale de npm run gen, no de un fichero común", () => {
    contexto("alfa");
    const antes = generar().registro;
    contexto("beta");
    const despues = generar().registro;
    expect(antes).not.toContain("beta");
    expect(despues).toContain('import { rutas as contexto1 } from "../src/beta/index.js";');
    expect(despues).toContain("[contexto0, contexto1]");
  });

  it("sin contextos, el registro está vacío", () => {
    const r = generar();
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain("app/contextos.gen.ts: ningún contexto");
    expect(r.registro).toContain("export const contextos: FastifyPluginAsync<OpcionesContexto>[] = [];");
  });

  // Una comilla no vale en el nombre de una carpeta de Windows.
  it.each(["Prestamos", "mis_equipos", "-guion", "a.b", ...(process.platform === "win32" ? [] : ['a"b'])])("falla, sin escribir el registro, con la carpeta src/%s, que no es un id de contexto", (id) => {
    contexto("bien");
    contexto(id);
    const r = generar();
    expect(r.codigo).toBe(1);
    expect(r.errores).toContain(`src/${id}: el nombre de la carpeta de un contexto es su id`);
    expect(r.registro).toBeUndefined();
  });

  // Solo lo que sincronizar-nivel del harness lleva a un nivel (scripts/, test/reglas/ y package.json): ni .gitignore
  // ni app/ cambian hasta el reinicio, así que un test sobre ellos dejaría en rojo un nivel recién sincronizado.
  it("npm run gen genera el registro", () => {
    const paquete = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(paquete.scripts.gen).toContain("node scripts/generar-contextos.mjs");
  });
});
