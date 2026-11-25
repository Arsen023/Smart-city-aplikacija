import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// UI bira šta se pakuje u jedan HTML fajl:
//   ui-a, ui-b        – ekrani verzije A i B (MCP App resursi)
//   chat, chat-sandbox – chat aplikacija (naš MCP host) i njen sandbox za ekrane
const KORENI = {
  "ui-a": "src/ui-a",
  "ui-b": "src/ui-b",
  chat: "src/chat/ui",
  "chat-sandbox": "src/chat/sandbox",
} as const;

const UI = process.env.UI;
if (!UI || !(UI in KORENI)) {
  throw new Error(`Postavi promenljivu UI na jedno od: ${Object.keys(KORENI).join(", ")}`);
}
const koren = KORENI[UI as keyof typeof KORENI];

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  root: path.resolve(import.meta.dirname, koren),
  // Ekrani (ui://) moraju biti jedan HTML fajl. Chat stranicu služi naš Express server, pa se pakuje
  // u više fajlova: CopilotKit (verzija B) je poseban deo koji se preuzima tek kad se izabere.
  plugins: UI === "chat" ? [] : [viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    // Rezultat: dist/<UI>/index.html
    outDir: path.resolve(import.meta.dirname, "dist", UI),
    emptyOutDir: true,
  },
});
