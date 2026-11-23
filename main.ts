// Učitaj .env (Node ugrađeno, bez paketa). Bez .env važe podrazumevane vrednosti (demo, s1-dobar).
// Napomena: ESM `import`-i ispod se izvrše pre ovog koda, ali nijedan modul ne čita
// process.env pri učitavanju – samo pri pozivu alata – pa .env stiže na vreme. PORT se čita niže.
try {
  process.loadEnvFile();
} catch (e) {
  const kod = (e as NodeJS.ErrnoException).code;
  if (kod !== "ENOENT") console.error(".env nije učitan:", e instanceof Error ? e.message : e);
}

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { pokreniPeriodicniUvoz } from "./src/server/periodicni-uvoz.js";
import { createServer } from "./src/server/server.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

const app = createMcpExpressApp({ host: "0.0.0.0" });
app.use(cors());

app.all("/mcp", async (req: Request, res: Response) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.listen(PORT, (err?: Error) => {
  if (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
  console.log(`MCP server listening on http://localhost:${PORT}/mcp`);
  // EKONET_IZVOR=baza: vreme i vazduh se periodično uvoze u bazu (src/server/periodicni-uvoz.ts)
  pokreniPeriodicniUvoz();
});