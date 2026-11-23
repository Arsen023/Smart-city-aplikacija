/// <reference types="vite/client" />
/**
 * Kontrolna tabla (dashboard) pored chata: kartice, mapa senzora, prognoza i grafikoni.
 *
 * Podatke daje MCP alat `get_dashboard` (isti server kao chat), pa stranica ništa ne računa:
 * kategoriju je izračunao modul pravila na serveru (pravilo 1), a ovde se samo crta.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { bojeKategorije, EAQI_BOJE } from "../../zajednicko/boje-eaqi.js";
import { esc, fmt, linijskiGrafikon, miniLinija, stubicastiGrafikon, type Tacka } from "./grafikoni.js";

// ─── Oblik odgovora get_dashboard (src/server/dashboard-alati.ts) ───────────

interface Kategorija {
  naziv: string;
  nivo: number;
}
interface SatVazduha {
  vreme: string;
  pm25: number | null;
  pm10: number | null;
  nivo: number | null;
}
interface Vazduh {
  stanica: { id: string; naziv: string };
  status: string;
  measuredAt: string | null;
  category: Kategorija | null;
  pm25: number | null;
  pm10: number | null;
  message: string | null;
  istorija: SatVazduha[];
}
interface Senzor {
  id: string;
  naziv: string;
  lat: number;
  lon: number;
  vrsta: "model" | "senzor";
  status: string;
  category: Kategorija | null;
  pm25: number | null;
  pm10: number | null;
  measuredAt: string | null;
}
interface SatVremena {
  vreme: string;
  temperaturaC: number | null;
  vlaznostProc: number | null;
  vetarKmh: number | null;
  padavineMm: number | null;
  opis: string;
  ikona: string;
}
interface Vreme {
  trenutno: SatVremena | null;
  prognoza: SatVremena[];
  protekla24h: SatVremena[];
}
interface MerenjeVode {
  vreme: string;
  temperaturaC: number | null;
  ph: number | null;
  dox: number | null;
  doxZasicenje: number | null;
}
interface Voda {
  uredjaj: { id: string; naziv: string };
  poslednje: MerenjeVode | null;
  istorija: MerenjeVode[];
}
export interface Dashboard {
  azurirano: string;
  vazduh: Vazduh | null;
  senzori: Senzor[];
  vreme: Vreme | null;
  voda: Voda | null;
  greske: string[];
}

export type PozoviAlat = (ime: string, argumenti: Record<string, unknown>) => Promise<{ structuredContent?: unknown; isError?: boolean }>;

function jeDashboard(x: unknown): x is Dashboard {
  const d = x as Partial<Dashboard> | null;
  return !!d && typeof d.azurirano === "string" && Array.isArray(d.senzori) && Array.isArray(d.greske);
}

// ─── Formatiranje ───────────────────────────────────────────────────────────

const ZONA = "Europe/Belgrade";
const datumVreme = (iso: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("sr-Latn", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month}.${p.year}. ${p.hour}:${p.minute}`;
};
const sat = (iso: string) =>
  new Intl.DateTimeFormat("sr-Latn", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const dan = (iso: string) =>
  new Intl.DateTimeFormat("sr-Latn", { timeZone: ZONA, day: "2-digit", month: "2-digit" }).format(new Date(iso));

/** Vrednost sa jedinicom ili „nije dostupno“ (pravilo 5: nikad 0). */
const vr = (n: number | null | undefined, jed = "") => (n === null || n === undefined ? "nije dostupno" : `${fmt(n)}${jed}`);

const NEMA_BOJE = "#94a3b8";
const boja = (k: Kategorija | null) => (k ? (EAQI_BOJE[k.nivo] ?? NEMA_BOJE) : NEMA_BOJE);

function bedz(k: Kategorija | null, rezerva: string): string {
  if (!k) return `<span class="bedz bez">${esc(rezerva)}</span>`;
  const b = bojeKategorije(k.nivo);
  return `<span class="bedz" style="background:${b.pozadina};color:${b.tekst}">${esc(k.naziv)}</span>`;
}

// ─── Delovi table ───────────────────────────────────────────────────────────

function kartica(o: { ikona: string; tonIkone: string; naslov: string; vrednost: string; ispod: string; mini: string }): string {
  return `<article class="stat">
    <div class="stat-ikona" style="background:${o.tonIkone}">${o.ikona}</div>
    <div class="stat-telo">
      <h3>${esc(o.naslov)}</h3>
      <div class="stat-vrednost">${o.vrednost}</div>
      <p class="stat-ispod">${o.ispod}</p>
    </div>
    <div class="stat-mini">${o.mini}</div>
  </article>`;
}

function kartice(d: Dashboard): string {
  const a = d.vazduh;
  const t = d.vreme?.trenutno ?? null;
  const prosla = d.vreme?.protekla24h ?? [];
  const voda = d.voda?.poslednje ?? null;

  const vazduhKartica = kartica({
    ikona: "💨",
    tonIkone: "#e0f2fe",
    naslov: "Kvalitet vazduha",
    vrednost: a ? bedz(a.category, a.status === "stale" ? "Zastareli podaci" : "Nema procene") : `<span class="nedostupno">nije dostupno</span>`,
    ispod: a
      ? a.category
        ? `PM2.5 ${esc(vr(a.pm25))} · PM10 ${esc(vr(a.pm10))} µg/m³`
        : esc(a.message ?? "Nema preporuke.")
      : "Vazduh nije dostupan.",
    mini: a ? miniLinija(a.istorija.map((h) => h.pm25), "#0ea5e9") : "",
  });

  const temperatura = kartica({
    ikona: "🌡️",
    tonIkone: "#ffedd5",
    naslov: "Temperatura",
    vrednost: t?.temperaturaC != null ? `${fmt(t.temperaturaC)}<small> °C</small>` : `<span class="nedostupno">nije dostupno</span>`,
    ispod: t ? `${t.ikona} ${esc(t.opis)}` : "Vreme nije dostupno.",
    mini: miniLinija(prosla.map((h) => h.temperaturaC), "#f97316"),
  });

  const vlaznost = kartica({
    ikona: "💧",
    tonIkone: "#ede9fe",
    naslov: "Vlažnost vazduha",
    vrednost: t?.vlaznostProc != null ? `${fmt(t.vlaznostProc)}<small> %</small>` : `<span class="nedostupno">nije dostupno</span>`,
    ispod: t ? `Vetar ${esc(vr(t.vetarKmh, " km/h"))}` : "Vreme nije dostupno.",
    mini: miniLinija(prosla.map((h) => h.vlaznostProc), "#8b5cf6"),
  });

  const vodaKartica = kartica({
    ikona: "🌊",
    tonIkone: "#dbeafe",
    naslov: "Kvalitet vode",
    vrednost: voda ? `${esc(vr(voda.dox))}<small> mg/L O₂</small>` : `<span class="nedostupno">nije dostupno</span>`,
    ispod: voda
      ? `pH ${esc(vr(voda.ph))} · ${esc(vr(voda.temperaturaC, " °C"))} · ${esc(datumVreme(voda.vreme))}`
      : "Voda nije dostupna.",
    mini: miniLinija((d.voda?.istorija ?? []).map((m) => m.dox), "#2563eb"),
  });

  return `<section class="kartice">${vazduhKartica}${temperatura}${vlaznost}${vodaKartica}</section>`;
}

function prognoza(v: Vreme | null): string {
  const t = v?.trenutno;
  if (!v || !t) return `<section class="panel prognoza"><h2>Vremenska prognoza</h2><p class="prazno">Vreme nije dostupno.</p></section>`;
  const sati = v.prognoza
    .slice(0, 6)
    .map(
      (p) => `<li><span class="sat">${esc(sat(p.vreme))}</span><span class="ik" title="${esc(p.opis)}">${p.ikona}</span><b>${esc(vr(p.temperaturaC, "°"))}</b></li>`,
    )
    .join("");
  return `<section class="panel prognoza">
    <h2>Vremenska prognoza</h2>
    <div class="sada-vreme">
      <span class="ik-velika">${t.ikona}</span>
      <div>
        <div class="temp-velika">${esc(vr(t.temperaturaC))}<small>°C</small></div>
        <div class="opis">${esc(t.opis)}</div>
        <div class="sitno">Vetar ${esc(vr(t.vetarKmh, " km/h"))} · Vlažnost ${esc(vr(t.vlaznostProc, " %"))} · Padavine ${esc(vr(t.padavineMm, " mm"))}</div>
      </div>
    </div>
    <ul class="sati">${sati}</ul>
    <p class="izvor">Izvor: Open-Meteo (model), ${esc(datumVreme(t.vreme))}</p>
  </section>`;
}

type VelicinaVode = "dox" | "ph" | "temperaturaC";
const VELICINE_VODE: Record<VelicinaVode, { naziv: string; jedinica: string; boja: string }> = {
  dox: { naziv: "Kiseonik", jedinica: "mg/L", boja: "#2563eb" },
  ph: { naziv: "pH", jedinica: "pH", boja: "#0891b2" },
  temperaturaC: { naziv: "Temperatura", jedinica: "°C", boja: "#f97316" },
};

function grafikonVode(voda: Voda | null, izabrana: VelicinaVode): string {
  const dugmad = (Object.keys(VELICINE_VODE) as VelicinaVode[])
    .map((k) => `<button type="button" data-voda="${k}" class="${k === izabrana ? "aktivno" : ""}">${VELICINE_VODE[k].naziv}</button>`)
    .join("");
  const v = VELICINE_VODE[izabrana];
  const tacke: Tacka[] = (voda?.istorija ?? []).map((m) => ({ oznaka: sat(m.vreme), vrednost: m[izabrana] }));
  const raspon = voda?.istorija.length ? `${dan(voda.istorija[0]!.vreme)} · ${esc(voda.uredjaj.naziv)}` : "";
  return `<section class="panel">
    <div class="panel-zaglavlje"><h2>🌊 Istorija kvaliteta vode</h2><div class="cipovi">${dugmad}</div></div>
    ${voda ? linijskiGrafikon(tacke, v.boja, v.jedinica, `${v.naziv} vode po vremenu`) : `<p class="prazno">Voda nije dostupna.</p>`}
    <p class="izvor">${raspon ? `Poslednja 24 h merenja (${raspon}).` : ""}</p>
  </section>`;
}

function grafikonVazduha(a: Vazduh | null): string {
  const tacke: Tacka[] = (a?.istorija ?? []).map((h) => ({
    oznaka: sat(h.vreme),
    vrednost: h.pm25,
    boja: h.nivo ? (EAQI_BOJE[h.nivo] ?? NEMA_BOJE) : NEMA_BOJE,
  }));
  return `<section class="panel">
    <div class="panel-zaglavlje"><h2>💨 Kvalitet vazduha u poslednja 24 h</h2><span class="sitno">PM2.5, boja = EAQI kategorija sata</span></div>
    ${a ? stubicastiGrafikon(tacke, "µg/m³", "PM2.5 po satu za poslednja 24 sata") : `<p class="prazno">Vazduh nije dostupan.</p>`}
    <p class="izvor">${a ? esc(a.stanica.naziv) : ""}</p>
  </section>`;
}

// ─── Mapa ───────────────────────────────────────────────────────────────────

let mapa: L.Map | null = null;
let slojSenzora: L.LayerGroup | null = null;

function popupSenzora(s: Senzor): string {
  return `<strong>${esc(s.naziv)}</strong><br>
    ${bedz(s.category, s.status === "stale" ? "Zastareli podaci" : "Nema procene")}<br>
    PM2.5 ${esc(vr(s.pm25))} · PM10 ${esc(vr(s.pm10))} µg/m³<br>
    <span class="sitno">${s.measuredAt ? esc(datumVreme(s.measuredAt)) : "nema merenja"} · ${s.vrsta === "model" ? "model" : "senzor"}</span>`;
}

function legenda(senzori: Senzor[]): string {
  const vidjene = new Map<number, string>();
  for (const s of senzori) if (s.category) vidjene.set(s.category.nivo, s.category.naziv);
  const stavke = [...vidjene.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([nivo, naziv]) => `<li><i style="background:${EAQI_BOJE[nivo] ?? NEMA_BOJE}"></i>${esc(naziv)}</li>`);
  if (senzori.some((s) => !s.category)) stavke.push(`<li><i style="background:${NEMA_BOJE}"></i>Bez procene</li>`);
  stavke.push(`<li><i class="model"></i>Model (Open-Meteo)</li>`);
  return `<ul class="legenda">${stavke.join("")}</ul>`;
}

function nacrtajMapu(senzori: Senzor[]): void {
  const el = document.getElementById("mapa");
  if (!el) return;
  if (!mapa) {
    mapa = L.map(el, { scrollWheelZoom: false }).setView([45.255, 19.845], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    slojSenzora = L.layerGroup().addTo(mapa);
  }
  slojSenzora!.clearLayers();
  for (const s of senzori) {
    const krug = L.circleMarker([s.lat, s.lon], {
      radius: s.vrsta === "model" ? 13 : 9,
      color: s.vrsta === "model" ? "#1e293b" : "#ffffff",
      weight: s.vrsta === "model" ? 2 : 2.5,
      dashArray: s.vrsta === "model" ? "4 3" : undefined,
      fillColor: boja(s.category),
      fillOpacity: 0.9,
    });
    krug.bindPopup(popupSenzora(s));
    krug.bindTooltip(s.naziv);
    slojSenzora!.addLayer(krug);
  }
  const granice = senzori.map((s) => [s.lat, s.lon] as [number, number]);
  if (granice.length > 1) mapa.fitBounds(granice, { padding: [36, 36], maxZoom: 13 });
  // posle promene veličine kontejnera (npr. otvaranje panela) Leaflet mora ponovo da izmeri
  setTimeout(() => mapa?.invalidateSize(), 0);
}

// ─── Glavni tok ─────────────────────────────────────────────────────────────

export function pokreniTablu(koren: HTMLElement, pozovi: PozoviAlat): { osvezi: () => Promise<void> } {
  let podaci: Dashboard | null = null;
  let velicinaVode: VelicinaVode = "dox";

  koren.innerHTML = `
    <header class="tabla-zaglavlje">
      <div>
        <h1>Dobrodošli 👋</h1>
        <p>Pregled vazduha, vremena i vode u Novom Sadu.</p>
      </div>
      <div class="azurirano">
        <span id="azurirano" class="sitno">Učitavanje…</span>
        <button type="button" id="osvezi-tablu" class="krug" title="Osveži podatke" aria-label="Osveži podatke">↻</button>
      </div>
    </header>
    <div id="greske-table" role="status"></div>
    <div id="kartice"></div>
    <div class="red-2">
      <section class="panel mapa-panel" id="sekcija-mapa">
        <div class="panel-zaglavlje"><h2>📍 Mapa senzora</h2><div id="legenda"></div></div>
        <div id="mapa" role="region" aria-label="Mapa senzora kvaliteta vazduha"></div>
      </section>
      <div id="prognoza"></div>
    </div>
    <div class="red-3" id="sekcija-grafikoni">
      <div id="graf-voda"></div>
      <div id="graf-vazduh"></div>
    </div>`;

  const $ = (id: string) => koren.querySelector<HTMLElement>(`#${id}`)!;
  const dugmeOsvezi = $("osvezi-tablu") as HTMLButtonElement;

  function nacrtaj(d: Dashboard) {
    $("azurirano").textContent = `Poslednje ažuriranje: ${datumVreme(d.azurirano)}`;
    $("greske-table").innerHTML = d.greske.length
      ? `<p class="upozorenje">⚠️ ${d.greske.map(esc).join(" · ")}</p>`
      : "";
    $("kartice").innerHTML = kartice(d);
    $("prognoza").innerHTML = prognoza(d.vreme);
    $("graf-voda").innerHTML = grafikonVode(d.voda, velicinaVode);
    $("graf-vazduh").innerHTML = grafikonVazduha(d.vazduh);
    $("legenda").innerHTML = legenda(d.senzori);
    nacrtajMapu(d.senzori);
  }

  $("graf-voda").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-voda]");
    if (!b || !podaci) return;
    velicinaVode = b.dataset.voda as VelicinaVode;
    $("graf-voda").innerHTML = grafikonVode(podaci.voda, velicinaVode);
  });

  async function osvezi() {
    dugmeOsvezi.disabled = true;
    koren.classList.add("ucitava");
    try {
      const r = await pozovi("get_dashboard", {});
      if (r.isError || !jeDashboard(r.structuredContent)) throw new Error("neispravan odgovor");
      podaci = r.structuredContent;
      nacrtaj(podaci);
    } catch {
      $("azurirano").textContent = "Podaci trenutno nisu dostupni.";
      $("greske-table").innerHTML = `<p class="upozorenje">⚠️ Kontrolna tabla nije učitana. Proverite da li radi MCP server (npm start).</p>`;
    } finally {
      dugmeOsvezi.disabled = false;
      koren.classList.remove("ucitava");
    }
  }

  dugmeOsvezi.addEventListener("click", () => void osvezi());
  return { osvezi };
}
