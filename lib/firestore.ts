// Adaptador de Firestore del puerto de persistencia (lib/datos.ts). Es lo único de la aplicación que
// conoce Firestore: los contextos usan el puerto. La base es la propia de la aplicación
// (FIRESTORE_DATABASE, creada por infra/firestore.tf) y la cuenta de ejecución solo puede usar esa.
import { Firestore } from "@google-cloud/firestore";
import type { Almacen, Transaccion } from "./datos.js";

/** Lo que el adaptador usa de Firestore; un test puede pasar uno de mentira con la misma forma. */
export type ClienteFirestore = Pick<Firestore, "collection" | "runTransaction">;

export function almacenFirestore(cliente: ClienteFirestore): Almacen {
  const documento = (coleccion: string, id: string) => cliente.collection(coleccion).doc(id);
  return {
    async obtener<T extends object>(coleccion: string, id: string) {
      const instantanea = await documento(coleccion, id).get();
      return instantanea.exists ? (instantanea.data() as T) : undefined;
    },
    async guardar(coleccion, id, datos) {
      await documento(coleccion, id).set(datos);
    },
    async listar<T extends object>(coleccion: string) {
      const consulta = await cliente.collection(coleccion).get();
      return consulta.docs.map((d) => d.data() as T);
    },
    async borrar(coleccion, id) {
      await documento(coleccion, id).delete();
    },
    transaccion<R>(trabajo: (tx: Transaccion) => Promise<R>): Promise<R> {
      // Firestore repite la transacción si otra cambia lo que ha leído (concurrencia optimista).
      return cliente.runTransaction((t) =>
        trabajo({
          async obtener<T extends object>(coleccion: string, id: string) {
            const instantanea = await t.get(documento(coleccion, id));
            return instantanea.exists ? (instantanea.data() as T) : undefined;
          },
          guardar: (coleccion, id, datos) => {
            t.set(documento(coleccion, id), datos);
          },
          borrar: (coleccion, id) => {
            t.delete(documento(coleccion, id));
          },
        }),
      );
    },
  };
}

/** El cliente de la base de la aplicación, con las credenciales del entorno (la cuenta de ejecución). */
export function clienteFirestore(baseDeDatos: string): Firestore {
  return new Firestore({ databaseId: baseDeDatos, ignoreUndefinedProperties: true });
}
