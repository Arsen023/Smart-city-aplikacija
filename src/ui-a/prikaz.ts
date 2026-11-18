/**
 * Šta ekran A prikazuje za dato stanje – čista funkcija, bez DOM-a (testira se sa node --test).
 *
 * Ovde nema pravila ni pragova (pravila 1 i 4): kategorija, savet i poruke dolaze od servera,
 * a ova funkcija samo bira šta se vidi za koji status.
 */
import type { Rezultat, Status, Velicina } from "../core/tipovi.js";
import { JEDINICA_PM } from "../core/tipovi.js";
import { prikazDatumVreme } from "../core/vreme.js";
import { bojeKategorije } from "../zajednicko/boje-eaqi.js";
import { tekstVrednosti } from "../zajednicko/format.js";

export type StanjeEkrana =
  | { vrsta: "ucitavanje" }
  | { vrsta: "rezultat"; rezultat: Rezultat }
  /** Poziv alata nije uspeo, `isError`, ili structuredContent nije ispravnog oblika. */
  | { vrsta: "greska"; poruka?: string; stanica?: { id: string; naziv: string } };

export interface ModelEkrana {
  stanje: "ucitavanje" | Status;
  naslov: string;
  /** Id stanice koja se prikazuje (za izbor i „Osveži“), `null` ako nije poznat. */
  stanicaId: string | null;
  /** Element 2: "PM2.5 12,4 µg/m³", "PM10 nije dostupno". `null` = ne prikazuje se. */
  vrednosti: string[] | null;
  /** Element 3: "Merenje: 16.11.2026. 09:00". TODO(T10/zajednicko): dodati „pre X min“ kad protekloVreme() pređe u src/zajednicko/. */
  vreme: string | null;
  /** Element 4: boja + naziv (nikad samo boja). */
  kategorija: { naziv: string; opis: string; pozadina: string; tekst: string } | null;
  napomena: string | null;
  /** Poruka za stale / no_data / error, ili zašto nema saveta (S5). */
  poruka: string | null;
  savet: string | null;
  osnov: string | null;
  pravilo: string | null;
  pokusajPonovo: boolean;
}

export const PORUKA_UCITAVANJE = "Učitavanje…";
export const PORUKA_GRESKA = "Podaci trenutno nisu dostupni. Pokušajte ponovo kasnije.";
const PORUKA_BEZ_PREPORUKE = "Ne dajemo preporuku.";
const PORUKA_BEZ_SAVETA = "Savet trenutno nije dostupan.";

const NASLOV = "Kvalitet vazduha";
const VELICINE: readonly Velicina[] = ["PM2.5", "PM10"];

const prazno: Omit<ModelEkrana, "stanje" | "naslov" | "stanicaId"> = {
  vrednosti: null,
  vreme: null,
  kategorija: null,
  napomena: null,
  poruka: null,
  savet: null,
  osnov: null,
  pravilo: null,
  pokusajPonovo: false,
};

const naslov = (naziv: string | undefined) => (naziv ? `${NASLOV} – ${naziv}` : NASLOV);

/** Obe praćene veličine, redom; ako server ne pošalje neku, ona je „nije dostupno“, nikad 0. */
function vrednosti(r: Rezultat): string[] {
  return VELICINE.map((velicina) =>
    tekstVrednosti(r.values.find((v) => v.velicina === velicina) ?? { velicina, vrednost: null, jedinica: JEDINICA_PM }),
  );
}

export function modelEkrana(s: StanjeEkrana): ModelEkrana {
  if (s.vrsta === "ucitavanje") {
    return { ...prazno, stanje: "ucitavanje", naslov: NASLOV, stanicaId: null, poruka: PORUKA_UCITAVANJE };
  }
  if (s.vrsta === "greska") {
    return {
      ...prazno,
      stanje: "error",
      naslov: naslov(s.stanica?.naziv),
      stanicaId: s.stanica?.id || null,
      poruka: s.poruka ?? PORUKA_GRESKA,
      pokusajPonovo: true,
    };
  }

  const r = s.rezultat;
  const osnovno = { stanje: r.status, naslov: naslov(r.station.naziv), stanicaId: r.station.id || null };

  if (r.status === "error") {
    return { ...prazno, ...osnovno, poruka: r.message ?? PORUKA_GRESKA, pokusajPonovo: true };
  }

  const vreme = r.measuredAt
    ? `Merenje: ${prikazDatumVreme(new Date(r.measuredAt))}`
    : r.status === "no_data"
      ? "Merenje: nema podataka"
      : null;

  if (r.status === "no_data") {
    return { ...prazno, ...osnovno, vreme, poruka: r.message ?? PORUKA_BEZ_PREPORUKE };
  }

  // Kategorija i savet samo za "ok" (pravilo 2), i kad bi ulaz bio nedosledan.
  const ok = r.status === "ok" && r.category !== null;
  const kategorija =
    ok && r.category
      ? { naziv: r.category.naziv, opis: `Određuje ${r.category.odredjujuca}`, ...bojeKategorije(r.category.nivo) }
      : null;
  const advice = ok ? r.advice : null;

  return {
    ...prazno,
    ...osnovno,
    vrednosti: vrednosti(r),
    vreme,
    kategorija,
    napomena: ok ? r.napomena : null,
    poruka: ok ? (advice ? null : (r.message ?? PORUKA_BEZ_SAVETA)) : (r.message ?? PORUKA_BEZ_PREPORUKE),
    savet: advice?.savet ?? null,
    osnov: advice ? `Osnov: ${advice.osnov}` : null,
    pravilo: ok && r.rule ? `Pravilo: ${r.rule}` : null,
  };
}

/** Kratak tekst za updateModelContext: šta korisnik trenutno gleda. */
export function tekstZaModel(m: ModelEkrana): string {
  const delovi = [`Korisnik gleda ekran „${m.naslov}“.`];
  if (m.vrednosti) delovi.push(`${m.vrednosti.join(", ")}.`);
  if (m.vreme) delovi.push(`${m.vreme}.`);
  if (m.kategorija) delovi.push(`Kategorija: ${m.kategorija.naziv}.`);
  else delovi.push(`Status: ${m.stanje}.`);
  if (m.poruka && m.stanje !== "ok") delovi.push(m.poruka);
  return delovi.join(" ");
}
