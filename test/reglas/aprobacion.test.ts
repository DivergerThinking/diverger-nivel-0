// Política «otra persona» (EN-OPS-10 y TA-172 del harness): la PR del harness la aprueba una persona distinta de quien
// lo lanzó. El script corre contra el GitHub de mentira; las reglas de la rama dicen si se exige el check otra-persona.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { arrancar, REPO, type Datos } from "./github-falso.js";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "aprobacion.mjs");
const MENSAJE = "La aprobación tiene que ser de una persona distinta de quien lanzó el harness";
const CABEZA = "c0ffee";
const APP = { login: "diverger-harness[bot]", type: "Bot" };

type Usuario = { login: string; type?: string };
type Revision = { user: Usuario; state: string; commit_id?: string; author_association?: string };
type Commit = { commit: { message: string }; author?: Usuario | null; committer?: Usuario | null };

const REGLAS_OTRA_PERSONA = [{ type: "pull_request", parameters: { require_last_push_approval: true } },
  { type: "required_status_checks", parameters: { required_status_checks: [{ context: "calidad", integration_id: 15368 },
    { context: "otra-persona", integration_id: 15368 }] } }];
const REGLAS_SIN_ELLA = [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "calidad" }] } }];

/** Un commit del harness: lo hace la App y dice quién lo lanzó. */
function commitDelHarness(...quienes: string[]): Commit {
  const trailers = quienes.map((q) => `Diverger-Iniciado-por: ${q}`).join("\n");
  return { commit: { message: `feat: TA-004 Prestar un equipo\n\nDiverger-Rol: Desarrollador\n${trailers}` },
    author: APP, committer: { login: "web-flow", type: "Bot" } };
}

let servidor: Server | undefined;

afterEach(() => {
  servidor?.close();
  servidor = undefined;
});

async function comprobar(reglas: unknown[], revisiones: Revision[], commits: Commit[] = [commitDelHarness("ana-lopez")],
  extra: { commits?: number; user?: Usuario } = {}): Promise<{ codigo: number; salida: string }> {
  const datos: Datos = {
    ejecuciones: [], usuarios: {}, reglas,
    permisos: { "luis-gil": "write", "marta-ruiz": "admin", "ana-lopez": "write", "pepe-lector": "read" },
    prs: { 55: { body: "", user: APP, head: { sha: CABEZA }, commits: commits.length, listaDeCommits: commits,
      reviews: revisiones, ...extra } },
  };
  const api = await arrancar(datos);
  servidor = api.servidor;
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [SCRIPT], {
      env: { ...process.env, GITHUB_API_URL: api.url, GITHUB_REPOSITORY: REPO, GH_TOKEN: "token-de-prueba",
        PR_NUMERO: "55", PR_BASE: "main" },
    });
    return { codigo: 0, salida: stdout };
  } catch (error) {
    const fallo = error as { code: number; stderr: string };
    return { codigo: fallo.code, salida: fallo.stderr };
  }
}

const aprueba = (login: string, state = "APPROVED", otros: Partial<Revision> = {}): Revision =>
  ({ user: { login }, state, commit_id: CABEZA, author_association: "COLLABORATOR", ...otros });
const otraPersona = (revisiones: Revision[], commits?: Commit[], extra?: { commits?: number; user?: Usuario }) =>
  comprobar(REGLAS_OTRA_PERSONA, revisiones, commits, extra);

describe("política «otra persona» (EN-OPS-10 del harness)", () => {
  it("criterio positivo: lanzada por ana-lopez y aprobada por luis-gil, pasa", async () => {
    const r = await otraPersona([aprueba("luis-gil")]);
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain("Aprobada por @luis-gil, distinta de quien lanzó el harness (@ana-lopez)");
  });

  it("criterio negativo: aprobada solo por la propia ana-lopez, falla con el mensaje del criterio", async () => {
    const r = await otraPersona([aprueba("ana-lopez")]);
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain(`::error::${MENSAJE}`);
  });

  it("sin ninguna aprobación también falla", async () => {
    expect((await otraPersona([])).codigo).toBe(1);
  });

  it("con dos personas que lanzaron el harness, aprueba una tercera", async () => {
    const commits = [commitDelHarness("ana-lopez"), commitDelHarness("luis-gil")];
    expect((await otraPersona([aprueba("luis-gil")], commits)).codigo).toBe(1);
    expect((await otraPersona([aprueba("marta-ruiz")], commits)).codigo).toBe(0);
  });

  it("un commit de una persona con un Diverger-Iniciado-por falso no cambia quién lanzó el harness (revisión)", async () => {
    // Ana reescribe la rama con un commit suyo que dice que la lanzó luis-gil, y la aprueba: no cuenta.
    const falso: Commit = { commit: { message: "feat: TA-004\n\nDiverger-Rol: Desarrollador\nDiverger-Iniciado-por: luis-gil" },
      author: { login: "ana-lopez" }, committer: { login: "ana-lopez" } };
    expect((await otraPersona([aprueba("ana-lopez")], [commitDelHarness("ana-lopez"), falso])).codigo).toBe(1);
    // Y si solo queda el commit falso, en una PR que abre la App, no se sabe quién la lanzó: falla.
    expect((await otraPersona([aprueba("ana-lopez")], [falso])).codigo).toBe(1);
  });

  it("en una PR de la App, un commit sin autor reconocido hace que falle (revisión de seguridad)", async () => {
    const anonimo: Commit = { commit: { message: "fix: algo" }, author: null, committer: null };
    const r = await otraPersona([aprueba("luis-gil")], [commitDelHarness("ana-lopez"), anonimo]);
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("Un commit de la PR no tiene autor reconocido en GitHub");
  });

  it("quien hizo un commit de la PR tampoco la puede aprobar", async () => {
    const deLuis: Commit = { commit: { message: "fix: un arreglo" }, author: { login: "luis-gil" }, committer: null };
    expect((await otraPersona([aprueba("luis-gil")], [commitDelHarness("ana-lopez"), deLuis])).codigo).toBe(1);
    expect((await otraPersona([aprueba("marta-ruiz")], [commitDelHarness("ana-lopez"), deLuis])).codigo).toBe(0);
  });

  it("vale la última revisión de cada persona, y los comentarios no la cambian", async () => {
    expect((await otraPersona([aprueba("luis-gil"), aprueba("luis-gil", "CHANGES_REQUESTED")])).codigo).toBe(1);
    expect((await otraPersona([aprueba("marta-ruiz"), aprueba("marta-ruiz", "COMMENTED")])).codigo).toBe(0);
    expect((await otraPersona([aprueba("luis-gil"), aprueba("luis-gil", "DISMISSED")])).codigo).toBe(1);
  });

  it("la aprobación de una GitHub App no cuenta, y quien lanzó se compara sin mayúsculas", async () => {
    expect((await otraPersona([aprueba("diverger-harness[bot]")])).codigo).toBe(1);
    expect((await otraPersona([{ ...aprueba("renovate"), user: { login: "renovate", type: "Bot" } }])).codigo).toBe(1);
    expect((await otraPersona([aprueba("Ana-Lopez")])).codigo).toBe(1);
  });

  it("solo cuenta una aprobación del último commit y de alguien con escritura en el repositorio", async () => {
    expect((await otraPersona([aprueba("luis-gil", "APPROVED", { commit_id: "viejo" })])).codigo).toBe(1);
    for (const asociacion of ["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", undefined]) {
      expect((await otraPersona([aprueba("luis-gil", "APPROVED", { author_association: asociacion })])).codigo,
        String(asociacion)).toBe(1);
    }
    for (const asociacion of ["OWNER", "MEMBER", "COLLABORATOR"]) {
      expect((await otraPersona([aprueba("luis-gil", "APPROVED", { author_association: asociacion })])).codigo,
        asociacion).toBe(0);
    }
    // Un miembro de la organización con solo lectura, o alguien de quien no se sabe el permiso, no cuenta.
    expect((await otraPersona([aprueba("pepe-lector", "APPROVED", { author_association: "MEMBER" })])).codigo).toBe(1);
    expect((await otraPersona([aprueba("desconocido", "APPROVED", { author_association: "MEMBER" })])).codigo).toBe(1);
  });

  it("con los datos incompletos, falla: más commits de los leídos, o una PR de la App sin quien la lanzó", async () => {
    const truncada = await otraPersona([aprueba("luis-gil")], [commitDelHarness("ana-lopez")], { commits: 300 });
    expect(truncada.codigo).toBe(1);
    expect(truncada.salida).toContain("No se pueden leer todos los commits de la PR (300)");
    const sinQuien = await otraPersona([aprueba("luis-gil")], [{ commit: { message: "feat: algo" }, author: APP }]);
    expect(sinQuien.codigo).toBe(1);
    expect(sinQuien.salida).toContain("La PR la abre diverger-harness[bot] y ningún commit suyo dice quién lanzó el harness");
  });

  it("si las reglas de la rama no exigen otra-persona, o la PR no es del harness, no hay nada que comprobar", async () => {
    for (const reglas of [REGLAS_SIN_ELLA, []]) {
      const r = await comprobar(reglas, [aprueba("ana-lopez")]);
      expect(r.codigo).toBe(0);
      expect(r.salida).toContain("Las reglas de la rama base no exigen otra-persona");
    }
    const sinHarness = await otraPersona([], [{ commit: { message: "fix: un arreglo de una persona" },
      author: { login: "luis-gil" } }], { user: { login: "luis-gil" } });
    expect(sinHarness.codigo).toBe(0);
    expect(sinHarness.salida).toContain("La PR no tiene commits del harness");
  });

  it("si el ruleset no fija el check a GitHub Actions o no pide aprobar el último push, falla (revisión de seguridad)", async () => {
    const sinFijar = [{ type: "pull_request", parameters: { require_last_push_approval: true } },
      { type: "required_status_checks", parameters: { required_status_checks: [{ context: "otra-persona" }] } }];
    const sinUltimoPush = [{ type: "pull_request", parameters: {} }, REGLAS_OTRA_PERSONA[1]];
    for (const reglas of [sinFijar, sinUltimoPush]) {
      const r = await comprobar(reglas, [aprueba("luis-gil")]);
      expect(r.codigo).toBe(1);
      expect(r.salida).toContain("vuelve a aplicar la política con aplicar-politica.sh del harness");
    }
  });

  it("solo cuentan los commits de la misma App que abre la PR, no los de otra App", async () => {
    // Los commits de la App de la PR no dicen quién la lanzó, y otra App añade uno que dice luis-gil. Antes valía ese, y
    // ana-lopez podía aprobar; ahora no cuenta, no se sabe quién la lanzó, y falla (revisión de la PR #64).
    const sinTrailer: Commit = { commit: { message: "feat: x" }, author: APP, committer: { login: "web-flow", type: "Bot" } };
    const deOtraApp: Commit = { ...commitDelHarness("luis-gil"), author: { login: "otra-app[bot]", type: "Bot" } };
    expect((await otraPersona([aprueba("ana-lopez")], [sinTrailer, deOtraApp])).codigo).toBe(1);
  });

  it("si la API falla, falla", async () => {
    const api = await arrancar({ ejecuciones: [], usuarios: {}, reglas: REGLAS_OTRA_PERSONA, prs: {} });
    servidor = api.servidor;
    await expect(promisify(execFile)(process.execPath, [SCRIPT], {
      env: { ...process.env, GITHUB_API_URL: api.url, GITHUB_REPOSITORY: REPO, PR_NUMERO: "55", PR_BASE: "main" },
    })).rejects.toMatchObject({ code: 1 });
  });

  it("el workflow corre al abrir la PR y con cada revisión, de uno en uno, con el script de la rama base", () => {
    const workflow = readFileSync(join(RAIZ, ".github", "workflows", "aprobacion.yml"), "utf8");
    expect(workflow).toMatch(/pull_request_review:\s*\n\s*types: \[submitted, edited, dismissed\]/);
    expect(workflow).toMatch(/pull_request:\s*\n\s*types: \[opened, synchronize, reopened\]/);
    expect(workflow).toContain("  otra-persona:");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("PR_BASE: ${{ github.event.pull_request.base.ref }}");
    expect(workflow).toMatch(/concurrency:\s*\n\s*group: aprobacion-\$\{\{ github\.event\.pull_request\.number \}\}\s*\n\s*cancel-in-progress: true/);
    expect(workflow).toContain("run: node scripts/aprobacion.mjs");
    expect(workflow).not.toMatch(/\$\{\{ github\.event\.(review|pull_request)\.(body|title)/);
  });
});
