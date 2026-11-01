// Trailers de autoría (EN-OPS-02): el hook los añade a los commits de un agente y el CI falla si
// un commit de agente no los lleva. Se prueba sobre un repositorio git real.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "trailers.mjs");
const HOOKS = join(RAIZ, "scripts", "git-hooks");
const AGENTE = { DIVERGER_ROL: "Desarrollador", DIVERGER_MODELO: "claude-sonnet-5-5", DIVERGER_TAREA: "TA-004" };

let repo = "";

function git(args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8", env: { ...process.env, ...env } });
}

function commit(mensaje: string, env: Record<string, string> = {}): void {
  writeFileSync(join(repo, "fichero.txt"), `${mensaje}\n${String(Math.random())}\n`);
  git(["add", "fichero.txt"]);
  git(["commit", "-q", "-m", mensaje], env);
}

function comprobar(): { codigo: number | null; errores: string } {
  const r = spawnSync(process.execPath, [SCRIPT, "base..HEAD"], { cwd: repo, encoding: "utf8" });
  return { codigo: r.status, errores: r.stderr };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "trailers-"));
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.name", "Prueba"]);
  git(["config", "user.email", "prueba@example.com"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "core.autocrlf", "false"]);
  git(["config", "core.hooksPath", HOOKS]);
  commit("inicio");
  git(["tag", "base"]);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("trailers de autoría", () => {
  it("el hook añade rol, modelo y tarea al commit del worker y el CI lo acepta", () => {
    commit("feat: préstamo de equipos", AGENTE);
    const mensaje = git(["log", "-1", "--format=%B"]);
    expect(mensaje).toContain("Diverger-Rol: Desarrollador");
    expect(mensaje).toContain("Diverger-Modelo: claude-sonnet-5-5");
    expect(mensaje).toContain("Diverger-Tarea: TA-004");
    expect(comprobar()).toEqual({ codigo: 0, errores: "" });
  });

  it("los commits de personas no necesitan trailers", () => {
    commit("docs: README");
    expect(comprobar()).toEqual({ codigo: 0, errores: "" });
  });

  it("el CI falla con un commit de agente sin el trailer de tarea", () => {
    git(["config", "core.hooksPath", join(repo, "sin-hooks")]);
    commit("feat: algo\n\nDiverger-Rol: Desarrollador\nDiverger-Modelo: claude-sonnet-5-5");
    const { codigo, errores } = comprobar();
    expect(codigo).toBe(1);
    expect(errores).toContain("Falta el trailer de tarea (Diverger-Tarea)");
    expect(errores).not.toContain("Falta el trailer de rol");
  });

  it("un commit con Co-Authored-By de Claude y sin trailers es de agente", () => {
    git(["config", "core.hooksPath", join(repo, "sin-hooks")]);
    commit("fix: algo\n\nCo-Authored-By: Claude <noreply@anthropic.com>");
    const { codigo, errores } = comprobar();
    expect(codigo).toBe(1);
    expect(errores.split("\n").filter(Boolean)).toHaveLength(3);
  });

  it("el hook falla si hay tarea pero faltan el rol o el modelo", () => {
    writeFileSync(join(repo, "fichero.txt"), "x\n");
    git(["add", "fichero.txt"]);
    const r = spawnSync("git", ["commit", "-q", "-m", "feat: x"], {
      cwd: repo, encoding: "utf8", env: { ...process.env, DIVERGER_TAREA: "TA-004" },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Faltan DIVERGER_ROL o DIVERGER_MODELO");
  });
});
