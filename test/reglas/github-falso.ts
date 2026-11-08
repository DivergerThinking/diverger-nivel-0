// API de GitHub de mentira para las pruebas de quién lanzó una ejecución (EN-OPS-06): las ejecuciones
// de Actions, los usuarios y la descripción de las PR (EN-OPS-07), en un servidor HTTP local al que apunta GITHUB_API_URL.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface Ejecucion {
  id: number;
  path: string;
  actor: { login: string };
  display_title: string;
  head_branch?: string;
  status: string;
  created_at: string;
  run_started_at?: string;
  updated_at: string;
  html_url?: string;
}

export interface Datos {
  ejecuciones: Ejecucion[];
  usuarios: Record<string, { id: number; name: string | null }>;
  /** Las PR por número, con su descripción actual (EN-OPS-07). */
  prs?: Record<string, { body: string | null }>;
}

export const REPO = "DivergerThinking/app-de-prueba";

export const PERSONAS: Datos["usuarios"] = {
  joselcs: { id: 1234567, name: "José Luis Calvo" },
  "ana-lopez": { id: 7654321, name: "Ana López" },
};

/** Un worker lanzado por el bucle (con la identidad del harness) y el bucle, lanzado por `persona`. */
export function lanzadoPorElBucle(persona: string, iniciativa = "prestamos"): Ejecucion[] {
  return [
    { id: 900, path: ".github/workflows/diverger-worker.yml", actor: { login: "diverger-harness[bot]" },
      display_title: "diverger-worker TA-004 c7fbf6d2", head_branch: "main", status: "completed",
      created_at: "2026-11-02T10:05:00Z", updated_at: "2026-11-02T10:20:00Z" },
    { id: 800, path: ".github/workflows/diverger-bucle.yml", actor: { login: persona },
      display_title: `diverger-bucle ${iniciativa}`, status: "completed",
      created_at: "2026-11-02T10:00:00Z", run_started_at: "2026-11-02T10:00:00Z", updated_at: "2026-11-02T11:00:00Z",
      html_url: `https://github.com/${REPO}/actions/runs/800` },
    // Un bucle anterior de la misma iniciativa, ya terminado, lanzado por otra persona.
    { id: 700, path: ".github/workflows/diverger-bucle.yml", actor: { login: "ana-lopez" },
      display_title: `diverger-bucle ${iniciativa}`, status: "completed",
      created_at: "2026-11-01T09:00:00Z", run_started_at: "2026-11-01T09:00:00Z", updated_at: "2026-11-01T09:30:00Z" },
  ];
}

/** La respuesta de la API a una petición GET, o undefined si no existe (404). */
function responder(datos: Datos, url: URL): unknown {
  const ejecucion = new RegExp(`^/repos/${REPO}/actions/runs/([0-9]+)$`).exec(url.pathname);
  if (ejecucion) return datos.ejecuciones.find((e) => String(e.id) === ejecucion[1]);
  if (url.pathname === `/repos/${REPO}/actions/workflows/diverger-bucle.yml/runs`) {
    const hasta = Date.parse((url.searchParams.get("created") ?? "").replace(/^<=/, ""));
    return { workflow_runs: datos.ejecuciones.filter((e) => e.path.endsWith("diverger-bucle.yml")
      && (Number.isNaN(hasta) || Date.parse(e.created_at) <= hasta)) };
  }
  const pr = new RegExp(`^/repos/${REPO}/pulls/([0-9]+)$`).exec(url.pathname);
  if (pr) return datos.prs?.[pr[1] ?? ""];
  const usuario = /^\/users\/([^/]+)$/.exec(url.pathname);
  if (!usuario) return undefined;
  const login = decodeURIComponent(usuario[1] ?? "");
  const datosUsuario = datos.usuarios[login];
  return datosUsuario ? { login, ...datosUsuario } : undefined;
}

export async function arrancar(datos: Datos): Promise<{ url: string; servidor: Server }> {
  const servidor = createServer((peticion, respuesta) => {
    const cuerpo = responder(datos, new URL(peticion.url ?? "/", "http://localhost"));
    respuesta.writeHead(cuerpo ? 200 : 404, { "Content-Type": "application/json" });
    respuesta.end(JSON.stringify(cuerpo ?? { message: "Not Found" }));
  });
  await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo));
  return { url: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`, servidor };
}
