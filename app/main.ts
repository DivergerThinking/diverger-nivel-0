// Arranque en Cloud Run: el puerto llega en PORT y el ID de cliente de Google en GOOGLE_CLIENT_ID.
// Sin GOOGLE_CLIENT_ID la aplicación arranca igual, con el inicio de sesión cerrado: así se puede
// desplegar antes de crear el cliente OAuth. Los datos van a la base de FIRESTORE_DATABASE; sin ella, a
// memoria, y se pierden al parar.
import { fileURLToPath } from "node:url";
import { verificadorGoogle } from "../lib/auth.js";
import { almacenEnMemoria } from "../lib/datos.js";
import { almacenFirestore, clienteFirestore } from "../lib/firestore.js";
import { crearServidor } from "./server.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
if (!googleClientId) {
  console.warn("Falta la variable GOOGLE_CLIENT_ID: el inicio de sesión queda cerrado.");
}
const baseDeDatos = process.env.FIRESTORE_DATABASE ?? "";
if (!baseDeDatos) {
  console.warn("Falta la variable FIRESTORE_DATABASE: los datos se guardan en memoria y se pierden al parar.");
}
const app = await crearServidor({
  googleClientId,
  almacen: baseDeDatos ? almacenFirestore(clienteFirestore(baseDeDatos)) : almacenEnMemoria(),
  verificarToken: googleClientId ? verificadorGoogle(googleClientId) : () => Promise.resolve(null),
  webRoot: fileURLToPath(new URL("../../web", import.meta.url)),
  logger: true,
});
await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 8080) });
