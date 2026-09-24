import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

declare const process: { cwd(): string };
const srcPath = `${process.cwd().replace(/\\/g, "/")}/src`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": srcPath } },
  server: { port: 5173 },
});
