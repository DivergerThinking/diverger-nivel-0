import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El frontend vive en web/ y se construye en dist/web, que sirve el propio servidor.
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist/web", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:8080" } },
});
