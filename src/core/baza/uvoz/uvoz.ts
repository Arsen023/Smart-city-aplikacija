/**
 * Uvoz vremena i kvaliteta vazduha iz javnih izvora u bazu: `npm run baza:uvoz`.
 * Preduslov: db/01-sema.sql i db/03-vazduh-vreme.sql pokrenuti, DATABASE_URL u .env.
 *
 * Izvori ne traže ključ. Može se pokretati više puta – istorija se puni, duplikata nema.
 * Kad je EKONET_IZVOR=baza, MCP server ovo radi sam, periodično (BAZA_UVOZ_MIN).
 */
import { GreskaBaze, poveziVezu } from "../index.js";
import { tekstIshoda, uvoziSve } from "./index.js";

try {
  process.loadEnvFile();
} catch {
  // bez .env: DATABASE_URL mora biti u okruženju
}

async function main() {
  const veza = await poveziVezu();
  try {
    const ishodi = await uvoziSve(veza.izvrsi);
    for (const r of ishodi) (r.ok ? console.log : console.error)(tekstIshoda(r));
    if (ishodi.some((r) => !r.ok)) process.exitCode = 1;
  } finally {
    await veza.zatvori();
  }
}

main().catch((e: unknown) => {
  const poruka = e instanceof GreskaBaze ? e.message : "Uvoz nije uspeo.";
  const uzrok = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
  console.error(`${poruka}${uzrok}`);
  process.exitCode = 1;
});
