// Arranque en Cloud Run: el puerto llega en PORT y el ID de cliente de Google en GOOGLE_CLIENT_ID.
// Sin GOOGLE_CLIENT_ID la aplicación arranca igual, con el inicio de sesión cerrado: así se puede
// desplegar antes de crear el cliente OAuth.
import { fileURLToPath } from "node:url";
import { verificadorGoogle } from "../lib/auth.js";
import { crearServidor } from "./server.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
if (!googleClientId) {
  console.warn("Falta la variable GOOGLE_CLIENT_ID: el inicio de sesión queda cerrado.");
}
const app = await crearServidor({
  googleClientId,
  verificarToken: googleClientId ? verificadorGoogle(googleClientId) : () => Promise.resolve(null),
  webRoot: fileURLToPath(new URL("../../web", import.meta.url)),
  logger: true,
});
await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 8080) });
