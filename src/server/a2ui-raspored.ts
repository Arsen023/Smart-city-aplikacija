/**
 * Verzija B – raspored ekrana koji sastavlja AI po želji korisnika („prikaži mi samo grafikon“).
 *
 * AI ne piše sirov A2UI. Piše pojednostavljen opis rasporeda (Kolona, Red, Kartica, Tekst,
 * Kategorija, Grafikon, Razdelnik), a ovaj modul ga PROVERAVA i DETERMINISTIČKI prevodi u A2UI.
 *
 * Bezbednost i pravila koja se ne krše:
 * - AI bira samo raspored i komponente. Vrednosti dolaze iz data modela preko `path` (pravila 1, 7).
 * - Statički tekst (naslovi) ne sme da sadrži cifre – AI ne može da upiše nijedan broj.
 * - Dozvoljene su samo komponente iz liste i samo poznate putanje podataka.
 * - Savet uvek ide uz osnov (FR-11); „Osveži“ se uvek dodaje (FR-15) – to radi a2ui.ts.
 * Ako bilo šta ne prođe proveru, koristi se fiksni ekran.
 */
import { z } from "zod";
import { KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA, PUTANJE_PODATAKA } from "../zajednicko/a2ui-katalog.js";

/** Putanje podataka koje AI sme da prikaže (zajedničke sa chatom, src/zajednicko/a2ui-katalog.ts). */
export const PUTANJE = PUTANJE_PODATAKA;


export const TIPOVI = ["Kolona", "Red", "Kartica", "Tekst", "Kategorija", "Grafikon", "Razdelnik"] as const;
export const STILOVI = ["h1", "h2", "h3", "h4", "h5", "body", "caption"] as const;
const RASPOREDI = ["start", "center", "end", "spaceBetween", "spaceAround"] as const;

export const MAX_KOMPONENTI = 40;
export const MAX_STATICKOG_TEKSTA = 60;

const IdSema = z.string().regex(/^[a-z][a-z0-9-]{0,29}$/);

const AiKomponentaSema = z
  .object({
    id: IdSema,
    tip: z.enum(TIPOVI),
    deca: z.array(IdSema).max(12).optional(),
    dete: IdSema.optional(),
    podatak: z.string().optional(),
    tekst: z.string().optional(),
    stil: z.enum(STILOVI).optional(),
    raspored: z.enum(RASPOREDI).optional(),
  })
  .strict();

export const AiRasporedSema = z
  .object({
    koren: IdSema,
    komponente: z.array(AiKomponentaSema).min(1).max(MAX_KOMPONENTI),
  })
  .strict();

export type AiRaspored = z.infer<typeof AiRasporedSema>;
type AiKomponenta = z.infer<typeof AiKomponentaSema>;

/** A2UI komponenta (isti oblik kao u a2ui.ts). */
export type Komponenta = { id: string; component: string } & Record<string, unknown>;

export type IshodRasporeda =
  | { ok: true; koren: string; komponente: Komponenta[]; koristiSavet: boolean; koristiOsnov: boolean }
  | { ok: false; razlog: string };

const PREFIKS = "ai-";

function decaOd(k: AiKomponenta): string[] {
  if (k.tip === "Kolona" || k.tip === "Red") return k.deca ?? [];
  if (k.tip === "Kartica") return k.dete ? [k.dete] : [];
  return [];
}

/** Proverava opis rasporeda koji je napisao AI. Ne baca izuzetak. */
export function proveriRaspored(ulaz: unknown): IshodRasporeda {
  const p = AiRasporedSema.safeParse(ulaz);
  if (!p.success) return { ok: false, razlog: "opis nije u dozvoljenom obliku" };
  const { koren, komponente } = p.data;

  const poId = new Map<string, AiKomponenta>();
  for (const k of komponente) {
    if (poId.has(k.id)) return { ok: false, razlog: `dupli id ${k.id}` };
    poId.set(k.id, k);
  }
  if (!poId.has(koren)) return { ok: false, razlog: "koren ne postoji" };

  for (const k of komponente) {
    if (k.tip === "Kartica" && !k.dete) return { ok: false, razlog: `kartica ${k.id} nema dete` };
    if ((k.tip === "Kolona" || k.tip === "Red") && !(k.deca && k.deca.length)) {
      return { ok: false, razlog: `${k.id} nema decu` };
    }
    for (const d of decaOd(k)) if (!poId.has(d)) return { ok: false, razlog: `${k.id} upućuje na nepostojeće ${d}` };

    if (k.tip === "Tekst") {
      const imaPodatak = k.podatak !== undefined;
      const imaTekst = k.tekst !== undefined;
      if (imaPodatak === imaTekst) return { ok: false, razlog: `tekst ${k.id} mora imati ili podatak ili tekst` };
      if (imaPodatak && !(k.podatak! in PUTANJE)) return { ok: false, razlog: `nepoznata putanja ${k.podatak}` };
      if (imaTekst) {
        const t = k.tekst!.trim();
        if (!t || t.length > MAX_STATICKOG_TEKSTA) return { ok: false, razlog: `tekst ${k.id} je prazan ili predugačak` };
        if (/\d/.test(t)) return { ok: false, razlog: `tekst ${k.id} sadrži broj` };
      }
    } else if (k.podatak !== undefined || k.tekst !== undefined) {
      return { ok: false, razlog: `${k.id} (${k.tip}) ne sme da ima podatak ni tekst` };
    }
  }

  // Stablo: svaka komponenta je dostupna iz korena tačno jednom, bez ciklusa.
  const posecene = new Set<string>();
  const stek = [koren];
  while (stek.length) {
    const id = stek.pop() as string;
    if (posecene.has(id)) return { ok: false, razlog: `komponenta ${id} se koristi više puta ili postoji ciklus` };
    posecene.add(id);
    stek.push(...decaOd(poId.get(id) as AiKomponenta));
  }

  // Prevod u A2UI (samo komponente dostupne iz korena).
  const a2ui: Komponenta[] = [];
  let koristiSavet = false;
  let koristiOsnov = false;
  for (const id of posecene) {
    const k = poId.get(id) as AiKomponenta;
    const aiId = PREFIKS + k.id;
    const deca = decaOd(k).map((d) => PREFIKS + d);
    switch (k.tip) {
      case "Kolona":
        a2ui.push({ id: aiId, component: "Column", children: deca });
        break;
      case "Red":
        a2ui.push({ id: aiId, component: "Row", children: deca, justify: k.raspored ?? "start", align: "center" });
        break;
      case "Kartica":
        a2ui.push({ id: aiId, component: "Card", child: deca[0] });
        break;
      case "Razdelnik":
        a2ui.push({ id: aiId, component: "Divider" });
        break;
      case "Kategorija":
        a2ui.push({
          id: aiId,
          component: KOMPONENTA_KATEGORIJA,
          naziv: { path: "/kategorija/naziv" },
          nivo: { path: "/kategorija/nivo" },
        });
        break;
      case "Grafikon":
        a2ui.push({ id: aiId, component: KOMPONENTA_GRAFIKON, tacke: { path: "/istorija" }, jedinica: "µg/m³" });
        break;
      case "Tekst":
        if (k.podatak === "/savet") koristiSavet = true;
        if (k.podatak === "/osnov") koristiOsnov = true;
        a2ui.push({
          id: aiId,
          component: "Text",
          text: k.podatak ? { path: k.podatak } : k.tekst!.trim(),
          variant: k.stil ?? "body",
        });
        break;
    }
  }

  return { ok: true, koren: PREFIKS + koren, komponente: a2ui, koristiSavet, koristiOsnov };
}

// ─── Prompt za AI ───────────────────────────────────────────────────────────

export function promptRasporeda(zelja: string): { sistem: string; korisnik: string } {
  const putanje = Object.entries(PUTANJE)
    .map(([p, opis]) => `  ${p} – ${opis}`)
    .join("\n");
  const sistem = `Ti sastavljaš raspored ekrana za aplikaciju o kvalitetu vazduha, po želji korisnika.
Ne pišeš vrednosti – samo biraš komponente i gde idu. Podaci se vezuju preko putanja.

Komponente (polje "tip"):
- "Kolona": elementi jedan ispod drugog. Polje "deca": lista id-jeva.
- "Red": elementi jedan pored drugog. Polje "deca": lista id-jeva. Opciono "raspored": start | center | end | spaceBetween | spaceAround.
- "Kartica": okvir oko jednog elementa. Polje "dete": jedan id (za više elemenata stavi Kolonu u Karticu).
- "Tekst": ILI "podatak" (jedna od putanja ispod) ILI "tekst" (kratak naslov, najviše ${MAX_STATICKOG_TEKSTA} znakova, BEZ cifara). Opciono "stil": h1 | h2 | h3 | h4 | h5 | body | caption.
- "Kategorija": značka sa kategorijom kvaliteta vazduha (boja i naziv). Bez dodatnih polja.
- "Grafikon": grafikon PM2.5 i PM10 za poslednja 24 h. Bez dodatnih polja.
- "Razdelnik": horizontalna linija.

Putanje podataka:
${putanje}

Pravila:
- Odgovori ISKLJUČIVO JSON objektom: {"koren": "<id>", "komponente": [ ... ]}.
- id: mala slova, cifre i crtice, počinje slovom (npr. "glavna", "red-pm").
- Svaka komponenta se koristi tačno jednom; koren je obično "Kolona".
- Najviše ${MAX_KOMPONENTI} komponenti.
- Nikad ne upisuj brojeve u "tekst" – brojevi dolaze samo preko putanja.
- Ako prikazuješ /savet, prikaži i /osnov.
- Prikaži ono što korisnik traži; ako nije jasno, napravi pregledan ekran sa kategorijom, vrednostima i savetom.

Primer za želju „samo kategorija i grafikon“:
{"koren":"glavna","komponente":[
 {"id":"glavna","tip":"Kolona","deca":["naslov","kat","graf"]},
 {"id":"naslov","tip":"Tekst","podatak":"/stanica","stil":"h3"},
 {"id":"kat","tip":"Kategorija"},
 {"id":"graf","tip":"Grafikon"}]}`;
  return { sistem, korisnik: `Želja korisnika za prikaz: ${zelja}` };
}
