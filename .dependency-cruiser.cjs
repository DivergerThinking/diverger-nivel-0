// Reglas de dependencias entre bounded contexts (ADR 0003 del harness): cada contexto vive en
// src/<id> y los demás solo pueden importar su index.ts. El servidor (app/) y el frontend (web/)
// tampoco entran en lo interno de un contexto.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "solo-index-de-otro-contexto",
      severity: "error",
      comment: "Un contexto solo puede importar el index.ts de otro contexto.",
      from: { path: "^src/([^/]+)/" },
      to: { path: "^src/([^/]+)/", pathNot: ["^src/$1/", "^src/[^/]+/index[.]ts$"] },
    },
    {
      name: "app-y-web-solo-por-index",
      severity: "error",
      comment: "app/ y web/ solo usan un contexto a través de su index.ts.",
      from: { path: "^(app|web)/" },
      to: { path: "^src/[^/]+/", pathNot: "^src/[^/]+/index[.]ts$" },
    },
    {
      name: "contextos-sin-app-ni-web",
      severity: "error",
      comment: "Un contexto no depende del servidor ni del frontend.",
      from: { path: "^src/" },
      to: { path: "^(app|web)/" },
    },
    {
      name: "lib-compartida",
      severity: "error",
      comment: "lib/ es código común sin negocio: no depende de app/, web/ ni de ningún contexto.",
      from: { path: "^lib/" },
      to: { path: "^(app|web|src)/" },
    },
    {
      name: "datos-solo-por-el-puerto",
      severity: "error",
      comment:
        "Los contextos, el servidor y el frontend no usan el cliente de la base: los datos van por el puerto de lib/datos.ts, y solo su adaptador (lib/firestore.ts) conoce la base (HU-GP-01).",
      from: { path: "^(src|app|web)/" },
      to: { path: "node_modules/@google-cloud/firestore" },
    },
    {
      name: "sin-ciclos",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "[.]test[.]tsx?$" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js"] },
  },
};
