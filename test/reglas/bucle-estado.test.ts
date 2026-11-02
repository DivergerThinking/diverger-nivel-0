// Estado del bucle entre lanzamientos (ADR 0024 y harness#498): el paso «Recuperar el estado anterior» de
// diverger-bucle.yml y su script, con un gh de mentira que responde como la API de GitHub. Un error de GitHub para el
// job; solo «no hay ningún artefacto» es empezar de cero. Se saltan donde no hay bash o jq (en el CI sí están).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, ".github", "diverger", "bucle-estado.sh");
const WF = parse(readFileSync(join(RAIZ, ".github", "workflows", "diverger-bucle.yml"), "utf8")) as {
  jobs: { bucle: { steps: { name?: string; id?: string; uses?: string; if?: string; run?: string; with?: Record<string, unknown> }[] } };
};
const PASOS = WF.jobs.bucle.steps;

describe("forma del paso que recupera el estado", () => {
  it("ejecuta el script de la rama base y la subida solo corre si el estado se recuperó, sobrescribiendo", () => {
    const estado = PASOS.find((p) => p.id === "estado");
    expect(estado?.name).toBe("Recuperar el estado anterior");
    expect(estado?.run).toBe("bash .github/diverger/bucle-estado.sh");
    const subida = PASOS.find((p) => p.uses?.startsWith("actions/upload-artifact@"));
    expect(subida?.if).toBe("always() && steps.estado.outcome == 'success'");
    expect(subida?.with).toMatchObject({ name: "diverger-bucle-${{ inputs.initiative }}", overwrite: true });
    expect(PASOS.indexOf(estado ?? {})).toBeLessThan(PASOS.findIndex((p) => p.name === "Bucle"));
  });
});

const HAY_JQ = spawnSync("bash", ["-c", "command -v jq"]).status === 0;

// gh de mentira: «api» responde con el fichero de cada URL, pasado por el filtro --jq, y «run download» copia el
// run.json de la ejecución. FALLA=<ejecuciones|artefactos|descarga> hace fallar esa llamada, como un 5xx.
const GH_FALSO = `#!/usr/bin/env bash
if [ "$1" = api ]; then
  shift; url=""; filtro="."
  while [ $# -gt 0 ]; do case "$1" in --paginate) ;; --jq) filtro="$2"; shift ;; *) url="$1" ;; esac; shift; done
  case "$url" in
    *"/actions/workflows/diverger-bucle.yml/runs?branch=main&"*) [ "\${FALLA:-}" != ejecuciones ] || { echo "HTTP 502" >&2; exit 1; }; fichero=ejecuciones.json ;;
    *"/actions/artifacts?name=diverger-bucle-demo&"*) [ "\${FALLA:-}" != artefactos ] || { echo "HTTP 502" >&2; exit 1; }; fichero=artefactos.json ;;
    *) echo "URL inesperada: $url" >&2; exit 1 ;;
  esac
  jq -r "$filtro" "$DATOS/$fichero"
elif [ "$1 $2" = "run download" ]; then
  [ "\${FALLA:-}" != descarga ] || { echo "HTTP 502" >&2; exit 1; }
  ejecucion="$3"; shift 3; destino=""
  while [ $# -gt 0 ]; do [ "$1" = -D ] && destino="$2"; shift; done
  cp "$DATOS/run-$ejecucion.json" "$destino/run.json"
else
  echo "gh $* inesperado" >&2; exit 1
fi
`;

describe.skipIf(!HAY_JQ)("script que recupera el estado", () => {
  let dir = "";
  let proyecto = "";
  let datos = "";
  let bin = "";

  function artefacto(ejecucion: number, creado: string, expired = false) {
    return { id: ejecucion * 10, name: "diverger-bucle-demo", expired, created_at: creado, workflow_run: { id: ejecucion, head_branch: "main" } };
  }

  function preparar(ejecuciones: number[], artefactos: object[], estados: Record<number, unknown>): void {
    writeFileSync(join(datos, "ejecuciones.json"), JSON.stringify({ workflow_runs: ejecuciones.map((id) => ({ id })) }));
    writeFileSync(join(datos, "artefactos.json"), JSON.stringify({ artifacts: artefactos }));
    for (const [ejecucion, estado] of Object.entries(estados)) {
      writeFileSync(join(datos, `run-${ejecucion}.json`), typeof estado === "string" ? estado : JSON.stringify(estado));
    }
  }

  function recuperar(extra: Record<string, string> = {}) {
    const r = spawnSync("bash", [SCRIPT], {
      cwd: proyecto,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, DATOS: datos, INICIATIVA: "demo",
        GITHUB_REPOSITORY: "DivergerThinking/app", GITHUB_REF_NAME: "main", GH_TOKEN: "token-de-prueba", ...extra },
    });
    const ruta = join(proyecto, ".diverger", "demo", "run.json");
    return { codigo: r.status, salida: r.stdout + r.stderr, estado: existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) as unknown : undefined };
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bucle-estado-"));
    proyecto = join(dir, "proyecto");
    datos = join(dir, "datos");
    bin = join(dir, "bin");
    for (const carpeta of [proyecto, datos, bin]) mkdirSync(carpeta);
    writeFileSync(join(bin, "gh"), GH_FALSO, { mode: 0o755 });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("recupera el run.json más reciente de una ejecución del bucle en la rama base", () => {
    preparar([300, 200, 100], [artefacto(100, "2026-11-01T10:00:00Z"), artefacto(200, "2026-11-02T10:00:00Z")],
      { 100: { budget: { usedUsd: 5 } }, 200: { budget: { usedUsd: 12 } } });
    const r = recuperar();
    expect(r.codigo).toBe(0);
    expect(r.estado).toEqual({ budget: { usedUsd: 12 } });
    expect(r.salida).toContain("recuperado de la ejecución 200");
  });

  it("ignora un artefacto con el mismo nombre que no es de una ejecución del bucle en la rama base", () => {
    // 999 sería, por ejemplo, un workflow de una PR que sube un diverger-bucle-demo con el gasto a cero.
    preparar([200], [artefacto(200, "2026-11-01T10:00:00Z"), artefacto(999, "2026-11-02T10:00:00Z")],
      { 200: { budget: { usedUsd: 12 } }, 999: { budget: { usedUsd: 0 } } });
    expect(recuperar().estado).toEqual({ budget: { usedUsd: 12 } });
  });

  it("encuentra el estado aunque haya muchas ejecuciones de otras iniciativas, y el de la ejecución en curso tras un «Re-run»", () => {
    // La 500 es la que se relanza: su primer intento dejó el estado y todavía no está «completed».
    const otras = Array.from({ length: 40 }, (_, i) => 1000 + i);
    preparar([500, ...otras, 100], [artefacto(100, "2026-11-01T10:00:00Z"), artefacto(500, "2026-11-02T18:00:00Z")],
      { 100: { budget: { usedUsd: 5 } }, 500: { budget: { usedUsd: 30 } } });
    expect(recuperar().estado).toEqual({ budget: { usedUsd: 30 } });
  });

  it("no usa artefactos caducados", () => {
    preparar([200, 100], [artefacto(100, "2026-11-01T10:00:00Z"), artefacto(200, "2026-11-02T10:00:00Z", true)],
      { 100: { budget: { usedUsd: 5 } } });
    expect(recuperar().estado).toEqual({ budget: { usedUsd: 5 } });
  });

  it("sin ningún artefacto empieza de cero, sin fallar", () => {
    preparar([100], [], {});
    const r = recuperar();
    expect(r.codigo).toBe(0);
    expect(r.estado).toBeUndefined();
    expect(r.salida).toContain("empieza de cero");
  });

  it.each(["ejecuciones", "artefactos", "descarga"])("si falla la llamada de %s, el job falla y no deja run.json", (falla) => {
    preparar([200], [artefacto(200, "2026-11-02T10:00:00Z")], { 200: { budget: { usedUsd: 12 } } });
    const r = recuperar({ FALLA: falla });
    expect(r.codigo).toBe(1);
    expect(r.estado).toBeUndefined();
    expect(r.salida).toContain("::error::No se puede recuperar el estado del bucle");
  });

  it("falla si el run.json descargado no es un objeto JSON", () => {
    preparar([200], [artefacto(200, "2026-11-02T10:00:00Z")], { 200: "[1, 2]" });
    const r = recuperar();
    expect(r.codigo).toBe(1);
    expect(r.estado).toBeUndefined();
  });
});
