/**
 * K2 – modul pravila. Deterministički, bez LLM-a (FR-07, NFR-02).
 *
 * Tok: validna merenja → satni proseci (6.2) → svežina (6.3) → podindeks po veličini
 * → ukupna kategorija = najlošiji podindeks (6.1).
 */
import type {
  Kategorija,
  Merenje,
  NivoKategorije,
  ProcenaPravila,
  SatnaVrednost,
  Velicina,
} from "../tipovi.js";
import { isoBeograd, prikazKratko } from "../vreme.js";
import {
  EAQI_GORNJE_GRANICE,
  NAZIVI_KATEGORIJA,
  PODRAZUMEVANA_KONFIGURACIJA,
  PRACENE_VELICINE,
  type KonfiguracijaPravila,
} from "./pragovi.js";

const SAT_MS = 3_600_000;

// ─── Podindeks ──────────────────────────────────────────────────────────────

/** EAQI nivo (1–6) za jednu vrednost. Vrednost se zaokružuje na ceo broj kao u EEA tabeli. */
export function podindeks(velicina: Velicina, vrednost: number): NivoKategorije {
  const v = Math.round(vrednost);
  const granice = EAQI_GORNJE_GRANICE[velicina];
  for (let i = 0; i < granice.length; i++) {
    if (v <= granice[i]) return (i + 1) as NivoKategorije;
  }
  return 6;
}

// ─── Satni proseci ──────────────────────────────────────────────────────────

interface SatniProsek {
  velicina: Velicina;
  /** Početak sata (ms od epohe). */
  satMs: number;
  vrednost: number;
  /** Vreme najnovijeg merenja u tom satu. */
  poslednjeMs: number;
}

function jeValidno(m: Merenje): boolean {
  return (
    PRACENE_VELICINE.includes(m.velicina) &&
    typeof m.vrednost === "number" &&
    Number.isFinite(m.vrednost) &&
    m.vrednost >= 0 &&
    Number.isFinite(Date.parse(m.vreme))
  );
}

/** Grupiše merenja po veličini i satu; sat važi ako ima dovoljno merenja (minPokrivenost). */
function satniProseci(merenja: Merenje[], konf: KonfiguracijaPravila): SatniProsek[] {
  const grupe = new Map<string, { velicina: Velicina; satMs: number; zbir: number; broj: number; poslednjeMs: number }>();
  for (const m of merenja) {
    if (!jeValidno(m)) continue;
    const ms = Date.parse(m.vreme);
    const satMs = Math.floor(ms / SAT_MS) * SAT_MS;
    const kljuc = `${m.velicina}|${satMs}`;
    const g = grupe.get(kljuc) ?? { velicina: m.velicina, satMs, zbir: 0, broj: 0, poslednjeMs: ms };
    g.zbir += m.vrednost;
    g.broj += 1;
    g.poslednjeMs = Math.max(g.poslednjeMs, ms);
    grupe.set(kljuc, g);
  }
  const minBroj = Math.ceil(konf.ocekivanihMerenjaPoSatu * konf.minPokrivenost);
  return [...grupe.values()]
    .filter((g) => g.broj >= minBroj)
    .map((g) => ({ velicina: g.velicina, satMs: g.satMs, vrednost: g.zbir / g.broj, poslednjeMs: g.poslednjeMs }))
    .sort((a, b) => a.satMs - b.satMs);
}

/**
 * Satne vrednosti za grafikon (FR-05, FR-06). Sat bez validnog proseka za neku veličinu
 * ima `null` za tu veličinu, nikad 0.
 */
export function satneVrednosti(
  merenja: Merenje[],
  konf: KonfiguracijaPravila = PODRAZUMEVANA_KONFIGURACIJA,
): SatnaVrednost[] {
  const poSatu = new Map<number, SatnaVrednost>();
  for (const p of satniProseci(merenja, konf)) {
    const t = poSatu.get(p.satMs) ?? { vreme: isoBeograd(new Date(p.satMs)), pm25: null, pm10: null };
    const zaokruzeno = Math.round(p.vrednost * 10) / 10;
    if (p.velicina === "PM2.5") t.pm25 = zaokruzeno;
    else t.pm10 = zaokruzeno;
    poSatu.set(p.satMs, t);
  }
  return [...poSatu.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
}

// ─── Procena ────────────────────────────────────────────────────────────────

interface VrednostZaProcenu {
  velicina: Velicina;
  vrednost: number;
  measuredMs: number;
}

/** Vrednost za kategoriju po veličini, prema periodu iz konfiguracije. */
function vrednostZaVelicinu(
  proseci: SatniProsek[],
  velicina: Velicina,
  konf: KonfiguracijaPravila,
): VrednostZaProcenu | null {
  const satni = proseci.filter((p) => p.velicina === velicina);
  const poslednji = satni.at(-1);
  if (!poslednji) return null;

  if (konf.period === "sat") {
    return { velicina, vrednost: poslednji.vrednost, measuredMs: poslednji.poslednjeMs };
  }

  // 24h: prosek satnih vrednosti u 24 sata zaključno sa poslednjim satom
  const od = poslednji.satMs - 23 * SAT_MS;
  const uProzoru = satni.filter((p) => p.satMs >= od);
  if (uProzoru.length < Math.ceil(24 * konf.minPokrivenost)) return null;
  const prosek = uProzoru.reduce((s, p) => s + p.vrednost, 0) / uProzoru.length;
  return { velicina, vrednost: prosek, measuredMs: poslednji.poslednjeMs };
}

function opisPravila(konf: KonfiguracijaPravila): string {
  const period = konf.period === "sat" ? "satne vrednosti" : "24-časovni prosek";
  return `EAQI (EEA 2024), ${period}, najlošiji podindeks`;
}

/**
 * Glavna funkcija modula pravila (tip ProceniFn).
 * `sada` se prosleđuje spolja da bi rezultat bio ponovljiv (demo režim, testovi).
 */
export function proceni(
  merenja: Merenje[],
  sada: Date,
  konf: KonfiguracijaPravila = PODRAZUMEVANA_KONFIGURACIJA,
): ProcenaPravila {
  const rule = opisPravila(konf);
  const proseci = satniProseci(merenja, konf);

  if (proseci.length === 0) {
    return {
      status: "no_data",
      category: null,
      measuredAt: null,
      rule,
      message: "Nema merenja PM2.5 ni PM10 za ovu stanicu. Ne dajemo preporuku.",
      napomena: null,
    };
  }

  const najnovijeMs = Math.max(...proseci.map((p) => p.poslednjeMs));
  const granicaSvezine = sada.getTime() - konf.pragSvezineMinuta * 60_000;

  // Za kategoriju koristimo samo veličine čije je poslednje merenje sveže.
  const vrednosti = PRACENE_VELICINE.map((v) => vrednostZaVelicinu(proseci, v, konf)).filter(
    (v): v is VrednostZaProcenu => v !== null && v.measuredMs >= granicaSvezine,
  );

  if (vrednosti.length === 0) {
    const vreme = new Date(najnovijeMs);
    const zastarelo = najnovijeMs < granicaSvezine;
    return {
      status: zastarelo ? "stale" : "no_data",
      category: null,
      measuredAt: isoBeograd(vreme),
      rule,
      message: zastarelo
        ? `Poslednje merenje je od ${prikazKratko(vreme)}. Ne dajemo preporuku.`
        : "Nema dovoljno merenja za 24-časovni prosek. Ne dajemo preporuku.",
      napomena: null,
    };
  }

  // Najlošiji podindeks; kod istog nivoa prednost ima redosled iz PRACENE_VELICINE.
  let najgora = vrednosti[0];
  let najgoriNivo = podindeks(najgora.velicina, najgora.vrednost);
  for (const v of vrednosti.slice(1)) {
    const n = podindeks(v.velicina, v.vrednost);
    if (n > najgoriNivo) {
      najgora = v;
      najgoriNivo = n;
    }
  }

  const category: Kategorija = {
    naziv: NAZIVI_KATEGORIJA[najgoriNivo],
    nivo: najgoriNivo,
    odredjujuca: najgora.velicina,
  };

  const nedostaju = PRACENE_VELICINE.filter((v) => !vrednosti.some((x) => x.velicina === v));
  const napomena =
    nedostaju.length > 0
      ? `${nedostaju.join(", ")} nije dostupno, kategorija je određena iz ${vrednosti.map((v) => v.velicina).join(", ")}.`
      : null;

  return {
    status: "ok",
    category,
    measuredAt: isoBeograd(new Date(Math.max(...vrednosti.map((v) => v.measuredMs)))),
    rule,
    message: null,
    napomena,
  };
}
