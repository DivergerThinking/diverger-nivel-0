// La PR de una tarea lleva la aprobación del revisor de código en su último commit (EN-OPS-08, ADR 0008 del harness).
// Se prueban el job «revisor» de ci.yml y su script sobre un repositorio git real, con un gh de mentira que responde
// con los estados del commit.
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "revisor.mjs");
// Sin git (el contenedor de las comprobaciones del worker, harness#533) o en Windows, donde el gh de mentira no es
// ejecutable, las pruebas del script se saltan; en el CI corren.
const HAY_GIT = spawnSync("git", ["--version"]).status === 0;
const CON_SCRIPT = HAY_GIT && process.platform !== "win32";
const RAMA = "diverger/prestamos/TA-004";

const aprobado = (extra: Record<string, unknown> = {}) =>
  ({ context: "revisor-codigo", state: "success", creator: { login: "github-actions[bot]" }, ...extra });

describe("job «revisor» de ci.yml", () => {
  const ci = parse(readFileSync(join(RAIZ, ".github", "workflows", "ci.yml"), "utf8")) as {
    jobs: Record<string, { if?: string; permissions: Record<string, string>;
      steps: { uses?: string; with?: Record<string, unknown>; run?: string; env?: Record<string, string> }[] }>;
  };
  const job = ci.jobs.revisor;

  it("corre en cada PR con el script de la rama base y solo lee el contenido y los estados", () => {
    expect(job?.if).toBe("github.event_name == 'pull_request'");
    expect(job?.permissions).toEqual({ contents: "read", statuses: "read" });
    expect(job?.steps[0]?.with?.ref).toBe("${{ github.event.pull_request.base.sha }}");
    const ultimo = job?.steps.at(-1);
    expect(ultimo?.run).toMatch(/^\s*node scripts\/revisor\.mjs "\$RANGO"\s*$/m);
    expect(ultimo?.env).toMatchObject({ PR_RAMA: "${{ github.head_ref }}", REPO: "${{ github.repository }}",
      GH_TOKEN: "${{ github.token }}" });
  });

  it.skipIf(!CON_SCRIPT)("pasa con un aviso si la rama base aún no tiene el script: es la PR que lo añade", () => {
    const vacio = mkdtempSync(join(tmpdir(), "revisor-sin-script-"));
    try {
      const r = spawnSync("bash", ["-c", job?.steps.at(-1)?.run ?? "exit 9"], { cwd: vacio, encoding: "utf8",
        env: { ...process.env, RANGO: "a..b" } });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("::notice::La rama base no tiene scripts/revisor.mjs");
    } finally {
      rmSync(vacio, { recursive: true, force: true });
    }
  });

  it.skipIf(!CON_SCRIPT)("con el script en la rama base, su fallo hace fallar el job", () => {
    const base = mkdtempSync(join(tmpdir(), "revisor-con-script-"));
    try {
      mkdirSync(join(base, "scripts"));
      writeFileSync(join(base, "scripts", "revisor.mjs"), "process.exit(1);\n");
      const r = spawnSync("bash", ["-c", job?.steps.at(-1)?.run ?? "exit 9"], { cwd: base, encoding: "utf8",
        env: { ...process.env, RANGO: "a..b" } });
      expect(r.status).toBe(1);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!CON_SCRIPT)("el script del job «revisor»", () => {
  let repo = "";
  let bin = "";

  function git(args: string[]): string {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  }

  function commit(mensaje: string, extra: string[] = []): void {
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "src", "a.ts"), `export const x = ${Math.random()};\n`);
    git(["add", "-A"]);
    git(["commit", "-q", "-m", mensaje, ...extra]);
  }

  function tarea(): void {
    commit("feat: TA-004", ["--trailer", "Diverger-Tarea: TA-004"]);
  }

  function comprobar(rama: string, estados: unknown[]) {
    writeFileSync(join(bin, "estados.json"), JSON.stringify(estados));
    const cabeza = git(["rev-parse", "HEAD"]).trim();
    const r = spawnSync(process.execPath, [SCRIPT, `base..${cabeza}`], { cwd: repo, encoding: "utf8",
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`, PR_RAMA: rama, REPO: "org/app" } });
    let llamada: string;
    try {
      llamada = readFileSync(join(bin, "llamada"), "utf8");
    } catch {
      llamada = "";
    }
    return { codigo: r.status, salida: r.stdout, errores: r.stderr, llamada, cabeza };
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "revisor-"));
    bin = mkdtempSync(join(tmpdir(), "revisor-bin-"));
    // gh de mentira: guarda la llamada y responde con los estados de la prueba, del más reciente al más antiguo.
    writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > "${bin}/llamada"\ncat "${bin}/estados.json"\n`);
    chmodSync(join(bin, "gh"), 0o755);
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.name", "Prueba"]);
    git(["config", "user.email", "prueba@example.com"]);
    git(["config", "commit.gpgsign", "false"]);
    commit("inicio");
    git(["tag", "base"]);
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  });

  it("criterio positivo: la PR de una tarea con la aprobación del worker en su último commit pasa", () => {
    tarea();
    const r = comprobar(RAMA, [{ context: "otro", state: "failure" }, aprobado()]);
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain("El revisor de código aprobó el último commit de la PR de la tarea TA-004");
    expect(r.llamada).toContain(`repos/org/app/commits/${r.cabeza}/statuses`);
  });

  it("criterio negativo: la PR de una tarea sin la aprobación falla, porque nadie más la aprueba", () => {
    tarea();
    const r = comprobar(RAMA, [{ context: "ci", state: "success", creator: { login: "github-actions[bot]" } }]);
    expect(r.codigo).toBe(1);
    expect(r.errores).toContain("no tiene la aprobación del revisor de código en su último commit");
  });

  it("un commit nuevo en la rama de la tarea no tiene la aprobación: la PR vuelve a fallar", () => {
    tarea();
    commit("arreglo a mano");
    const r = comprobar(RAMA, []);
    expect(r.codigo).toBe(1);
    expect(r.llamada).toContain(`commits/${r.cabeza}/statuses`);
  });

  it("un estado revisor-codigo publicado por otra cuenta no vale", () => {
    tarea();
    const r = comprobar(RAMA, [aprobado({ creator: { login: "joselcs" } })]);
    expect(r.codigo).toBe(1);
    expect(r.errores).toContain("lo ha publicado joselcs, no el job del worker (github-actions[bot])");
  });

  it("vale el estado más reciente: uno en failure después de la aprobación la anula", () => {
    tarea();
    const r = comprobar(RAMA, [aprobado({ state: "failure" }), aprobado()]);
    expect(r.codigo).toBe(1);
    expect(r.errores).toContain("está en failure, no en success");
  });

  it("la rama de un worker es de una tarea aunque sus commits no lleven el trailer", () => {
    commit("cambio sin trailers");
    expect(comprobar(RAMA, []).codigo).toBe(1);
  });

  it("un commit con el trailer Diverger-Tarea hace de la PR la de una tarea en cualquier otra rama", () => {
    tarea();
    expect(comprobar("feature/x", []).codigo).toBe(1);
  });

  it.each([
    ["de una persona, sin trailers ni rama de worker", "docs/notas", false],
    ["de mantenimiento del kit de evaluación", "diverger/reinicio/123", true],
    ["del plan de una iniciativa", "plan/prestamos", true],
    ["de la aplicación de un cambio", "cambio/prestamos/C-001", true],
    ["de mantenimiento con una issue en el trailer, como harness#318", "feat/harness-318-revisor", false],
  ])("la PR %s no es de una tarea: pasa sin preguntar a GitHub", (_caso, rama, conTrailer) => {
    if (conTrailer) tarea();
    else commit("docs: notas", ["--trailer", "Diverger-Tarea: harness#318"]);
    const r = comprobar(rama, []);
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain("No es la PR de una tarea");
    expect(r.llamada).toBe("");
  });
});
