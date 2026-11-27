// El modelo de los agentes del harness que juzgan en los jobs (harness#1107, ADR 0081 del harness): el de la cabecera
// del agente, que es el que propone el harness, o el que fija el proyecto en models de .diverger/settings.json.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, ".github", "diverger", "modelo-agente.sh");
const HAY_BASH = spawnSync("bash", ["-c", "command -v jq && command -v sed"]).status === 0;
const AGENTE = "---\nname: auditor-seguridad\ntools: Read, Grep, Glob\nmodel: opus\n---\n\n# Auditor\n\nmodel: no es la cabecera\n";

let carpeta = "";
afterEach(() => {
  if (carpeta) rmSync(carpeta, { recursive: true, force: true });
});

function lanzar(ajustes: object | string | null, clave = "securityAuditor") {
  carpeta = mkdtempSync(join(tmpdir(), "modelo-agente-"));
  const agente = join(carpeta, "auditor-seguridad.md");
  writeFileSync(agente, AGENTE);
  if (ajustes !== null) {
    mkdirSync(join(carpeta, ".diverger"));
    writeFileSync(join(carpeta, ".diverger", "settings.json"), typeof ajustes === "string" ? ajustes : JSON.stringify(ajustes));
  }
  const r = spawnSync("bash", [SCRIPT, agente, clave], { cwd: carpeta, encoding: "utf8" });
  return { status: r.status, salida: `${r.stdout}${r.stderr}`, agente: readFileSync(agente, "utf8") };
}

describe.skipIf(!HAY_BASH)("modelo-agente.sh", () => {
  it("sin ajuste, deja el modelo que propone el harness", () => {
    const r = lanzar(null);
    expect(r.status).toBe(0);
    expect(r.agente).toBe(AGENTE);
    expect(r.salida).toContain("Modelo de auditor-seguridad: opus (el del harness)");
  });

  it("con models.<clave>, cambia solo la línea de la cabecera de la copia", () => {
    const r = lanzar({ models: { securityAuditor: "claude-sonnet-5-5", developer: "haiku" } });
    expect(r.status).toBe(0);
    expect(r.agente).toContain("\nmodel: claude-sonnet-5-5\n---");
    expect(r.agente).toContain("\nmodel: no es la cabecera\n");
    expect(r.salida).toContain("(models.securityAuditor del proyecto)");
  });

  it("el modelo de otra clave no le afecta", () => {
    expect(lanzar({ models: { codeReviewer: "haiku" } }).agente).toBe(AGENTE);
  });

  it("un modelo que no es un nombre válido para el job y no cambia nada", () => {
    const r = lanzar({ models: { securityAuditor: "opus; rm -rf /" } });
    expect(r.status).toBe(1);
    expect(r.salida).toContain("no es válido");
    expect(r.agente).toBe(AGENTE);
  });

  it("un settings.json roto para el job", () => {
    expect(lanzar("{ no es json").status).toBe(1);
  });
});

describe("los jobs aplican el modelo del proyecto a la copia de cada agente que juzga", () => {
  const worker = readFileSync(join(RAIZ, ".github", "workflows", "diverger-worker.yml"), "utf8");
  const bucle = readFileSync(join(RAIZ, ".github", "workflows", "diverger-bucle.yml"), "utf8");

  it("el revisor de código y el auditor de seguridad, en el job del worker", () => {
    expect(worker).toContain('bash .github/diverger/modelo-agente.sh "$PLUGIN_NUCLEO/agents/revisor-codigo.md" codeReviewer');
    expect(worker).toContain('bash .github/diverger/modelo-agente.sh "$PLUGIN_QUALITY/agents/auditor-seguridad.md" securityAuditor');
  });

  it("el analista de bloqueos, en el job del análisis", () => {
    expect(bucle).toContain('bash .github/diverger/modelo-agente.sh "$plugin/agents/analista-bloqueos.md" blockingAnalyst');
  });
});
