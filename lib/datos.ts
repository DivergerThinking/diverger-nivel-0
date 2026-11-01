// Puerto de persistencia de la aplicación (HU-GP-01, decisión del titular del 01/11/2026). Los contextos
// guardan y leen sus datos solo a través de este puerto, que el servidor les pasa al registrarlos; nunca
// usan el cliente de la base directamente (lo vigila dependency-cruiser). Así el código de los contextos no
// depende de la base de datos: este golden path usa Firestore (lib/firestore.ts), y otro golden path cambia
// solo el adaptador.
//
// Cada contexto usa sus propias colecciones, con su id delante: «prestamos_equipos» (ADR 0003 del harness:
// un contexto solo escribe en sus colecciones).

/** Lo que se puede leer dentro y fuera de una transacción. */
export interface Lectura {
  /** El documento con ese id, o undefined si no existe. */
  obtener<T extends object>(coleccion: string, id: string): Promise<T | undefined>;
}

/** Lo que se lee y escribe de forma atómica: primero todas las lecturas y después las escrituras. */
export interface Transaccion extends Lectura {
  guardar(coleccion: string, id: string, datos: object): void;
  borrar(coleccion: string, id: string): void;
}

export interface Almacen extends Lectura {
  /** Crea o sustituye el documento. */
  guardar(coleccion: string, id: string, datos: object): Promise<void>;
  /** Todos los documentos de la colección, en cualquier orden. */
  listar<T extends object>(coleccion: string): Promise<T[]>;
  borrar(coleccion: string, id: string): Promise<void>;
  /**
   * Ejecuta el trabajo de forma atómica: si otra transacción cambia lo que se ha leído antes de terminar,
   * no se aplica nada y se repite. Es lo que evita, por ejemplo, prestar dos veces el mismo equipo con dos
   * peticiones a la vez.
   */
  transaccion<R>(trabajo: (tx: Transaccion) => Promise<R>): Promise<R>;
}

/** Lo que el servidor pasa a cada contexto al registrarlo: sus rutas reciben el almacén en sus opciones. */
export interface OpcionesContexto {
  almacen: Almacen;
}

const copia = <T>(valor: T): T => structuredClone(valor);

/**
 * Almacén en memoria, para los tests y para arrancar sin base de datos. Las transacciones van de una en
 * una, así que son atómicas. Los datos se pierden al parar el proceso.
 */
export function almacenEnMemoria(): Almacen {
  const colecciones = new Map<string, Map<string, object>>();
  const de = (coleccion: string): Map<string, object> => {
    let documentos = colecciones.get(coleccion);
    if (!documentos) {
      documentos = new Map();
      colecciones.set(coleccion, documentos);
    }
    return documentos;
  };
  let cola: Promise<unknown> = Promise.resolve();

  const obtener = <T extends object>(coleccion: string, id: string): Promise<T | undefined> => {
    const documento = de(coleccion).get(id);
    return Promise.resolve(documento === undefined ? undefined : (copia(documento) as T));
  };

  return {
    obtener,
    guardar(coleccion, id, datos) {
      de(coleccion).set(id, copia(datos));
      return Promise.resolve();
    },
    listar<T extends object>(coleccion: string) {
      return Promise.resolve([...de(coleccion).values()].map((d) => copia(d) as T));
    },
    borrar(coleccion, id) {
      de(coleccion).delete(id);
      return Promise.resolve();
    },
    transaccion<R>(trabajo: (tx: Transaccion) => Promise<R>): Promise<R> {
      const ejecutar = async (): Promise<R> => {
        const escrituras: (() => void)[] = [];
        const resultado = await trabajo({
          obtener,
          guardar: (coleccion, id, datos) => escrituras.push(() => de(coleccion).set(id, copia(datos))),
          borrar: (coleccion, id) => escrituras.push(() => de(coleccion).delete(id)),
        });
        for (const escribir of escrituras) escribir();
        return resultado;
      };
      const resultado = cola.then(ejecutar, ejecutar);
      cola = resultado.catch(() => undefined);
      return resultado;
    },
  };
}
