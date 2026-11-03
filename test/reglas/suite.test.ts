// La PR de una tarea no toca la suite de aceptación (EN-CAL-01, ADR 0031 del harness). Se prueba el script del
// CI sobre un repositorio git real y el job «suite» de ci.yml.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "suite.mjs");
// Las comprobaciones del worker corren en un contenedor sin git (harness#533): ahí estas pruebas se saltan.
const HAY_GIT = spawnSync("git", ["--version"]).status === 0;
const TAREA = ["--trailer", "Diverger-Rol: Desarrollador", "--trailer", "Diverger-Modelo: claude-sonnet-5-5",
  "--trailer", "Diverger-Tarea: TA-012"];

let repo = "";
let salida = "";

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

function escribir(ruta: string, texto: string): void {
  mkdirSync(join(repo, dirname(ruta)), { recursive: true });
  writeFileSync(join(repo, ruta), texto);
}

function commit(mensaje: string, trailers: string[] = []): void {
  git(["add", "-A"]);
  git(["commit", "-q", "-m", mensaje, ...trailers]);
}

function comprobar(rama = "diverger/nivel-0/TA-012"): { codigo: number | null; errores: string; salida: string; resumen: string } {
  const env = { ...process.env, GITHUB_OUTPUT: join(salida, "output"), GITHUB_STEP_SUMMARY: join(salida, "resumen"),
    PR_RAMA: rama };
  writeFileSync(env.GITHUB_OUTPUT, "");
  writeFileSync(env.GITHUB_STEP_SUMMARY, "");
  const r = spawnSync(process.execPath, [SCRIPT, "base..HEAD"], { cwd: repo, encoding: "utf8", env });
  return { codigo: r.status, errores: r.stderr, salida: readFileSync(env.GITHUB_OUTPUT, "utf8"),
    resumen: readFileSync(env.GITHUB_STEP_SUMMARY, "utf8") };
}

beforeEach(() => {
  salida = mkdtempSync(join(tmpdir(), "suite-salida-"));
  if (!HAY_GIT) return;
  repo = mkdtempSync(join(tmpdir(), "suite-"));
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.name", "Prueba"]);
  git(["config", "user.email", "prueba@example.com"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "core.autocrlf", "false"]);
  escribir("tests/aceptacion/prestamo.feature", "# language: es\nCaracterística: Prestar\n");
  escribir("src/prestamos/servicio.ts", "export const x = 1;\n");
  commit("inicio");
  git(["tag", "base"]);
});

afterEach(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
  rmSync(salida, { recursive: true, force: true });
  repo = "";
});

describe.skipIf(!HAY_GIT)("la PR de una tarea y la suite de aceptación", () => {
  it("criterio positivo: la PR de TA-012 que no toca la suite pasa", () => {
    escribir("src/prestamos/servicio.ts", "export const x = 2;\n");
    commit("feat: TA-012", TAREA);
    const r = comprobar();
    expect(r.codigo).toBe(0);
    expect(r.salida).toBe("modificada=false\n");
    expect(r.resumen).toContain("La PR no toca la suite de aceptación.");
  });

  it("criterio negativo: la PR de TA-012 que modifica prestamo.feature falla y se cuenta", () => {
    escribir("src/prestamos/servicio.ts", "export const x = 2;\n");
    escribir("tests/aceptacion/prestamo.feature", "# language: es\nCaracterística: Prestar, más fácil\n");
    commit("feat: TA-012", TAREA);
    const r = comprobar();
    expect(r.codigo).toBe(1);
    expect(r.salida).toBe("modificada=true\n");
    expect(r.errores).toContain("La PR de la tarea TA-012 modifica la suite de aceptación: tests/aceptacion/prestamo.feature.");
    expect(r.resumen).toContain("generate_features");
  });

  it.each([
    ["añade", () => { escribir("tests/aceptacion/nuevo.feature", "Característica: Nuevo\n"); }, "tests/aceptacion/nuevo.feature"],
    ["borra", () => { rmSync(join(repo, "tests/aceptacion/prestamo.feature")); }, "tests/aceptacion/prestamo.feature"],
    ["saca", () => { renameSync(join(repo, "tests/aceptacion/prestamo.feature"), join(repo, "prestamo.feature")); },
      "tests/aceptacion/prestamo.feature"],
  ])("la PR de una tarea que %s un escenario también falla", (_, cambiar, fichero) => {
    cambiar();
    commit("feat: TA-012", TAREA);
    const r = comprobar();
    expect(r.codigo).toBe(1);
    expect(r.errores).toContain(fichero);
  });

  it("basta un commit de la tarea entre otros de una persona", () => {
    escribir("src/prestamos/servicio.ts", "export const x = 2;\n");
    commit("feat: TA-012", TAREA);
    escribir("tests/aceptacion/prestamo.feature", "cambiado\n");
    commit("arreglo a mano");
    expect(comprobar().codigo).toBe(1);
  });

  it("la PR de una persona que regenera la suite pasa, pero se cuenta", () => {
    escribir("tests/aceptacion/prestamo.feature", "# language: es\nCaracterística: Prestar, regenerada\n");
    commit("docs: criterios nuevos de HU-PRE-01 y suite regenerada");
    const r = comprobar();
    expect(r.codigo).toBe(0);
    expect(r.salida).toBe("modificada=true\n");
    expect(r.resumen).toContain("CODEOWNERS pide la aprobación de un propietario");
  });

  it("las ramas de mantenimiento del harness no son tareas: el reinicio borra la suite", () => {
    rmSync(join(repo, "tests/aceptacion/prestamo.feature"));
    commit("chore: reinicio de diverger-nivel-0", ["--trailer", "Diverger-Rol: Evaluación", "--trailer",
      "Diverger-Tarea: EN-GP-06"]);
    const reinicio = comprobar("diverger/reinicio/12345");
    expect(reinicio.codigo).toBe(0);
    expect(reinicio.salida).toBe("modificada=true\n");
    expect(comprobar("diverger/ajustes/7").codigo).toBe(0);
    // Solo esas dos formas: cualquier otra rama con el trailer es la PR de una tarea.
    expect(comprobar("diverger/reinicio/abc").codigo).toBe(1);
    expect(comprobar("diverger/nivel-0/EN-GP-06").codigo).toBe(1);
  });

  it("una suite cambiada en main después de abrir la PR no cuenta como de la PR", () => {
    git(["checkout", "-q", "-b", "tarea"]);
    escribir("src/prestamos/servicio.ts", "export const x = 2;\n");
    commit("feat: TA-012", TAREA);
    git(["checkout", "-q", "main"]);
    escribir("tests/aceptacion/prestamo.feature", "regenerada en main\n");
    commit("docs: suite regenerada");
    git(["tag", "-f", "base"]);
    git(["checkout", "-q", "tarea"]);
    expect(comprobar().codigo).toBe(0);
  });

  it("falla con un rango que no es <base>..<head>", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "base"], { cwd: repo, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no es <base>..<head>");
  });
});

describe("job «suite» de ci.yml", () => {
  type Paso = { name?: string; id?: string; if?: string; run?: string; uses?: string; with?: Record<string, unknown>;
    env?: Record<string, string> };
  type Job = { if?: string; permissions: Record<string, string>; steps: Paso[] };
  const CI = parse(readFileSync(join(RAIZ, ".github", "workflows", "ci.yml"), "utf8")) as { jobs: Record<string, Job | undefined> };
  const job = CI.jobs.suite as Job;

  it("corre en cada PR con el script de la rama base", () => {
    expect(job.if).toBe("github.event_name == 'pull_request'");
    expect(job.steps[0]?.with?.ref).toBe("${{ github.event.pull_request.base.sha }}");
    const paso = job.steps.find((p) => p.id === "suite");
    expect(paso?.run).toBe('node scripts/suite.mjs "$RANGO"');
    expect(paso?.env).not.toHaveProperty("GH_TOKEN");
    expect(paso?.env?.PR_RAMA).toBe("${{ github.head_ref }}");
  });

  it("etiqueta la PR aunque la comprobación falle, solo si toca la suite", () => {
    const paso = job.steps.find((p) => p.name === "Contar la modificación");
    expect(paso?.if).toBe("always() && steps.suite.outputs.modificada == 'true'");
    expect(paso?.run).toContain("--add-label suite-modificada");
    expect(job.permissions).toEqual({ contents: "read", issues: "write", "pull-requests": "write" });
  });
});
