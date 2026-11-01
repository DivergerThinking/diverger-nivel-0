// CODEOWNERS sobre la configuración (EN-OPS-04): el CI falla si .diverger/settings.json o el propio
// CODEOWNERS se quedan sin propietario. Se prueba el script del CI sobre carpetas de juguete.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "codeowners.mjs");
const BUENO = "/.diverger/settings.json @joselcs\n/.github/CODEOWNERS @joselcs\n";

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
      escribir(".github/CODEOWNERS", `${patron} @joselcs\n/.github/CODEOWNERS @joselcs\n`);
      expect(comprobar()).toEqual({ codigo: 0, errores: [] });
    },
  );

  it.each(["/settings.json", "/.diverger/*.md", "/diverger/", "*.md", "/.diverger/settings"])(
    "el patrón %s no la cubre",
    (patron) => {
      escribir(".github/CODEOWNERS", `${patron} @joselcs\n/.github/CODEOWNERS @joselcs\n`);
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
    escribir(".github/CODEOWNERS", "/.diverger/settings.json @joselcs\n");
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
    escribir("CODEOWNERS", "/.diverger/settings.json @joselcs\n/CODEOWNERS @joselcs\n");
    expect(comprobar()).toEqual({ codigo: 0, errores: [] });
    escribir(".github/CODEOWNERS", "/src/ @joselcs\n");
    expect(comprobar().errores).toHaveLength(2);
  });
});
