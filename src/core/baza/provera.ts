/**
 * Provera veze sa bazom: `npm run baza:provera`.
 * Čita DATABASE_URL iz .env, ispisuje broj merenja, uređaje i poslednje merenje. Ništa ne menja.
 */
import { GreskaBaze, poveziBazu } from "./index.js";

try {
  process.loadEnvFile();
} catch {
  // bez .env: DATABASE_URL mora biti u okruženju
}

async function main() {
  const baza = await poveziBazu();
  try {
    const p = await baza.pregled();
    console.log(`Veza sa bazom radi. Merenja: ${p.brojMerenja}, od ${p.od ?? "—"} do ${p.do ?? "—"}.`);
    for (const u of await baza.uredjaji()) {
      const m = await baza.poslednjeMerenje(u.id);
      console.log(`- ${u.naziv} (${u.id}): poslednje merenje ${m ? m.vreme : "nema"}`);
    }
  } finally {
    await baza.zatvori();
  }
}

main().catch((e: unknown) => {
  const poruka = e instanceof GreskaBaze ? e.message : "Veza sa bazom nije uspela.";
  const uzrok = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
  console.error(`${poruka}${uzrok}`);
  process.exitCode = 1;
});
