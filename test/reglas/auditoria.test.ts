// Dependencias con vulnerabilidades conocidas (harness#894, ADR 0072 del harness): el CI falla con cualquier aviso
// alto o crítico de `npm audit` que no tenga una excepción en vigor en .github/diverger/excepciones-sca.json. Se
// prueba el script del CI con salidas de `npm audit --json` de juguete y con el fichero de la plantilla.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

const RAIZ = join(import.meta.dirname, "..", "..");
const SCRIPT = join(RAIZ, "scripts", "auditar-dependencias.mjs");
const EXCEPCIONES = join(RAIZ, ".github", "diverger", "excepciones-sca.json");
const HOY = "2026-11-18";
const PICOMATCH = "GHSA-fc5q-39xc-vjpf";
const MOTIVO = "Solo llega a herramientas de desarrollo y no hay versión corregida.";

interface Aviso { name: string; title: string; url: string; severity: string }

function aviso(name: string, id: string, severity: string, title = `Fallo de ${name}`): Aviso {
  return { name, title, url: `https://github.com/advisories/${id}`, severity };
}

/** Una salida de `npm audit --json`: cada paquete con sus avisos propios o con los paquetes por los que le llegan. */
function auditoria(paquetes: Record<string, { severity: string; via: (Aviso | string)[] }>): string {
  const vulnerabilities = Object.fromEntries(Object.entries(paquetes).map(([name, v]) => [name, { name, ...v }]));
  return JSON.stringify({ auditReportVersion: 2, vulnerabilities, metadata: {} });
}

const CON_PICOMATCH = auditoria({
  picomatch: { severity: "high", via: [aviso("picomatch", PICOMATCH, "high", "picomatch vulnerable to ReDoS")] },
  vitest: { severity: "high", via: ["picomatch"] },
  glob: { severity: "moderate", via: [aviso("glob", "GHSA-3g3m-2fjr-6pw4", "moderate")] },
});

let carpeta = "";

function auditar(entrada: string, excepciones: unknown, hoy = HOY): { codigo: number | null; errores: string[]; salida: string } {
  const ficheroEntrada = join(carpeta, "auditoria.json");
  const ficheroExcepciones = join(carpeta, "excepciones.json");
  writeFileSync(ficheroEntrada, entrada);
  writeFileSync(ficheroExcepciones, typeof excepciones === "string" ? excepciones : JSON.stringify(excepciones));
  const r = spawnSync(process.execPath, [SCRIPT, "--entrada", ficheroEntrada, "--excepciones", ficheroExcepciones],
    { encoding: "utf8", env: { ...process.env, AUDITORIA_HOY: hoy } });
  return { codigo: r.status, errores: r.stderr.split("\n").filter(Boolean), salida: r.stdout };
}

const excepcion = (cambios: Record<string, unknown> = {}): { excepciones: Record<string, unknown>[] } =>
  ({ excepciones: [{ aviso: PICOMATCH, paquete: "picomatch", motivo: MOTIVO, caduca: "2026-12-17", ...cambios }] });

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), "auditoria-"));
});

afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

describe("auditoría de dependencias con excepciones", () => {
  it("sin avisos altos pasa, aunque los haya moderados", () => {
    const moderados = auditoria({ glob: { severity: "moderate", via: [aviso("glob", "GHSA-3g3m-2fjr-6pw4", "moderate")] } });
    expect(auditar(moderados, { excepciones: [] })).toMatchObject({ codigo: 0, errores: [] });
    expect(auditar(auditoria({}), { excepciones: [] })).toMatchObject({ codigo: 0, errores: [] });
  });

  it("un aviso alto sin excepción falla y dice cuál, una sola vez aunque llegue por varios paquetes", () => {
    const r = auditar(CON_PICOMATCH, { excepciones: [] });
    expect(r.codigo).toBe(1);
    expect(r.errores).toEqual([
      `Vulnerabilidad high sin excepción: picomatch (${PICOMATCH}): picomatch vulnerable to ReDoS. ` +
      "Actualiza la dependencia o, si no hay versión corregida, añade una excepción con su motivo y su caducidad en .github/diverger/excepciones-sca.json",
    ]);
  });

  it("un aviso crítico también falla", () => {
    const critico = auditoria({ lodash: { severity: "critical", via: [aviso("lodash", "GHSA-aaaa-bbbb-cccc", "critical")] } });
    const r = auditar(critico, { excepciones: [] });
    expect(r.codigo).toBe(1);
    expect(r.errores[0]).toContain("Vulnerabilidad critical sin excepción: lodash (GHSA-aaaa-bbbb-cccc)");
  });

  it("con una excepción en vigor pasa y dice qué se ha aceptado y hasta cuándo", () => {
    const r = auditar(CON_PICOMATCH, excepcion());
    expect(r).toMatchObject({ codigo: 0, errores: [] });
    expect(r.salida).toContain(`Aceptada hasta el 2026-12-17: picomatch (${PICOMATCH}). ${MOTIVO}`);
  });

  it("la excepción de un aviso no tapa otro aviso alto", () => {
    const dos = auditoria({
      picomatch: { severity: "high", via: [aviso("picomatch", PICOMATCH, "high")] },
      vite: { severity: "high", via: [aviso("vite", "GHSA-dddd-eeee-ffff", "high", "Lee ficheros de fuera del proyecto"), "picomatch"] },
    });
    const r = auditar(dos, excepcion());
    expect(r.codigo).toBe(1);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toContain("vite (GHSA-dddd-eeee-ffff): Lee ficheros de fuera del proyecto");
  });

  it("una excepción caducada no vale: falla y dice cuál", () => {
    const r = auditar(CON_PICOMATCH, excepcion(), "2026-12-18");
    expect(r.codigo).toBe(1);
    expect(r.errores).toEqual([
      `La excepción de ${PICOMATCH} (picomatch) caducó el 2026-12-17: actualiza la dependencia o renuévala con su motivo en .github/diverger/excepciones-sca.json`,
    ]);
    // El día de la caducidad todavía vale.
    expect(auditar(CON_PICOMATCH, excepcion(), "2026-12-17").codigo).toBe(0);
  });

  it("una excepción que ya no hace falta no falla, pero pide quitarla", () => {
    const r = auditar(auditoria({}), excepcion());
    expect(r).toMatchObject({ codigo: 0, errores: [] });
    expect(r.salida).toContain(`::notice::La excepción de ${PICOMATCH} (picomatch) ya no hace falta: quítala de .github/diverger/excepciones-sca.json`);
  });

  it.each([
    ["sin motivo", { motivo: "" }, "le falta el motivo, de 20 caracteres o más"],
    ["con un motivo de compromiso", { motivo: "temporal" }, "le falta el motivo, de 20 caracteres o más"],
    ["sin caducidad", { caduca: undefined }, "le falta la caducidad, con la forma AAAA-MM-DD"],
    ["con una fecha que no existe", { caduca: "2026-02-30" }, "le falta la caducidad, con la forma AAAA-MM-DD"],
    ["con más de 90 días por delante", { caduca: "2027-02-17" }, "caduca el 2027-02-17, a más de 90 días: una excepción se revisa al menos cada 90 días"],
    ["con un identificador que no es de un aviso", { aviso: "picomatch" }, "no tiene un identificador de aviso, con la forma GHSA-xxxx-xxxx-xxxx"],
    ["sin el paquete", { paquete: "" }, "le falta el paquete"],
  ])("una excepción %s no vale y el fichero se rechaza", (_caso, cambios, mensaje) => {
    const r = auditar(CON_PICOMATCH, excepcion(cambios));
    expect(r.codigo).toBe(1);
    expect(r.errores.join("\n")).toContain(mensaje);
  });

  it("un fichero de excepciones que no se puede leer falla, en lugar de pasar sin excepciones o con todas", () => {
    expect(auditar(auditoria({}), "{no es json").errores[0]).toContain("no es un JSON válido");
    expect(auditar(auditoria({}), { otra: [] }).errores[0]).toContain("no tiene la lista «excepciones»");
    const repetida = { excepciones: [...excepcion().excepciones, ...excepcion().excepciones] };
    expect(auditar(CON_PICOMATCH, repetida).errores.join("\n")).toContain(`${PICOMATCH} está dos veces`);
  });

  it("una auditoría que no se ha podido hacer falla, en lugar de darse por limpia", () => {
    const sinRed = JSON.stringify({ error: { code: "ENOTFOUND", summary: "request to https://registry.npmjs.org failed" } });
    const r = auditar(sinRed, { excepciones: [] });
    expect(r.codigo).toBe(1);
    expect(r.errores[0]).toContain("No se ha podido auditar las dependencias: request to https://registry.npmjs.org failed");
    expect(auditar("", { excepciones: [] }).codigo).toBe(1);
    expect(auditar(JSON.stringify({ auditReportVersion: 2 }), { excepciones: [] }).codigo).toBe(1);
  });
});

describe("la plantilla", () => {
  it("su fichero de excepciones es válido y cada excepción lleva motivo y caducidad", () => {
    const fichero = JSON.parse(readFileSync(EXCEPCIONES, "utf8")) as { excepciones: { aviso: string; paquete: string; motivo: string; caduca: string }[] };
    for (const e of fichero.excepciones) {
      expect(e.aviso).toMatch(/^GHSA(-[0-9a-z]{4}){3}$/);
      expect(e.motivo.length).toBeGreaterThanOrEqual(20);
      expect(e.caduca).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Con el fichero de la plantilla y una auditoría limpia el script pasa: el formato lo acepta el propio script.
    const entrada = join(carpeta, "limpia.json");
    writeFileSync(entrada, auditoria({}));
    const hoy = fichero.excepciones.map((e) => e.caduca).sort()[0] ?? HOY;
    const r = spawnSync(process.execPath, [SCRIPT, "--entrada", entrada, "--excepciones", EXCEPCIONES],
      { encoding: "utf8", env: { ...process.env, AUDITORIA_HOY: hoy } });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });

  it("el job calidad audita con el script, no con npm audit a secas", () => {
    const ci = parse(readFileSync(join(RAIZ, ".github", "workflows", "ci.yml"), "utf8")) as {
      jobs: Record<string, { steps: { name?: string; run?: string }[] } | undefined>;
    };
    const paso = ci.jobs.calidad?.steps.find((s) => s.name === "Dependencias con vulnerabilidades conocidas (SCA)");
    expect(paso?.run).toBe("node scripts/auditar-dependencias.mjs");
    expect(readFileSync(join(RAIZ, ".github", "workflows", "ci.yml"), "utf8")).not.toMatch(/npm audit --audit-level/);
  });

  it("el script y el fichero de excepciones tienen propietario en CODEOWNERS", () => {
    const codeowners = readFileSync(join(RAIZ, ".github", "CODEOWNERS"), "utf8");
    expect(codeowners).toMatch(/^\/\.github\/ @\S+/m);
    expect(codeowners).toMatch(/^\/scripts\/ @\S+/m);
  });
});
