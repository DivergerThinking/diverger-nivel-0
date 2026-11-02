// Trailers de autoría (EN-OPS-02): el hook los añade a los commits de un agente y el CI falla si
// un commit de agente no los lleva. Los commits del harness dicen además qué persona lo lanzó, y el CI
// lo compara con quien lanzó la ejecución (EN-OPS-06). Se prueba sobre un repositorio git real y, para
// quién lanzó la ejecución, con una API de GitHub de mentira.
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { arrancar, lanzadoPorElBucle, PERSONAS, REPO, type Datos } from "./github-falso.js";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "trailers.mjs");
const HOOKS = join(RAIZ, "scripts", "git-hooks");
// Las comprobaciones del worker corren en un contenedor sin git (harness#533): ahí estas pruebas se saltan, y
// el CI de la PR las ejecuta en el runner, que sí lo tiene.
const HAY_GIT = spawnSync("git", ["--version"]).status === 0;
const AGENTE = { DIVERGER_ROL: "Desarrollador", DIVERGER_MODELO: "claude-sonnet-5-5", DIVERGER_TAREA: "TA-004" };

let repo = "";
let servidor: Server | undefined;

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
  if (!HAY_GIT) return;
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
  if (repo) rmSync(repo, { recursive: true, force: true });
  servidor?.close();
  servidor = undefined;
});

describe.skipIf(!HAY_GIT)("trailers de autoría", () => {
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

// Commit del harness como lo hace el worker: autor diverger-harness[bot], sin hooks y con los trailers.
const HARNESS = { GIT_AUTHOR_NAME: "diverger-harness[bot]", GIT_AUTHOR_EMAIL: "350234409+diverger-harness[bot]@users.noreply.github.com" };
const CUERPO = `<!-- diverger:task=TA-004;run=c7fbf6d2 -->\nLanzado por @joselcs. Job del worker: https://github.com/${REPO}/actions/runs/900\n`;
const RAMA = "diverger/prestamos/TA-004";

function commitDelHarness(iniciadoPor: string | undefined, coautor = iniciadoPor): void {
  git(["config", "core.hooksPath", join(repo, "sin-hooks")]);
  const persona = PERSONAS[coautor ?? ""];
  const trailers = ["Diverger-Rol: Desarrollador", "Diverger-Modelo: claude-sonnet-5-5", "Diverger-Tarea: TA-004",
    ...(iniciadoPor ? [`Diverger-Iniciado-por: ${iniciadoPor}`] : []),
    ...(coautor && persona ? [`Co-authored-by: ${persona.name ?? coautor} <${String(persona.id)}+${coautor}@users.noreply.github.com>`] : [])];
  commit(`feat: TA-004 Prestar un equipo\n\n${trailers.join("\n")}`, HARNESS);
}

async function comprobarPR(datos: Datos, cuerpo = CUERPO, rama = RAMA, base = "main"): Promise<{ codigo: number; errores: string }> {
  const api = await arrancar(datos);
  servidor = api.servidor;
  try {
    await promisify(execFile)(process.execPath, [SCRIPT, "base..HEAD"], {
      cwd: repo,
      env: { ...process.env, GITHUB_API_URL: api.url, GITHUB_REPOSITORY: REPO, GH_TOKEN: "token-de-prueba", PR_CUERPO: cuerpo, PR_RAMA: rama, PR_BASE: base },
    });
    return { codigo: 0, errores: "" };
  } catch (error) {
    const fallo = error as { code: number; stderr: string };
    return { codigo: fallo.code, errores: fallo.stderr };
  }
}

describe.skipIf(!HAY_GIT)("trailer de quien lanzó el harness (EN-OPS-06)", () => {
  const LANZADO_POR_JOSELCS = { ejecuciones: lanzadoPorElBucle("joselcs"), usuarios: PERSONAS };

  it("un commit del harness lanzado por joselcs lleva su trailer y su Co-authored-by noreply, y el CI lo acepta", async () => {
    commitDelHarness("joselcs");
    const mensaje = git(["log", "-1", "--format=%B"]);
    expect(mensaje).toContain("Diverger-Rol: Desarrollador");
    expect(mensaje).toContain("Diverger-Iniciado-por: joselcs");
    expect(mensaje).toContain("Co-authored-by: José Luis Calvo <1234567+joselcs@users.noreply.github.com>");
    expect(await comprobarPR(LANZADO_POR_JOSELCS)).toEqual({ codigo: 0, errores: "" });
  });

  it("el CI falla si un commit del harness no lleva el trailer de quien lo lanzó", async () => {
    commitDelHarness(undefined);
    const { codigo, errores } = await comprobarPR(LANZADO_POR_JOSELCS);
    expect(codigo).toBe(1);
    expect(errores).toContain("Falta el trailer de quien lanzó el harness (Diverger-Iniciado-por)");
  });

  it("el CI falla si el trailer es de otra persona que la que lanzó la ejecución", async () => {
    commitDelHarness("ana-lopez");
    const { codigo, errores } = await comprobarPR(LANZADO_POR_JOSELCS);
    expect(codigo).toBe(1);
    expect(errores).toContain("El trailer de quien lanzó el harness no coincide con quien lanzó la ejecución");
    expect(errores).toContain("Diverger-Iniciado-por: ana-lopez; la lanzó joselcs");
  });

  it("el CI falla si el Co-authored-by no es el correo noreply de quien lo lanzó", async () => {
    commitDelHarness("joselcs", "ana-lopez");
    const { codigo, errores } = await comprobarPR(LANZADO_POR_JOSELCS);
    expect(codigo).toBe(1);
    expect(errores).toContain("Falta el Co-authored-by de quien lanzó el harness con su correo noreply (1234567+joselcs@users.noreply.github.com)");
  });

  it("el CI falla si la PR del harness no enlaza el job del worker", async () => {
    commitDelHarness("joselcs");
    const { codigo, errores } = await comprobarPR(LANZADO_POR_JOSELCS, "PR sin enlace");
    expect(codigo).toBe(1);
    expect(errores).toContain("No se puede comprobar quién lanzó la ejecución: la PR no enlaza el job del worker");
  });

  it("el CI falla si el job enlazado es el worker de otra tarea, según GitHub y no según la PR", async () => {
    commitDelHarness("joselcs");
    const ejecuciones = lanzadoPorElBucle("joselcs").map((e) => e.id === 900 ? { ...e, display_title: "diverger-worker TA-005 c7fbf6d2" } : e);
    const { codigo, errores } = await comprobarPR({ ejecuciones, usuarios: PERSONAS });
    expect(codigo).toBe(1);
    expect(errores).toContain("No se puede comprobar quién lanzó la ejecución: La ejecución 900 es del worker de la tarea TA-005, no de la tarea TA-004 de la rama de la PR");
  });

  it("el CI falla si el job enlazado corrió en otra rama que la base de la PR", async () => {
    commitDelHarness("joselcs");
    const { codigo, errores } = await comprobarPR(LANZADO_POR_JOSELCS, CUERPO, RAMA, "release");
    expect(codigo).toBe(1);
    expect(errores).toContain("La ejecución 900 corrió en la rama main, no en la rama base de la PR (release)");
  });

  it("el CI falla si la PR del harness no sale de la rama de un worker", async () => {
    commitDelHarness("joselcs");
    const { codigo, errores } = await comprobarPR(LANZADO_POR_JOSELCS, CUERPO, "otra-rama");
    expect(codigo).toBe(1);
    expect(errores).toContain("la rama de la PR (otra-rama) no es la de un worker (diverger/<iniciativa>/<tarea>)");
  });

  it("los commits de personas y de agentes en su sesión no necesitan el trailer ni la API", () => {
    commit("docs: README");
    commit("feat: algo", AGENTE);
    // Sin PR_CUERPO ni API: no hay commits del harness, así que no pregunta a GitHub.
    expect(comprobar()).toEqual({ codigo: 0, errores: "" });
  });

  it("los commits de otras Apps sin trailers de Diverger (Dependabot) no son del harness", () => {
    git(["config", "core.hooksPath", join(repo, "sin-hooks")]);
    commit("build(deps): bump vite", { GIT_AUTHOR_NAME: "dependabot[bot]", GIT_AUTHOR_EMAIL: "49699333+dependabot[bot]@users.noreply.github.com" });
    expect(comprobar()).toEqual({ codigo: 0, errores: "" });
  });

  it("el hook añade quien lanzó el harness y su Co-authored-by sin quitar el del agente", () => {
    commit("feat: algo\n\nCo-Authored-By: Claude <noreply@anthropic.com>", {
      ...AGENTE, DIVERGER_INICIADO_POR: "joselcs", DIVERGER_INICIADO_POR_ID: "1234567", DIVERGER_INICIADO_POR_NOMBRE: "José Luis Calvo",
    });
    const mensaje = git(["log", "-1", "--format=%B"]);
    expect(mensaje).toContain("Diverger-Iniciado-por: joselcs");
    expect(mensaje).toContain("Co-authored-by: José Luis Calvo <1234567+joselcs@users.noreply.github.com>");
    expect(mensaje).toContain("Co-Authored-By: Claude <noreply@anthropic.com>");
  });

  it("el hook falla si hay quien lo lanzó pero no su id de GitHub", () => {
    writeFileSync(join(repo, "fichero.txt"), "x\n");
    git(["add", "fichero.txt"]);
    const r = spawnSync("git", ["commit", "-q", "-m", "feat: x"], {
      cwd: repo, encoding: "utf8", env: { ...process.env, ...AGENTE, DIVERGER_INICIADO_POR: "joselcs" },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Falta DIVERGER_INICIADO_POR_ID");
  });
});

describe("job trailers del CI", () => {
  const ci = parse(readFileSync(join(RAIZ, ".github", "workflows", "ci.yml"), "utf8")) as {
    jobs: Record<string, { permissions?: Record<string, string>; steps: { uses?: string; with?: Record<string, unknown>; env?: Record<string, string>; run?: string }[] }>;
  };
  const job = ci.jobs.trailers ?? { steps: [] };

  it("usa el script de la rama base, para que una PR no cambie la comprobación que la juzga", () => {
    const checkout = job.steps.find((p) => p.uses?.startsWith("actions/checkout@"));
    expect(checkout?.with).toMatchObject({ ref: "${{ github.event.pull_request.base.sha }}", "fetch-depth": 0 });
    expect(job.steps.some((p) => p.run?.includes('git fetch --quiet origin "refs/pull/$NUMERO/head"'))).toBe(true);
  });

  it("pasa la descripción y la rama de la PR y puede leer las ejecuciones (EN-OPS-06)", () => {
    expect(job.permissions).toEqual({ contents: "read", actions: "read" });
    const paso = job.steps.find((p) => p.run === 'node scripts/trailers.mjs "$RANGO"');
    expect(paso?.env).toMatchObject({
      GH_TOKEN: "${{ github.token }}",
      PR_CUERPO: "${{ github.event.pull_request.body }}",
      PR_RAMA: "${{ github.head_ref }}",
      PR_BASE: "${{ github.base_ref }}",
    });
  });
});
