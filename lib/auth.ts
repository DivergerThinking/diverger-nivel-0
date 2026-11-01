// Inicio de sesión con Google (Google Identity Services): el frontend obtiene un token de
// identidad y el servidor lo verifica en cada petición a /api. Lo comparten app/ y los contextos.
import { OAuth2Client } from "google-auth-library";

export interface Persona {
  email: string;
  nombre: string;
}

/** Devuelve la persona del token, o null si el token no es válido. */
export type VerificarToken = (token: string) => Promise<Persona | null>;

declare module "fastify" {
  interface FastifyRequest {
    /** La persona que ha iniciado sesión; null en las rutas públicas. */
    persona: Persona | null;
  }
}

export function verificadorGoogle(clientId: string): VerificarToken {
  const cliente = new OAuth2Client();
  return async (token) => {
    try {
      const ticket = await cliente.verifyIdToken({ idToken: token, audience: clientId });
      const datos = ticket.getPayload();
      if (!datos?.email || datos.email_verified !== true) return null;
      return { email: datos.email, nombre: datos.name ?? datos.email };
    } catch {
      return null;
    }
  };
}

/** Token de la cabecera «Authorization: Bearer <token>», o null. */
export function tokenDeCabecera(cabecera: string | undefined): string | null {
  const encontrado = /^Bearer (\S+)$/.exec(cabecera ?? "");
  return encontrado?.[1] ?? null;
}
