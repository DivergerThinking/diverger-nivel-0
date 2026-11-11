// Mínimo privilegio en GCP (EN-GP-05 y TA-146 del harness, RQ.061): la infraestructura como código de infra/ no
// concede a nadie roles/iam.serviceAccountUser a nivel de proyecto, porque con él la cuenta de despliegue podría actuar
// como cualquier cuenta de servicio del proyecto, y no da los roles básicos (Editor, Owner, Viewer). serviceAccountUser
// solo cabe sobre una cuenta de servicio concreta, en un recurso google_service_account_iam_*. Las cuentas de
// despliegue y de ejecución, y quitar Editor a la de Compute Engine, son de infra/entornos/gcp.sh del harness; esto
// impide que la infraestructura de la aplicación lo deshaga.
//
// Se lee el texto, no el plan, así que la regla es amplia a propósito (revisión de la PR #62): cualquier aparición de
// roles/iam.serviceAccountUser o de un rol básico fuera de un google_service_account_iam_* es un error, esté en un
// recurso, en locals, en una variable, en un for_each o en un heredoc. Las políticas completas
// (google_*_iam_policy) no se usan: sustituyen la política entera del proyecto. Y la infraestructura va en .tf, no en
// .tf.json, que esto no revisa; los .tofu de OpenTofu se revisan como los .tf, y los .tfvars se buscan enteros. Los
// módulos solo pueden ser locales, sin «..», aunque la ruta siguiera dentro de la carpeta, y un .tfvars no puede nombrar
// serviceAccountUser ni para un recurso de una cuenta de servicio: se pone en el .tf. El rol de un recurso de IAM del proyecto
// tiene que ser una cadena literal. Se quitan los comentarios antes de buscar.
// Uso en el CI: node scripts/iam.mjs [carpeta], por defecto infra. Falla con un error por cada problema.
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const SERVICE_ACCOUNT_USER =
  "serviceAccountUser debe concederse solo sobre la cuenta de ejecución, no a nivel de proyecto";
export const ROL_BASICO = "los roles básicos (Editor, Owner, Viewer) no se conceden en la infraestructura del proyecto";
export const POLITICA = "las políticas completas de IAM (google_*_iam_policy) no se usan: sustituyen la política entera";
export const MODULO = "los módulos solo pueden ser locales, con source = \"./…\", para que se revisen con lo demás";
export const ILEGIBLE = "no se puede leer: una cadena, un heredoc o un bloque no se cierra, o una cabecera resource o module no se entiende";
export const TF_JSON = "la infraestructura va en ficheros .tf o .tofu, no .tf.json ni .tofu.json, para que se pueda revisar";

const SAU = /roles\/iam\.serviceAccountUser/i;
const BASICO = /roles\/(editor|owner|viewer)\b/i;
const PERMITIDO = /^google_service_account_iam_(member|binding)$/;
const POLITICA_COMPLETA = /^google_(project|folder|organization)_iam_policy$/;
const DE_PROYECTO = /^google_(project|folder|organization)_iam_(member|binding)$/;
// El rol de un recurso de IAM del proyecto, la carpeta o la organización es una cadena literal sin interpolación: uno
// construido (local.rol, each.value, "roles/${…}") no se puede comprobar leyendo el texto (revisión de seguridad).
const ROL_LITERAL = /^"roles\/[A-Za-z0-9._]+"$/;
export const ROL_NO_LITERAL = "el rol tiene que ser una cadena literal, como \"roles/datastore.user\", para poder comprobarlo";
const HEREDOC = /^<<-?([A-Za-z_][A-Za-z0-9_]*)[ \t]*\n/;

/** Dónde acaba la cadena que empieza en la comilla de i (el índice de su comilla de cierre), con las interpolaciones
 * ${…} y %{…}, que pueden llevar llaves y otras cadenas dentro (revisión de seguridad de la PR #62). */
function finDeLaCadena(texto, i) {
  for (let j = i + 1; j < texto.length; j++) {
    const c = texto[j];
    if (c === "\\") j++;
    else if (c === '"') return j;
    else if ((c === "$" || c === "%") && texto[j + 1] === c && texto[j + 2] === "{") j += 2; // $${ y %%{ son texto.
    else if ((c === "$" || c === "%") && texto[j + 1] === "{") {
      let nivel = 1;
      for (j += 2; j < texto.length && nivel > 0; j++) {
        if (texto[j] === "\\") j++;
        else if (texto[j] === '"') j = finDeLaCadena(texto, j);
        else if (texto[j] === "{") nivel++;
        else if (texto[j] === "}") nivel--;
      }
      j--;
    }
  }
  return texto.length;
}

/** Dónde acaba el heredoc que empieza en i, o -1 si en i no empieza ninguno. */
function finDelHeredoc(texto, i) {
  const apertura = HEREDOC.exec(texto.slice(i, i + 80));
  if (!apertura) return -1;
  const cuerpo = i + apertura[0].length;
  const cierre = new RegExp(`(^|\\n)[ \\t]*${apertura[1]}[ \\t]*(?=\\n|$)`).exec(texto.slice(cuerpo));
  return cierre ? cuerpo + cierre.index + cierre[0].length : texto.length;
}

/** El texto sin comentarios (de línea con # o //, y de bloque), sin tocar las cadenas ni los heredocs. */
export function sinComentarios(texto) {
  let salida = "";
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const heredoc = finDelHeredoc(texto, i);
    if (heredoc !== -1) {
      salida += texto.slice(i, heredoc);
      i = heredoc - 1;
    } else if (c === '"') {
      const fin = finDeLaCadena(texto, i);
      salida += texto.slice(i, fin + 1);
      i = fin;
    } else if (c === "#" || (c === "/" && texto[i + 1] === "/")) {
      const fin = texto.indexOf("\n", i);
      i = (fin === -1 ? texto.length : fin) - 1;
    } else if (c === "/" && texto[i + 1] === "*") {
      const fin = texto.indexOf("*/", i + 2);
      i = fin === -1 ? texto.length : fin + 1;
    } else salida += c;
  }
  return salida;
}

/** Dónde acaba el bloque que empieza en «desde» (justo después de su llave), saltando cadenas y heredocs. */
function finDelBloque(texto, desde) {
  let nivel = 1;
  for (let i = desde; i < texto.length; i++) {
    const c = texto[i];
    const heredoc = finDelHeredoc(texto, i);
    if (heredoc !== -1) i = heredoc - 1;
    else if (c === '"') i = finDeLaCadena(texto, i);
    else if (c === "{") nivel++;
    else if (c === "}" && --nivel === 0) return i;
  }
  return texto.length;
}

/** Los bloques resource de un texto HCL ya sin comentarios: tipo, nombre, inicio y fin. Las etiquetas pueden ir sin
 * comillas, como admiten OpenTofu y Terraform. */
// Una etiqueta de bloque: un identificador, que en HCL admite cualquier letra Unicode, con comillas o sin ellas. Una
// entre comillas con otra cosa, como un escape \u005f que OpenTofu convierte en _, no se reconoce: la cabecera no se
// entiende y el fichero falla (revisión de seguridad de la PR #64).
const ETIQUETA = String.raw`("[\p{L}\p{N}_-]+"|[\p{L}\p{N}_-]+)`;
const sinComillas = (etiqueta) => etiqueta.replace(/^"|"$/g, "");
// Las cabeceras empiezan línea, como manda HCL: así una que esté a mitad de línea, dentro de una cadena, no cuenta.
const MODULO_CABECERA = new RegExp(String.raw`^[ \t]*module(?=[\s"])\s*${ETIQUETA}\s*\{`, "gmu");
// Cualquier cabecera de bloque resource o module que no sea un atributo.
const CABECERA = /^[ \t]*(?:resource|module)(?![\p{L}\p{N}_-])(?![ \t]*=)/gmu;
// Dónde empieza la palabra resource o module de una coincidencia.
const palabra = (m) => m.index + m[0].search(/resource|module/);

export function recursos(texto) {
  const encontrados = [];
  // OpenTofu no exige espacios entre las palabras de la cabecera: resource"a""b"{ también vale (revisión de la PR #64).
  const inicio = new RegExp(String.raw`^[ \t]*resource(?=[\s"])\s*${ETIQUETA}\s*${ETIQUETA}\s*\{`, "gmu");
  let coincidencia;
  while ((coincidencia = inicio.exec(texto))) {
    const fin = finDelBloque(texto, inicio.lastIndex);
    encontrados.push({ tipo: sinComillas(coincidencia[1]), nombre: sinComillas(coincidencia[2]), inicio: palabra(coincidencia),
      fin });
    inicio.lastIndex = fin;
  }
  return encontrados;
}

/** Si las cadenas, los heredocs y las llaves del texto se cierran todos. */
function equilibrado(texto) {
  let nivel = 0;
  for (let i = 0; i < texto.length; i++) {
    const heredoc = finDelHeredoc(texto, i);
    if (heredoc !== -1) {
      if (heredoc >= texto.length && !/\n[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*$/.test(texto)) return false;
      i = heredoc - 1;
    } else if (texto[i] === '"') {
      i = finDeLaCadena(texto, i);
      if (i >= texto.length) return false;
    } else if (texto[i] === "{") nivel++;
    else if (texto[i] === "}" && --nivel < 0) return false;
  }
  return nivel === 0;
}

/** Los problemas del texto de un .tf. */
export function revisar(original) {
  const texto = sinComentarios(original);
  const bloques = recursos(texto);
  // Si el lector no consigue cerrar algo, no se fía de lo que ha leído: falla (revisión de seguridad de la PR #62).
  if (bloques.some((b) => b.fin >= texto.length) || !equilibrado(texto)) return [ILEGIBLE];
  // Y si hay una cabecera resource o module que el lector no ha sabido leer, tampoco (revisión de seguridad de la PR #64).
  const modulos = [...texto.matchAll(MODULO_CABECERA)];
  // Se comparan las posiciones, no cuántas hay: con el número, una de más en un sitio taparía una de menos en otro.
  const leidas = [...bloques.map((b) => b.inicio), ...modulos.map(palabra)].sort((a, b) => a - b).join();
  const todas = [...texto.matchAll(CABECERA)].map(palabra).sort((a, b) => a - b).join();
  if (leidas !== todas) return [ILEGIBLE];
  const errores = [];
  // Un módulo remoto, o de fuera de la carpeta, trae recursos que esto no lee (revisión de seguridad de la PR #63).
  for (const modulo of modulos) {
    const cuerpo = texto.slice(modulo.index, finDelBloque(texto, modulo.index + modulo[0].length) + 1);
    // Un solo source, literal, local, sin salir de la carpeta ni entrar en una .terraform, que no se revisa.
    // El atributo empieza línea (my-source no cuenta), y su valor es una cadena sola: ni paréntesis, ni heredoc, ni nada
    // detrás. Cualquier otra forma, o más de un source en el bloque, no vale (revisión de seguridad de la PR #64).
    const origenes = [...cuerpo.matchAll(/(?:^|\n|\{)[ \t]*source[ \t]*=([^\n}]*)/g)].map((m) => m[1].trim());
    const literal = origenes.length === 1 ? /^"([^"\\$%]*)"$/.exec(origenes[0]) : null;
    const origen = literal?.[1] ?? "";
    const local = /^\.\/[\w./-]*$/.test(origen)
      && !origen.split("/").some((parte) => parte === ".." || parte === ".terraform");
    if (!local) errores.push(`module.${sinComillas(modulo[1])}: ${MODULO}`);
  }
  for (const { tipo, nombre, inicio, fin } of bloques) {
    if (POLITICA_COMPLETA.test(tipo)) errores.push(`${tipo}.${nombre}: ${POLITICA}`);
    if (DE_PROYECTO.test(tipo)) {
      const valores = [...texto.slice(inicio, fin + 1).matchAll(/(?:^|[\s{])role\s*=\s*([^\n]*)/g)].map((m) => m[1].trim());
      if (!valores.length || valores.some((valor) => !ROL_LITERAL.test(valor))) {
        errores.push(`${tipo}.${nombre}: ${ROL_NO_LITERAL}`);
      }
    }
  }
  // Cualquier aparición cuenta, en un recurso o fuera de ellos (locals, una variable, un data, un heredoc): un error por
  // cada recurso que la tenga y otro si está fuera. Dentro de un google_service_account_iam_*, serviceAccountUser sí
  // vale; un rol básico, nunca.
  let fuera = "";
  let desde = 0;
  for (const bloque of bloques) {
    const cuerpo = texto.slice(bloque.inicio, bloque.fin + 1);
    if (!PERMITIDO.test(bloque.tipo) && SAU.test(cuerpo)) {
      errores.push(`${bloque.tipo}.${bloque.nombre}: ${SERVICE_ACCOUNT_USER}`);
    }
    if (BASICO.test(cuerpo)) errores.push(`${bloque.tipo}.${bloque.nombre}: ${ROL_BASICO}`);
    fuera += texto.slice(desde, bloque.inicio);
    desde = bloque.fin + 1;
  }
  fuera += texto.slice(desde);
  if (SAU.test(fuera)) errores.push(`fuera de un recurso: ${SERVICE_ACCOUNT_USER}`);
  if (BASICO.test(fuera)) errores.push(`fuera de un recurso: ${ROL_BASICO}`);
  return errores;
}

// Solo se salta la caché de OpenTofu de la carpeta revisada: una carpeta .terraform más abajo podría esconder .tf
// (revisión de seguridad de la PR #63).
function ficheros(carpeta, raiz = carpeta) {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (nombre === ".terraform" && carpeta === raiz) return [];
    return statSync(ruta).isDirectory() ? ficheros(ruta, raiz) : [ruta];
  });
}

// Con las rutas reales, también se ejecuta si se lanza a través de un enlace (revisión de la PR #62).
const lanzado = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : "";
if (import.meta.url === lanzado) {
  const carpeta = process.argv[2] ?? "infra";
  const errores = [];
  for (const ruta of ficheros(carpeta)) {
    const visible = relative(".", ruta);
    if (ruta.endsWith(".tf.json") || ruta.endsWith(".tofu.json") || ruta.endsWith(".tfvars.json")) {
      errores.push([visible, TF_JSON]);
    } else if (ruta.endsWith(".tf") || ruta.endsWith(".tofu")) {
      for (const error of revisar(readFileSync(ruta, "utf8"))) errores.push([visible, error]);
    } else if (ruta.endsWith(".tfvars")) {
      // Una variable puede llevar el rol: aquí no hay recursos, así que cualquier aparición cuenta.
      const texto = sinComentarios(readFileSync(ruta, "utf8"));
      if (SAU.test(texto)) errores.push([visible, `fuera de un recurso: ${SERVICE_ACCOUNT_USER}`]);
      if (BASICO.test(texto)) errores.push([visible, `fuera de un recurso: ${ROL_BASICO}`]);
    }
  }
  // Lo que va en un comando de GitHub Actions se escapa, para que un nombre de fichero no cambie el comando.
  const escapar = (texto) => texto.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const propiedad = (texto) => escapar(texto).replace(/:/g, "%3A").replace(/,/g, "%2C");
  for (const [fichero, error] of errores) console.error(`::error file=${propiedad(fichero)}::${escapar(`${fichero}: ${error}`)}`);
  if (errores.length) process.exit(1);
  console.log(`IAM de ${carpeta}: sin serviceAccountUser a nivel de proyecto, roles básicos ni políticas completas`);
}
