// La PR del plan de una iniciativa (harness#711): la forma de diverger-plan.yml, que la abre con la identidad del
// harness al llegar el push de plan/<iniciativa> y lanza el bucle al integrarse, y el paso que decide si lo lanza,
// ejecutado con un gh de mentira.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const TEXTO = readFileSync(join(RAIZ, ".github", "workflows", "diverger-plan.yml"), "utf8");
const BUCLE = parse(readFileSync(join(RAIZ, ".github", "workflows", "diverger-bucle.yml"), "utf8")) as {
  on: { workflow_dispatch: { inputs: Record<string, { required: boolean; type: string }> } };
};

interface Paso {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | boolean>;
}
interface Job { if: string; permissions: Record<string, string>; env: Record<string, string>; steps: Paso[] }

const WF = parse(TEXTO) as {
  on: { push: { branches: string[] }; pull_request: { types: string[] } };
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};
const VACIO: Job = { if: "", permissions: {}, env: {}, steps: [] };
const ABRIR = WF.jobs.abrir ?? VACIO;
const LANZAR = WF.jobs.lanzar ?? VACIO;

describe("forma de diverger-plan.yml", () => {
  it("abre la PR con el push de una rama plan/ y lanza con la PR integrada desde una rama plan/ del mismo repositorio", () => {
    expect(WF.on.push.branches).toEqual(["plan/**"]);
    expect(WF.on.pull_request.types).toEqual(["closed"]);
    expect(ABRIR.if).toContain("github.event_name == 'push'");
    expect(ABRIR.if).toContain("github.event.deleted == false");
    expect(LANZAR.if).toContain("github.event.pull_request.merged == true");
    expect(LANZAR.if).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(LANZAR.if).toContain("startsWith(github.event.pull_request.head.ref, 'plan/')");
  });

  it("sin permisos en el workflow; el job que lanza solo escribe en Actions", () => {
    expect(WF.permissions).toEqual({});
    expect(ABRIR.permissions).toEqual({});
    expect(LANZAR.permissions).toEqual({ actions: "write", contents: "read", "pull-requests": "read" });
  });

  it("no ejecuta nada de la rama: sin checkout, y lo que llega de fuera va en variables y se comprueba", () => {
    for (const job of [ABRIR, LANZAR]) {
      expect(job.steps.some((p) => p.uses?.startsWith("actions/checkout@"))).toBe(false);
      for (const p of job.steps) expect(p.run ?? "").not.toMatch(/\$\{\{/);
    }
    expect(ABRIR.steps[0]?.run).toContain('"$RAMA" =~ ^plan/[a-z0-9]+(-[a-z0-9]+)*$');
    expect(ABRIR.steps[0]?.run).toContain('"$SUBIDA_POR" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}$');
  });

  it("la PR la abre la identidad del harness, con un token que solo escribe contenido y PR de este repositorio", () => {
    const token = ABRIR.steps.find((p) => p.uses?.startsWith("actions/create-github-app-token@"));
    expect(token?.uses).toMatch(/@[0-9a-f]{40}$/);
    expect(token?.with).toMatchObject({ repositories: "${{ github.event.repository.name }}",
      "permission-contents": "write", "permission-pull-requests": "write" });
    expect(Object.keys(token?.with ?? {}).filter((k) => k.startsWith("permission-")).sort())
      .toEqual(["permission-contents", "permission-pull-requests"]);
    const abrir = ABRIR.steps.at(-1);
    expect(abrir?.env).toEqual({ GH_TOKEN: "${{ steps.token.outputs.token }}" });
    // La descripción dice quién lo lanzó: la comprobación trailers lo pide en toda PR de la identidad del harness.
    expect(abrir?.run).toContain('echo "Lanzado por @$SUBIDA_POR."');
    expect(abrir?.run).toContain("--auto --merge --delete-branch");
  });

  it("el bucle admite la entrada con quien subió el plan", () => {
    expect(BUCLE.on.workflow_dispatch.inputs["lanzado-por"]).toMatchObject({ required: false, type: "string" });
  });
});

// El paso de lanzar, con un gh de mentira que responde lo que dicen las variables GH_* y apunta lo que se lanza.
const GH = `#!/usr/bin/env bash
case "$1 $2" in
  "api --paginate") printf '%s\\n' "$GH_COMMITS" ;;
  "api repos/"*) [ "$GH_TAREAS" = "si" ] && echo 3 || exit 1 ;;
  "run list") echo "\${GH_EN_MARCHA:-0}" ;;
  "workflow run") echo "$*" >> "$GH_LANZADOS" ;;
  *) echo "gh inesperado: $*" >&2; exit 2 ;;
esac
`;

describe.skipIf(process.platform === "win32")("lanzar el bucle al integrarse la PR del plan", () => {
  let carpeta = "";
  const COMMIT = "chore: plan de la iniciativa «prestamos»\n\nDiverger-Rol: Planificación\nDiverger-Modelo: varios\n"
    + "Diverger-Tarea: plan\nDiverger-Iniciado-por: joselcs\nDiverger-Lanzar: prestamos";

  beforeEach(() => {
    carpeta = mkdtempSync(join(tmpdir(), "diverger-plan-"));
    writeFileSync(join(carpeta, "gh"), GH);
    chmodSync(join(carpeta, "gh"), 0o755);
  });
  afterEach(() => {
    rmSync(carpeta, { recursive: true, force: true });
  });

  function lanzar(entorno: Record<string, string>): { codigo: number | null; resumen: string; lanzados: string; errores: string } {
    const r = spawnSync("bash", ["-c", LANZAR.steps.at(-1)?.run ?? "exit 9"], { encoding: "utf8", env: {
      PATH: `${carpeta}:${process.env.PATH ?? ""}`, RUNNER_TEMP: carpeta, GITHUB_STEP_SUMMARY: join(carpeta, "resumen"),
      GITHUB_REPOSITORY: "DivergerThinking/app-de-prueba", GH_LANZADOS: join(carpeta, "lanzados"),
      RAMA: "plan/prestamos", BASE: "main", NUMERO: "12", GH_COMMITS: COMMIT, GH_TAREAS: "si", ...entorno } });
    const leer = (nombre: string): string => existsSync(join(carpeta, nombre)) ? readFileSync(join(carpeta, nombre), "utf8") : "";
    return { codigo: r.status, resumen: leer("resumen"), lanzados: leer("lanzados"), errores: r.stdout + r.stderr };
  }

  it("lanza el bucle de la iniciativa del trailer en la rama base, con quien subió el plan", () => {
    const r = lanzar({});
    expect(r.errores).not.toContain("::error::");
    expect(r.codigo).toBe(0);
    expect(r.lanzados.trim()).toBe("workflow run diverger-bucle.yml -R DivergerThinking/app-de-prueba --ref main "
      + "-f initiative=prestamos -f lanzado-por=joselcs");
    expect(r.resumen).toContain("Bucle de prestamos lanzado en main al integrarse la PR #12 del plan.");
  });

  it("vale la rama con el sufijo que da el núcleo cuando la del plan ya existía", () => {
    expect(lanzar({ RAMA: "plan/prestamos-2" }).lanzados).toContain("initiative=prestamos ");
  });

  it("no lanza nada si el plan no lo pidió: una rama plan/ subida a mano", () => {
    const r = lanzar({ GH_COMMITS: "chore: plan corregido a mano" });
    expect(r.codigo).toBe(0);
    expect(r.lanzados).toBe("");
    expect(r.resumen).toContain("no pidió lanzar la construcción");
  });

  it("no lanza nada si el bucle de la iniciativa ya está en marcha, o si la iniciativa no tiene tareas en la rama base", () => {
    const enMarcha = lanzar({ GH_EN_MARCHA: "1" });
    expect([enMarcha.codigo, enMarcha.lanzados]).toEqual([0, ""]);
    expect(enMarcha.resumen).toContain("ya está en marcha");
    const sinTareas = lanzar({ GH_TAREAS: "no" });
    expect([sinTareas.codigo, sinTareas.lanzados]).toEqual([0, ""]);
    expect(sinTareas.resumen).toContain("no tiene tareas en main");
  });

  it("falla sin lanzar si el trailer pide otra iniciativa que la de la rama, o más de una", () => {
    const otra = lanzar({ RAMA: "plan/devoluciones" });
    expect([otra.codigo, otra.lanzados]).toEqual([1, ""]);
    expect(otra.errores).toContain("no es la del plan de la iniciativa prestamos");
    const dos = lanzar({ GH_COMMITS: `${COMMIT}\nDiverger-Lanzar: devoluciones` });
    expect([dos.codigo, dos.lanzados]).toEqual([1, ""]);
    expect(dos.errores).toContain("más de una iniciativa");
  });
});
