/**
 * Periodični uvoz vremena i vazduha u bazu dok MCP server radi (samo kad je EKONET_IZVOR=baza).
 * Tako su podaci sveži bez ručnog `npm run baza:uvoz`. Interval: BAZA_UVOZ_MIN (podrazumevano 30, 0 = isključeno).
 * Greška uvoza ne obara server: ispiše se i pokuša ponovo u sledećem krugu.
 */
import { poveziVezu } from "../core/baza/index.js";
import { tekstIshoda, uvoziSve } from "../core/baza/uvoz/index.js";

type Okruzenje = Readonly<Record<string, string | undefined>>;

export const PODRAZUMEVANI_INTERVAL_MIN = 30;

/** Interval u minutima ili `null` kad uvoz ne treba (drugi izvor ili 0). */
export function intervalUvoza(env: Okruzenje): number | null {
  if (env.EKONET_IZVOR?.trim() !== "baza") return null;
  const tekst = env.BAZA_UVOZ_MIN?.trim();
  if (!tekst) return PODRAZUMEVANI_INTERVAL_MIN;
  const n = Number(tekst);
  if (!Number.isFinite(n) || n < 0) return PODRAZUMEVANI_INTERVAL_MIN;
  return n === 0 ? null : Math.max(5, n);
}

export function pokreniPeriodicniUvoz(env: Okruzenje = process.env): void {
  const min = intervalUvoza(env);
  if (min === null) return;

  let radi = false;
  const krug = async () => {
    if (radi) return;
    radi = true;
    try {
      const veza = await poveziVezu(env);
      try {
        const ishodi = await uvoziSve(veza.izvrsi);
        console.log(`[uvoz] ${ishodi.map(tekstIshoda).join(" · ")}`);
      } finally {
        await veza.zatvori();
      }
    } catch (e) {
      console.error(`[uvoz] nije uspeo: ${e instanceof Error ? e.message : "greška"}`);
    } finally {
      radi = false;
    }
  };

  console.log(`[uvoz] vreme i vazduh iz javnih izvora: odmah, pa na svakih ${min} min`);
  void krug();
  setInterval(() => void krug(), min * 60_000).unref();
}
