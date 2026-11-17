// Dependencias con vulnerabilidades conocidas (SCA) con excepciones por aviso (harness#894, ADR 0072 del harness).
// Uso en el CI: node scripts/auditar-dependencias.mjs. Ejecuta `npm audit --json` y falla con cualquier aviso alto o
// crítico que no tenga una excepción en vigor en .github/diverger/excepciones-sca.json.
//
// `npm audit --audit-level=high` no admite excepciones: un aviso sin versión corregida deja el CI en rojo, y con él
// todas las PR, hasta que el paquete publica el arreglo. Una excepción acepta un aviso concreto, por su identificador,
// con su motivo y una caducidad de 90 días como mucho. Todo lo demás sigue parando el CI, también en las
// dependencias de desarrollo, que se ejecutan en él. El fichero y este script tienen propietario en CODEOWNERS.
//
// Para los tests: --entrada <fichero> usa una salida de `npm audit --json` ya guardada, --excepciones <fichero> cambia
// el fichero de excepciones y AUDITORIA_HOY (AAAA-MM-DD) fija la fecha.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const EXCEPCIONES = ".github/diverger/excepciones-sca.json";
export const GRAVES = ["high", "critical"];
export const DIAS_MAXIMOS = 90;
const AVISO = /^GHSA(-[0-9a-z]{4}){3}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** La fecha como número de día, o NaN si no tiene la forma AAAA-MM-DD o no existe (2026-02-30). */
function dia(fecha) {
  if (typeof fecha !== "string" || !FECHA.test(fecha)) return NaN;
  const ms = Date.parse(`${fecha}T00:00:00Z`);
  return new Date(ms).toISOString().slice(0, 10) === fecha ? ms / 86_400_000 : NaN;
}

/** Los avisos altos y críticos de una salida de `npm audit --json`, uno por identificador. */
export function avisosGraves(auditoria) {
  const avisos = new Map();
  for (const paquete of Object.values(auditoria.vulnerabilities)) {
    // Un paquete trae sus avisos propios como objetos; como texto, el nombre del paquete por el que le llega otro.
    for (const via of Array.isArray(paquete?.via) ? paquete.via : []) {
      if (typeof via !== "object" || via === null || !GRAVES.includes(via.severity)) continue;
      const id = String(via.url ?? "").split("/").pop() || String(via.source ?? via.title);
      if (!avisos.has(id)) avisos.set(id, { id, paquete: via.name ?? paquete.name, gravedad: via.severity, titulo: via.title ?? "" });
    }
  }
  return [...avisos.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Errores del fichero de excepciones: sin ellos, cada excepción tiene aviso, paquete, motivo y una caducidad válida. */
export function erroresDeExcepciones(fichero, hoy, ruta = EXCEPCIONES) {
  if (typeof fichero !== "object" || fichero === null || !Array.isArray(fichero.excepciones)) {
    return [`${ruta} no tiene la lista «excepciones»`];
  }
  const errores = [];
  const vistos = new Set();
  fichero.excepciones.forEach((e, i) => {
    const nombre = `La excepción ${i + 1} de ${ruta}`;
    if (typeof e !== "object" || e === null) { errores.push(`${nombre} no es un objeto`); return; }
    if (typeof e.aviso !== "string" || !AVISO.test(e.aviso)) {
      errores.push(`${nombre} no tiene un identificador de aviso, con la forma GHSA-xxxx-xxxx-xxxx`);
    } else if (vistos.has(e.aviso)) {
      errores.push(`${e.aviso} está dos veces en ${ruta}`);
    } else {
      vistos.add(e.aviso);
    }
    if (typeof e.paquete !== "string" || !e.paquete.trim()) errores.push(`${nombre}: le falta el paquete`);
    if (typeof e.motivo !== "string" || e.motivo.trim().length < 20) errores.push(`${nombre}: le falta el motivo, de 20 caracteres o más`);
    const caduca = dia(e.caduca);
    if (Number.isNaN(caduca)) {
      errores.push(`${nombre}: le falta la caducidad, con la forma AAAA-MM-DD`);
    } else if (caduca - dia(hoy) > DIAS_MAXIMOS) {
      errores.push(`${nombre} caduca el ${e.caduca}, a más de ${DIAS_MAXIMOS} días: una excepción se revisa al menos cada ${DIAS_MAXIMOS} días`);
    }
  });
  return errores;
}

/** Lo que dice la auditoría con las excepciones: errores que paran el CI, avisos aceptados y excepciones que sobran. */
export function evaluar(auditoria, fichero, hoy, ruta = EXCEPCIONES) {
  const errores = erroresDeExcepciones(fichero, hoy, ruta);
  if (errores.length) return { errores, aceptados: [], sobran: [] };
  const excepciones = new Map(fichero.excepciones.map((e) => [e.aviso, e]));
  const aceptados = [];
  const graves = avisosGraves(auditoria);
  for (const a of graves) {
    const e = excepciones.get(a.id);
    if (!e) {
      errores.push(`Vulnerabilidad ${a.gravedad} sin excepción: ${a.paquete} (${a.id}): ${a.titulo}. Actualiza la dependencia o, ` +
        `si no hay versión corregida, añade una excepción con su motivo y su caducidad en ${ruta}`);
    } else if (dia(e.caduca) < dia(hoy)) {
      errores.push(`La excepción de ${a.id} (${e.paquete}) caducó el ${e.caduca}: actualiza la dependencia o renuévala con su motivo en ${ruta}`);
    } else {
      aceptados.push(`Aceptada hasta el ${e.caduca}: ${a.paquete} (${a.id}). ${e.motivo.trim()}`);
    }
  }
  const presentes = new Set(graves.map((a) => a.id));
  const sobran = fichero.excepciones.filter((e) => !presentes.has(e.aviso))
    .map((e) => `La excepción de ${e.aviso} (${e.paquete}) ya no hace falta: quítala de ${ruta}`);
  return { errores, aceptados, sobran };
}

/** La salida de `npm audit --json`. npm termina con 1 cuando hay vulnerabilidades, así que su código no se mira. */
function ejecutarNpmAudit() {
  const opciones = { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  // En Windows npm es un .cmd y solo se ejecuta con shell; la orden va entera y es fija, sin argumentos de fuera.
  const r = process.platform === "win32"
    ? spawnSync("npm audit --json", { ...opciones, shell: true })
    : spawnSync("npm", ["audit", "--json"], opciones);
  if (r.error) throw new Error(`npm audit no se ha podido ejecutar: ${r.error.message}`);
  return r.stdout;
}

function leerJson(texto, que) {
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`${que} no es un JSON válido`);
  }
}

function principal(argumentos) {
  const opcion = (nombre) => {
    const i = argumentos.indexOf(nombre);
    return i >= 0 ? argumentos[i + 1] : undefined;
  };
  const ruta = opcion("--excepciones") ?? EXCEPCIONES;
  const entrada = opcion("--entrada");
  const hoy = process.env.AUDITORIA_HOY || new Date().toISOString().slice(0, 10);
  if (Number.isNaN(dia(hoy))) throw new Error(`AUDITORIA_HOY no es una fecha AAAA-MM-DD: ${hoy}`);

  const auditoria = leerJson(entrada ? readFileSync(entrada, "utf8") : ejecutarNpmAudit(), "La salida de npm audit");
  // Sin red o con el registro caído, npm responde con «error» y sin vulnerabilidades: eso no es una auditoría limpia.
  if (auditoria?.error) {
    throw new Error(`No se ha podido auditar las dependencias: ${auditoria.error.summary ?? auditoria.error.code ?? "npm audit dio un error"}`);
  }
  if (typeof auditoria?.vulnerabilities !== "object" || auditoria.vulnerabilities === null) {
    throw new Error("No se ha podido auditar las dependencias: la salida de npm audit no trae «vulnerabilities»");
  }
  let texto;
  try {
    texto = readFileSync(ruta, "utf8");
  } catch {
    throw new Error(`No se puede leer ${ruta}`);
  }
  const { errores, aceptados, sobran } = evaluar(auditoria, leerJson(texto, ruta), hoy, opcion("--excepciones") ? EXCEPCIONES : ruta);
  for (const linea of aceptados) console.log(linea);
  for (const linea of sobran) console.log(`::notice::${linea}`);
  if (errores.length) {
    for (const error of errores) console.error(error);
    return 1;
  }
  console.log("Dependencias sin vulnerabilidades altas ni críticas fuera de las excepciones.");
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
