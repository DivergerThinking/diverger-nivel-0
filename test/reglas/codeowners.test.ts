// CODEOWNERS sobre la configuración (EN-OPS-04), la suite de aceptación (EN-CAL-01) y las instrucciones de los
// agentes (EN-OPS-11): el CI falla si .diverger/settings.json, el propio CODEOWNERS, tests/aceptacion/, CLAUDE.md
// o .claude/settings.json se quedan sin propietario. Se prueba el script del CI sobre carpetas de juguete.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "codeowners.mjs");
const INSTRUCCIONES = "CLAUDE.md @joselcs\n/.claude/ @joselcs\n";
const SUITE = `/tests/aceptacion/ @joselcs @686f6c61\n${INSTRUCCIONES}`;
const BUENO = `${SUITE}/.diverger/settings.json @joselcs\n/.github/CODEOWNERS @joselcs\n`;

let carpeta = "";

function escribir(ruta: string, texto: string): void {
  mkdirSync(join(carpeta, dirname(ruta)), { recursive: true });
  writeFileSync(join(carpeta, ruta), texto);
}

function comprobar(raiz = carpeta): { codigo: number | null; errores: string[] } {
  const r = spawnSync(process.execPath, [SCRIPT, raiz], { encoding: "utf8" });
  return { codigo: r.status, errores: r.stderr.split("\n").filter(Boolean) };
}

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), "codeowners-"));
});

afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

describe("CODEOWNERS de la configuración", () => {
  it("la plantilla protege la configuración y su propio CODEOWNERS", () => {
    expect(comprobar(RAIZ)).toEqual({ codigo: 0, errores: [] });
  });

  it.each(["*", "/.diverger/", ".diverger/", "/.diverger", "/.diverger/*.json", "settings.json", "**/settings.json", "/**"])(
    "el patrón %s cubre la configuración",
    (patron) => {
      escribir(".github/CODEOWNERS", `${SUITE}${patron} @joselcs\n/.github/CODEOWNERS @joselcs\n`);
      expect(comprobar()).toEqual({ codigo: 0, errores: [] });
    },
  );

  it.each(["/settings.json", "/.diverger/*.md", "/diverger/", "*.md", "/.diverger/settings"])(
    "el patrón %s no la cubre",
    (patron) => {
      escribir(".github/CODEOWNERS", `${SUITE}${patron} @joselcs\n/.github/CODEOWNERS @joselcs\n`);
      expect(comprobar().errores).toEqual([
        ".github/CODEOWNERS: ninguna regla cubre .diverger/settings.json; añade «/.diverger/settings.json @titular»",
      ]);
    },
  );

  it("falla sin CODEOWNERS", () => {
    const { codigo, errores } = comprobar();
    expect(codigo).toBe(1);
    expect(errores[0]).toContain("No hay CODEOWNERS");
  });

  it("falla si una regla posterior sin propietarios deja la configuración sin protección", () => {
    escribir(".github/CODEOWNERS", `${BUENO}/.diverger/settings.json\n`);
    const { codigo, errores } = comprobar();
    expect(codigo).toBe(1);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain("no tiene propietarios");
  });

  it("falla si el propio CODEOWNERS no tiene propietario", () => {
    escribir(".github/CODEOWNERS", `${SUITE}/.diverger/settings.json @joselcs\n`);
    expect(comprobar().errores).toEqual([
      ".github/CODEOWNERS: ninguna regla cubre .github/CODEOWNERS; añade «/.github/CODEOWNERS @titular»",
    ]);
  });

  it("falla con propietarios o patrones que GitHub no entiende", () => {
    escribir(".github/CODEOWNERS", `${BUENO}!/docs/ @joselcs\n/web/ joselcs\n`);
    const { errores } = comprobar();
    expect(errores).toHaveLength(2);
    expect(errores[0]).toContain("no admite el patrón «!/docs/»");
    expect(errores[1]).toContain("«joselcs» no es un propietario válido");
  });

  it("admite equipos y correos, y gana la última regla", () => {
    escribir(".github/CODEOWNERS", "* @otra\n/.diverger/ @DivergerThinking/titulares persona@diverger.ai\n/.github/ @joselcs\n");
    expect(comprobar()).toEqual({ codigo: 0, errores: [] });
  });

  it("usa el primer CODEOWNERS que encuentra GitHub", () => {
    escribir("CODEOWNERS", `${SUITE}/.diverger/settings.json @joselcs\n/CODEOWNERS @joselcs\n`);
    expect(comprobar()).toEqual({ codigo: 0, errores: [] });
    escribir(".github/CODEOWNERS", "/src/ @joselcs\n");
    expect(comprobar().errores).toHaveLength(5);
  });
});

describe("CODEOWNERS de la suite de aceptación (EN-CAL-01)", () => {
  it.each(["/tests/aceptacion/", "/tests/", "tests/aceptacion/", "aceptacion/", "/tests/aceptacion", "*.feature", "*"])(
    "el patrón %s cubre la suite",
    (patron) => {
      escribir(".github/CODEOWNERS", `${patron} @joselcs\n/.diverger/settings.json @joselcs\n/.github/CODEOWNERS @joselcs\n${INSTRUCCIONES}`);
      expect(comprobar()).toEqual({ codigo: 0, errores: [] });
    },
  );

  it("falla si ninguna regla cubre la suite", () => {
    escribir(".github/CODEOWNERS", `/.diverger/settings.json @joselcs\n/.github/CODEOWNERS @joselcs\n/tests/unitarios/ @joselcs\n${INSTRUCCIONES}`);
    expect(comprobar().errores).toEqual([
      ".github/CODEOWNERS: ninguna regla cubre tests/aceptacion/; añade «/tests/aceptacion/ @titular»",
    ]);
  });

  it("falla si una regla posterior sin propietarios la deja sin protección", () => {
    escribir(".github/CODEOWNERS", `${BUENO}/tests/aceptacion/*.feature\n`);
    expect(comprobar().errores).toEqual([
      ".github/CODEOWNERS: la última regla que cubre tests/aceptacion/ no tiene propietarios y la deja sin protección",
    ]);
  });
});

describe("CODEOWNERS de las instrucciones de los agentes (EN-OPS-11)", () => {
  const BASE = "/tests/aceptacion/ @joselcs @686f6c61\n/.diverger/settings.json @joselcs\n/.github/CODEOWNERS @joselcs\n";

  it.each([
    ["CLAUDE.md", "/.claude/settings.json"],
    ["/CLAUDE.md", "/.claude/"],
    ["*.md", ".claude/"],
  ])("los patrones %s y %s cubren CLAUDE.md y .claude/settings.json", (claude, ajustes) => {
    escribir(".github/CODEOWNERS", `${BASE}${claude} @acme/responsables\n${ajustes} @acme/responsables\n`);
    expect(comprobar()).toEqual({ codigo: 0, errores: [] });
  });

  it("falla si nada cubre CLAUDE.md ni .claude/settings.json", () => {
    escribir(".github/CODEOWNERS", `${BASE}/src/ @acme/responsables\n`);
    expect(comprobar().errores).toEqual([
      ".github/CODEOWNERS: ninguna regla cubre CLAUDE.md; añade «/CLAUDE.md @titular»",
      ".github/CODEOWNERS: ninguna regla cubre .claude/settings.json; añade «/.claude/settings.json @titular»",
    ]);
  });

  it("falla si una regla posterior sin propietarios deja .claude/settings.json sin protección", () => {
    escribir(".github/CODEOWNERS", `${BASE}${INSTRUCCIONES}/.claude/settings.json\n`);
    expect(comprobar().errores).toEqual([
      ".github/CODEOWNERS: la última regla que cubre .claude/settings.json no tiene propietarios y la deja sin protección",
    ]);
  });

  it("en la plantilla, cualquier CLAUDE.md y todo .claude/ tienen dueño, y el código no", async () => {
    const { propietarios, reglas } = (await import(pathToFileURL(SCRIPT).href)) as {
      reglas: (texto: string) => { patron: string; propietarios: string[] }[];
      propietarios: (lista: { patron: string; propietarios: string[] }[], ruta: string) => string[] | null;
    };
    const lista = reglas(readFileSync(join(RAIZ, ".github", "CODEOWNERS"), "utf8"));
    // Claude Code también carga el CLAUDE.md de la carpeta en la que trabaja, y el worker escribe en src/ y web/.
    for (const ruta of ["CLAUDE.md", "src/prestamos/CLAUDE.md", "web/CLAUDE.md", ".claude/settings.json", ".claude/agents/x.md"]) {
      expect(propietarios(lista, ruta), ruta).toEqual(["@joselcs"]);
    }
    // Criterio negativo: un cambio solo de código no pide la revisión por las instrucciones.
    expect(propietarios(lista, "src/reservas.ts")).toBeNull();
  });
});
