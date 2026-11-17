import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// UI=ui-a ili UI=ui-b: koji prikaz se pakuje u jedan HTML fajl.
const UI = process.env.UI;
if (UI !== "ui-a" && UI !== "ui-b") {
  throw new Error('Postavi promenljivu UI na "ui-a" ili "ui-b"');
}

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "src", UI),
  plugins: [viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    // Rezultat: dist/ui-a/index.html ili dist/ui-b/index.html
    outDir: path.resolve(import.meta.dirname, "dist", UI),
    emptyOutDir: true,
  },
});
