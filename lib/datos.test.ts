// Puerto de persistencia (HU-GP-01): el almacén en memoria y el adaptador de Firestore cumplen el mismo
// contrato. El de Firestore se prueba con un cliente de mentira con la misma forma.
import { describe, expect, it } from "vitest";
import { almacenEnMemoria, type Almacen } from "./datos.js";
import { almacenFirestore, type ClienteFirestore } from "./firestore.js";

interface Equipo {
  nombre: string;
  prestado: boolean;
}

/** Firestore de mentira en memoria, con transacciones de una en una. */
function firestoreDeMentira(): ClienteFirestore {
  const datos = new Map<string, unknown>();
  const instantanea = (clave: string) => ({ exists: datos.has(clave), data: () => structuredClone(datos.get(clave)) });
  const doc = (coleccion: string, id: string) => {
    const clave = `${coleccion}/${id}`;
    return {
      clave,
      get: () => Promise.resolve(instantanea(clave)),
      set: (valor: unknown) => Promise.resolve(void datos.set(clave, structuredClone(valor))),
      delete: () => Promise.resolve(void datos.delete(clave)),
    };
  };
  const cliente = {
    collection: (coleccion: string) => ({
      doc: (id: string) => doc(coleccion, id),
      get: () =>
        Promise.resolve({
          docs: [...datos.keys()].filter((k) => k.startsWith(`${coleccion}/`)).map((k) => instantanea(k)),
        }),
    }),
    runTransaction: async (trabajo: (t: unknown) => Promise<unknown>) => {
      const escrituras: (() => void)[] = [];
      const resultado = await trabajo({
        get: (d: { clave: string }) => Promise.resolve(instantanea(d.clave)),
        set: (d: { clave: string }, valor: unknown) => escrituras.push(() => datos.set(d.clave, structuredClone(valor))),
        delete: (d: { clave: string }) => escrituras.push(() => datos.delete(d.clave)),
      });
      for (const escribir of escrituras) escribir();
      return resultado;
    },
  };
  return cliente as unknown as ClienteFirestore;
}

describe.each([
  ["en memoria", () => almacenEnMemoria()],
  ["Firestore", () => almacenFirestore(firestoreDeMentira())],
])("almacén %s", (_nombre, crear: () => Almacen) => {
  it("guarda, obtiene, lista y borra", async () => {
    const almacen = crear();
    await almacen.guardar("prestamos_equipos", "pc-07", { nombre: "Portátil 07", prestado: false });
    await almacen.guardar("prestamos_equipos", "pr-02", { nombre: "Proyector 2", prestado: true });
    expect(await almacen.obtener<Equipo>("prestamos_equipos", "pc-07")).toEqual({ nombre: "Portátil 07", prestado: false });
    expect(await almacen.obtener("prestamos_equipos", "no-existe")).toBeUndefined();
    expect((await almacen.listar<Equipo>("prestamos_equipos")).map((e) => e.nombre).sort()).toEqual(["Portátil 07", "Proyector 2"]);
    expect(await almacen.listar("otra_coleccion")).toEqual([]);
    await almacen.borrar("prestamos_equipos", "pc-07");
    expect(await almacen.obtener("prestamos_equipos", "pc-07")).toBeUndefined();
  });

  it("lo que devuelve es una copia: cambiarlo no cambia lo guardado", async () => {
    const almacen = crear();
    await almacen.guardar("c", "1", { nombre: "A", prestado: false });
    const leido = await almacen.obtener<Equipo>("c", "1");
    if (leido) leido.prestado = true;
    expect(await almacen.obtener<Equipo>("c", "1")).toEqual({ nombre: "A", prestado: false });
  });

  it("la transacción escribe al final y devuelve su resultado", async () => {
    const almacen = crear();
    await almacen.guardar("c", "1", { nombre: "A", prestado: false });
    const resultado = await almacen.transaccion(async (tx) => {
      const equipo = await tx.obtener<Equipo>("c", "1");
      if (!equipo || equipo.prestado) return "ya prestado";
      tx.guardar("c", "1", { ...equipo, prestado: true });
      return "prestado";
    });
    expect(resultado).toBe("prestado");
    expect(await almacen.obtener<Equipo>("c", "1")).toEqual({ nombre: "A", prestado: true });
  });

  it("si el trabajo falla, la transacción no escribe nada", async () => {
    const almacen = crear();
    await expect(
      almacen.transaccion((tx) => {
        tx.guardar("c", "1", { nombre: "A" });
        return Promise.reject(new Error("falla"));
      }),
    ).rejects.toThrow("falla");
    expect(await almacen.obtener("c", "1")).toBeUndefined();
  });
});

describe("almacén en memoria", () => {
  it("dos transacciones a la vez no prestan dos veces el mismo equipo", async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardar("c", "1", { nombre: "A", prestado: false });
    const prestar = () =>
      almacen.transaccion(async (tx) => {
        const equipo = await tx.obtener<Equipo>("c", "1");
        await new Promise((r) => setTimeout(r, 5));
        if (!equipo || equipo.prestado) return false;
        tx.guardar("c", "1", { ...equipo, prestado: true });
        return true;
      });
    const resultados = await Promise.all([prestar(), prestar()]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });
});
