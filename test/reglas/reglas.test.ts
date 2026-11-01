// Las reglas del CI siguen funcionando: el lint rechaza código que las incumple y el linter de
// dependencias impide entrar en lo interno de otro contexto (ADR 0003 del harness).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ESLint } from "eslint";
import { cruise, type IConfiguration, type ICruiseResult } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..", "..");
const config = createRequire(import.meta.url)(join(RAIZ, ".dependency-cruiser.cjs")) as IConfiguration;

describe("lint", () => {
  it("rechaza un fichero que incumple las reglas", async () => {
    const eslint = new ESLint({ cwd: RAIZ });
    const [resultado] = await eslint.lintText("export const valor: any = 1;\n", { filePath: join(RAIZ, "app", "server.ts") });
    expect(resultado?.errorCount).toBeGreaterThan(0);
    expect(resultado?.messages.map((m) => m.ruleId)).toContain("@typescript-eslint/no-explicit-any");
  });
});

async function violaciones(ficheros: Record<string, string>): Promise<string[]> {
  const base = mkdtempSync(join(tmpdir(), "contextos-"));
  try {
    for (const [ruta, texto] of Object.entries(ficheros)) {
      mkdirSync(join(base, dirname(ruta)), { recursive: true });
      writeFileSync(join(base, ruta), texto);
    }
    const carpetas = ["app", "src"].filter((carpeta) => Object.keys(ficheros).some((ruta) => ruta.startsWith(`${carpeta}/`)));
    const resultado = await cruise(carpetas, {
      baseDir: base,
      validate: true,
      ruleSet: { forbidden: config.forbidden ?? [] },
      tsPreCompilationDeps: true,
      enhancedResolveOptions: { extensions: [".ts"] },
    });
    const salida = resultado.output as ICruiseResult;
    return salida.summary.violations.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

describe("dependencias entre contextos", () => {
  it("permite importar el index.ts de otro contexto", async () => {
    expect(
      await violaciones({
        "src/equipos/index.ts": "export const disponible = true;\n",
        "src/prestamos/index.ts": 'import { disponible } from "../equipos/index";\nexport const ok = disponible;\n',
      }),
    ).toEqual([]);
  });

  it("falla si src/prestamos importa un fichero de src/equipos que no es su index.ts", async () => {
    expect(
      await violaciones({
        "src/equipos/index.ts": "export {};\n",
        "src/equipos/interno.ts": "export const secreto = 1;\n",
        "src/prestamos/index.ts": 'import { secreto } from "../equipos/interno";\nexport const mal = secreto;\n',
      }),
    ).toEqual(["solo-index-de-otro-contexto: src/prestamos/index.ts -> src/equipos/interno.ts"]);
  });

  it("falla si el servidor entra en lo interno de un contexto", async () => {
    expect(
      await violaciones({
        "src/equipos/interno.ts": "export const secreto = 1;\n",
        "app/server.ts": 'import { secreto } from "../src/equipos/interno";\nexport const mal = secreto;\n',
      }),
    ).toEqual(["app-y-web-solo-por-index: app/server.ts -> src/equipos/interno.ts"]);
  });
});
