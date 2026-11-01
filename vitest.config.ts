import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: "servidor", environment: "node", include: ["app/**/*.test.ts", "src/**/*.test.ts", "test/**/*.test.ts"], testTimeout: 60000 },
      },
      {
        extends: true,
        test: { name: "web", environment: "jsdom", include: ["web/**/*.test.tsx"] },
      },
    ],
  },
});
