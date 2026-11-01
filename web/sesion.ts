// Inicio de sesión con Google Identity Services: carga el script de Google, pinta su botón y
// devuelve el token de identidad, que el frontend manda en cada petición a /api.

interface RespuestaDeGoogle {
  credential: string;
}

interface GoogleId {
  initialize(opciones: { client_id: string; callback: (respuesta: RespuestaDeGoogle) => void }): void;
  renderButton(elemento: HTMLElement, opciones: { theme: string; size: string }): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** Pinta el botón de Google en `elemento` y llama a `alEntrar` con el token al iniciar sesión. */
export type BotonDeGoogle = (elemento: HTMLElement, clientId: string, alEntrar: (token: string) => void) => Promise<void>;

const SCRIPT = "https://accounts.google.com/gsi/client";

function cargarScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  return new Promise((resolver, rechazar) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      resolver();
    };
    script.onerror = () => {
      rechazar(new Error("No se ha podido cargar el inicio de sesión de Google."));
    };
    document.head.appendChild(script);
  });
}

export const botonDeGoogle: BotonDeGoogle = async (elemento, clientId, alEntrar) => {
  await cargarScript();
  const id = window.google?.accounts.id;
  if (!id) throw new Error("No se ha podido cargar el inicio de sesión de Google.");
  id.initialize({
    client_id: clientId,
    callback: (respuesta) => {
      alEntrar(respuesta.credential);
    },
  });
  id.renderButton(elemento, { theme: "outline", size: "large" });
};
